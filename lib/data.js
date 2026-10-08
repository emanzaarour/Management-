import crypto from "crypto";
import {
  appendRows,
  batchUpdateRows,
  columnLetter,
  ensureHeaders,
  ensureSheet,
  readSheet,
  withSpreadsheetLock,
} from "./googleSheets";

import { HEADERS, SHEETS } from "./schema";
export { SHEETS } from "./schema";
import {
  canAccessCenter,
  canReadModule,
  canManageProgramSessions,
  canAccessGroup,
  canAccessPerson,
  isAdmin,
  isOfficer,
  personIdForUser,
  programAllowed,
} from "./policy";
import {
  validateDate,
  validateMonth,
  validateInterval,
  validateRange,
} from "./validation";

const clean = (value) => String(value ?? "").trim();
const norm = (value) => clean(value).toLowerCase().replace(/\s+/g, " ");
const headerKey = (value) => norm(value).replace(/[^a-z0-9]/g, "");
function pick(row, ...candidates) {
  for (const candidate of candidates) {
    if (row?.[candidate] !== undefined && row?.[candidate] !== "")
      return row[candidate];
  }
  const wanted = new Set(candidates.map(headerKey));
  for (const [key, value] of Object.entries(row || {})) {
    if (wanted.has(headerKey(key)) && value !== undefined && value !== "")
      return value;
  }
  return "";
}
const yes = (value) =>
  norm(value) === "yes" || norm(value) === "true" || value === true;
const yesNo = (value) => (yes(value) ? "Yes" : "No");
const nowIso = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, "0");

const CENTER_ALIASES = new Map([
  ["kab elias", "Qab Elias"],
  ["qab elias", "Qab Elias"],
  ["qabelias", "Qab Elias"],
  ["al marj", "Marj"],
  ["marj", "Marj"],
  ["dalhamiye", "Dalhamieh"],
  ["dalhamieh", "Dalhamieh"],
  ["dalhamiyet zahleh", "Dalhamieh"],
  ["jeb janine", "Jeb Janin"],
  ["jeb janin", "Jeb Janin"],
  ["jeb jannine", "Jeb Janin"],
  ["bar elias", "Bar Elias"],
  ["saadnayel", "Saadnayel"],
  ["taalabaya", "Taalabaya"],
  ["taanayel", "Taanayel"],
]);

export function canonicalCenter(value) {
  const v = clean(value);
  return CENTER_ALIASES.get(norm(v)) || v;
}

