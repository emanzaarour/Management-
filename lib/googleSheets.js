import { HEADERS, headerIndex } from "./schema";
import { google } from "googleapis";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getAuth() {
  const email = required("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

let client;
export function sheetsClient() {
  if (!client) {
    required("GOOGLE_SHEET_ID");
    client = google.sheets({ version: "v4", auth: getAuth() });
  }
  return client;
}

export function getSpreadsheetId() {
  return required("GOOGLE_SHEET_ID");
}

export function columnLetter(number) {
  let n = Number(number);
  let result = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    result = String.fromCharCode(65 + r) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || "A";
}

export async function ensureSheet(sheetName, headers = []) {
  const sheets = sheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === sheetName,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }
  if (headers.length) await ensureHeaders(sheetName, headers);
}

export async function ensureHeaders(sheetName, requiredHeaders = []) {
  const sheets = sheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const current = response.data.values?.[0] || [];
  if (!current.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${columnLetter(requiredHeaders.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [requiredHeaders] },
    });
    return requiredHeaders;
  }
  const next = [...current];
  for (const header of requiredHeaders)
    if (headerIndex(next, header) < 0) next.push(header);
  if (next.length !== current.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${columnLetter(next.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [next] },
    });
  }
  return next;
}

export async function readSheet(sheetName) {
  const sheets = sheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:AZ`,
  });
  const values = response.data.values || [];
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0].map((h) => String(h).trim());
  const rows = values.slice(1).map((row, index) => {
    const item = { __rowNumber: index + 2 };
    headers.forEach((header, i) => {
      item[header] = row[i] ?? "";
    });
    for (const field of HEADERS[sheetName] || []) {
      const i = headerIndex(headers, field);
      if (i >= 0) item[field] = row[i] ?? "";
    }
    return item;
  });
  return { headers, rows };
}

export async function appendRows(sheetName, rows) {
  if (!rows.length) return;
  const headers = await ensureHeaders(sheetName, HEADERS[sheetName] || []);
  const fields = HEADERS[sheetName];
  if (fields)
    rows = rows.map((row) => {
      const aligned = Array(headers.length).fill("");
      row.forEach((v, i) => {
        const col = headerIndex(headers, fields[i]);
        if (col >= 0) aligned[col] = v;
      });
      return aligned;
    });
  const sheets = sheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:AZ`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export async function batchUpdateRows(updates) {
  if (!updates.length) return;
  const data = [];
  const headersBySheet = new Map();
  for (const update of updates) {
    const match = update.range.match(
      /^([A-Za-z_]+)!([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/,
    );
    if (!match || !HEADERS[match[1]])
      throw new Error("Unsupported update range");
    const [, sheet, col, row] = match;
    if (Number(row) < 2) throw new Error("Data writes cannot replace headers");
    if (!headersBySheet.has(sheet))
      headersBySheet.set(sheet, await ensureHeaders(sheet, HEADERS[sheet]));
    const headers = headersBySheet.get(sheet);
    const start =
      [...col].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
    for (const [offset, values] of update.values.entries())
      for (const [i, value] of values.entries()) {
        const field = HEADERS[sheet][start + i];
        const physical = headerIndex(headers, field);
        if (physical < 0) throw new Error("Missing field for update");
        data.push({
          range: `${sheet}!${columnLetter(physical + 1)}${Number(row) + offset}`,
          values: [[value]],
        });
      }
  }
  const sheets = sheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });
}

// Sheets metadata IDs are spreadsheet-scoped and unique. Claiming one serializes
// writes across Vercel instances; never auto-steal a lock from a running writer.
export const WRITE_LOCK_ID = 1739701201;
export async function withSpreadsheetLock(operation) {
  const sheets = sheetsClient(),
    spreadsheetId = getSpreadsheetId();
  const owner = globalThis.crypto.randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              createDeveloperMetadata: {
                developerMetadata: {
                  metadataId: WRITE_LOCK_ID,
                  metadataKey: "MAPS_WRITE_LOCK",
                  metadataValue: owner,
                  location: { spreadsheet: true },
                  visibility: "DOCUMENT",
                },
              },
            },
          ],
        },
      });
      acquired = true;
      break;
    } catch (error) {
      if (Number(error.code || error.response?.status) !== 400) throw error;
      const result = await sheets.spreadsheets.developerMetadata.get({
        spreadsheetId,
        metadataId: WRITE_LOCK_ID,
      });
      if (result.data.metadataKey !== "MAPS_WRITE_LOCK")
        throw new Error(
          "Spreadsheet metadata ID collision; contact your administrator",
        );
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!acquired)
    throw new Error(
      "Another save is in progress. Retry shortly; if it persists, an administrator must inspect the write lock.",
    );
  try {
    return await operation();
  } finally {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDeveloperMetadata: {
              dataFilter: {
                developerMetadataLookup: {
                  metadataId: WRITE_LOCK_ID,
                  metadataValue: owner,
                },
              },
            },
          },
        ],
      },
    });
  }
}
