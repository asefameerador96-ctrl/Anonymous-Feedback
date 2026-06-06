# Candor — Anonymous Employee Feedback

A privacy-first, self-hostable anonymous feedback app for rating line managers and organisational culture. Built with Next.js, deployable to Vercel in about ten minutes.

## What makes this actually anonymous

The hard part of an anonymous survey isn't the form — it's making sure the data architecture can't be used to deanonymise people later. This app is built around four guarantees:

1. **Invitation tokens are stored in a completely separate table from responses.** When you submit, the token is marked used in one transaction, then your response is inserted in another. No column links them. There is no SQL query that can join a response back to the token that authorised it.
2. **No IP addresses, user agents, session identifiers, or precise timestamps are ever stored** alongside responses. Only a day-bucketed date (`2025-11-04`, not `2025-11-04T14:23:07Z`), so submissions cannot be correlated with badge swipes, login logs, or anything else.
3. **Aggregation threshold of 5.** No per-manager or culture-wide result is shown to admins until at least 5 responses exist for that group. Below the threshold, the dashboard displays a suppression notice with no underlying numbers.
4. **Free-text comments are returned to admins in random order** and are never displayed in the same row as a manager's ratings, so an admin can't read "this comment came from someone who rated their manager 1/5".

The admin dashboard shows aggregate ratings and a randomised stream of comments. There is no way, even with database access, to view an individual person's complete submission tied to a token.

## Stack

- **Next.js 14** (App Router)
- **Azure Database for PostgreSQL** (Flexible Server), accessed with **node-postgres (`pg`)** — works with any standard Postgres, not tied to one host
- **Azure App Service** (Linux, Node 20) for hosting, deployed via GitHub Actions
- **Tailwind CSS** — styling
- **jose** — JWT for the admin session cookie
- No analytics, no tracking scripts, no third-party JS

The schema auto-creates on first request (see `lib/schema.js` + `lib/db.ts`), so a fresh database needs no manual migration step.

## Deploy to Azure — step by step

This deploys to **Azure App Service** with an **Azure Database for PostgreSQL** backend. Pushing to `main` on GitHub triggers the workflow in `.github/workflows/azure-deploy.yml`, which builds and ships to App Service.

### 1. Create the database

In the Azure portal, create **Azure Database for PostgreSQL → Flexible Server** (the Burstable B1ms tier is the cheapest). During setup:

- Note the admin username and password.
- Under **Networking**, allow access. For a quick start, enable **"Allow public access from Azure services"** and add a firewall rule for your own IP (so you can run `npm run db:init` locally). For production, prefer a VNet/private endpoint.

Your connection string looks like:

```
postgres://USER:PASSWORD@SERVERNAME.postgres.database.azure.com:5432/postgres?sslmode=require
```

### 2. Create the web app

Create an **App Service** → Linux → **Node 20 LTS** runtime. Note the app name (e.g. `anonymous-feedback`) — it must match `AZURE_WEBAPP_NAME` in the workflow file.

In **App Service → Settings → Configuration → General settings**, set the **Startup Command** to:

```
npm start
```

In **Settings → Environment variables** (Application settings), add:

- `DATABASE_URL` — the connection string from step 1.
- `ADMIN_PASSWORD` — the password for the admin dashboard. Make it long.
- `ADMIN_SECRET` — a random string ≥ 32 chars for signing session cookies. Generate with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SCM_DO_BUILD_DURING_DEPLOYMENT` = `false` (the GitHub Action already builds; this stops Azure rebuilding).

### 3. Wire up the GitHub deploy

1. In the App Service **Overview → Get publish profile**, download the `.PublishSettings` file.
2. In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, name it `AZURE_WEBAPP_PUBLISH_PROFILE` and paste the entire file contents.
3. Edit `AZURE_WEBAPP_NAME` in `.github/workflows/azure-deploy.yml` to your app's name.
4. Push to `main` (GitHub Desktop works). The Action builds and deploys; watch it under the repo's **Actions** tab.

### 4. Initialise the database (optional)

The schema auto-creates on the first request, so you can skip this. To provision the tables and seed sample managers up front, run locally with `DATABASE_URL` set:

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL
npm run db:init
```

This creates the `managers`, `invite_tokens`, and `responses` tables and seeds four sample managers (Alex Morgan, Jordan Reyes, Sam Chen, Riley Patel).

### 5. Set up your first survey

1. Visit `https://your-app.azurewebsites.net/admin/login` and sign in with `ADMIN_PASSWORD`.
2. Go to the **Manage** tab.
3. Add your real managers; deactivate the seeded ones with the **Deactivate** button.
4. Generate invitation codes — one per employee. Use **Copy links** and distribute by email, paper, or however your org prefers. Each link looks like `https://your-app.azurewebsites.net/?code=…` and pre-fills the code automatically.
5. Employees open their link (or paste the code), and complete the survey.

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
