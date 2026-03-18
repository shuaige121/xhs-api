# XHS API Gateway

Cloudflare Worker proxy for the XHS (Xiaohongshu/RED) Marketing API with OAuth token management and D1 storage.

## Features

- **OAuth flow** -- authorize, exchange code for token, auto-refresh before expiry
- **50+ endpoints** -- campaigns, ad units, creatives, reports (offline & realtime), account management, assets, tools, conversion tracking
- **Token storage** -- D1-backed, per-advertiser tokens with automatic refresh (5-min buffer)
- **CORS** -- configurable allowed origin for frontend integration

## Routes

| Route | Method | Description |
|---|---|---|
| `/xhs/health` | GET | Health check + endpoint count |
| `/xhs/endpoints` | GET | List all available endpoint names |
| `/xhs/auth` | GET | Start OAuth authorization |
| `/xhs/callback` | GET | OAuth callback (exchanged automatically) |
| `/xhs/tokens` | GET | List stored tokens |
| `/xhs/token/:id` | GET | Get token status for an advertiser |
| `/xhs/token/:id` | POST | Force-refresh a token |
| `/xhs/api/:endpoint` | POST | Proxy any XHS API endpoint |

## Usage

Call any XHS endpoint through the proxy:

```bash
# List campaigns
curl -X POST https://your-worker.dev/xhs/api/campaign.list \
  -H "Content-Type: application/json" \
  -H "X-Advertiser-Id: 123456" \
  -d '{"page": 1, "page_size": 20}'

# Get offline account report
curl -X POST https://your-worker.dev/xhs/api/report.offline.account \
  -H "Content-Type: application/json" \
  -H "X-Advertiser-Id: 123456" \
  -d '{"start_date": "2026-03-01", "end_date": "2026-03-17"}'
```

The advertiser ID can be passed via `X-Advertiser-Id` header or `advertiser_id` in the request body.

## Setup

```bash
npm install

# Create D1 database
wrangler d1 create xhs-db

# Initialize schema
npm run db:init

# Store your XHS app secret
wrangler secret put XHS_SECRET
```

Set `XHS_APP_ID` and `FRONTEND_URL` in `wrangler.toml`, then configure a route or custom domain.

## Deploy

```bash
npm run deploy
```

## Tech Stack

- **Runtime** -- Cloudflare Workers
- **Database** -- Cloudflare D1 (SQLite)
- **Language** -- JavaScript (no build step)
