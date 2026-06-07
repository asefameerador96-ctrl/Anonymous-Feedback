# Anonvey — Truly Anonymous

A multi-tenant SaaS platform for running **truly anonymous** employee surveys. Any organisation registers with their work email, builds a survey, distributes single-use codes, and sees aggregated results — with anonymity built into the data architecture, not just promised in a policy. Even the platform owner cannot read an organisation's results.

Built with Next.js, containerized, and running on Azure Container Apps + Azure Database for PostgreSQL.

## Roles & sign-in

| Who | Where | Auth |
|-----|-------|------|
| Respondent (employee) | `/respond?code=…` → `/survey` | single-use invite code |
| Organisation admin | `/admin` (sign in / register at `/register`) | email + password per org (scrypt-hashed) |
| Platform owner | `/owner` (sign in at `/owner/login`) | `ADMIN_EMAIL` + `ADMIN_PASSWORD` env |

Each organisation's data (managers, codes, responses) is fully isolated by `org_id`; one company can never see another's. The owner dashboard sees only operational metadata (org list, headcounts, counts) — **never** any survey answer or comment.

## What makes this actually anonymous

The hard part of an anonymous survey isn't the form — it's making sure the data architecture can't be used to deanonymise people later. This platform is built around these guarantees:

1. **Invitation codes are stored in a completely separate table from responses.** When you submit, the code is marked used in one transaction, then your response is inserted in another. No column links them — the only thing carried across is the organisation id, never the code. There is no SQL query that can join a response back to the code that authorised it.
2. **No IP addresses, user agents, session identifiers, or precise timestamps are ever stored** alongside responses. Only a day-bucketed date, so submissions cannot be correlated with badge swipes, login logs, or anything else.
3. **A configurable anonymity threshold.** No per-manager or culture-wide result is shown until at least _N_ responses exist for that group, where _N_ is set by each org admin (default 5). Below the threshold, the dashboard suppresses all underlying numbers.
4. **Free-text comments are returned to admins in random order** and are never displayed in the same row as a manager's ratings.
5. **The platform owner can't read results.** The owner dashboard's query is structurally limited to metadata and counts — it never selects answer or comment content.

## Stack

- **Next.js 14** (App Router)
- **Azure Database for PostgreSQL** (Flexible Server), accessed with **node-postgres (`pg`)** — works with any standard Postgres, not tied to one host
- **Containerized** (multi-stage `Dockerfile`, Next.js standalone output) and hosted on **Azure Container Apps** (scale-to-zero), image stored in **Azure Container Registry**, deployed via GitHub Actions
- **Tailwind CSS** — styling
- **jose** — JWT for the admin session cookie
- No analytics, no tracking scripts, no third-party JS

The schema auto-creates on first request (see `lib/schema.js` + `lib/db.ts`), so a fresh database needs no manual migration step.

## Deploy to Azure (Container Apps)

The app is containerized and runs on **Azure Container Apps**, pulling its image from **Azure Container Registry**, backed by **Azure Database for PostgreSQL**. Once the one-time infrastructure exists, **pushing to `main` redeploys automatically** via `.github/workflows/azure-deploy.yml`: GitHub Actions logs into Azure with **OIDC** (no stored credentials), builds the image with `az acr build`, and rolls it out with `az containerapp update`.

### How CI/CD works

```
push to main ──▶ GitHub Actions ──▶ az login (OIDC) ──▶ az acr build ──▶ az containerapp update
```

The deploy identity is a federated Azure AD app whose role is **scoped to the `rg-candor` resource group only**, so the pipeline can't reach any other Azure resources. Required repo secrets (already configured): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

### One-time infrastructure (already provisioned)

Everything lives in the isolated `rg-candor` resource group, region `southeastasia`:

| Resource | Name | Notes |
|----------|------|-------|
| Resource group | `rg-candor` | isolation boundary |
| Container Registry | `candoracrcrkbte` | Basic, holds the `candor` image |
| PostgreSQL Flexible Server | `candor-pg-crkbte` | Burstable B1ms, db `candor` |
| Container Apps env | `candor-env` | managed environment |
| Container App | `candor-app` | scale-to-zero, public ingress :3000 |

