/**
 * Single source of truth for the database schema.
 *
 * Shared by:
 *   - lib/db.ts        → lazy auto-initialiser that runs on first DB access
 *   - scripts/init-db.js → explicit `npm run db:init` migration
 *
 * IMPORTANT ANONYMITY NOTES (do not change without understanding the model):
 *   - The `responses` table has NO foreign key to invite_tokens.
 *   - The `invite_tokens` table has NO column linking to a specific response.
 *   - We only store a day-bucketed date, not a precise timestamp.
 *   - No IP, user-agent, or session info is ever stored alongside responses.
 */

const DDL = [
  `CREATE TABLE IF NOT EXISTS managers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

  // Invite tokens: single-use, stored entirely separately from responses.
  // The `used` flag flips on submission but the token is NEVER joined
  // back to a response row.
  `CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )`,

  // Responses: the actual feedback. No token column, no IP, no user agent,
  // only a day bucket rather than a precise timestamp.
  `CREATE TABLE IF NOT EXISTS responses (
      id SERIAL PRIMARY KEY,
      manager_id INTEGER REFERENCES managers(id),
      manager_clarity SMALLINT,
      manager_support SMALLINT,
      manager_fairness SMALLINT,
      manager_growth SMALLINT,
      manager_comments TEXT,
      culture_trust SMALLINT,
      culture_inclusion SMALLINT,
      culture_workload SMALLINT,
      culture_voice SMALLINT,
      culture_comments TEXT,
      day_bucket DATE NOT NULL
    )`,

  `CREATE INDEX IF NOT EXISTS idx_responses_manager ON responses(manager_id)`,

  // Anonvey platform: a registering company (tenant).
  `CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      phone TEXT,
      employee_count INTEGER,
      min_threshold INTEGER NOT NULL DEFAULT 5,
      plan TEXT NOT NULL DEFAULT 'trial',
      survey_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

  // Admin users belonging to an organisation. Passwords are scrypt-hashed.
  `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

  // Multi-tenancy: tag the existing per-survey tables with their organisation.
  // Rows created before multi-tenancy have NULL org_id and are scoped out.
  `ALTER TABLE managers ADD COLUMN IF NOT EXISTS org_id INTEGER`,
  `ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS org_id INTEGER`,
  `ALTER TABLE responses ADD COLUMN IF NOT EXISTS org_id INTEGER`,
  `CREATE INDEX IF NOT EXISTS idx_managers_org ON managers(org_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tokens_org ON invite_tokens(org_id)`,
  `CREATE INDEX IF NOT EXISTS idx_responses_org ON responses(org_id)`,

  // Hierarchy + contact on managers: parent_id builds the org tree, email lets
  // us address manager-wise code emails.
  `ALTER TABLE managers ADD COLUMN IF NOT EXISTS parent_id INTEGER`,
  `ALTER TABLE managers ADD COLUMN IF NOT EXISTS email TEXT`,

  // Employees: the workforce, used ONLY for distributing codes (and optional
  // emailing). Never linked to a response — anonymity is preserved because the
  // response carries no token or employee reference.
  `CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      email TEXT,
      department TEXT,
      manager_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  `CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(org_id)`,

  // Codes can optionally be bound to a manager (manager-wise aggregation) and
  // to an employee (for email-merge distribution). Neither is ever copied onto
  // a response.
  `ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS manager_id INTEGER`,
  `ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS employee_id INTEGER`,
];

// Seeded only when the managers table is empty. Edit or deactivate these
// from the admin "Manage" tab after first run.
const SEED_MANAGERS = [
  ["Alex Morgan", "Engineering"],
  ["Jordan Reyes", "Product"],
  ["Sam Chen", "Design"],
  ["Riley Patel", "Operations"],
];

module.exports = { DDL, SEED_MANAGERS };