export function dateKey(value) {
  if (!value) return "";
  const s = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad(dmy[2])}-${pad(dmy[1])}`;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return s;
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function addDays(iso, days) {
  const d = new Date(`${dateKey(iso)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

export function dayName(iso) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateKey(iso)}T12:00:00Z`));
}

export function timeToMinutes(value) {
  const m = clean(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function rangesOverlap(startA, endA, startB, endB) {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  if ([a1, a2, b1, b2].some((x) => x === null)) return false;
  return a1 < b2 && b1 < a2;
}

function durationMinutes(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null || e <= s) return 0;
  return e - s;
}

function inferType(position, explicit = "") {
  if (clean(explicit)) return clean(explicit);
  const p = norm(position);
  if (p.includes("teacher")) return "Teacher";
  if (p.includes("facilitator") || p.includes("facil")) return "Facilitator";
  if (p.includes("officer")) return "Officer";
  return "Staff";
}

let setupPromise;
export async function ensurePortalSheets() {
  if (!setupPromise)
    setupPromise = withSpreadsheetLock(async () => {
      for (const [sheet, headers] of Object.entries(HEADERS))
        await ensureSheet(
          sheet,
          sheet === SHEETS.STAFF || sheet === SHEETS.USERS
            ? headers.slice(0, 5)
            : headers,
        );

      const subjects = await readSheet(SHEETS.SUBJECTS);
      if (!subjects.rows.length)
        await appendRows(SHEETS.SUBJECTS, [
          ["Arabic", "Yes"],
          ["English", "Yes"],
          ["Math", "Yes"],
          ["CBPSS", "Yes"],
        ]);
      const timeSlots = await readSheet(SHEETS.TIME_SLOTS);
      if (!timeSlots.rows.length) {
        await appendRows(SHEETS.TIME_SLOTS, [
          ["Morning", 1, "08:00", "08:40", "Yes"],
          ["Morning", 2, "08:40", "09:20", "Yes"],
          ["Morning", 3, "09:40", "10:20", "Yes"],
          ["Morning", 4, "10:20", "11:00", "Yes"],
          ["Morning", 5, "11:20", "12:00", "Yes"],
          ["Afternoon", 1, "12:15", "12:55", "Yes"],
          ["Afternoon", 2, "12:55", "13:35", "Yes"],
          ["Afternoon", 3, "13:50", "14:30", "Yes"],
          ["Afternoon", 4, "14:30", "15:10", "Yes"],
          ["Afternoon", 5, "15:25", "16:05", "Yes"],
        ]);
      }
    }).catch((error) => {
      setupPromise = null;
      throw error;
    });
  return setupPromise;
}

export async function findAuthorizedUser(email) {
  const { rows } = await readSheet(SHEETS.USERS);
  const row = rows.find(
    (r) => norm(pick(r, "Email", "User Email")) === norm(email),
  );
  if (
    !row ||
    norm(pick(row, "Active")) !== "yes" ||
    !["admin", "manager", "officer"].includes(norm(pick(row, "Role")))
  )
    return null;
  const user = {
    email: clean(pick(row, "Email", "User Email")),
    name: clean(pick(row, "Name", "User Name")),
    role: clean(pick(row, "Role")) || "Manager",
    center: canonicalCenter(pick(row, "Center", "Centre")),
  };
  if (
    !user.center ||
    (norm(user.role) !== "admin" && norm(user.center) === "all")
  )
    return null;
  user.staffId = clean(pick(row, "Staff ID"));
  user.programs = clean(pick(row, "Programs"))
    .split(",")
    .map(clean)
    .filter(Boolean);
  user.scheduleAccess = yes(pick(row, "Schedule Access"));
  user.timesheetAccess = yes(pick(row, "Timesheet Access"));
  user.reportsAccess = yes(pick(row, "Reports Access"));
  if (norm(user.role) === "officer" && !user.staffId) {
    const staffRows = (await readSheet(SHEETS.STAFF)).rows;
    const matches = staffRows.filter(
      (s) =>
        norm(pick(s, "Staff Name", "Name")) === norm(user.name) &&
        norm(canonicalCenter(pick(s, "Center"))) === norm(user.center),
    );
    if (matches.length === 1)
      user.staffId = clean(pick(matches[0], "Staff ID"));
  }
  return user;
}

export async function getAccessUsers() {
  await ensurePortalSheets();
  const { rows } = await readSheet(SHEETS.USERS);
  return rows
    .map((r) => ({
      email: clean(r.Email),
      name: clean(r.Name),
      role: clean(r.Role) || "Manager",
      center: canonicalCenter(r.Center),
      active: yes(r.Active),
      staffId: clean(r["Staff ID"]),
      programs: clean(r.Programs),
      scheduleAccess: yes(r["Schedule Access"]),
      timesheetAccess: yes(r["Timesheet Access"]),
      reportsAccess: yes(r["Reports Access"]),
      __rowNumber: r.__rowNumber,
    }))
    .filter((r) => r.email);
}

export async function getAllStaff() {
  await ensurePortalSheets();
  const { rows } = await readSheet(SHEETS.STAFF);
  return rows
    .map((r) => {
      const id = clean(pick(r, "Staff ID", "StaffID", "ID"));
      const name = clean(pick(r, "Staff Name", "Name", "Employee Name"));
      const position = clean(pick(r, "Position", "Job Title"));
      const center = canonicalCenter(pick(r, "Center", "Centre"));
      const activeValue = pick(r, "Active", "Status");
      const explicitType = clean(
        pick(r, "Type", "Employee Type", "Staff Type"),
      );
      return {
        id,
        name,
        position,
        center,
        active: yes(activeValue),
        type: inferType(position, explicitType),
        defaultStart: clean(pick(r, "Default Start Time", "Start Time")),
        defaultEnd: clean(pick(r, "Default End Time", "End Time")),
        __rowNumber: r.__rowNumber,
      };
    })
    .filter((r) => r.id && r.name);
}

export async function getActiveStaff() {
  return (await getAllStaff()).filter((s) => s.active);
}

export async function getCenters() {
  const [staff, users, sections] = await Promise.all([
    getAllStaff(),
    getAccessUsers(),
    readSheet(SHEETS.SECTIONS),
  ]);
  const values = [
    ...staff.map((s) => s.center),
    ...users.map((u) => (norm(u.center) === "all" ? "" : u.center)),
    ...sections.rows.map((r) => canonicalCenter(r.Center)),
  ].filter(Boolean);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

async function appendAuditRow({
  user,
  center = "",
  action,
  entity = "",
  staffId = "",
  staffName = "",
  date = "",
  oldValue = "",
  newValue = "",
}) {
  await appendRows(SHEETS.AUDIT, [
    [
      nowIso(),
      user.email,
      user.name,
      user.role,
      canonicalCenter(center),
      action,
      staffId,
      staffName,
      date,
      oldValue,
      newValue,
      entity || action.split("_")[0],
      oldValue,
      newValue,
    ],
  ]);
}

export async function getSystemSettings() {
  await ensurePortalSheets();
  const { rows } = await readSheet(SHEETS.SETTINGS);
  const map = Object.fromEntries(
    rows.map((r) => [clean(r.Setting), clean(r.Value)]),
  );
  const offDays = (map.OffDays ?? "5,6")
    .split(",")
    .filter((x) => x !== "")
    .map(Number)
    .filter((n) => n >= 0 && n <= 6);
  return { offDays };
}

async function updateSystemSettingsUnlocked({ user, offDays }) {
  await ensurePortalSheets();
  const value = [
    ...new Set((offDays || []).map(Number).filter((n) => n >= 0 && n <= 6)),
  ]
    .sort()
    .join(",");
  const { rows } = await readSheet(SHEETS.SETTINGS);
  const existing = rows.find((r) => clean(r.Setting) === "OffDays");
  if (existing)
    await batchUpdateRows([
      {
        range: `${SHEETS.SETTINGS}!A${existing.__rowNumber}:B${existing.__rowNumber}`,
        values: [["OffDays", value]],
      },
    ]);
  else await appendRows(SHEETS.SETTINGS, [["OffDays", value]]);
  await appendAuditRow({
    user,
    action: "SETTINGS_UPDATE",
    oldValue: existing?.Value || "",
    newValue: `OffDays=${value}`,
  });
  return getSystemSettings();
}

export async function getAttendanceRows() {
  await ensurePortalSheets();
  return (await readSheet(SHEETS.ATTENDANCE)).rows;
}

async function saveAttendanceUnlocked({ user, staff, month, year, days }) {
  await ensurePortalSheets();
  if (
    !canReadModule(user, "attendance") ||
    !canAccessCenter(user, staff.center)
  )
    throw new Error("Forbidden");
  validateMonth(month, year);
  if (!Array.isArray(days) || days.length > 31)
    throw new Error("Invalid attendance payload");
  const keys = new Set();
  for (const day of days) {
    validateDate(day.date);
    if (
      Number(day.date.slice(0, 4)) !== year ||
      Number(day.date.slice(5, 7)) !== month ||
      !["Working", "Off"].includes(day.status) ||
      keys.has(day.date)
    )
      throw new Error("Invalid or duplicate attendance date/status");
    keys.add(day.date);
  }
  const now = nowIso();
  const { rows } = await readSheet(SHEETS.ATTENDANCE);
  const byKey = new Map(
    rows.map((r) => [`${clean(r["Staff ID"])}|${dateKey(r.Date)}`, r]),
  );
  const updates = [];
  const appends = [];
  const audits = [];
  for (const item of days) {
    if (!["Working", "Off"].includes(item.status)) continue;
    const key = `${staff.id}|${item.date}`;
    const existing = byKey.get(key);
    if (existing) {
      if (clean(existing.Status) !== item.status) {
        const values = [
          staff.id,
          staff.name,
          staff.position,
          staff.center,
          item.date,
          month,
          year,
          item.status,
          existing["Submitted By"] || user.email,
          existing["Submitted At"] || now,
          now,
        ];
        updates.push({
          range: `${SHEETS.ATTENDANCE}!A${existing.__rowNumber}:K${existing.__rowNumber}`,
          values: [values],
        });
        audits.push([
          now,
          user.email,
          user.name,
          user.role,
          staff.center,
          "ATTENDANCE_UPDATE",
          staff.id,
          staff.name,
          item.date,
          clean(existing.Status),
          item.status,
          "Attendance",
          clean(existing.Status),
          item.status,
        ]);
      }
    } else {
      appends.push([
        staff.id,
        staff.name,
        staff.position,
        staff.center,
        item.date,
        month,
        year,
        item.status,
        user.email,
        now,
        now,
      ]);
      audits.push([
        now,
        user.email,
        user.name,
        user.role,
        staff.center,
        "ATTENDANCE_SUBMIT",
        staff.id,
        staff.name,
        item.date,
        "",
        item.status,
        "Attendance",
        "",
        item.status,
      ]);
    }
  }
  await batchUpdateRows(updates);
  await appendRows(SHEETS.ATTENDANCE, appends);
  await appendRows(SHEETS.AUDIT, audits);
  return { ok: true };
}

export async function getAttendanceForStaff({ staffId, month, year }) {
  validateMonth(month, year);
  const rows = await getAttendanceRows();
  return rows
    .filter((r) => clean(r["Staff ID"]) === clean(staffId))
    .map((r) => ({ date: dateKey(r.Date), status: clean(r.Status) }))
    .filter(
      (r) =>
        Number(r.date.slice(0, 4)) === Number(year) &&
        Number(r.date.slice(5, 7)) === Number(month),
    );
}

export async function getStaffWithAttendanceStatus({ center, month, year }) {
  validateMonth(month, year);
  const [staff, attendance] = await Promise.all([
    getActiveStaff(),
    getAttendanceRows(),
  ]);
  const requestedCenter = canonicalCenter(center);
  const filtered = staff.filter(
    (s) => norm(canonicalCenter(s.center)) === norm(requestedCenter),
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  const counts = new Map();
  for (const r of attendance) {
    const d = dateKey(r.Date);
    if (!d) continue;
    if (!["Working", "Off"].includes(clean(r.Status))) continue;
    if (
      Number(d.slice(0, 4)) !== Number(year) ||
      Number(d.slice(5, 7)) !== Number(month)
    )
      continue;
    const id = clean(r["Staff ID"]);
    if (!counts.has(id)) counts.set(id, new Set());
    counts.get(id).add(d);
  }
  return filtered.map((s) => ({
    ...s,
    savedDays: counts.get(s.id)?.size || 0,
    submitted: (counts.get(s.id)?.size || 0) >= daysInMonth,
  }));
}

export async function getSetupData() {
  await ensurePortalSheets();
  const [programs, sections, subjects, timeSlots, staff, users, centers] =
    await Promise.all([
      readSheet(SHEETS.PROGRAMS),
      readSheet(SHEETS.SECTIONS),
      readSheet(SHEETS.SUBJECTS),
      readSheet(SHEETS.TIME_SLOTS),
      getAllStaff(),
      getAccessUsers(),
      getCenters(),
    ]);
  return {
    programs: programs.rows
      .map((r) => ({
        program: clean(r.Program),
        category: clean(r.Category),
        requiredSessions: Number(r["Required Sessions"]) || 9,
        active: yes(r.Active),
        rowNumber: r.__rowNumber,
      }))
      .filter((r) => r.program),
    sections: sections.rows
      .map((r) => ({
        center: canonicalCenter(r.Center),
        program: clean(r.Program),
        section: clean(r.Section),
        shift: clean(r.Shift),
        active: yes(r.Active),
        rowNumber: r.__rowNumber,
      }))
      .filter((r) => r.center && r.program && r.section),
    subjects: subjects.rows
      .map((r) => ({
        subject: clean(r.Subject),
        active: yes(r.Active),
        rowNumber: r.__rowNumber,
      }))
      .filter((r) => r.subject),
    timeSlots: timeSlots.rows
      .map((r) => ({
        shift: clean(r.Shift),
        session: Number(r.Session),
        startTime: clean(r["Start Time"]),
        endTime: clean(r["End Time"]),
        active: yes(r.Active),
        rowNumber: r.__rowNumber,
      }))
      .filter((r) => r.shift && r.session),
    payroll: (await readSheet(SHEETS.PAYROLL)).rows.map((r) => ({
      position: clean(r.Position),
      hourlyRate: Number(r["Hourly Rate"]) || 0,
      currency: clean(r.Currency),
      active: yes(r.Active),
      rowNumber: r.__rowNumber,
    })),
    systemSettings: (await readSheet(SHEETS.SETTINGS)).rows.map((r) => ({
      setting: clean(r.Setting),
      value: clean(r.Value),
      rowNumber: r.__rowNumber,
    })),
    staff,
    users,
    centers,
  };
}

async function upsertSetupEntityUnlocked({ user, entity, rowNumber, data }) {
  await ensurePortalSheets();
  const specs = {
    payroll: {
      sheet: SHEETS.PAYROLL,
      headers: HEADERS[SHEETS.PAYROLL],
      values: () => [
        clean(data.position),
        Number(data.hourlyRate) || 0,
        clean(data.currency),
        yesNo(data.active),
      ],
    },
    setting: {
      sheet: SHEETS.SETTINGS,
      headers: HEADERS[SHEETS.SETTINGS],
      values: () => [clean(data.setting), clean(data.value)],
    },
    program: {
      sheet: SHEETS.PROGRAMS,
      headers: HEADERS[SHEETS.PROGRAMS],
      values: () => [
        clean(data.program),
        clean(data.category),
        yesNo(data.active),
      ],
    },
    section: {
      sheet: SHEETS.SECTIONS,
      headers: HEADERS[SHEETS.SECTIONS],
      values: () => [
        canonicalCenter(data.center),
        clean(data.program),
        clean(data.section),
        clean(data.shift),
        yesNo(data.active),
      ],
    },
    subject: {
      sheet: SHEETS.SUBJECTS,
      headers: HEADERS[SHEETS.SUBJECTS],
      values: () => [clean(data.subject), yesNo(data.active)],
    },
    timeSlot: {
      sheet: SHEETS.TIME_SLOTS,
      headers: HEADERS[SHEETS.TIME_SLOTS],
      values: () => [
        clean(data.shift),
        Number(data.session),
        clean(data.startTime),
        clean(data.endTime),
        yesNo(data.active),
      ],
    },
  };
  const spec = specs[entity];
  if (!spec) throw new Error("Unknown setup entity.");
  const values = spec.values();
  const oldRow = rowNumber
    ? (await readSheet(spec.sheet)).rows.find(
        (r) => r.__rowNumber === Number(rowNumber),
      )
    : null;
  if (
    rowNumber &&
    (!Number.isInteger(Number(rowNumber)) || Number(rowNumber) < 2 || !oldRow)
  )
    throw new Error("Setup row not found");
  const stableFields = {
    payroll: ["Position"],
    setting: ["Setting"],
    program: ["Program"],
    section: ["Center", "Program", "Section", "Shift"],
    subject: ["Subject"],
    timeSlot: ["Shift", "Session"],
  }[entity];
  if (
    oldRow &&
    stableFields.some(
      (f) => norm(oldRow[f]) !== norm(values[spec.headers.indexOf(f)]),
    )
  )
    throw new Error(
      "Stable setup identifiers cannot be changed; deactivate and add a new entry.",
    );
  if (
    !rowNumber &&
    (await readSheet(spec.sheet)).rows.some((r) =>
      stableFields.every(
        (f) => norm(r[f]) === norm(values[spec.headers.indexOf(f)]),
      ),
    )
  )
    throw new Error("Setup entry already exists");
  if (
    entity === "section" &&
    (!clean(data.program) ||
      !clean(data.section) ||
      !["Morning", "Afternoon"].includes(data.shift))
  )
    throw new Error("Program, section and shift are required");
  if (entity === "timeSlot")
    validateInterval("2026-01-01", data.startTime, data.endTime);
  if (values.some((v, i) => i < 1 && !clean(v)))
    throw new Error("Required field is missing.");
  if (rowNumber) {
    await batchUpdateRows([
      {
        range: `${spec.sheet}!A${rowNumber}:${columnLetter(spec.headers.length)}${rowNumber}`,
        values: [values],
      },
    ]);
  } else await appendRows(spec.sheet, [values]);
  await appendAuditRow({
    user,
    center: data.center || "",
    action: `SETUP_${entity.toUpperCase()}_${rowNumber ? "UPDATE" : "CREATE"}`,
    oldValue: oldRow ? JSON.stringify(oldRow) : "",
    newValue: JSON.stringify(data),
  });
  return { ok: true };
}

async function createStaffMemberUnlocked({ user, staff }) {
  const id = clean(staff.id);
  const name = clean(staff.name);
  const position = clean(staff.position);
  const center = canonicalCenter(staff.center);
  if (!id || !name || !position || !center)
    throw new Error("Staff ID, name, position and center are required.");
  const all = await getAllStaff();
  if (all.some((s) => norm(s.id) === norm(id)))
    throw new Error("Staff ID already exists.");
  const values = [
    id,
    name,
    position,
    center,
    yesNo(staff.active ?? true),
    clean(staff.type) || inferType(position),
    clean(staff.defaultStart),
    clean(staff.defaultEnd),
  ];
  await appendRows(SHEETS.STAFF, [values]);
  await appendAuditRow({
    user,
    center,
    action: "STAFF_CREATE",
    staffId: id,
    staffName: name,
    newValue: values.join(" | "),
  });
  return { ok: true };
}

async function updateStaffMemberUnlocked({ user, staffId, patch }) {
  const all = await getAllStaff();
  const existing = all.find((s) => norm(s.id) === norm(staffId));
  if (!existing) throw new Error("Staff member not found.");
  const values = [
    existing.id,
    clean(patch.name) || existing.name,
    clean(patch.position) || existing.position,
    canonicalCenter(patch.center || existing.center),
    yesNo(patch.active ?? existing.active),
    clean(patch.type) || existing.type,
    clean(patch.defaultStart ?? existing.defaultStart),
    clean(patch.defaultEnd ?? existing.defaultEnd),
  ];
  await batchUpdateRows([
    {
      range: `${SHEETS.STAFF}!A${existing.__rowNumber}:H${existing.__rowNumber}`,
      values: [values],
    },
  ]);
  await appendAuditRow({
    user,
    center: values[3],
    action: "STAFF_UPDATE",
    oldValue: JSON.stringify(existing),
    staffId: existing.id,
    staffName: values[1],
    newValue: values.join(" | "),
  });
  return { ok: true };
}

async function createAccessUserUnlocked({ user, entry }) {
  const email = clean(entry.email);
  if (!email || !clean(entry.name))
    throw new Error("Email and name are required.");
  const users = await getAccessUsers();
  if (users.some((u) => norm(u.email) === norm(email)))
    throw new Error("Email already exists.");
  const values = [
    email,
    clean(entry.name),
    clean(entry.role) || "Manager",
    canonicalCenter(entry.center),
    yesNo(entry.active ?? true),
    clean(entry.staffId),
    clean(entry.programs),
    yesNo(entry.scheduleAccess),
    yesNo(entry.timesheetAccess),
    yesNo(entry.reportsAccess),
  ];
  validateAccessEntry(entry);
  await appendRows(SHEETS.USERS, [values]);
  await appendAuditRow({
    user,
    center: values[3],
    action: "USER_CREATE",
    newValue: values.join(" | "),
  });
  return { ok: true };
}

async function updateAccessUserUnlocked({ user, email, patch }) {
  const users = await getAccessUsers();
  const existing = users.find((u) => norm(u.email) === norm(email));
  if (!existing) throw new Error("User not found.");
  const values = [
    existing.email,
    clean(patch.name) || existing.name,
    clean(patch.role) || existing.role,
    canonicalCenter(patch.center || existing.center),
    yesNo(patch.active ?? existing.active),
    clean(patch.staffId ?? existing.staffId),
    clean(patch.programs ?? existing.programs),
    yesNo(patch.scheduleAccess ?? existing.scheduleAccess),
    yesNo(patch.timesheetAccess ?? existing.timesheetAccess),
    yesNo(patch.reportsAccess ?? existing.reportsAccess),
  ];
  validateAccessEntry({ role: values[2], center: values[3] });
  await batchUpdateRows([
    {
      range: `${SHEETS.USERS}!A${existing.__rowNumber}:J${existing.__rowNumber}`,
      values: [values],
    },
  ]);
  await appendAuditRow({
    user,
    center: values[3],
    action: "USER_UPDATE",
    oldValue: JSON.stringify(existing),
    newValue: values.join(" | "),
  });
  return { ok: true };
}

function validateAccessEntry(entry) {
  if (
    !["admin", "manager", "officer"].includes(norm(entry.role)) ||
    !clean(entry.center) ||
    (norm(entry.role) !== "admin" && norm(entry.center) === "all")
  )
    throw new Error(
      "Valid role and assigned center are required; All is Admin-only.",
    );
}

function weeklyRow(r) {
  return {
    weekStart: dateKey(r["Week Start"]),
    date: dateKey(r.Date),
    center: canonicalCenter(r.Center),
    program: clean(r.Program),
    section: clean(r.Section),
    shift: clean(r.Shift),
    session: Number(r.Session),
    startTime: clean(r["Start Time"]),
    endTime: clean(r["End Time"]),
    teacherId: clean(r["Teacher ID"]),
    teacherName: clean(r["Teacher Name"]),
    subject: clean(r.Subject),
    status: clean(r.Status) || "Active",
    updatedBy: clean(r["Updated By"]),
    updatedAt: clean(r["Updated At"]),
    rowNumber: r.__rowNumber,
  };
}

export async function getWeeklySchedule({ center, weekStart }) {
  validateDate(weekStart);
  await ensurePortalSheets();
  const { rows } = await readSheet(SHEETS.WEEKLY);
  return rows
    .map(weeklyRow)
    .filter(
      (r) =>
        norm(r.center) === norm(canonicalCenter(center)) &&
        r.weekStart === dateKey(weekStart) &&
        norm(r.status) !== "deleted",
    );
}

async function getAllWeeklyActiveRows() {
  return (await readSheet(SHEETS.WEEKLY)).rows
    .map(weeklyRow)
    .filter(
      (r) => !["deleted", "cancelled"].includes(norm(r.status)) && r.teacherId,
    );
}

function sessionRow(r) {
  return {
    groupId: clean(r["Group ID"]),
    sessionNo: Number(r["Session No"]),
    date: dateKey(r.Date),
    dayOfWeek: clean(r["Day of Week"]),
    startTime: clean(r["Start Time"]),
    endTime: clean(r["End Time"]),
    status: clean(r.Status) || "Planned",
    topic: clean(r.Topic),
    updatedBy: clean(r["Updated By"]),
    updatedAt: clean(r["Updated At"]),
    rowNumber: r.__rowNumber,
  };
}

async function getAllSessionRows() {
  return (await readSheet(SHEETS.SESSIONS)).rows.map(sessionRow);
}
async function getAllGroupRowsRaw() {
  return (await readSheet(SHEETS.GROUPS)).rows;
}

async function resolveGroupPerson(group, staff) {
  if (staff.some((s) => s.id === group.officerId)) return group.officerId;
  const matches = staff.filter(
    (s) =>
      norm(s.name) === norm(group.officerName) &&
      norm(s.center) === norm(group.center),
  );
  return matches.length === 1 ? matches[0].id : group.officerId;
}

async function getConflictSources() {
  const [weekly, sessions, groupsRaw, staff] = await Promise.all([
    getAllWeeklyActiveRows(),
    getAllSessionRows(),
    getAllGroupRowsRaw(),
    getAllStaff(),
  ]);
  const officerByGroup = new Map();
  for (const row of groupsRaw) {
    const group = groupRow(row);
    officerByGroup.set(group.groupId, await resolveGroupPerson(group, staff));
  }
  return {
    weekly,
    programSessions: sessions
      .filter((s) => norm(s.status) !== "cancelled")
      .map((s) => ({ ...s, personId: officerByGroup.get(s.groupId) || "" })),
  };
}

function findPersonConflict({
  personId,
  date,
  startTime,
  endTime,
  weekly = [],
  programSessions = [],
  extra = [],
  excludeWeeklyKey = "",
  excludeSessionKey = "",
}) {
  if (!personId || !date || !startTime || !endTime) return null;
  for (const r of weekly) {
    const key = `${r.date}|${r.center}|${r.program}|${r.section}|${norm(r.shift)}|${r.session}`;
    if (key === excludeWeeklyKey) continue;
    if (
      clean(r.teacherId) === clean(personId) &&
      r.date === dateKey(date) &&
      rangesOverlap(startTime, endTime, r.startTime, r.endTime)
    )
      return `already assigned to ${r.program}-${r.section} at ${r.startTime}-${r.endTime}`;
  }
  for (const s of programSessions) {
    const key = `${s.groupId}|${s.sessionNo}`;
    if (key === excludeSessionKey) continue;
    if (
      clean(s.personId) === clean(personId) &&
      s.date === dateKey(date) &&
      rangesOverlap(startTime, endTime, s.startTime, s.endTime)
    )
      return `already has a program session at ${s.startTime}-${s.endTime}`;
  }
  for (const x of extra) {
    if (
      clean(x.personId) === clean(personId) &&
      x.date === dateKey(date) &&
      rangesOverlap(startTime, endTime, x.startTime, x.endTime)
    )
      return `already assigned in this new schedule at ${x.startTime}-${x.endTime}`;
  }
  return null;
}

async function saveWeeklyScheduleUnlocked({ user, entries }) {
  await ensurePortalSheets();
  if (!canReadModule(user, "attendance")) throw new Error("Forbidden");
  if (!Array.isArray(entries) || entries.length > 2000)
    throw new Error("Invalid schedule entries");
  const setup = await getSetupData();
  const entryKeys = new Set();
  for (const e of entries) {
    if (!canAccessCenter(user, e.center)) throw new Error("Forbidden");
    if (
      !Number.isInteger(Number(e.session)) ||
      Number(e.session) < 1 ||
      Number(e.session) > 100
    )
      throw new Error("Invalid session number");
    validateDate(e.weekStart);
    validateInterval(e.date, e.startTime, e.endTime);
    if (e.date < e.weekStart || e.date > addDays(e.weekStart, 4))
      throw new Error("Date is outside the selected five-day week");
    const key = `${e.date}|${norm(canonicalCenter(e.center))}|${norm(e.program)}|${norm(e.section)}|${norm(e.shift)}|${e.session}`;
    if (entryKeys.has(key)) throw new Error("Duplicate schedule cell");
    entryKeys.add(key);
    if (!e.teacherId) continue;
    const sec = setup.sections.find(
      (x) =>
        x.active &&
        norm(x.center) === norm(canonicalCenter(e.center)) &&
        norm(x.program) === norm(e.program) &&
        norm(x.section) === norm(e.section) &&
        norm(x.shift) === norm(e.shift),
    );
    const member = setup.staff.find(
      (x) =>
        x.active &&
        x.id === e.teacherId &&
        norm(x.center) === norm(canonicalCenter(e.center)),
    );
    if (
      !sec ||
      !member ||
      !setup.programs.some(
        (x) => x.active && norm(x.program) === norm(e.program),
      ) ||
      !setup.subjects.some(
        (x) => x.active && norm(x.subject) === norm(e.subject),
      )
    )
      throw new Error("Select an active section, program, teacher and subject");
    e.teacherName = member.name;
  }
  const existingRows = (await readSheet(SHEETS.WEEKLY)).rows.map(weeklyRow);
  const map = new Map(
    existingRows.map((r) => [
      `${r.date}|${norm(r.center)}|${norm(r.program)}|${norm(r.section)}|${norm(r.shift)}|${r.session}`,
      r,
    ]),
  );
  const { programSessions } = await getConflictSources();
  const incomingKeys = new Set(
    entries.map(
      (e) =>
        `${dateKey(e.date)}|${norm(canonicalCenter(e.center))}|${norm(e.program)}|${norm(e.section)}|${norm(e.shift)}|${Number(e.session)}`,
    ),
  );
  const baseWeekly = existingRows.filter(
    (r) =>
      !["deleted", "cancelled"].includes(norm(r.status)) &&
      r.teacherId &&
      !incomingKeys.has(
        `${r.date}|${norm(r.center)}|${norm(r.program)}|${norm(r.section)}|${norm(r.shift)}|${r.session}`,
      ),
  );
  const accepted = [];
  const updates = [];
  const appends = [];
  const now = nowIso();
  for (const e of entries) {
    const center = canonicalCenter(e.center);
    const date = dateKey(e.date);
    const key = `${date}|${norm(center)}|${norm(e.program)}|${norm(e.section)}|${norm(e.shift)}|${Number(e.session)}`;
    const existing = map.get(key);
    if (!clean(e.teacherId)) {
      if (existing)
        updates.push({
          range: `${SHEETS.WEEKLY}!M${existing.rowNumber}:O${existing.rowNumber}`,
          values: [["Deleted", user.email, now]],
        });
      continue;
    }
    const conflict = findPersonConflict({
      personId: e.teacherId,
      date,
      startTime: e.startTime,
      endTime: e.endTime,
      weekly: baseWeekly,
      programSessions,
      extra: accepted,
    });
    if (conflict)
      throw new Error(
        `Conflict: ${e.teacherName || e.teacherId} is ${conflict}.`,
      );
    accepted.push({
      personId: e.teacherId,
      date,
      startTime: e.startTime,
      endTime: e.endTime,
    });
    const values = [
      dateKey(e.weekStart),
      date,
      center,
      clean(e.program),
      clean(e.section),
      clean(e.shift),
      Number(e.session),
      clean(e.startTime),
      clean(e.endTime),
      clean(e.teacherId),
      clean(e.teacherName),
      clean(e.subject),
      "Active",
      user.email,
      now,
    ];
    if (existing)
      updates.push({
        range: `${SHEETS.WEEKLY}!A${existing.rowNumber}:O${existing.rowNumber}`,
        values: [values],
      });
    else appends.push(values);
  }
  await batchUpdateRows(updates);
  await appendRows(SHEETS.WEEKLY, appends);
  if (entries.length)
    await appendAuditRow({
      user,
      center: entries[0].center,
      action: "WEEKLY_SCHEDULE_SAVE",
      date: entries[0].weekStart,
      oldValue: JSON.stringify(
        existingRows.filter((r) =>
          incomingKeys.has(
            `${r.date}|${norm(r.center)}|${norm(r.program)}|${norm(r.section)}|${norm(r.shift)}|${r.session}`,
          ),
        ),
      ),
      newValue: JSON.stringify(entries),
    });
  return { ok: true };
}

export async function copyPreviousWeek({
  user,
  center,
  program = "All",
  shift = "All",
  section = "All",
  targetWeekStart,
}) {
  validateDate(targetWeekStart);
  if (!canAccessCenter(user, center)) throw new Error("Forbidden");
  const previous = addDays(targetWeekStart, -7);
  const rows = await getWeeklySchedule({ center, weekStart: previous });
  const setup = await getSetupData();
  const filtered = rows.filter(
    (r) =>
      setup.sections.some(
        (s) =>
          s.active &&
          norm(s.center) === norm(r.center) &&
          norm(s.program) === norm(r.program) &&
          norm(s.section) === norm(r.section) &&
          norm(s.shift) === norm(r.shift),
      ) &&
      (norm(program) === "all" || norm(r.program) === norm(program)) &&
      (norm(shift) === "all" || norm(r.shift) === norm(shift)) &&
      (norm(section) === "all" || norm(r.section) === norm(section)),
  );
  const entries = filtered.map((r) => ({
    ...r,
    weekStart: dateKey(targetWeekStart),
    date: addDays(r.date, 7),
  }));
  await saveWeeklySchedule({ user, entries });
  return { copied: entries.length };
}

function groupRow(r) {
  return {
    groupId: clean(r["Group ID"]),
    center: canonicalCenter(r.Center),
    program: clean(r.Program),
    groupName: clean(r["Group Name"]),
    targetGroup: clean(r["Target Group"]),
    officerId: clean(r["Officer ID"]),
    officerName: clean(r["Officer Name"]),
    requiredSessions: Number(r["Required Sessions"]) || 9,
    firstSessionDate: dateKey(r["First Session Date"]),
    dayOfWeek: clean(r["Day of Week"]),
    startTime: clean(r["Start Time"]),
    endTime: clean(r["End Time"]),
    status: clean(r.Status) || "Active",
    createdBy: clean(r["Created By"]),
    createdAt: clean(r["Created At"]),
    updatedAt: clean(r["Updated At"]),
    rowNumber: r.__rowNumber,
  };
}

export async function getProgramGroupById(groupId) {
  await ensurePortalSheets();
  const { rows } = await readSheet(SHEETS.GROUPS);
  return rows.map(groupRow).find((g) => g.groupId === clean(groupId)) || null;
}

export async function getProgramGroups({
  center,
  program = "All",
  status = "All",
}) {
  await ensurePortalSheets();
  const [groupsRaw, sessionsRaw] = await Promise.all([
    readSheet(SHEETS.GROUPS),
    readSheet(SHEETS.SESSIONS),
  ]);
  const sessions = sessionsRaw.rows.map(sessionRow);
  const groups = groupsRaw.rows.map(groupRow);
  return groups
    .map((g) => {
      const completed = sessions.filter(
        (s) => s.groupId === g.groupId && norm(s.status) === "completed",
      ).length;
      return {
        ...g,
        status: completed >= g.requiredSessions ? "Completed" : "Active",
      };
    })
    .filter(
      (g) =>
        (norm(center) === "all" ||
          norm(g.center) === norm(canonicalCenter(center))) &&
        (norm(program) === "all" || norm(g.program) === norm(program)) &&
        (norm(status) === "all" || norm(g.status) === norm(status)),
    )
    .map((g) => {
      const own = sessions.filter((s) => s.groupId === g.groupId);
      const completed = own.filter(
        (s) => norm(s.status) === "completed",
      ).length;
      return { ...g, completedSessions: completed, sessionsCount: own.length };
    });
}

export async function getProgramSessions(groupId) {
  await ensurePortalSheets();
  return (await getAllSessionRows())
    .filter((s) => s.groupId === clean(groupId))
    .sort((a, b) => a.sessionNo - b.sessionNo);
}

async function createProgramGroupUnlocked({ user, group }) {
  await ensurePortalSheets();
  if (
    !canAccessCenter(user, group.center) ||
    !programAllowed(user, group.program)
  )
    throw new Error("Forbidden");
  if (isOfficer(user)) {
    if (group.officerId !== personIdForUser(user))
      throw new Error("Officer can only create their own groups");
    group.officerName = user.name;
  } else {
    const member = (await getAllStaff()).find(
      (s) =>
        s.active &&
        s.id === group.officerId &&
        norm(s.center) === norm(canonicalCenter(group.center)),
    );
    if (!member)
      throw new Error("Select an active officer in the chosen center");
    group.officerName = member.name;
  }
  if (
    !(await getSetupData()).programs.some(
      (p) => p.active && norm(p.program) === norm(group.program),
    )
  )
    throw new Error("Select an active program");
  const center = canonicalCenter(group.center);
  const required = Number(group.requiredSessions ?? 9);
  const first = dateKey(group.firstSessionDate);
  if (
    !center ||
    !clean(group.program) ||
    !clean(group.groupName) ||
    !clean(group.officerId) ||
    !first ||
    !clean(group.startTime) ||
    !clean(group.endTime)
  )
    throw new Error(
      "Center, program, group, officer, first date and time are required.",
    );
  validateInterval(first, group.startTime, group.endTime);
  if (!Number.isInteger(required) || required < 1 || required > 100)
    throw new Error("Required Sessions must be between 1 and 100");
  if (group.dayOfWeek && group.dayOfWeek !== dayName(first))
    throw new Error("First Session Date must match Day of Week");
  const groupId = `G${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const now = nowIso();
  const generated = [];
  const conflicts = await getConflictSources();
  const extra = [];
  const personId = await resolveGroupPerson(group, await getAllStaff());
  for (let i = 0; i < required; i++) {
    const date = addDays(first, i * 7);
    const conflict = findPersonConflict({
      personId,
      date,
      startTime: group.startTime,
      endTime: group.endTime,
      weekly: conflicts.weekly,
      programSessions: conflicts.programSessions,
      extra,
    });
    if (conflict)
      throw new Error(
        `Conflict for session ${i + 1} on ${date}: officer is ${conflict}.`,
      );
    extra.push({
      personId,
      date,
      startTime: group.startTime,
      endTime: group.endTime,
    });
    generated.push([
      groupId,
      i + 1,
      date,
      dayName(date),
      clean(group.startTime),
      clean(group.endTime),
      "Planned",
      "",
      user.email,
      now,
    ]);
  }
  await appendRows(SHEETS.GROUPS, [
    [
      groupId,
      center,
      clean(group.program),
      clean(group.groupName),
      clean(group.targetGroup),
      clean(group.officerId),
      clean(group.officerName),
      required,
      first,
      dayName(first),
      clean(group.startTime),
      clean(group.endTime),
      "Active",
      user.email,
      now,
      now,
    ],
  ]);
  await appendRows(SHEETS.SESSIONS, generated);
  await appendAuditRow({
    user,
    center,
    action: "PROGRAM_GROUP_CREATE",
    staffId: group.officerId,
    staffName: group.officerName,
    newValue: `${group.program} | ${group.groupName} | ${required} sessions`,
  });
  return { groupId, generated: required };
}

