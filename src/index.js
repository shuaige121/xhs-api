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
 */

// ============================================================
// 聚光平台端点配置
// ============================================================
const XHS_AUTH_URL = 'https://ad-market.xiaohongshu.com/auth';
const XHS_API_BASE = 'https://edith.xiaohongshu.com/api/open';
const SCOPES = ['report_service', 'ad_query', 'ad_manage', 'account_manage'];

// 完整 API 端点映射（硬编码）
const ENDPOINTS = {
  // === OAuth ===
  'oauth.token':           { method: 'POST', path: '/jg/oauth/token' },
  'oauth.refresh':         { method: 'POST', path: '/jg/oauth/refresh_token' },

  // === 投放管理 - 计划 ===
  'campaign.create':       { method: 'POST', path: '/jg/campaign/create' },
  'campaign.update':       { method: 'POST', path: '/jg/campaign/update' },
  'campaign.list':         { method: 'POST', path: '/jg/campaign/list' },
  'campaign.status':       { method: 'POST', path: '/jg/campaign/status/update' },

  // === 投放管理 - 单元 ===
  'unit.create':           { method: 'POST', path: '/jg/unit/create' },
  'unit.update':           { method: 'POST', path: '/jg/unit/update' },
  'unit.list':             { method: 'POST', path: '/jg/unit/list' },
  'unit.status':           { method: 'POST', path: '/jg/unit/update/status' },

  // === 投放管理 - 创意 ===
  'creative.create':       { method: 'POST', path: '/jg/creativity/create' },
  'creative.update':       { method: 'POST', path: '/jg/creativity/update' },
  'creative.search':       { method: 'POST', path: '/jg/creativity/search' },
  'creative.status':       { method: 'POST', path: '/jg/creativity/status/update' },

  // === 素材管理 ===
  'note.list':             { method: 'POST', path: '/jg/note/list' },
  'spu.list':              { method: 'POST', path: '/jg/spu/list' },
  'target_pack.list':      { method: 'POST', path: '/jg/target_pack/list' },
  'target_pack.create':    { method: 'POST', path: '/jg/target_pack/create' },
  'target_pack.update':    { method: 'POST', path: '/jg/target_pack/update' },
  'target_pack.delete':    { method: 'POST', path: '/jg/target_pack/delete' },
  'target_pack.bindunit':  { method: 'POST', path: '/jg/target_pack/bindunit' },
  'negative_word.list':    { method: 'POST', path: '/jg/negative_word/list' },
  'negative_word.add':     { method: 'POST', path: '/jg/negative_word/add' },
  'negative_word.delete':  { method: 'POST', path: '/jg/negative_word/delete' },
  'directlink.list':       { method: 'POST', path: '/jg/directlink/list' },
  'directlink.create':     { method: 'POST', path: '/jg/directlink/create' },
  'directlink.delete':     { method: 'POST', path: '/jg/directlink/delete' },
  'landingpage.list':      { method: 'POST', path: '/jg/landingpage/list' },

  // === 数据报表 - 离线 ===
  'report.offline.advertiser': { method: 'POST', path: '/jg/data/report/advertiser' },
  'report.offline.campaign':   { method: 'POST', path: '/jg/data/report/campaign' },
  'report.offline.unit':       { method: 'POST', path: '/jg/data/report/unit' },
  'report.offline.creative':   { method: 'POST', path: '/jg/data/report/creativity' },
  'report.offline.keyword':    { method: 'POST', path: '/jg/data/report/keyword' },
  'report.offline.searchterm': { method: 'POST', path: '/jg/data/report/search_term' },
  'report.offline.note':       { method: 'POST', path: '/jg/data/report/note' },
  'report.offline.series':     { method: 'POST', path: '/jg/data/report/series' },
  'report.offline.crowd':      { method: 'POST', path: '/api/idea/group_report' },

  // === 数据报表 - 实时 ===
  'report.realtime.advertiser': { method: 'POST', path: '/jg/data/realtime/advertiser' },
  'report.realtime.campaign':   { method: 'POST', path: '/jg/data/realtime/campaign' },
  'report.realtime.unit':       { method: 'POST', path: '/jg/data/realtime/unit' },
  'report.realtime.creative':   { method: 'POST', path: '/jg/data/realtime/creativity' },
  'report.realtime.keyword':    { method: 'POST', path: '/jg/data/realtime/keyword' },
  'report.realtime.targeting':  { method: 'POST', path: '/jg/data/realtime/targeting' },

  // === 账户服务 ===
  'account.balance':       { method: 'GET',  path: '/jg/account/balance/info' },
  'account.budget.update': { method: 'POST', path: '/jg/account/budget/update' },
  'account.sub.page':      { method: 'POST', path: '/jg/account/sub/page' },
  'account.flow':          { method: 'POST', path: '/jg/account/flow/list' },
  'account.campaign_flow': { method: 'POST', path: '/jg/campaign/flow/list' },
  'account.transfer':      { method: 'POST', path: '/jg/account/transfer' },
  'account.transfer_result': { method: 'POST', path: '/jg/account/transfer/result' },
  'account.whitelist':     { method: 'POST', path: '/jg/white/list' },

  // === 工具 ===
  'tool.history':          { method: 'POST', path: '/jg/history/list' },
  'tool.keyword.recommend': { method: 'POST', path: '/jg/keyword/recommend' },
  'tool.keyword.industry':  { method: 'POST', path: '/jg/keyword/industry/taxonomy' },
  'tool.crowd.estimate':    { method: 'POST', path: '/jg/crowd/estimate' },
  'tool.target.keyword':    { method: 'POST', path: '/jg/target/keyword/match' },
  'tool.target.recommend':  { method: 'POST', path: '/jg/target/keyword/recommend' },
  'tool.target.info':       { method: 'POST', path: '/jg/target/available/info' },
  'tool.name.check':        { method: 'POST', path: '/jg/data/name/check' },
  'tool.poi.list':          { method: 'POST', path: '/jg/data/poi/list' },

  // === 转化追踪 ===
  'conversion.click':      { method: 'POST', path: '/jg/conversion/click/link' },
  'conversion.leads':      { method: 'POST', path: '/jg/conversion/leads' },
  'conversion.aurora':     { method: 'POST', path: '/jg/conversion/aurora/leads' },
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
  const tokenRes = await xhsFetch(env, 'oauth.token', {
    app_id: parseInt(env.XHS_APP_ID),
    secret: env.XHS_SECRET,
    auth_code: authCode,
  }, null); // 不需要 access_token

  if (!tokenRes.ok) {
    return json({ error: 'token exchange failed', detail: tokenRes.data }, corsHeaders, 400);
  }

  const tokenData = tokenRes.data;

  // 聚光返回可能包含多个广告主 token（最多 5000 个）
  // 格式可能是 { access_token, refresh_token, advertiser_ids: [...] }
  // 或者每个广告主单独的 token
  const advertiserId = String(tokenData.advertiser_id || tokenData.user_id || 'default');
  const expiresAt = tokenData.expires_at
    || Math.floor(Date.now() / 1000) + (tokenData.expires_in || 86400);

  await upsertToken(env.DB, {
    userId: advertiserId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt,
  });

  // 如果返回了广告主 ID 列表，存储映射关系
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

  const tokenRes = await xhsFetch(env, 'oauth.refresh', {
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

  // 从 header 或 body 获取 advertiser_id
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

  // 代理请求到聚光 API
  const result = await xhsFetch(env, endpointName, body, token);

  return json({
    endpoint: endpointName,
    xhs_path: endpoint.path,
    ...result,
  }, corsHeaders, result.ok ? 200 : 502);
}

// ============================================================
// XHS API 调用
// ============================================================

async function xhsFetch(env, endpointName, body, accessToken) {
  const endpoint = ENDPOINTS[endpointName];
  if (!endpoint) return { ok: false, data: { error: 'unknown endpoint' } };

  // 离线人群包报表用不同的 base path
  const fullPath = endpoint.path.startsWith('/api/')
    ? `https://edith.xiaohongshu.com${endpoint.path}`
    : `${XHS_API_BASE}${endpoint.path}`;

  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Access-Token'] = accessToken;
  }

  const fetchOpts = { method: endpoint.method, headers };

  if (endpoint.method === 'POST') {
    fetchOpts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(fullPath, fetchOpts);
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
      const tokenRes = await xhsFetch(env, 'oauth.refresh', {
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

  // 过期了但没 refresh_token，返回旧 token（让调用方看到 401 错误）
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
