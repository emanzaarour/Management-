# MAPS Management Portal

This is the uploaded Next.js application, extended in place. It keeps the navy sidebar, dashboard cards/tables, English/Arabic interface, and supplied MAPS logo. It uses Next.js server routes and the Google Sheets API directly. It does not use Google Apps Script.

## Run locally

Use Node.js 24 (`.nvmrc`).

```bash
npm install
cp .env.example .env.local
# Enter real values securely in .env.local; never commit that file.
npm test
npm run build
npm run start
```

For development use `npm run dev`. A frozen dependency refresh uses `npm ci`.

Required server environment variables: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SESSION_SECRET`. Literal `\n` in the Google private key is converted to newlines server-side. Keys and session secrets must be real process values because they are used for local signing; a network proxy placeholder is insufficient.

Share the chosen spreadsheet with the service account as Editor, enable the Google Sheets API, and permit HTTPS traffic to `sheets.googleapis.com` and `oauth2.googleapis.com`. No client-supplied spreadsheet ID is accepted. No secret belongs in a `NEXT_PUBLIC_` variable.

## Tests

```bash
npm test
npm run build
npm run test:e2e
```

`npm test` runs server routes/data logic with a mocked Sheets transport and inspects real Excel workbooks. Browser tests start the production app; authenticated UI scenarios use explicit API fixtures. They also exercise real unauthenticated HTTP routes and origin protection. These do not prove live workbook access. See `SETUP_REPORT.md` for evidence and limitations.

Browser tests use `/usr/bin/chromium` when present. Otherwise install a Playwright browser (`npx playwright install chromium`) or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a supported Chromium executable. There is no standalone lint configuration in the original project.

## Access

Login remains temporarily email-only, as requested. Email comparison trims whitespace and ignores case. `Users_Access` requires `Active = Yes`, a recognized role, and a center. Only Admin can use `Center = All`. Existing sessions are rechecked against the access sheet on each API request.

- Admin: all modules and centers, plus setup.
- Manager: attendance/schedule management and views/exports within the assigned center. Program groups can be viewed, but managed by Admin/Officer.
- Officer: own program groups/sessions within the assigned center. Optional access to own schedule, reports or timesheets is granted in Admin Setup.

For an Officer, an optional `Staff ID` binds the login to a person. A unique matching staff name/center is used for older access sheets; otherwise the email is the fallback identity. Set an explicit ID in Admin Setup when names are ambiguous. Optional `Programs` restricts permitted programs (comma-separated); a blank value allows active programs for that Officer's own groups. `Schedule Access`, `Timesheet Access`, and `Reports Access` default to No. Read permission and export permission use the same role/scope rules.

Email-only login does not verify mailbox ownership. Do not treat it as strong identity authentication; OTP is deliberately not implemented.

## Sheets compatibility

Core sheets: `Users_Access`, `Staff_Master`, `Programs_Setup`, `Sections_Setup`, `Weekly_Schedule`, `Program_Groups`, `Program_Sessions`, `Attendance_Log`, `Payroll_Setup`, `System_Settings`, `Audit_Log`. The existing `Subjects_Setup` and `Time_Slots_Setup` are retained because the timetable editor uses them. No manual workload or report sheets are created.

Missing operational sheets/required headers are created additively on first use. Existing column order, normalized header spellings and unknown columns are preserved. Existing historical center values are not rewritten during reads. Targeted updates are mapped to physical header positions. `Type` and default staff times remain optional for loading older five-column staff sheets.

Programs come from `Programs_Setup`; there is no hardcoded program list. Sections use Center/Program/Section/Shift/Active, without mandatory dates. Inactive setup entries cannot be selected for new schedules/groups; historical data remains available for filters/exports. Renaming stable program, section, subject or time-slot identifiers is blocked; deactivate and add a new entry instead.

Default attendance is Friday/Saturday Off and other days Working. An Admin can configure `OffDays` in System Settings using JavaScript weekday numbers (`0=Sunday` through `6=Saturday`), e.g. `5,6`. Attendance is updated by Staff ID + Date. Submitting an existing month does not append another row for the same date.

The chosen week-start opens five consecutive dates, retaining the existing application behavior. Each section is a separate timetable. Recorded historical times are retained when setup slots change. Copy Previous Week applies the selected center/program/shift/section filters and validates conflicts before saving.

Dashboard and reports share calculated center/teacher/program/section/subject filters. Periods include one month, multiple months, a custom range, or all available months. The visible Month/Year controls also define the comparison month in a multi-month view. Weekly active records and completed program sessions contribute hours; cancelled/deleted weekly records and planned/cancelled program sessions do not. Weekly schedule records are not completion-tracked, so their counts represent scheduled classes rather than independently verified delivery.

Monthly Excel exports combine all permitted programs/subjects into one worksheet per person. Hours sum actual intervals and exclude gaps; historical overlaps are merged for the financial total. Staff working-attendance dates use optional Default Start/End Time if no session data exists. Without default times those dates show zero hours rather than inventing payable time. Configure these defaults via Staff Admin for attendance-only personnel.

`Payroll_Setup` supports Position/Hourly Rate/Currency/Active. Rates are setup metadata; the approved financial workbook reports hours, not payment amounts. Existing extra payroll columns are preserved.

## Concurrent writes and recovery

Portal saves are serialized across instances with a spreadsheet developer-metadata lock. This protects duplicate attendance insertion and overlap checks for concurrent portal requests. Direct spreadsheet edits and other applications do not honor this lock. Worksheet mutations and audit appends are not a cross-request database transaction; an interrupted Google API operation can need reconciliation.

If a server dies while saving, the lock is deliberately not auto-stolen. An administrator should stop all portal writers, inspect the affected operation/audit data, then inspect the lock:

```bash
node scripts/sheet-lock.mjs
```

Only after confirming no writer remains active, release a stale lock:

```bash
node scripts/sheet-lock.mjs --release --all-writers-stopped
```

This removes application metadata only. Do not run recovery against an active writer. The lock behavior is fixture-tested but still needs validation against the live workbook.

## Vercel

Import/push this folder to your Git repository and select it as the Vercel project root. Set Node.js 24 and add the four server environment variables securely in Vercel Project Settings. Enable Google Sheets access as described above, deploy, then validate login and persistence against the real workbook. Set the production HTTPS URL as the normal app origin; secure cookies are enabled in production. The logo is included in server file tracing for financial exports.

See `SETUP_REPORT.md` and `CHANGED_FILES.md` for the audit, validation results, outstanding live checks, and exact file list. This archive contains source and a lockfile, without credentials, build caches or node_modules.