async function refreshGroupStatus(groupId) {
  const [groupsRaw, sessions] = await Promise.all([
    readSheet(SHEETS.GROUPS),
    getProgramSessions(groupId),
  ]);
  const group = groupsRaw.rows.map(groupRow).find((g) => g.groupId === groupId);
  if (!group) return;
  const completed = sessions.filter(
    (s) => norm(s.status) === "completed",
  ).length;
  const next = completed >= group.requiredSessions ? "Completed" : "Active";
  if (next !== group.status)
    await batchUpdateRows([
      {
        range: `${SHEETS.GROUPS}!M${group.rowNumber}:P${group.rowNumber}`,
        values: [[next, group.createdBy, group.createdAt, nowIso()]],
      },
    ]);
}

async function updateProgramSessionUnlocked({
  user,
  groupId,
  sessionNo,
  patch,
}) {
  const sessions = await getProgramSessions(groupId);
  const existing = sessions.find((s) => s.sessionNo === Number(sessionNo));
  if (!existing) throw new Error("Session not found.");
  const groupsRaw = (await readSheet(SHEETS.GROUPS)).rows.map(groupRow);
  const group = groupsRaw.find((g) => g.groupId === groupId);
  if (!group) throw new Error("Group not found.");
  const date = dateKey(patch.date || existing.date);
  const startTime = clean(patch.startTime || existing.startTime);
  const endTime = clean(patch.endTime || existing.endTime);
  const status = clean(patch.status || existing.status);
  if (!canAccessGroup(user, group)) throw new Error("Forbidden");
  validateInterval(date, startTime, endTime);
  if (!["Planned", "Completed", "Cancelled"].includes(status))
    throw new Error("Invalid session status");
  if (norm(status) !== "cancelled") {
    const c = await getConflictSources();
    const conflict = findPersonConflict({
      personId: await resolveGroupPerson(group, await getAllStaff()),
      date,
      startTime,
      endTime,
      weekly: c.weekly,
      programSessions: c.programSessions,
      excludeSessionKey: `${groupId}|${existing.sessionNo}`,
    });
    if (conflict) throw new Error(`Conflict: officer is ${conflict}.`);
  }
  const values = [
    groupId,
    existing.sessionNo,
    date,
    dayName(date),
    startTime,
    endTime,
    status,
    clean(patch.topic ?? existing.topic),
    user.email,
    nowIso(),
  ];
  await batchUpdateRows([
    {
      range: `${SHEETS.SESSIONS}!A${existing.rowNumber}:J${existing.rowNumber}`,
      values: [values],
    },
  ]);
  await refreshGroupStatus(groupId);
  await appendAuditRow({
    user,
    center: group.center,
    action: "PROGRAM_SESSION_UPDATE",
    staffId: group.officerId,
    staffName: group.officerName,
    date,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify({
      date,
      startTime,
      endTime,
      status,
      topic: patch.topic ?? existing.topic,
    }),
  });
  return { ok: true };
}

