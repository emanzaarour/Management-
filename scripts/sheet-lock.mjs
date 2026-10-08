// Run only from a trusted administrative shell with the application's real env.
import { google } from "googleapis";
const required = (name) => {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
};
const spreadsheetId = required("GOOGLE_SHEET_ID");
const auth = new google.auth.JWT({
  email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  key: required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const api = google.sheets({ version: "v4", auth });
const metadataId = 1739701201;
try {
  const { data } = await api.spreadsheets.developerMetadata.get({
    spreadsheetId,
    metadataId,
  });
  if (data.metadataKey !== "MAPS_WRITE_LOCK")
    throw new Error(
      "Metadata ID belongs to another application; do not remove it",
    );
  console.log("MAPS spreadsheet write lock is present.");
  if (process.argv.includes("--release")) {
    if (!process.argv.includes("--all-writers-stopped"))
      throw new Error(
        "Stop all portal writers first, then explicitly pass --all-writers-stopped",
      );
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDeveloperMetadata: {
              dataFilter: {
                developerMetadataLookup: {
                  metadataId,
                  metadataKey: "MAPS_WRITE_LOCK",
                },
              },
            },
          },
        ],
      },
    });
    console.log(
      "Stale MAPS write lock released; no worksheet data was changed.",
    );
  }
} catch (error) {
  if (Number(error.code || error.response?.status) === 404)
    console.log("No MAPS spreadsheet write lock is present.");
  else {
    console.error("Lock check failed:", error.message);
    process.exitCode = 1;
  }
}
