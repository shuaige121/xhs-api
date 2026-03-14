/**
 * XHS 聚光平台 API Gateway Worker
 *
 * 完整的小红书聚光 Marketing API 网关，包含:
 * - OAuth 授权流程 (auth_code → token → refresh)
 * - 投放管理 (计划/单元/创意 CRUD)
 * - 数据报表 (离线/实时，多层级)
 * - 账户服务 (余额/预算/流水/转账)
 * - 素材管理 (笔记/SPU/定向包/否定词)
 * - 工具 (关键词/人群/操作记录)
 *
 * 所有 API 通过 Worker 代理，自动管理 token。
 *
 * 端点路径已从 xhs-ad-console/platforms/xhs_ad_platform.py 验证。
 * API Base: https://adapi.xiaohongshu.com
 * Auth Header: Access-Token
 */

// ============================================================
// 聚光平台端点配置（已验证）
// ============================================================
const XHS_AUTH_URL = 'https://ad-market.xiaohongshu.com/auth';
const XHS_API_BASE = 'https://adapi.xiaohongshu.com';
const SCOPES = ['report_service', 'ad_query', 'ad_manage', 'account_manage'];

// 完整 API 端点映射（硬编码，路径已从 xhs_ad_platform.py 验证）
const ENDPOINTS = {
  // === OAuth（已验证）===
  'oauth.token':           { method: 'POST', path: '/api/open/oauth2/access_token' },
  'oauth.refresh':         { method: 'POST', path: '/api/open/oauth2/refresh_token' },
  'oauth.advertisers':     { method: 'POST', path: '/api/open/oauth2/advertiser/get' },

  // === 投放管理 - 计划（已验证）===
  'campaign.create':       { method: 'POST', path: '/api/open/jg/campaign/create' },
  'campaign.update':       { method: 'POST', path: '/api/open/jg/campaign/update' },
  'campaign.list':         { method: 'POST', path: '/api/open/jg/campaign/list' },
  'campaign.status':       { method: 'POST', path: '/api/open/jg/campaign/status/update' },

  // === 投放管理 - 单元（已验证）===
  'unit.create':           { method: 'POST', path: '/api/open/jg/unit/create' },
  'unit.update':           { method: 'POST', path: '/api/open/jg/unit/update' },
  'unit.list':             { method: 'POST', path: '/api/open/jg/unit/list' },
  'unit.status':           { method: 'POST', path: '/api/open/jg/unit/status/update' },

  // === 投放管理 - 创意（已验证）===
  'creative.create':       { method: 'POST', path: '/api/open/jg/creativity/note/create' },
  'creative.update':       { method: 'POST', path: '/api/open/jg/creativity/update' },
  'creative.search':       { method: 'POST', path: '/api/open/jg/creativity/search' },
  'creative.status':       { method: 'POST', path: '/api/open/jg/creativity/status/update' },

  // === 素材管理 ===
  'note.list':             { method: 'POST', path: '/api/open/jg/note/list' },
  'spu.list':              { method: 'POST', path: '/api/open/jg/spu/list' },
  'target_pack.list':      { method: 'POST', path: '/api/open/jg/target_pack/list' },
  'target_pack.create':    { method: 'POST', path: '/api/open/jg/target_pack/create' },
  'target_pack.update':    { method: 'POST', path: '/api/open/jg/target_pack/update' },
  'target_pack.delete':    { method: 'POST', path: '/api/open/jg/target_pack/delete' },
  'target_pack.bindunit':  { method: 'POST', path: '/api/open/jg/target_pack/bindunit' },
  'negative_word.list':    { method: 'POST', path: '/api/open/jg/negative_word/list' },
  'negative_word.add':     { method: 'POST', path: '/api/open/jg/negative_word/add' },
  'negative_word.delete':  { method: 'POST', path: '/api/open/jg/negative_word/delete' },
  'directlink.list':       { method: 'POST', path: '/api/open/jg/directlink/list' },
  'directlink.create':     { method: 'POST', path: '/api/open/jg/directlink/create' },
  'directlink.delete':     { method: 'POST', path: '/api/open/jg/directlink/delete' },
  'landingpage.list':      { method: 'POST', path: '/api/open/jg/landing_page/list_landing_page' },

  // === 数据报表 - 离线（已验证）===
  'report.offline.account':    { method: 'POST', path: '/api/open/jg/data/report/offline/account' },
  'report.offline.campaign':   { method: 'POST', path: '/api/open/jg/data/report/offline/campaign' },
  'report.offline.unit':       { method: 'POST', path: '/api/open/jg/data/report/offline/unit' },
  'report.offline.creative':   { method: 'POST', path: '/api/open/jg/data/report/offline/creative' },
  'report.offline.keyword':    { method: 'POST', path: '/api/open/jg/data/report/offline/keyword' },
  'report.offline.searchterm': { method: 'POST', path: '/api/open/jg/data/report/offline/search_term' },
  'report.offline.note':       { method: 'POST', path: '/api/open/jg/data/report/offline/note' },
  'report.offline.series':     { method: 'POST', path: '/api/open/jg/data/report/offline/series' },

  // === 数据报表 - 实时（已验证）===
  'report.realtime.account':   { method: 'POST', path: '/api/open/jg/data/report/realtime/account' },
  'report.realtime.campaign':  { method: 'POST', path: '/api/open/jg/data/report/realtime/campaign' },
  'report.realtime.unit':      { method: 'POST', path: '/api/open/jg/data/report/realtime/unit' },
  'report.realtime.creative':  { method: 'POST', path: '/api/open/jg/data/report/realtime/creativity' },
  'report.realtime.keyword':   { method: 'POST', path: '/api/open/jg/data/report/realtime/keyword' },
  'report.realtime.targeting': { method: 'POST', path: '/api/open/jg/data/report/realtime/targeting' },

  // === 账户服务（已验证）===
  'account.budget':        { method: 'POST', path: '/api/open/jg/account/budget/info' },
  'account.budget.update': { method: 'POST', path: '/api/open/jg/account/budget/update' },
  'account.sub.page':      { method: 'POST', path: '/api/open/jg/account/sub/page' },
  'account.flow':          { method: 'POST', path: '/api/open/jg/account/flow/list' },
  'account.campaign_flow': { method: 'POST', path: '/api/open/jg/campaign/flow/list' },
  'account.transfer':      { method: 'POST', path: '/api/open/jg/account/transfer' },
  'account.transfer_result': { method: 'POST', path: '/api/open/jg/account/transfer/result' },
  'account.whitelist':     { method: 'POST', path: '/api/open/jg/white/list' },
  'account.qual':          { method: 'POST', path: '/api/open/jg/data/qual/info' },

  // === 工具（已验证）===
  'tool.history':            { method: 'POST', path: '/api/open/jg/history/list' },
  'tool.keyword.recommend':  { method: 'POST', path: '/api/open/jg/keyword/common/recommend' },
  'tool.keyword.bags':       { method: 'POST', path: '/api/open/jg/keyword/word/bag/list' },
  'tool.keyword.industry':   { method: 'POST', path: '/api/open/jg/keyword/industry/taxonomy' },
  'tool.crowd.estimate':     { method: 'POST', path: '/api/open/jg/crowd/estimate' },
  'tool.target.keyword':     { method: 'POST', path: '/api/open/jg/target/keyword/match' },
  'tool.target.recommend':   { method: 'POST', path: '/api/open/jg/target/keyword/recommend' },
  'tool.target.info':        { method: 'POST', path: '/api/open/jg/target/available/info' },
  'tool.name.check':         { method: 'POST', path: '/api/open/jg/data/name/check' },
  'tool.poi.list':           { method: 'POST', path: '/api/open/jg/data/poi/list' },

  // === 转化追踪 ===
  'conversion.click':       { method: 'POST', path: '/api/open/jg/conversion/click/link' },
  'conversion.leads':       { method: 'POST', path: '/api/open/jg/conversion/leads' },
  'conversion.aurora':      { method: 'POST', path: '/api/open/jg/conversion/aurora/leads' },
};