async function addProgramSessionUnlocked({ user, groupId, session }) {
  const groups = (await readSheet(SHEETS.GROUPS)).rows.map(groupRow);
  const group = groups.find((g) => g.groupId === groupId);
  if (!group) throw new Error("Group not found.");
  const sessions = await getProgramSessions(groupId);
  const sessionNo = sessions.length
    ? Math.max(...sessions.map((s) => s.sessionNo)) + 1
    : 1;
  const date = dateKey(session.date);
  if (!canAccessGroup(user, group)) throw new Error("Forbidden");
  validateInterval(date, session.startTime, session.endTime);
  if (
    session.status &&
    !["Planned", "Completed", "Cancelled"].includes(session.status)
  )
    throw new Error("Invalid session status");
  {
    const c = await getConflictSources();
    const conflict = findPersonConflict({
      personId: await resolveGroupPerson(group, await getAllStaff()),
      date,
      startTime: session.startTime,
      endTime: session.endTime,
      weekly: c.weekly,
      programSessions: c.programSessions,
    });
    if (conflict) throw new Error(`Conflict: officer is ${conflict}.`);
  }
  await appendRows(SHEETS.SESSIONS, [
    [
      groupId,
      sessionNo,
      date,
      dayName(date),
      clean(session.startTime),
      clean(session.endTime),
      clean(session.status) || "Planned",
      clean(session.topic),
      user.email,
      nowIso(),
    ],
  ]);
  await refreshGroupStatus(groupId);
  await appendAuditRow({
    user,
    center: group.center,
    entity: "Program Session",
    action: "PROGRAM_SESSION_CREATE",
    newValue: JSON.stringify({ groupId, sessionNo, ...session }),
  });
  return { ok: true, sessionNo };
}

