/**
 * Initialise the database schema and seed initial managers.
 * Run with: npm run db:init  (after setting env vars locally or via vercel env pull)
 *
 * IMPORTANT ANONYMITY NOTES:
 * - The `responses` table has NO foreign key to invite_tokens.
 * - The `invite_tokens` table has NO column linking to a specific response.
 * - We only store a day-bucketed date, not a precise timestamp.
 * - No IP, user-agent, or session info is ever stored alongside responses.
 */

const { sql } = require("@vercel/postgres");

async function main() {
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS managers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Invite tokens: single-use, stored entirely separately from responses.
  // The `used` flag flips on submission but the token is NEVER joined
  // back to a response row.
  await sql`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `;

  // Responses: the actual feedback. Note:
  //  - no token column
  //  - no IP, no user agent
  //  - only a day bucket, not a precise timestamp
  await sql`
    CREATE TABLE IF NOT EXISTS responses (
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
    );
  `;

  // Useful index for the dashboard aggregation
  await sql`
    CREATE INDEX IF NOT EXISTS idx_responses_manager
      ON responses(manager_id);
  `;

  // Seed a few example managers if the table is empty
  const { rows } = await sql`SELECT COUNT(*)::int AS c FROM managers;`;
  if (rows[0].c === 0) {
    console.log("Seeding example managers...");
    await sql`
      INSERT INTO managers (name, department) VALUES
        ('Alex Morgan', 'Engineering'),
        ('Jordan Reyes', 'Product'),
        ('Sam Chen', 'Design'),
        ('Riley Patel', 'Operations');
    `;
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