// ============================================================
// Worker 入口
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Advertiser-Id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // --- 静态路由 ---
      if (path === '/xhs/health') {
        return json({
          status: 'ok',
          time: new Date().toISOString(),
          endpoints: Object.keys(ENDPOINTS).length,
          api_base: XHS_API_BASE,
        }, corsHeaders);
      }

      if (path === '/xhs/endpoints') {
        return json(ENDPOINTS, corsHeaders);
      }

      if (path === '/xhs/auth') {
        return handleAuth(url, env);
      }

      if (path === '/xhs/callback') {
        return handleCallback(url, env, corsHeaders);
      }

      if (path === '/xhs/tokens') {
        return handleListTokens(env, corsHeaders);
      }

      if (path.startsWith('/xhs/token/')) {
        const userId = path.split('/xhs/token/')[1];
        if (request.method === 'POST') {
          return handleRefreshToken(userId, env, corsHeaders);
        }
        return handleGetToken(userId, env, corsHeaders);
      }

      // --- API 代理路由 ---
      // POST /xhs/api/{endpoint_name}  e.g. POST /xhs/api/campaign.list
      if (path.startsWith('/xhs/api/') && request.method === 'POST') {
        const endpointName = path.replace('/xhs/api/', '');
        return handleApiProxy(endpointName, request, env, corsHeaders);
      }

      return json({ error: 'not found', available: '/xhs/endpoints' }, corsHeaders, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'internal error', message: err.message }, corsHeaders, 500);
    }
  },
};