export async function getActivityRecords({ user, center = "All" } = {}) {
  await ensurePortalSheets();
  if (user && !canAccessCenter(user, center)) throw new Error("Forbidden");
  const [weekly, rawGroups, sessions, staff] = await Promise.all([
    getAllWeeklyActiveRows(),
    getAllGroupRowsRaw(),
    getAllSessionRows(),
    getAllStaff(),
  ]);
  const scoped = (c) =>
    norm(center) === "all" ||
    norm(canonicalCenter(c)) === norm(canonicalCenter(center));
  const members = new Map(staff.map((s) => [s.id, s]));
  const groups = new Map(rawGroups.map(groupRow).map((g) => [g.groupId, g]));
  const records = [];
  for (const r of weekly) {
    if (
      !scoped(r.center) ||
      (user &&
        (!canAccessPerson(user, r.teacherId) ||
          !programAllowed(user, r.program)))
    )
      continue;
    if (user && isOfficer(user) && !user.scheduleAccess) continue;
    const member = members.get(r.teacherId);
    records.push({
      ...r,
      personId: r.teacherId,
      name: member?.name || r.teacherName,
      type: member?.type || "Teacher",
      minutes: durationMinutes(r.startTime, r.endTime),
      source: "schedule",
    });
  }
  for (const r of sessions) {
    const g = groups.get(r.groupId);
    if (
      !g ||
      !scoped(g.center) ||
      norm(r.status) !== "completed" ||
      (user && !canAccessGroup(user, g))
    )
      continue;
    const matches = staff.filter(
      (s) =>
        norm(s.name) === norm(g.officerName) &&
        norm(s.center) === norm(g.center),
    );
    const member =
      members.get(g.officerId) || (matches.length === 1 ? matches[0] : null);
    records.push({
      ...r,
      center: g.center,
      program: g.program,
      section: "",
      subject: "",
      personId: member?.id || g.officerId,
      name: member?.name || g.officerName,
      type: member?.type || "Officer",
      groupName: g.groupName,
      minutes: durationMinutes(r.startTime, r.endTime),
      source: "program",
    });
  }
  return { records, staff };
}

