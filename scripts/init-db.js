/**
 * Explicitly create the database schema and seed initial managers.
 * Run with:  npm run db:init
 *
 * Reads DATABASE_URL from the environment, or from a local .env.local file.
 * The running app also auto-creates the schema on first request (see
 * lib/db.ts), so this script is optional — handy for provisioning an Azure
 * database up front, before the first visitor arrives.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { DDL, SEED_MANAGERS } = require("../lib/schema");

// Minimal .env.local loader so `npm run db:init` works without extra deps.
function loadDotEnvLocal() {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadDotEnvLocal();

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_CONNECTION_STRING;

  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Add it to .env.local or your environment " +
        "(your Azure Database for PostgreSQL connection string)."
    );
    process.exit(1);
  }

  const sslDisabled =
    process.env.PGSSL === "disable" || process.env.PGSSLMODE === "disable";

  const client = new Client({
    connectionString,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected. Creating tables...");
  for (const stmt of DDL) {
    await client.query(stmt);
  }

  const { rows } = await client.query("SELECT COUNT(*)::int AS c FROM managers");
  if (rows[0].c === 0) {
    console.log("Seeding example managers...");
    for (const [name, department] of SEED_MANAGERS) {
      await client.query(
        "INSERT INTO managers (name, department) VALUES ($1, $2)",
        [name, department]
      );
    }
  }

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
