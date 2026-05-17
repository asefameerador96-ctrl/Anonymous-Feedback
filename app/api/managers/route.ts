import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await sql`
    SELECT id, name, department FROM managers
    WHERE active = TRUE
    ORDER BY name ASC;
  `;
  return NextResponse.json({ managers: rows });
}