export async function getMonthlyWorkload({
  user,
  center,
  month,
  year,
  program = "All",
  teacherId = "All",
  section = "All",
  startDate = "",
  endDate = "",
}) {
  validateMonth(month, year);
  validateRange(startDate, endDate);
  const start = startDate || `${year}-${pad(month)}-01`;
  const end =
    endDate ||
    `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  const data = await getDashboardAnalytics({
    user,
    center,
    startDate: start,
    endDate: end,
    program,
    teacherId,
    section,
    referenceMonth: `${year}-${pad(month)}`,
  });
  return data.teacherSummary.map((r) => ({
    ...r,
    totalSessions: r.sessions,
    totalHours: r.hours,
  }));
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .map((x) => ({ ...x, s: timeToMinutes(x.start), e: timeToMinutes(x.end) }))
    .filter((x) => x.s !== null && x.e !== null && x.e > x.s)
    .sort((a, b) => a.s - b.s);
  const merged = [];
  for (const x of sorted) {
    const last = merged[merged.length - 1];
    if (last && x.s <= last.e) last.e = Math.max(last.e, x.e);
    else merged.push({ s: x.s, e: x.e });
  }
  return merged;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export async function getMonthlyTimesheets({ user, center, month, year }) {
  await ensurePortalSheets();
  validateMonth(month, year);
  const [{ records, staff }, attendance] = await Promise.all([
    getActivityRecords({ user, center }),
    getAttendanceRows(),
  ]);
  const members = staff.filter(
    (s) =>
      (norm(center) === "all" ||
        norm(s.center) === norm(canonicalCenter(center))) &&
      (!user || canAccessPerson(user, s.id)),
  );
  const byId = new Map(
    members.map((s) => [s.id, { member: s, dates: new Map() }]),
  );
  const inMonth = (date) =>
    Number(date.slice(0, 4)) === Number(year) &&
    Number(date.slice(5, 7)) === Number(month);
  for (const r of records) {
    if (!inMonth(r.date)) continue;
    if (!byId.has(r.personId))
      byId.set(r.personId, {
        member: {
          id: r.personId,
          name: r.name,
          position: r.type,
          center: r.center,
        },
        dates: new Map(),
      });
    const rec = byId.get(r.personId);
    if (!rec.dates.has(r.date)) rec.dates.set(r.date, []);
    rec.dates.get(r.date).push({ start: r.startTime, end: r.endTime });
  }
  for (const row of attendance) {
    const rec = byId.get(clean(row["Staff ID"]));
    const date = dateKey(row.Date);
    if (
      !rec ||
      !inMonth(date) ||
      norm(row.Status) !== "working" ||
      rec.dates.has(date) ||
      (norm(center) !== "all" &&
        norm(canonicalCenter(row.Center)) !== norm(canonicalCenter(center)))
    )
      continue;
    rec.dates.set(
      date,
      rec.member.defaultStart && rec.member.defaultEnd
        ? [{ start: rec.member.defaultStart, end: rec.member.defaultEnd }]
        : [],
    );
  }
  const result = [];
  for (const { member, dates } of byId.values()) {
    const rows = [...dates.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, intervals]) => {
        const merged = mergeIntervals(intervals);
        const minutes = merged.reduce((sum, x) => sum + (x.e - x.s), 0);
        const earliest = merged.length ? merged[0].s : null;
        const latest = merged.length ? merged[merged.length - 1].e : null;
        return {
          date,
          startTime: earliest === null ? "" : minutesToTime(earliest),
          endTime: latest === null ? "" : minutesToTime(latest),
          hours: Number((minutes / 60).toFixed(2)),
          attendance: "Present",
        };
      });
    if (rows.length)
      result.push({
        member,
        rows,
        totalHours: Number(rows.reduce((s, r) => s + r.hours, 0).toFixed(2)),
      });
  }
  return result;
}

export async function getDashboardAnalytics({
  user,
  center = "All",
  startDate = "",
  endDate = "",
  teacherId = "All",
  program = "All",
  section = "All",
  subject = "All",
  referenceMonth = "",
}) {
  validateRange(startDate, endDate);
  if (referenceMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth))
    throw new Error("Invalid reference month");
  const month =
    referenceMonth || (endDate || new Date().toISOString()).slice(0, 7);
  const [{ records, staff }, attendance] = await Promise.all([
    getActivityRecords({ user, center }),
    getAttendanceRows(),
  ]);
  const match = (actual, selected) =>
    norm(selected) === "all" || norm(actual) === norm(selected);
  const inRange = (d) =>
    (!startDate || d >= startDate) && (!endDate || d <= endDate);
  const selected = records.filter(
    (r) =>
      inRange(r.date) &&
      match(r.personId, teacherId) &&
      match(r.program, program) &&
      match(r.section, section) &&
      match(r.subject, subject),
  );
  const teachers = new Map(),
    subjects = new Map(),
    sections = new Map(),
    months = new Map(),
    programs = new Map(),
    centers = new Map(),
    groups = new Map();
  const add = (map, key, base, r) => {
    if (!map.has(key))
      map.set(key, {
        ...base,
        sessions: 0,
        minutes: 0,
        monthSessions: 0,
        monthMinutes: 0,
        days: new Set(),
      });
    const a = map.get(key);
    a.sessions++;
    a.minutes += r.minutes;
    a.days.add(r.date);
    if (r.date.slice(0, 7) === month) {
      a.monthSessions++;
      a.monthMinutes += r.minutes;
    }
  };
  for (const r of selected) {
    add(
      teachers,
      r.personId,
      {
        id: r.personId,
        name: r.name,
        type: r.type,
        subjects: {},
        programs: {},
      },
      r,
    );
    const t = teachers.get(r.personId);
    const sub = r.subject || r.program || "Other";
    t.subjects[sub] = (t.subjects[sub] || 0) + 1;
    t.programs[r.program] = (t.programs[r.program] || 0) + 1;
    if (r.source === "schedule") {
      add(subjects, r.subject || "Other", { subject: r.subject || "Other" }, r);
      add(
        sections,
        `${r.center}|${r.program}|${r.section}|${r.subject}`,
        {
          center: r.center,
          program: r.program,
          section: r.section,
          subject: r.subject,
        },
        r,
      );
    } else
      add(
        groups,
        r.groupId,
        {
          groupId: r.groupId,
          groupName: r.groupName,
          program: r.program,
          officer: r.name,
        },
        r,
      );
    add(
      months,
      r.date.slice(0, 7),
      { month: r.date.slice(0, 7), teachers: {}, subjects: {}, sections: {} },
      r,
    );
    const m = months.get(r.date.slice(0, 7));
    m.teachers[r.personId] = (m.teachers[r.personId] || 0) + r.minutes / 60;
    if (r.subject) m.subjects[r.subject] = (m.subjects[r.subject] || 0) + 1;
    if (r.section)
      m.sections[`${r.program}-${r.section}`] =
        (m.sections[`${r.program}-${r.section}`] || 0) + 1;
    add(programs, r.program, { program: r.program }, r);
    add(centers, r.center, { center: r.center }, r);
  }
  // Include zero months between the first and last selected month for truthful trends.
  const ordered = [...months.keys()].sort();
  if (ordered.length) {
    let key = ordered[0];
    const last = ordered.at(-1);
    while (key <= last) {
      if (!months.has(key))
        months.set(key, {
          month: key,
          sessions: 0,
          minutes: 0,
          days: new Set(),
          monthSessions: 0,
          monthMinutes: 0,
          teachers: {},
          subjects: {},
          sections: {},
        });
      const [y, m] = key.split("-").map(Number);
      key = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
    }
  }
  const summary = (map) =>
    [...map.values()].map(({ minutes, monthMinutes, days, ...r }) => ({
      ...r,
      hours: Number((minutes / 60).toFixed(2)),
      hoursInMonth: Number((monthMinutes / 60).toFixed(2)),
      hoursInPeriod: Number((minutes / 60).toFixed(2)),
      sessionsInMonth: r.monthSessions,
      workingDays: days.size,
    }));
  const teacherSummary = summary(teachers).sort(
    (a, b) => b.hours - a.hours || a.name.localeCompare(b.name),
  );
  const subjectTotal = [...subjects.values()].reduce(
    (sum, r) => sum + r.sessions,
    0,
  );
  const subjectSummary = summary(subjects)
    .map((r) => ({
      ...r,
      share: subjectTotal
        ? Number(((r.sessions * 100) / subjectTotal).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
  // Submitted means every date of a staff/month has a valid status; partial records remain pending.
  const attendanceDays = new Map();
  for (const r of attendance) {
    const date = dateKey(r.Date),
      id = clean(r["Staff ID"]);
    const member = staff.find((s) => s.id === id);
    if (
      !member ||
      !inRange(date) ||
      !match(id, teacherId) ||
      !["Working", "Off"].includes(clean(r.Status)) ||
      (norm(center) !== "all" &&
        norm(canonicalCenter(r.Center || member.center)) !==
          norm(canonicalCenter(center))) ||
      (user &&
        (!canReadModule(user, "attendance") || !canAccessPerson(user, id)))
    )
      continue;
    const key = `${id}|${date.slice(0, 7)}`;
    if (!attendanceDays.has(key)) attendanceDays.set(key, new Set());
    attendanceDays.get(key).add(date);
  }
  let submitted = 0;
  for (const [key, dates] of attendanceDays) {
    const parts = key.split("|").at(-1).split("-").map(Number);
    if (dates.size === new Date(parts[0], parts[1], 0).getDate()) submitted++;
  }
  return {
    referenceMonth: month,
    totals: {
      hours: Number(
        (selected.reduce((sum, r) => sum + r.minutes, 0) / 60).toFixed(2),
      ),
      sessions: selected.length,
      activeTeachers: teacherSummary.length,
      attendancePeople: submitted,
      submittedAttendance: submitted,
    },
    teacherSummary,
    subjectSummary,
    sectionSummary: summary(sections).sort((a, b) => b.sessions - a.sessions),
    groupSummary: summary(groups),
    programSummary: summary(programs),
    centerSummary: summary(centers),
    monthlyTrend: summary(months).sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    groupProgress: (
      await getProgramGroups({ center, program, status: "All" })
    ).filter((g) => !user || canAccessGroup(user, g)),
    availablePeriod: {
      startDate: records.map((r) => r.date).sort()[0] || "",
      endDate:
        records
          .map((r) => r.date)
          .sort()
          .at(-1) || "",
    },
  };
}

export async function getReportsSummary(options) {
  const { month, year } = options;
  validateMonth(month, year);
  const startDate = options.startDate || `${year}-${pad(month)}-01`,
    endDate =
      options.endDate ||
      `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
  const analytics = await getDashboardAnalytics({
    ...options,
    startDate,
    endDate,
    referenceMonth: `${year}-${pad(month)}`,
  });
  const groups = (
    await getProgramGroups({
      center: options.center,
      program: options.program || "All",
      status: "All",
    })
  ).filter((g) => !options.user || canAccessGroup(options.user, g));
  return {
    ...analytics,
    workload: analytics.teacherSummary.map((r) => ({
      ...r,
      totalSessions: r.sessions,
      totalHours: r.hours,
    })),
    groups,
  };
}

