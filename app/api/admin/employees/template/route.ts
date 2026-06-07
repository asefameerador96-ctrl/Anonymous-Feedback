import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Downloadable sample CSV so admins know the exact expected format.
export async function GET() {
  const csv = [
    "name,email,department,manager",
    "Jane Cooper,jane.cooper@yourcompany.com,Engineering,Alex Morgan",
    "Robert Fox,robert.fox@yourcompany.com,Engineering,Alex Morgan",
    "Esther Howard,esther.howard@yourcompany.com,Operations,Riley Patel",
    'Cody "CJ" Fisher,cody.fisher@yourcompany.com,Design,',
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="anonvey-employees-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