// ============================================================
// OAuth 处理
// ============================================================

function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = `https://${url.host}/xhs/callback`;

  const authUrl = new URL(XHS_AUTH_URL);
  authUrl.searchParams.set('appId', env.XHS_APP_ID);
  authUrl.searchParams.set('scope', JSON.stringify(SCOPES));
  authUrl.searchParams.set('redirectUri', redirectUri);
  authUrl.searchParams.set('state', state);

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(url, env, corsHeaders) {
  const authCode = url.searchParams.get('auth_code');
  const state = url.searchParams.get('state');

  if (!authCode) {
    return json({ error: 'missing auth_code parameter' }, corsHeaders, 400);
  }

  // auth_code 换 token（有效期 10 分钟）
  // 聚光 OAuth2 endpoint: /api/open/oauth2/access_token
  const tokenRes = await xhsFetch('oauth.token', {
    app_id: parseInt(env.XHS_APP_ID),
    secret: env.XHS_SECRET,
    auth_code: authCode,
  }, null);

  if (!tokenRes.ok) {
    return json({ error: 'token exchange failed', detail: tokenRes.data }, corsHeaders, 400);
  }

  const tokenData = tokenRes.data;

  // 聚光返回可包含多个广告主 token（最多 5000 个）
  const advertiserId = String(tokenData.advertiser_id || tokenData.user_id || 'default');
  const expiresAt = tokenData.expires_at
    || Math.floor(Date.now() / 1000) + (tokenData.expires_in || 86400);

  await upsertToken(env.DB, {
    userId: advertiserId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt,
  });

  // 如果返回了广告主 ID 列表，存储映射
  if (tokenData.advertiser_ids && Array.isArray(tokenData.advertiser_ids)) {
    for (const advId of tokenData.advertiser_ids) {
      await upsertToken(env.DB, {
        userId: String(advId),
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt,
      });
    }
  }

  // 跳转前端
  const frontendUrl = new URL(env.FRONTEND_URL || 'https://maplesgedu.com');
  frontendUrl.pathname = '/xhs/success';
  frontendUrl.searchParams.set('user_id', advertiserId);

  return Response.redirect(frontendUrl.toString(), 302);
}

// ============================================================
// Token 管理
// ============================================================