export function filterScheduleForUser(user, entries) {
  return entries.filter(
    (e) =>
      canAccessCenter(user, e.center) &&
      canAccessPerson(user, e.teacherId) &&
      programAllowed(user, e.program),
  );
}
export function filterGroupsForUser(user, groups) {
  return groups.filter((g) => canAccessGroup(user, g));
}
export async function getScopedSetupData(user) {
  const setup = await getSetupData();
  if (isAdmin(user)) return setup;
  return {
    ...setup,
    users: [],
    payroll: [],
    systemSettings: [],
    centers: [user.center],
    staff: setup.staff.filter(
      (s) => canAccessCenter(user, s.center) && canAccessPerson(user, s.id),
    ),
    sections: setup.sections.filter(
      (s) => canAccessCenter(user, s.center) && programAllowed(user, s.program),
    ),
    programs: setup.programs.filter((p) => programAllowed(user, p.program)),
  };
}

export async function checkEntryConflict({
  user,
  personId,
  center,
  groupId,
  sessionNo,
  date,
  startTime,
  endTime,
  excludeWeeklyKey = "",
  kind,
  firstSessionDate,
  requiredSessions,
  program,
}) {
  await ensurePortalSheets();
  if (kind === "group") {
    if (
      !canManageProgramSessions(user) ||
      !canAccessCenter(user, center) ||
      !canAccessPerson(user, personId) ||
      !programAllowed(user, program)
    )
      throw new Error("Forbidden");
    validateInterval(firstSessionDate, startTime, endTime);
    const count = Number(requiredSessions);
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw new Error("Required Sessions must be between 1 and 100");
    const sources = await getConflictSources();
    for (let i = 0; i < count; i++) {
      const day = addDays(firstSessionDate, i * 7);
      const conflict = findPersonConflict({
        personId,
        date: day,
        startTime,
        endTime,
        ...sources,
      });
      if (conflict)
        throw new Error(
          `Conflict for session ${i + 1} on ${day}: officer is ${conflict}.`,
        );
    }
    return { ok: true };
  }
  validateInterval(date, startTime, endTime);
  if (groupId) {
    const group = await getProgramGroupById(groupId);
    if (!group || !canAccessGroup(user, group)) throw new Error("Forbidden");
    personId = await resolveGroupPerson(group, await getAllStaff());
  } else if (
    !canReadModule(user, "schedule") ||
    !canAccessCenter(user, center) ||
    !canAccessPerson(user, personId)
  )
    throw new Error("Forbidden");
  const sources = await getConflictSources();
  const conflict = findPersonConflict({
    personId,
    date,
    startTime,
    endTime,
    ...sources,
    excludeWeeklyKey,
    excludeSessionKey: groupId ? `${groupId}|${sessionNo}` : "",
  });
  if (conflict) throw new Error(`Conflict: ${personId} is ${conflict}.`);
  return { ok: true };
}

export async function saveAttendance(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => saveAttendanceUnlocked(options));
}

export async function updateSystemSettings(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => updateSystemSettingsUnlocked(options));
}

export async function upsertSetupEntity(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => upsertSetupEntityUnlocked(options));
}

export async function createStaffMember(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => createStaffMemberUnlocked(options));
}

export async function updateStaffMember(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => updateStaffMemberUnlocked(options));
}

export async function createAccessUser(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => createAccessUserUnlocked(options));
}

export async function updateAccessUser(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => updateAccessUserUnlocked(options));
}

export async function saveWeeklySchedule(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => saveWeeklyScheduleUnlocked(options));
}

export async function createProgramGroup(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => createProgramGroupUnlocked(options));
}

export async function updateProgramSession(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => updateProgramSessionUnlocked(options));
}

export async function addProgramSession(options) {
  await ensurePortalSheets();
  return withSpreadsheetLock(() => addProgramSessionUnlocked(options));
}
