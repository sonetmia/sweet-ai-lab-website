import fs from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL is required to apply the Supabase schema.");
}

const schema = await fs.readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(schema);
  console.log("Supabase schema and RPC functions applied successfully.");
} finally {
  await client.end();
}
