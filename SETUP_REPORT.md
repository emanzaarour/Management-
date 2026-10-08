# MAPS portal audit and handoff — 8 October 2026

The uploaded Next.js project was inspected and extended in place. It was not rebuilt from scratch. All files from the uploaded archive are retained; the supplied logo is unchanged.

1. **Existing implementation:** The upload already contained email-only login, the navy bilingual UI, staff attendance, separate weekly section tables, initial conflict checks, recurring program groups, session exceptions, workload calculations, and both Excel exports. These were inspected and retained. This describes the original code; the original project was not connected to live Google Sheets during this task.

2. **Changes:** Added shared module/center/person/program authorization; rechecked active users on every request; normalized sheet headers for both reads and writes; completed month/period analytics and detailed monthly trends; reused analytics filters in Reports; completed historical workload filters; added payroll/system settings tabs and Officer permission controls; preserved historical schedule slots/closed sections; added recurring-group conflict checks while editing the form; added tests and deployment instructions.

3. **Bugs fixed:** Removed the non-Admin `All` center bypass; stopped setup data leaking global users/staff; prevented Officer access to others' groups; fixed a copy-week endpoint accepting an injected `user`; fixed cross-center financial inclusion; included inactive historical personnel in financial exports; fixed fixed-column writes that could corrupt reordered sheets; blocked duplicate attendance dates within a request and serialized concurrent saves; fixed submitted-attendance counting; included shift in timetable cell identities; fixed filter labeling, asynchronous setup center initialization, independent Admin forms, private-key example escaping, historical time retention and retired teacher/subject display. Financial exports now fail visibly if the logo is unavailable, include it in every worksheet, retain zero-hour values, and use a valid print-area setting.

4. **Implemented/retained features:** One-month/multiple-month/custom/all-period analytics; teacher comparison-month and selected-period hours; teacher sessions/days; subject share and section/month counts; detailed monthly teacher/subject/section trends; scoped attendance save/update/reload; weekly creation/edit/soft-delete/copy/shift/section/all-section views; identical/partial overlap checks across schedule and program sessions; recurring configurable groups; edit-one-session exceptions; automatic Completed status; historical Teacher Hours; role-scoped weekly and monthly Excel; one financial worksheet per person with merged daily intervals and the requested template/logo; stable setup identifiers and audit entries. No report/workload sheets are created, and no Apps Script is used.

5. **Incomplete or unverified:** Live Google Sheets login, read/write persistence, real service-account authorization, schema initialization, distributed metadata locking and recovery, and a deployed Vercel smoke test remain unverified. The required four variables are absent in this cloud machine. HTTPS checks to both Google API hosts returned proxy `403 Domain forbidden`. Authenticated tests use fixtures, not the user's workbook. There is no claim that the real workbook or production deployment is ready. OTP remains intentionally outside scope.

6. **Security findings:** Server checks protect data and exports; Managers cannot bypass center isolation; Officer optional access defaults to No and uses own person/program scope; session cookies are HttpOnly/SameSite=Lax and Secure in production; HMAC signatures/expiry and current active access are checked; cross-origin mutations are rejected; spreadsheet IDs come only from the configured server environment; writes use RAW values and targeted columns; secrets are not client imports or public environment variables. Email-only login still allows someone who knows an authorized email to impersonate that identity: this is the explicitly requested temporary model, not mailbox verification. Portal write serialization does not protect direct sheet edits by other tools. A process interruption can leave a lock or partial multi-request operation requiring administrative reconciliation. See README for controlled recovery. Production and full development dependency audits report zero vulnerabilities in the verified lockfile.

7. **Google Sheets compatibility:** Tested a five-column Staff_Master with no Type, reordered normalized headers, a historical center alias and an unknown custom column. Staff remains available and custom values survive updates. Aliases cover Qab Elias/Kab elias, Marj/AL Marj, Dalhamieh/Dalhamiye, Jeb Janin/Jeb Janine and direct Bar Elias. Historical reads do not rewrite names. Missing operational sheets/required headers are added, not replaced. Programs/sections remain data-driven; Active=No hides new entries and preserves history. Existing Subjects_Setup and Time_Slots_Setup are retained. No Teacher_Workload, Subject_Report or Section_Report sheets are introduced.

8. **Exact files:** See CHANGED_FILES.md for the modified and added files compared with the uploaded ZIP. The repository initially contained only a README; the existing uploaded application has now been placed in `/workspace/Management-`.