async function handleGetToken(userId, env, corsHeaders) {
  if (!userId) return json({ error: 'missing user_id' }, corsHeaders, 400);

  const row = await env.DB.prepare(
    'SELECT user_id, access_token, refresh_token, expires_at, scope FROM oauth_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row) return json({ error: 'not found' }, corsHeaders, 404);

  const now = Math.floor(Date.now() / 1000);
  return json({ ...row, expired: now > row.expires_at }, corsHeaders);
}

async function handleRefreshToken(userId, env, corsHeaders) {
  const row = await env.DB.prepare(
    'SELECT refresh_token FROM oauth_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row || !row.refresh_token) {
    return json({ error: 'no refresh token' }, corsHeaders, 404);
  }

  const tokenRes = await xhsFetch('oauth.refresh', {
    app_id: parseInt(env.XHS_APP_ID),
    secret: env.XHS_SECRET,
    refresh_token: row.refresh_token,
  }, null);

  if (!tokenRes.ok) {
    return json({ error: 'refresh failed', detail: tokenRes.data }, corsHeaders, 400);
  }

  const tokenData = tokenRes.data;
  const expiresAt = tokenData.expires_at
    || Math.floor(Date.now() / 1000) + (tokenData.expires_in || 86400);

  await upsertToken(env.DB, {
    userId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || row.refresh_token,
    expiresAt,
  });

  return json({ status: 'refreshed', expires_at: expiresAt }, corsHeaders);
}

async function handleListTokens(env, corsHeaders) {
  const { results } = await env.DB.prepare(
    'SELECT user_id, expires_at, updated_at FROM oauth_tokens ORDER BY updated_at DESC'
  ).all();

  const now = Math.floor(Date.now() / 1000);
  return json(results.map(r => ({
    ...r,
    expired: now > r.expires_at,
  })), corsHeaders);
}

// ============================================================
// API 代理 — 核心
// ============================================================

async function handleApiProxy(endpointName, request, env, corsHeaders) {
  const endpoint = ENDPOINTS[endpointName];
  if (!endpoint) {
    return json({
      error: `unknown endpoint: ${endpointName}`,
      hint: 'GET /xhs/endpoints for full list',
    }, corsHeaders, 400);
  }

  const body = await request.json().catch(() => ({}));
  const advertiserId = request.headers.get('X-Advertiser-Id')
    || body.advertiser_id
    || 'default';

  // 从 D1 取 token（自动刷新如果快过期）
  const token = await getValidToken(String(advertiserId), env);
  if (!token) {
    return json({
      error: 'no valid token',
      hint: `POST /xhs/token/${advertiserId} to refresh, or visit /xhs/auth to authorize`,
    }, corsHeaders, 401);
  }

  const result = await xhsFetch(endpointName, body, token);

  return json({
    endpoint: endpointName,
    xhs_path: endpoint.path,
    ...result,
  }, corsHeaders, result.ok ? 200 : 502);
}

// ============================================================
// XHS API 调用（已验证 base URL + header）
// ============================================================

async function xhsFetch(endpointName, body, accessToken) {
  const endpoint = ENDPOINTS[endpointName];
  if (!endpoint) return { ok: false, data: { error: 'unknown endpoint' } };

  const fullUrl = `${XHS_API_BASE}${endpoint.path}`;

  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    // 聚光 API 使用 Access-Token header（不是 Authorization: Bearer）
    headers['Access-Token'] = accessToken;
  }

  const fetchOpts = { method: endpoint.method, headers };

  if (endpoint.method === 'POST') {
    fetchOpts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(fullUrl, fetchOpts);
    const data = await res.json();

    // 聚光 API 统一返回格式: { code: 0, msg: "success", data: {...} }
    if (data.code === 0) {
      return { ok: true, data: data.data, msg: data.msg };
    }
    return { ok: false, data, code: data.code, msg: data.msg };
  } catch (err) {
    return { ok: false, data: { error: err.message } };
  }
}

// ============================================================
// Token 辅助
// ============================================================

async function getValidToken(userId, env) {
  const row = await env.DB.prepare(
    'SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);

  // token 还有 5 分钟以上有效期，直接用
  if (row.expires_at > now + 300) {
    return row.access_token;
  }

  // 快过期了，自动刷新
  if (row.refresh_token) {
    try {
      const tokenRes = await xhsFetch('oauth.refresh', {
        app_id: parseInt(env.XHS_APP_ID),
        secret: env.XHS_SECRET,
        refresh_token: row.refresh_token,
      }, null);

      if (tokenRes.ok) {
        const newExpires = tokenRes.data.expires_at
          || Math.floor(Date.now() / 1000) + (tokenRes.data.expires_in || 86400);

        await upsertToken(env.DB, {
          userId,
          accessToken: tokenRes.data.access_token,
          refreshToken: tokenRes.data.refresh_token || row.refresh_token,
          expiresAt: newExpires,
        });

        return tokenRes.data.access_token;
      }
    } catch (err) {
      console.error('Auto-refresh failed:', err);
    }
  }

  return row.access_token;
}

async function upsertToken(db, { userId, accessToken, refreshToken, expiresAt }) {
  await db.prepare(`
    INSERT INTO oauth_tokens (user_id, access_token, refresh_token, token_type, expires_at, scope)
    VALUES (?, ?, ?, 'bearer', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).bind(
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    JSON.stringify(SCOPES),
  ).run();
}

// ============================================================
// 工具函数
// ============================================================

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
