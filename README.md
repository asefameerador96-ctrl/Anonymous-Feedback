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

- **Next.js 14** (App Router) — Vercel's native framework
- **Vercel Postgres** (Neon under the hood) — free tier, one click to provision
- **Tailwind CSS** — styling
- **jose** — JWT for the admin session cookie
- No analytics, no tracking scripts, no third-party JS

## Deploy to Vercel — step by step

### 1. Push this to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create candor --private --source=. --push
# or push to a manually created repo
```

### 2. Import the repo in Vercel

Go to [vercel.com/new](https://vercel.com/new), select your GitHub repo, and click **Import**. Don't deploy yet — click **Environment Variables** first.

### 3. Add a Postgres database

In the Vercel project dashboard, go to **Storage → Create Database → Postgres**. Pick the free Hobby tier and create it. Vercel will automatically inject the `POSTGRES_*` env vars into your project.

### 4. Set the two app secrets

In **Settings → Environment Variables**, add:

- `ADMIN_PASSWORD` — the password you'll use to log into the admin dashboard. Make it long.
- `ADMIN_SECRET` — a random string of at least 32 characters, used to sign session cookies. Generate one with: `openssl rand -hex 32`

### 5. Deploy

Trigger a deploy (push a commit, or click **Redeploy** in Vercel). Wait ~30 seconds.

### 6. Initialise the database

Once deployed, you need to create the tables. Run this once from your local machine:

```bash
npm install
npx vercel link            # link this folder to your Vercel project
npx vercel env pull .env.local
npm run db:init
```

This creates the `managers`, `invite_tokens`, and `responses` tables and seeds four sample managers (Alex Morgan, Jordan Reyes, Sam Chen, Riley Patel). Edit them in the admin panel after.

### 7. Set up your first survey

1. Visit `https://your-app.vercel.app/admin/login` and sign in with `ADMIN_PASSWORD`.
2. Go to the **Manage** tab.
3. Add your actual managers (delete or rename the seeded ones via the database if you want them gone — or just deactivate by setting `active = false` in Postgres).
4. Generate invitation codes — one per employee. Copy them. Distribute by email, paper, or however your org prefers.
5. Employees visit the root URL, paste their code, and complete the survey.

## Local development

```bash
npm install
npx vercel env pull .env.local
npm run db:init      # only the first time
npm run dev
```

App runs on `http://localhost:3000`.

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
    admin/managers/         Add managers, generate invite tokens
lib/
  db.ts                     Postgres connection + threshold constant
  auth.ts                   Admin session JWT helpers
scripts/
  init-db.js                Create tables, seed managers
```

## Adapting the questions

Survey questions live in `app/survey/page.tsx` as `MANAGER_QUESTIONS` and `CULTURE_QUESTIONS`. If you change them, also update the corresponding columns in `scripts/init-db.js` and the aggregation in `app/api/admin/results/route.ts`.

## Things to consider before going live

- **Communicate the anonymity model.** Show employees the "How anonymity works here" section on the landing page (or your own version) before they're asked to trust the system. Trust is the bottleneck, not the technology.
- **Have a third party host this if your org is small.** With fewer than ~50 respondents, free-text comments alone can identify someone via writing style. The aggregation threshold helps, but doesn't fully solve this.
- **Don't add IP logging "for spam prevention" later.** The single-use token system is your spam prevention. If you add IP capture, you've broken the anonymity promise even if you only use it "for debugging".
- **Purge invite tokens after the survey closes.** Run `DELETE FROM invite_tokens;` once distribution is complete and the survey window has ended. This removes any residual record of who was invited.
- **Be very careful before adding a "respond again" flow.** The current design is one shot per token, which is what makes the anonymity model simple. Anything that links a person across responses weakens it.

## License

MIT — use it, modify it, deploy it however you like.
