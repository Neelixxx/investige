# Production Deploy (Managed Postgres + Redis + Cron)

## Target Architecture

- `gemindex` Next.js app service
- `gemindex-worker` background worker service (`npm run worker`)
- managed Postgres (`DATABASE_URL`)
- managed Redis (`REDIS_URL`)
- scheduled cron tick hitting `/api/jobs/worker`

## Render Blueprint

Use `infra/render/render.yaml` to provision:

- web service
- worker service
- cron service
- managed Postgres
- managed Redis key-value

## Deploy Steps

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and point to `infra/render/render.yaml`.
3. Set required env vars in Render:
   - `POKEMONTCG_API_KEY`
   - `ALLOW_SEEDED_ANALYTICS=0`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_ELITE_MONTHLY`
4. Optional legacy direct TCGplayer sync vars (only if you have working credentials):
   - `TCGPLAYER_PUBLIC_KEY`
   - `TCGPLAYER_PRIVATE_KEY`
   - `TCGPLAYER_CATEGORY_ID` (default `3`)
   - `TCGPLAYER_ACCESS_TOKEN` (optional passthrough)
5. After first deploy, run Prisma migration against managed Postgres:
   - `npx prisma migrate deploy`
6. Verify health:
   - `GET https://gemindex.onrender.com/api/health`
   - Expected: JSON with `"status":"ok"` and `totals` fields.
7. Verify homepage is Investige (not Next starter):
   - Open `https://gemindex.onrender.com`
   - Expected page title contains `Investige | Pokemon TCG Analytics`
8. Verify worker:
   - `POST /api/jobs/worker?token=<CRON_SECRET>`

## Live Data Source Note

- Investige can run fully live using only `POKEMONTCG_API_KEY` for catalog + pricing ingestion.
- If TCGplayer developer API credentials are unavailable, leave all `TCGPLAYER_*` vars blank.
- In that mode, run sales sync with `provider: "POKEMONTCG"`.

## If you see "Create Next App" on Render

Your Render service is deploying the wrong project settings. In Render Web Service settings:

1. Repository: `Neelixxx/gemindex`
2. Branch: `main`
3. Root Directory: `.`
4. Build Command: `npm ci && npm run build`
5. Start Command: `npm run start`
6. Health Check Path: `/api/health`
7. Manual Deploy: **Clear build cache & deploy latest commit**

Then recheck:

- `https://gemindex.onrender.com/api/health` (must return JSON, not 404)
- `https://gemindex.onrender.com` (must show Investige app, not starter template)

## Stripe Setup

1. Create recurring Stripe Prices for Pro and Elite plans.
2. Copy the two Price IDs into:
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_ELITE_MONTHLY`
3. In Stripe Dashboard, add webhook endpoint:
   - `https://<your-app-domain>/api/billing/webhook`
4. Subscribe webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## CI/CD

- `.github/workflows/deploy-render.yml` runs lint/test/build and triggers deploy hooks.
- `.github/workflows/cron-worker.yml` can be used as external scheduler fallback.
