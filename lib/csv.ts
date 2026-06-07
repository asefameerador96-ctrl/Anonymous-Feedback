/**
 * Minimal, dependency-free CSV handling for employee imports.
 * Handles quoted fields, escaped quotes (""), commas and newlines inside
 * quotes, and CRLF/CR line endings.
 */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type ParsedEmployee = {
  name: string;
  email: string | null;
  department: string | null;
  manager: string | null;
};

export type EmployeeCsvResult = {
  ok: boolean;
  employees: ParsedEmployee[];
  errors: string[];
};

const REQUIRED_COLUMNS = ["name"];
const KNOWN_COLUMNS = ["name", "email", "department", "manager"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a parsed CSV grid into employee rows, returning precise,
 * human-readable errors (e.g. "Row 4: name is required").
 */
export function validateEmployeeCsv(grid: string[][]): EmployeeCsvResult {
  const errors: string[] = [];
  const employees: ParsedEmployee[] = [];

  const nonEmpty = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) {
    return { ok: false, employees: [], errors: ["The file is empty."] };
  }

  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const index: Record<string, number> = {};
  header.forEach((h, i) => {
    if (index[h] === undefined) index[h] = i;
  });

  // Header validation
  for (const col of REQUIRED_COLUMNS) {
    if (index[col] === undefined) {
      errors.push(
        `Missing required column: "${col}". Expected a header row with columns: ${KNOWN_COLUMNS.join(
          ", "
        )}.`
      );
    }
  }
  const unknown = header.filter((h) => h && !KNOWN_COLUMNS.includes(h));
  if (unknown.length > 0) {
    errors.push(
      `Unrecognised column${unknown.length > 1 ? "s" : ""}: ${unknown
        .map((u) => `"${u}"`)
        .join(", ")}. Allowed: ${KNOWN_COLUMNS.join(", ")}.`
    );
  }
  if (errors.length > 0) {
    return { ok: false, employees: [], errors };
  }

  const seenEmails = new Set<string>();

  for (let r = 1; r < nonEmpty.length; r++) {
    const cells = nonEmpty[r];
    const rowNo = r + 1; // 1-based, matching what a user sees in a spreadsheet
    const get = (col: string) => {
      const i = index[col];
      return i === undefined ? "" : (cells[i] ?? "").trim();
    };

    const name = get("name");
    const email = get("email");
    const department = get("department");
    const manager = get("manager");

    if (!name) {
      errors.push(`Row ${rowNo}: name is required.`);
      continue;
    }
    if (email && !EMAIL_RE.test(email)) {
      errors.push(`Row ${rowNo}: "${email}" is not a valid email address.`);
      continue;
    }
    if (email) {
      const key = email.toLowerCase();
      if (seenEmails.has(key)) {
        errors.push(`Row ${rowNo}: duplicate email "${email}" in this file.`);
        continue;
      }
      seenEmails.add(key);
    }

    employees.push({
      name: name.slice(0, 160),
      email: email ? email.toLowerCase().slice(0, 200) : null,
      department: department ? department.slice(0, 120) : null,
      manager: manager ? manager.slice(0, 160) : null,
    });
  }

  if (employees.length === 0 && errors.length === 0) {
    errors.push("No employee rows found below the header.");
  }

  return { ok: errors.length === 0, employees, errors };
}
