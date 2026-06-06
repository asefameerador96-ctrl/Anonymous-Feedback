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