9. **Verification:** `npm install` completed; `npm ci` also completed during setup. The final `npm test` ran 44 tests and passed. `npm run build` exited 0 on Next.js 15.5.27 / Node.js 24.19.0. Seven Chromium browser checks passed against the built app (see verification/browser.txt). No standalone lint script/config existed, so no separate lint run is claimed. Build output, test output, browser output and dependency audit JSON are included under verification/. Tests cover the required role/scope, attendance, schedule/overlap/copy, session recurrence/exceptions/completion, historical and combined-period analytics/workload, Excel contents/logo/permissions, and mobile English LTR/Arabic RTL scenarios.

10. **Vercel:** The application builds and has the Vercel framework configuration, Node.js 24 engine and financial-logo file tracing. It is suitable to deploy for staging, but production readiness is conditional on the four real environment values, Sheets API enablement, workbook Editor permission, allowed Google API traffic, live persistence/export checks and a Vercel HTTPS smoke test. Deployment itself was not performed. A ZIP is source delivery; connect/push this source to the intended Git repository for Vercel deployment.

11. **Personal Google Sheet changes:** No Google Sheet changes are required. This means no manual worksheet/header redesign is needed for the supported starting schema: the app adds missing sheets/required headers safely. Live sheet contents could not be inspected, so any existing invalid rows or ambiguous identities still need review after connecting. Use Admin Setup for the optional controls below rather than manually restructuring sheets. Share the workbook with the service account as Editor; this is a permission requirement, not a schema change.

## Optional/additive fields managed by the app

These are appended on the relevant Admin save when absent; existing columns/values are retained. They are not mandatory for standard legacy staff attendance/login.

| Sheet Name | Column Name | Required Value / Change |
| --- | --- | --- |
| Users_Access | Staff ID | Optional stable Staff_Master ID for an Officer; recommended when a unique matching name/center cannot be inferred. Legacy email-owned groups remain accessible to that email. |
| Users_Access | Programs | Optional comma-separated permitted programs; blank permits active programs for the Officer's own groups. |
| Users_Access | Schedule Access | `Yes` only when that Officer may read/export their own weekly data; defaults to No. |
| Users_Access | Timesheet Access | `Yes` only when that Officer may read/export their own financial data; defaults to No. |
| Users_Access | Reports Access | `Yes` only when that Officer may view their own Reports; defaults to No. |
| Staff_Master | Type | Optional; inferred from Position when absent. |
| Staff_Master | Default Start Time / Default End Time | Optional HH:mm times for attendance-only staff; without times their working attendance rows do not invent payable hours. |
| Audit_Log | Entity / Old Value / New Value | Added alongside the existing audit fields; meaningful updates record old/new data. |
| Payroll_Setup | Position / Hourly Rate / Currency / Active | Added if missing; setup metadata only, not extra columns in the approved hours-only financial template. |

Existing access data must still have `Active=Yes` and a recognized Role. Non-Admin Center must name the assigned center, not All. Existing Programs_Setup and Sections_Setup should identify the real active programs/sections; the app deliberately does not seed a hardcoded program list.

## Saved cloud configuration

Saved `install_script`, `start_skill`, the four variable requirements, and custom domain additions `sheets.googleapis.com` / `oauth2.googleapis.com`. Existing package-manager network presets were preserved. Saving the draft did not apply runtime values/network policy or publish a snapshot. Review and save the changes in environment settings, enter actual values securely, then publish the prepared environment. Never supply keys in chat. Vercel environment settings must be configured separately.

## Live acceptance checks after configuration

- Confirm active Admin/Manager/Officer and inactive/unknown-email behavior with real access rows.
- Verify Manager isolation and Officer own-group/program filtering on the connected workbook.
- Save, update and reload designated test attendance; confirm only one Staff ID/Date row and an audit entry.
- Validate one weekly save/edit/copy, identical/partial overlap rejection, and real metadata lock release/concurrency.
- Validate recurring groups, one-session exceptions, automatic completion and Officer conflicts.
- Compare selected teacher/subject/section counts with real historical rows and inspect both exports as Admin and authorized non-Admin.
- Perform the production HTTPS cookie/session and server-export checks on Vercel.

Use designated test data and preserve historical records. Weekly active schedule rows are used for class counts; there is no separate delivered-class completion field in the supplied schedule model. Completed program sessions are counted separately from Planned/Cancelled sessions. A real historical dataset may need data-quality reconciliation; this task did not silently alter historical records.
