/**
 * XHS (小红书) OAuth Worker
 *
 * Routes:
 *   GET  /xhs/callback     — OAuth 回调，换 token 存 D1
 *   GET  /xhs/auth          — 发起授权跳转
 *   GET  /xhs/token/:userId — 查询已存 token
 *   POST /xhs/refresh       — 刷新 token
 *   GET  /xhs/health        — 健康检查
 */

const XHS_AUTH_URL = 'https://customer.xiaohongshu.com/login/oauth/authorize';
const XHS_TOKEN_URL = 'https://customer.xiaohongshu.com/api/oauth/token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/xhs/health') {
        return json({ status: 'ok', time: new Date().toISOString() }, corsHeaders);
      }

      if (path === '/xhs/auth') {
        return handleAuth(url, env);
      }

      if (path === '/xhs/callback') {
        return handleCallback(url, env, corsHeaders);
      }

      if (path.startsWith('/xhs/token/')) {
        const userId = path.split('/xhs/token/')[1];
        return handleGetToken(userId, env, corsHeaders);
      }

      if (path === '/xhs/refresh' && request.method === 'POST') {
        const body = await request.json();
        return handleRefresh(body, env, corsHeaders);
      }

      return json({ error: 'not found' }, corsHeaders, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'internal error', message: err.message }, corsHeaders, 500);
    }
  },
};

/**
 * 发起 OAuth 授权 — 跳转到小红书登录页
 */
function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = `https://${url.host}/xhs/callback`;

  const authUrl = new URL(XHS_AUTH_URL);
  authUrl.searchParams.set('app_key', env.XHS_APP_KEY);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  // authUrl.searchParams.set('scope', 'user_info'); // 按需添加

  return Response.redirect(authUrl.toString(), 302);
}

/**
 * OAuth 回调 — code 换 token，存 D1，跳转前端
 */
async function handleCallback(url, env, corsHeaders) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return json({ error: 'missing code parameter' }, corsHeaders, 400);
  }

  // 用 code 换 access_token
  const redirectUri = `https://${url.host}/xhs/callback`;

  const tokenRes = await fetch(XHS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_key: env.XHS_APP_KEY,
      app_secret: env.XHS_APP_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error || tokenData.error_code) {
    console.error('Token exchange failed:', JSON.stringify(tokenData));
    return json({ error: 'token exchange failed', detail: tokenData }, corsHeaders, 400);
  }

  // 存入 D1
  const userId = tokenData.user_id || tokenData.sub || 'unknown';
  const expiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in || 86400);

  await env.DB.prepare(`
    INSERT INTO oauth_tokens (user_id, access_token, refresh_token, token_type, expires_at, scope)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      updated_at = datetime('now')
  `).bind(
    userId,
    tokenData.access_token,
    tokenData.refresh_token || null,
    tokenData.token_type || 'bearer',
    expiresAt,
    tokenData.scope || null,
  ).run();

  // 跳转前端，带上 user_id（不暴露 token）
  const frontendUrl = new URL(env.FRONTEND_URL || 'https://maplesgedu.com');
  frontendUrl.pathname = '/xhs/success';
  frontendUrl.searchParams.set('user_id', userId);

  return Response.redirect(frontendUrl.toString(), 302);
}

/**
 * 查询 token（内部用，生产环境应加鉴权）
 */
async function handleGetToken(userId, env, corsHeaders) {
  if (!userId) {
    return json({ error: 'missing user_id' }, corsHeaders, 400);
  }

  const row = await env.DB.prepare(
    'SELECT user_id, access_token, refresh_token, expires_at, scope FROM oauth_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row) {
    return json({ error: 'not found' }, corsHeaders, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  return json({
    ...row,
    expired: now > row.expires_at,
  }, corsHeaders);
}

/**
 * 刷新 token
 */
async function handleRefresh(body, env, corsHeaders) {
  const { user_id } = body;

  if (!user_id) {
    return json({ error: 'missing user_id' }, corsHeaders, 400);
  }

  const row = await env.DB.prepare(
    'SELECT refresh_token FROM oauth_tokens WHERE user_id = ?'
  ).bind(user_id).first();

  if (!row || !row.refresh_token) {
    return json({ error: 'no refresh token' }, corsHeaders, 404);
  }

  const tokenRes = await fetch(XHS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_key: env.XHS_APP_KEY,
      app_secret: env.XHS_APP_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error || tokenData.error_code) {
    return json({ error: 'refresh failed', detail: tokenData }, corsHeaders, 400);
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in || 86400);

  await env.DB.prepare(`
    UPDATE oauth_tokens SET
      access_token = ?,
      refresh_token = ?,
      expires_at = ?,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).bind(
    tokenData.access_token,
    tokenData.refresh_token || row.refresh_token,
    expiresAt,
    user_id,
  ).run();

  return json({ status: 'refreshed', expires_at: expiresAt }, corsHeaders);
}

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