Reproduce from scratch with the Azure CLI (`az group create` → `az acr create` → `az postgres flexible-server create` → `az containerapp env create` → `az acr build` → `az containerapp create`), passing `DATABASE_URL`, `ADMIN_SECRET`, and `ADMIN_PASSWORD` as Container App secrets.

### Runtime configuration

These are set as **Container App secrets** (referenced by env vars), never committed:

- `DATABASE_URL` — `postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com/candor?sslmode=require`
- `ADMIN_PASSWORD` — password for the `/admin` dashboard.
- `ADMIN_SECRET` — random string ≥ 32 chars for signing session cookies.

Update one without a redeploy:

```bash
az containerapp secret set -g rg-candor -n candor-app --secrets admin-password=NEW_VALUE
az containerapp update -g rg-candor -n candor-app   # restart to pick it up
```

The schema (tables + sample managers) **auto-creates on the first request** — no migration step. To pre-provision instead, run `npm run db:init` locally with `DATABASE_URL` set.

### Set up your first survey

1. Visit `https://<your-app>.azurecontainerapps.io/admin/login` and sign in with `ADMIN_PASSWORD`.
2. Go to the **Manage** tab.
3. Add your real managers; deactivate the seeded ones with the **Deactivate** button.
4. Generate invitation codes — one per employee. Use **Copy links** and distribute them. Each link looks like `https://<your-app>.azurecontainerapps.io/?code=…` and pre-fills the code automatically.
5. Employees open their link (or paste the code) and complete the survey.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, ADMIN_PASSWORD, ADMIN_SECRET
npm run dev
```

App runs on `http://localhost:3000`. Point `DATABASE_URL` at your Azure database (it's reachable from your machine if you added your IP to the firewall) or any local Postgres. For a local Postgres without TLS, also set `PGSSL=disable`.

## File map

```
app/
  page.tsx                  Landing + invitation code entry
  survey/page.tsx           4-step survey
  thank-you/page.tsx        Post-submission confirmation
  admin/login/page.tsx      Admin sign-in
  admin/page.tsx            Admin dashboard (results + management)
  api/
    validate-token/         Check if an invite code is still valid
    submit/                 Receive and store a response (the privacy-critical route)
    managers/               Public list of active managers
    admin/login/            Admin password check, sets session cookie
    admin/results/          Aggregated results with k-anonymity threshold
    admin/managers/         List/add/deactivate managers, generate invite tokens
lib/
  db.ts                     pg connection pool, sql/query helpers, lazy schema init
  schema.js                 Shared DDL + seed data (single source of truth)
  auth.ts                   Admin session JWT helpers
scripts/
  init-db.js                Optional explicit migration (tables + seed)
.github/workflows/
  azure-deploy.yml          Build + deploy to Azure App Service on push to main
```

## Adapting the questions

Survey questions live in `app/survey/page.tsx` as `MANAGER_QUESTIONS` and `CULTURE_QUESTIONS`. If you change them, also update the corresponding columns in `lib/schema.js` (the `responses` table) and the aggregation in `app/api/admin/results/route.ts`.

## Things to consider before going live

- **Communicate the anonymity model.** Show employees the "How anonymity works here" section on the landing page (or your own version) before they're asked to trust the system. Trust is the bottleneck, not the technology.
- **Have a third party host this if your org is small.** With fewer than ~50 respondents, free-text comments alone can identify someone via writing style. The aggregation threshold helps, but doesn't fully solve this.
- **Don't add IP logging "for spam prevention" later.** The single-use token system is your spam prevention. If you add IP capture, you've broken the anonymity promise even if you only use it "for debugging".
- **Purge invite tokens after the survey closes.** Run `DELETE FROM invite_tokens;` once distribution is complete and the survey window has ended. This removes any residual record of who was invited.
- **Be very careful before adding a "respond again" flow.** The current design is one shot per token, which is what makes the anonymity model simple. Anything that links a person across responses weakens it.

## License

MIT — use it, modify it, deploy it however you like.
