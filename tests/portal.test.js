import { beforeEach, describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { HEADERS, SHEETS } from "../lib/schema";

const fake = vi.hoisted(() => ({
  tables: {},
  metadata: new Map(),
  token: "",
  jwt: null,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (fake.token ? { value: fake.token } : undefined),
  }),
}));
vi.mock("googleapis", () => {
  const col = (value) =>
    [...value].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const write = ({ range, values }) => {
    const [sheet, cell] = range.split("!");
    const match = cell.match(/^([A-Z]+)(\d+)/);
    if (!match) throw new Error("Invalid fixture range " + range);
    const start = col(match[1]),
      row = Number(match[2]) - 1;
    const table = fake.tables[sheet];
    if (!table) throw new Error("Missing fixture sheet " + sheet);
    values.forEach((vals, offset) => {
      table[row + offset] ||= [];
      vals.forEach((value, i) => {
        table[row + offset][start + i] = value;
      });
    });
  };
  const spreadsheets = {
    get: async () => ({
      data: {
        sheets: Object.keys(fake.tables).map((title) => ({
          properties: { title },
        })),
      },
    }),
    developerMetadata: {
      get: async ({ metadataId }) => ({ data: fake.metadata.get(metadataId) }),
    },
    batchUpdate: async ({ requestBody }) => {
      for (const r of requestBody.requests) {
        if (r.addSheet) fake.tables[r.addSheet.properties.title] = [];
        if (r.createDeveloperMetadata) {
          const m = r.createDeveloperMetadata.developerMetadata;
          if (fake.metadata.has(m.metadataId))
            throw Object.assign(new Error("Metadata ID already exists"), {
              code: 400,
            });
          fake.metadata.set(m.metadataId, m);
        }
        if (r.deleteDeveloperMetadata) {
          const q =
            r.deleteDeveloperMetadata.dataFilter.developerMetadataLookup;
          const m = fake.metadata.get(q.metadataId);
          if (!q.metadataValue || m?.metadataValue === q.metadataValue)
            fake.metadata.delete(q.metadataId);
        }
      }
      return { data: {} };
    },
    values: {
      get: async ({ range }) => {
        const [name, cells] = range.split("!");
        if (!fake.tables[name])
          throw new Error("Missing fixture sheet " + name);
        return {
          data: {
            values: structuredClone(
              cells === "1:1"
                ? fake.tables[name].slice(0, 1)
                : fake.tables[name],
            ),
          },
        };
      },
      update: async ({ range, requestBody }) => {
        write({ range, values: requestBody.values });
        return { data: {} };
      },
      append: async ({ range, requestBody }) => {
        fake.tables[range.split("!")[0]].push(
          ...structuredClone(requestBody.values),
        );
        return { data: {} };
      },
      batchUpdate: async ({ requestBody }) => {
        requestBody.data.forEach(write);
        return { data: {} };
      },
    },
  };
  return {
    google: {
      auth: {
        JWT: class {
          constructor(options) {
            fake.jwt = options;
          }
        },
      },
      sheets: () => ({ spreadsheets }),
    },
  };
});
import * as data from "../lib/data";
import * as policy from "../lib/policy";
import {
  makeSession,
  parseSession,
  sessionCookieOptions,
} from "../lib/session";
import {
  readSheet,
  appendRows,
  withSpreadsheetLock,
} from "../lib/googleSheets";
import * as login from "../app/api/login/route";
import * as attendance from "../app/api/attendance/route";
import * as schedule from "../app/api/schedule/route";
import * as copy from "../app/api/schedule/copy/route";
import * as groups from "../app/api/program-groups/route";
import * as sessions from "../app/api/program-sessions/route";
import * as dashboard from "../app/api/dashboard/route";
import * as workload from "../app/api/workload/route";
import * as reports from "../app/api/reports/route";
import * as setup from "../app/api/setup-data/route";
import * as weeklyExport from "../app/api/schedule/export/route";
import * as financialExport from "../app/api/timesheets/export/route";
import * as admin from "../app/api/admin/setup/route";
import * as conflict from "../app/api/conflicts/route";

const users = {
  admin: {
    email: "admin@test.invalid",
    name: "Admin",
    role: "Admin",
    center: "All",
  },
  manager: {
    email: "manager@test.invalid",
    name: "Manager",
    role: "Manager",
    center: "Qab Elias",
  },
  officer: {
    email: "hala@test.invalid",
    name: "Hala",
    role: "Officer",
    center: "Marj",
    staffId: "O1",
  },
};
function add(sheet, record) {
  fake.tables[sheet].push(fake.tables[sheet][0].map((h) => record[h] ?? ""));
}
function fixture() {
  fake.tables = Object.fromEntries(
    Object.entries(HEADERS).map(([sheet, headers]) => [sheet, [[...headers]]]),
  );
  fake.metadata.clear();
  fake.token = "";
  // A five-column legacy staff table with reordered, normalized headers and a custom field.
  fake.tables.Staff_Master = [
    ["center", "Active", "staff_id", "staff_name", "position", "Legacy Note"],
  ];
  add(SHEETS.STAFF, {
    center: "Kab elias",
    Active: "Yes",
    staff_id: "T1",
    staff_name: "Zainab",
    position: "Teacher",
    "Legacy Note": "keep me",
  });
  add(SHEETS.STAFF, {
    center: "Marj",
    Active: "Yes",
    staff_id: "O1",
    staff_name: "Hala",
    position: "Officer",
  });
  add(SHEETS.STAFF, {
    center: "Marj",
    Active: "Yes",
    staff_id: "O2",
    staff_name: "Another Officer",
    position: "Officer",
  });
  add(SHEETS.STAFF, {
    center: "Qab Elias",
    Active: "No",
    staff_id: "T3",
    staff_name: "Former Teacher",
    position: "Teacher",
  });
  for (const u of Object.values(users))
    add(SHEETS.USERS, {
      Email: u.email,
      Name: u.name,
      Role: u.role,
      Center: u.center,
      Active: "Yes",
      "Staff ID": u.staffId,
    });
  add(SHEETS.USERS, {
    Email: "inactive@test.invalid",
    Name: "Inactive",
    Role: "Manager",
    Center: "Marj",
    Active: "No",
  });
  for (const p of ["BLN", "RS", "CSG", "FPSS", "CBPSS"])
    add(SHEETS.PROGRAMS, { Program: p, Category: "Education", Active: "Yes" });
  add(SHEETS.PROGRAMS, { Program: "Closed", Active: "No" });
  for (const sec of [
    ["A", "Morning"],
    ["B", "Morning"],
    ["C", "Afternoon"],
  ])
    add(SHEETS.SECTIONS, {
      Center: "Qab Elias",
      Program: "BLN",
      Section: sec[0],
      Shift: sec[1],
      Active: "Yes",
    });
  add(SHEETS.SECTIONS, {
    Center: "Qab Elias",
    Program: "BLN",
    Section: "D",
    Shift: "Morning",
    Active: "No",
  });
  for (const subject of ["Arabic", "English", "Math", "CBPSS"])
    add(SHEETS.SUBJECTS, { Subject: subject, Active: "Yes" });
  for (const shift of ["Morning", "Afternoon"])
    for (const i of [1, 2])
      add(SHEETS.TIME_SLOTS, {
        Shift: shift,
        Session: i,
        "Start Time": i === 1 ? "08:00" : "10:00",
        "End Time": i === 1 ? "09:00" : "11:00",
        Active: "Yes",
      });
  process.env.SESSION_SECRET = "fixture-session-key-not-a-deployment-secret";
  process.env.GOOGLE_SHEET_ID = "fixture-sheet-id";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "fixture@test.invalid";
  process.env.GOOGLE_PRIVATE_KEY = "first\\nsecond";
}
const request = (path, body) =>
  new Request(
    `http://localhost${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
const signIn = (role) => {
  fake.token = makeSession(users[role]);
};
const entry = (patch) => ({
  weekStart: "2026-10-12",
  date: "2026-10-12",
  center: "Qab Elias",
  program: "BLN",
  section: "A",
  shift: "Morning",
  session: 1,
  startTime: "08:00",
  endTime: "09:00",
  teacherId: "T1",
  teacherName: "forged name",
  subject: "Arabic",
  ...patch,
});
async function saved(e) {
  return data.saveWeeklySchedule({ user: users.manager, entries: [entry(e)] });
}
async function workbook(response) {
  expect(response.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await response.arrayBuffer()));
  return wb;
}
beforeEach(fixture);

describe("access and server-side authorization", () => {
  for (const role of ["admin", "manager", "officer"])
    it(`${role} login, email whitespace/case, cookie flags`, async () => {
      const r = await login.POST(
        request("/api/login", {
          email: `  ${users[role].email.toUpperCase()}  `,
        }),
      );
      expect(r.status).toBe(200);
      expect((await r.json()).user.role).toBe(users[role].role);
      expect(r.headers.get("set-cookie")).toContain("HttpOnly");
      expect(r.headers.get("set-cookie")).toContain("SameSite=lax");
    });
  it("rejects unauthorized and inactive email", async () => {
    for (const email of ["unknown@test.invalid", "inactive@test.invalid"])
      expect((await login.POST(request("/api/login", { email }))).status).toBe(
        403,
      );
  });
  it("rejects unknown roles and non-Admin All", async () => {
    add(SHEETS.USERS, {
      Email: "all@test.invalid",
      Role: "Manager",
      Center: "All",
      Active: "Yes",
    });
    expect(await data.findAuthorizedUser("all@test.invalid")).toBeNull();
    expect(
      policy.canAccessCenter({ role: "Manager", center: "All" }, "Marj"),
    ).toBe(false);
  });
  it("rechecks deactivation on every API request", async () => {
    signIn("manager");
    fake.tables.Users_Access[2][4] = "No";
    expect((await setup.GET()).status).toBe(401);
  });
  it("normalizes center aliases without mutating history", () => {
    for (const [a, b] of [
      ["Kab elias", "Qab Elias"],
      ["AL Marj", "Marj"],
      ["Dalhamiye", "Dalhamieh"],
      ["Jeb Janine", "Jeb Janin"],
      ["Bar Elias", "Bar Elias"],
    ])
      expect(policy.canAccessCenter({ role: "Manager", center: a }, b)).toBe(
        true,
      );
    expect(policy.canAccessCenter(users.manager, "Bar Elias")).toBe(false);
  });
  it("does not expose global users, staff, settings to a Manager", async () => {
    signIn("manager");
    const r = await setup.GET();
    const d = await r.json();
    expect(d.users).toEqual([]);
    expect(d.payroll).toEqual([]);
    expect(d.staff.every((s) => s.center === "Qab Elias")).toBe(true);
  });
  it("denies Officer attendance, schedule, workload and financial export by default", async () => {
    signIn("officer");
    expect(
      (
        await attendance.GET(
          request("/api/attendance?staffId=O1&month=10&year=2026"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await schedule.GET(
          request("/api/schedule?center=Marj&weekStart=2026-10-12"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await workload.GET(
          request("/api/workload?center=Marj&month=10&year=2026"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await financialExport.GET(
          request("/api/timesheets/export?center=Marj&month=10&year=2026"),
        )
      ).status,
    ).toBe(403);
  });
  it("rejects Manager center bypass on read, write, analytics and both exports", async () => {
    signIn("manager");
    expect(
      (
        await schedule.GET(
          request("/api/schedule?center=Marj&weekStart=2026-10-12"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await schedule.POST(
          request("/api/schedule", { entries: [entry({ center: "Marj" })] }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await dashboard.GET(request("/api/dashboard?center=All"))).status,
    ).toBe(403);
    expect(
      (
        await weeklyExport.GET(
          request("/api/schedule/export?center=Marj&weekStart=2026-10-12"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await financialExport.GET(
          request("/api/timesheets/export?center=Marj&month=10&year=2026"),
        )
      ).status,
    ).toBe(403);
  });
  it("rejects forged and expired session tokens", () => {
    const t = makeSession(users.manager);
    expect(parseSession(t)).not.toBeNull();
    expect(parseSession(t + "x")).toBeNull();
    expect(parseSession(t + ".ignored")).toBeNull();
    expect(parseSession("garbage")).toBeNull();
    vi.useFakeTimers();
    vi.advanceTimersByTime(13 * 3600 * 1000);
    expect(parseSession(t)).toBeNull();
    vi.useRealTimers();
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(sessionCookieOptions().secure).toBe(true);
    process.env.NODE_ENV = old;
  });
  it("keeps private key newline conversion server-side", async () => {
    await readSheet(SHEETS.STAFF);
    expect(fake.jwt.key).toBe("first\nsecond");
  });
});

describe("legacy Sheets and attendance", () => {
  it("loads five-column staff with no Type and normalized/reordered headers", async () => {
    const staff = await data.getActiveStaff();
    expect(staff.length).toBe(3);
    expect(staff[0].id).toBe("T1");
    expect(staff[0].type).toBe("Teacher");
    expect(fake.tables.Staff_Master[0]).not.toContain("Type");
    expect(fake.tables.Staff_Master[1][0]).toBe("Kab elias");
  });
  it("saves, updates and reloads attendance without duplicate staff/date", async () => {
    signIn("manager");
    const days = Array.from({ length: 31 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      status: [5, 6].includes(new Date(Date.UTC(2026, 9, i + 1)).getUTCDay())
        ? "Off"
        : "Working",
    }));
    const body = { staffId: "T1", month: 10, year: 2026, days };
    expect(
      (await attendance.POST(request("/api/attendance", body))).status,
    ).toBe(200);
    expect(
      (
        await data.getStaffWithAttendanceStatus({
          center: "Kab elias",
          month: 10,
          year: 2026,
        })
      )[0].submitted,
    ).toBe(true);
    days[0].status = "Off";
    expect(
      (await attendance.POST(request("/api/attendance", body))).status,
    ).toBe(200);
    const r = await attendance.GET(
      request("/api/attendance?staffId=T1&month=10&year=2026"),
    );
    expect((await r.json()).attendance[0].status).toBe("Off");
    expect(fake.tables.Attendance_Log.length).toBe(32);
    expect((await readSheet(SHEETS.AUDIT)).rows.at(-1)["Entity"]).toBe(
      "Attendance",
    );
  });
  it("rejects duplicate/invalid dates, invalid statuses and month bypass before writing", async () => {
    const staff = (await data.getActiveStaff())[0];
    for (const days of [
      [
        { date: "2026-10-01", status: "Working" },
        { date: "2026-10-01", status: "Off" },
      ],
      [{ date: "2026-11-01", status: "Working" }],
      [{ date: "2026-10-32", status: "Working" }],
      [{ date: "2026-10-01", status: "Other" }],
    ])
      await expect(
        data.saveAttendance({
          user: users.manager,
          staff,
          month: 10,
          year: 2026,
          days,
        }),
      ).rejects.toThrow();
    expect(fake.tables.Attendance_Log.length).toBe(1);
  });
  it("serializes simultaneous saves across spreadsheet writers", async () => {
    const staff = (await data.getActiveStaff())[0];
    const options = {
      user: users.manager,
      staff,
      month: 10,
      year: 2026,
      days: [{ date: "2026-10-01", status: "Working" }],
    };
    await Promise.all([
      data.saveAttendance(options),
      data.saveAttendance(options),
    ]);
    expect(fake.tables.Attendance_Log.length).toBe(2);
    expect(fake.metadata.size).toBe(0);
  });
  it("preserves custom columns and stable staff IDs on targeted updates", async () => {
    await data.updateStaffMember({
      user: users.admin,
      staffId: "T1",
      patch: { id: "INJECTED", name: "Updated", active: true },
    });
    const row = (await readSheet(SHEETS.STAFF)).rows[0];
    expect(row["Staff ID"]).toBe("T1");
    expect(row["Staff Name"]).toBe("Updated");
    expect(row["Legacy Note"]).toBe("keep me");
    expect(
      fake.tables.Staff_Master[0].filter((h) => h === "Staff ID"),
    ).toHaveLength(0);
  });
  it("cannot overwrite a header row or rename a historical program", async () => {
    signIn("admin");
    expect(
      (
        await admin.POST(
          request("/api/admin/setup", {
            entity: "program",
            rowNumber: 1,
            data: { program: "X", active: true },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await admin.POST(
          request("/api/admin/setup", {
            entity: "program",
            rowNumber: 2,
            data: { program: "Renamed", active: true },
          }),
        )
      ).status,
    ).toBe(400);
  });
});

describe("weekly schedules and conflicts", () => {
  it("creates, edits and soft-deletes a cell with authoritative teacher name", async () => {
    await saved();
    let rows = await data.getWeeklySchedule({
      center: "Kab elias",
      weekStart: "2026-10-12",
    });
    expect(rows[0].teacherName).toBe("Zainab");
    await saved({ subject: "English" });
    expect(fake.tables.Weekly_Schedule.length).toBe(2);
    await saved({ teacherId: "" });
    expect(
      await data.getWeeklySchedule({
        center: "Qab Elias",
        weekStart: "2026-10-12",
      }),
    ).toEqual([]);
    expect((await readSheet(SHEETS.WEEKLY)).rows[0].Status).toBe("Deleted");
  });
  it("blocks identical and partial teacher overlap, permits adjacent times", async () => {
    await saved();
    await expect(saved({ section: "B" })).rejects.toThrow("Conflict");
    await expect(
      saved({ section: "B", startTime: "08:30", endTime: "09:30" }),
    ).rejects.toThrow("Conflict");
    await saved({ section: "B", startTime: "09:00", endTime: "10:00" });
    expect(fake.tables.Weekly_Schedule.length).toBe(3);
  });
  it("detects overlaps within a single submitted batch before any write", async () => {
    await expect(
      data.saveWeeklySchedule({
        user: users.manager,
        entries: [
          entry(),
          entry({ section: "B", startTime: "08:30", endTime: "09:30" }),
        ],
      }),
    ).rejects.toThrow("Conflict");
    expect(fake.tables.Weekly_Schedule.length).toBe(1);
  });
  it("rejects closed sections and invalid intervals or dates outside selected week", async () => {
    for (const e of [
      { section: "D" },
      { endTime: "07:00" },
      { date: "2026-10-20" },
      { startTime: "25:00" },
    ])
      await expect(saved(e)).rejects.toThrow();
  });
  it("copies previous week and ignores forged user payload", async () => {
    await saved({ weekStart: "2026-10-05", date: "2026-10-05" });
    signIn("manager");
    const r = await copy.POST(
      request("/api/schedule/copy", {
        center: "Qab Elias",
        targetWeekStart: "2026-10-12",
        user: users.admin,
      }),
    );
    expect(r.status).toBe(200);
    expect((await r.json()).copied).toBe(1);
    expect(
      (
        await data.getWeeklySchedule({
          center: "Qab Elias",
          weekStart: "2026-10-12",
        })
      )[0].updatedBy,
    ).toBe(users.manager.email);
  });
  it("reports conflict during entry and excludes the cell being edited", async () => {
    await saved();
    signIn("manager");
    expect(
      (
        await conflict.POST(
          request("/api/conflicts", {
            personId: "T1",
            center: "Qab Elias",
            date: "2026-10-12",
            startTime: "08:30",
            endTime: "09:30",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await conflict.POST(
          request("/api/conflicts", {
            personId: "T1",
            center: "Qab Elias",
            date: "2026-10-12",
            startTime: "08:00",
            endTime: "09:00",
            excludeWeeklyKey: "2026-10-12|Qab Elias|BLN|A|morning|1",
          }),
        )
      ).status,
    ).toBe(200);
  });
});

describe("Officer groups and recurring sessions", () => {
  const group = (patch) => ({
    center: "Marj",
    program: "CSG",
    groupName: "CSG Group 1",
    officerId: "O1",
    officerName: "Forged",
    requiredSessions: 9,
    firstSessionDate: "2026-10-13",
    dayOfWeek: "Tuesday",
    startTime: "10:00",
    endTime: "12:00",
    ...patch,
  });
  it("generates nine weekly sessions and edits only one exception", async () => {
    const result = await data.createProgramGroup({
      user: users.officer,
      group: group(),
    });
    let list = await data.getProgramSessions(result.groupId);
    expect(list).toHaveLength(9);
    expect(list[1].date).toBe("2026-10-20");
    await data.updateProgramSession({
      user: users.officer,
      groupId: result.groupId,
      sessionNo: 9,
      patch: { date: "2026-12-10", startTime: "13:00", endTime: "15:00" },
    });
    const next = await data.getProgramSessions(result.groupId);
    expect(next.slice(0, 8)).toEqual(list.slice(0, 8));
    expect(next[8].date).toBe("2026-12-10");
  });
  it("blocks another Officer assignment and unauthorized group access", async () => {
    await expect(
      data.createProgramGroup({
        user: users.officer,
        group: group({ officerId: "O2" }),
      }),
    ).rejects.toThrow("own groups");
    const other = await data.createProgramGroup({
      user: users.admin,
      group: group({ officerId: "O2" }),
    });
    signIn("officer");
    expect(
      (
        await sessions.GET(
          request(`/api/program-sessions?groupId=${other.groupId}`),
        )
      ).status,
    ).toBe(403);
    expect(
      (await groups.GET(request("/api/program-groups?center=Marj"))).status,
    ).toBe(200);
    expect(
      (
        await (
          await groups.GET(request("/api/program-groups?center=Marj"))
        ).json()
      ).groups,
    ).toEqual([]);
  });
  it("blocks Officer partial overlap across different programs", async () => {
    await data.createProgramGroup({ user: users.officer, group: group() });
    await expect(
      data.createProgramGroup({
        user: users.officer,
        group: group({ program: "FPSS", startTime: "11:00", endTime: "13:00" }),
      }),
    ).rejects.toThrow("Conflict");
    expect(fake.tables.Program_Groups.length).toBe(2);
  });
  it("marks a group Completed automatically and reopens after cancellation", async () => {
    const g = await data.createProgramGroup({
      user: users.officer,
      group: group({ requiredSessions: 2 }),
    });
    for (const sessionNo of [1, 2])
      await data.updateProgramSession({
        user: users.officer,
        groupId: g.groupId,
        sessionNo,
        patch: { status: "Completed" },
      });
    expect(
      (await data.getProgramGroups({ center: "Marj", status: "Completed" }))[0]
        .completedSessions,
    ).toBe(2);
    await data.updateProgramSession({
      user: users.officer,
      groupId: g.groupId,
      sessionNo: 2,
      patch: { status: "Cancelled" },
    });
    expect(
      (await data.getProgramGroups({ center: "Marj", status: "Active" }))[0]
        .status,
    ).toBe("Active");
  });
  it("validates required count, dates, times, weekday and session status", async () => {
    for (const patch of [
      { requiredSessions: 1.5 },
      { requiredSessions: 101 },
      { dayOfWeek: "Thursday" },
      { endTime: "09:00" },
    ])
      await expect(
        data.createProgramGroup({ user: users.officer, group: group(patch) }),
      ).rejects.toThrow();
    const g = await data.createProgramGroup({
      user: users.officer,
      group: group(),
    });
    await expect(
      data.updateProgramSession({
        user: users.officer,
        groupId: g.groupId,
        sessionNo: 1,
        patch: { status: "Invented" },
      }),
    ).rejects.toThrow();
  });
});

describe("analytics, historical workload and Excel contents", () => {
  async function history() {
    await saved({ weekStart: "2026-09-07", date: "2026-09-07" });
    await saved();
    await saved({
      session: 2,
      startTime: "10:00",
      endTime: "11:00",
      subject: "CBPSS",
    });
  }
  it("counts one month and combined months by teacher/program/section/subject", async () => {
    await history();
    const month = await data.getDashboardAnalytics({
      user: users.manager,
      center: "Qab Elias",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      teacherId: "T1",
    });
    expect(month.totals.hours).toBe(2);
    expect(month.teacherSummary[0].workingDays).toBe(1);
    const period = await data.getDashboardAnalytics({
      user: users.manager,
      center: "Qab Elias",
      startDate: "2026-09-01",
      endDate: "2026-10-31",
      referenceMonth: "2026-10",
      program: "BLN",
      section: "A",
      subject: "Arabic",
    });
    expect(period.totals.sessions).toBe(2);
    expect(period.teacherSummary[0].hoursInMonth).toBe(1);
    expect(period.teacherSummary[0].hoursInPeriod).toBe(2);
    expect(period.sectionSummary[0].sessionsInMonth).toBe(1);
    expect(period.subjectSummary[0].share).toBe(100);
    expect(period.monthlyTrend.map((r) => r.month)).toEqual([
      "2026-09",
      "2026-10",
    ]);
    expect(period.monthlyTrend[0].subjects.Arabic).toBe(1);
  });
  it("supports all months, custom ranges, older months and multi-month workload", async () => {
    await history();
    expect(
      (
        await data.getDashboardAnalytics({
          user: users.manager,
          center: "Qab Elias",
        })
      ).totals.hours,
    ).toBe(3);
    expect(
      (
        await data.getMonthlyWorkload({
          user: users.manager,
          center: "Qab Elias",
          month: 9,
          year: 2026,
        })
      )[0].totalHours,
    ).toBe(1);
    expect(
      (
        await data.getMonthlyWorkload({
          user: users.manager,
          center: "Qab Elias",
          month: 10,
          year: 2026,
          startDate: "2026-09-01",
          endDate: "2026-10-31",
        })
      )[0].totalHours,
    ).toBe(3);
    await expect(
      data.getDashboardAnalytics({
        startDate: "2026-10-31",
        endDate: "2026-09-01",
      }),
    ).rejects.toThrow("Period");
  });
  it("Dashboard and Reports use the same calculated filters", async () => {
    await history();
    signIn("manager");
    const q =
      "center=Qab%20Elias&startDate=2026-09-01&endDate=2026-10-31&subject=Arabic";
    const d = await (
      await dashboard.GET(request("/api/dashboard?" + q))
    ).json();
    const r = await data.getReportsSummary({
      user: users.manager,
      center: "Qab Elias",
      month: 10,
      year: 2026,
      startDate: "2026-09-01",
      endDate: "2026-10-31",
      subject: "Arabic",
    });
    expect(r.totals.sessions).toBe(d.totals.sessions);
  });
  for (const role of ["admin", "manager"])
    it(`weekly Excel as ${role}: all sections, shift/section filters and dates`, async () => {
      await history();
      signIn(role);
      const all = await workbook(
        await weeklyExport.GET(
          request(
            "/api/schedule/export?center=Qab%20Elias&weekStart=2026-10-12",
          ),
        ),
      );
      expect(all.worksheets.map((w) => w.name)).toEqual([
        "BLN-A",
        "BLN-B",
        "BLN-C",
      ]);
      expect(all.worksheets[0].getCell("B5").value).toBe("Zainab / Arabic");
      expect(all.worksheets[0].getCell("B4").value).toContain("2026-10-12");
      const one = await workbook(
        await weeklyExport.GET(
          request(
            "/api/schedule/export?center=Qab%20Elias&weekStart=2026-10-12&shift=Morning&section=B",
          ),
        ),
      );
      expect(one.worksheets.map((w) => w.name)).toEqual(["BLN-B"]);
    });
  for (const role of ["admin", "manager"])
    it(`financial Excel as ${role}: one sheet per person, exact hours, approved columns and logo`, async () => {
      await history();
      signIn(role);
      const response = await financialExport.GET(
        request("/api/timesheets/export?center=Qab%20Elias&month=10&year=2026"),
      );
      expect(response.headers.get("content-disposition")).toContain(
        "October_2026_Timesheets.xlsx",
      );
      const wb = await workbook(response);
      expect(wb.worksheets.map((w) => w.name)).toEqual(["Zainab"]);
      const ws = wb.worksheets[0];
      expect(ws.getImages()).toHaveLength(1);
      expect(ws.getRow(8).values.slice(1)).toEqual([
        "Number",
        "Date",
        "Start Time",
        "End Time",
        "Hours number",
        "Attendance",
      ]);
      expect(ws.getCell("E9").value).toBe(2);
      expect(ws.getCell("E10").value).toBe(2);
      expect(ws.getCell("A10").value).toBe("Total number of Hours");
      expect(ws.pageSetup.printArea).toBeTruthy();
    });
  it("financial export excludes another center work and includes inactive historical teachers", async () => {
    await history();
    add(SHEETS.WEEKLY, {
      "Week Start": "2026-10-12",
      Date: "2026-10-13",
      Center: "Marj",
      Program: "RS",
      Section: "A",
      Shift: "Morning",
      Session: 1,
      "Start Time": "08:00",
      "End Time": "09:00",
      "Teacher ID": "T1",
      "Teacher Name": "Zainab",
      Subject: "Arabic",
      Status: "Active",
    });
    add(SHEETS.WEEKLY, {
      "Week Start": "2026-10-12",
      Date: "2026-10-14",
      Center: "Qab Elias",
      Program: "BLN",
      Section: "A",
      Shift: "Morning",
      Session: 1,
      "Start Time": "08:00",
      "End Time": "09:00",
      "Teacher ID": "T3",
      "Teacher Name": "Former Teacher",
      Subject: "Arabic",
      Status: "Active",
    });
    const ts = await data.getMonthlyTimesheets({
      user: users.manager,
      center: "Qab Elias",
      month: 10,
      year: 2026,
    });
    expect(ts.find((t) => t.member.id === "T1").totalHours).toBe(2);
    expect(ts.find((t) => t.member.id === "T3").totalHours).toBe(1);
  });
  it("authorized Officer financial export contains only own completed sessions", async () => {
    const g = await data.createProgramGroup({
      user: users.officer,
      group: {
        center: "Marj",
        program: "CSG",
        groupName: "Own",
        officerId: "O1",
        requiredSessions: 1,
        firstSessionDate: "2026-10-13",
        startTime: "10:00",
        endTime: "12:00",
      },
    });
    await data.updateProgramSession({
      user: users.officer,
      groupId: g.groupId,
      sessionNo: 1,
      patch: { status: "Completed" },
    });
    fake.tables.Users_Access[3][8] = "Yes";
    signIn("officer");
    const wb = await workbook(
      await financialExport.GET(
        request("/api/timesheets/export?center=Marj&month=10&year=2026"),
      ),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Hala"]);
    expect(wb.worksheets[0].getCell("E9").value).toBe(2);
  });
});

describe("additional historical and export regressions", () => {
  it("includes the final selected-month date and combines multiple programs into one person sheet", async () => {
    await saved();
    add(SHEETS.SECTIONS, {
      Center: "Qab Elias",
      Program: "CBPSS",
      Section: "A",
      Shift: "Morning",
      Active: "Yes",
    });
    await saved({
      date: "2026-10-12",
      program: "CBPSS",
      session: 2,
      startTime: "10:00",
      endTime: "11:00",
      subject: "CBPSS",
    });
    await saved({ weekStart: "2026-10-27", date: "2026-10-31" });
    const ts = await data.getMonthlyTimesheets({
      user: users.manager,
      center: "Qab Elias",
      month: 10,
      year: 2026,
    });
    expect(ts).toHaveLength(1);
    expect(ts[0].rows.map((r) => r.date)).toEqual(["2026-10-12", "2026-10-31"]);
    expect(ts[0].totalHours).toBe(3);
  });
  it("keeps closed section history in exports, without allowing new entries", async () => {
    add(SHEETS.WEEKLY, {
      "Week Start": "2026-10-12",
      Date: "2026-10-12",
      Center: "Qab Elias",
      Program: "BLN",
      Section: "D",
      Shift: "Morning",
      Session: 1,
      "Start Time": "08:00",
      "End Time": "09:00",
      "Teacher ID": "T1",
      "Teacher Name": "Zainab",
      Subject: "Arabic",
      Status: "Active",
    });
    signIn("manager");
    const wb = await workbook(
      await weeklyExport.GET(
        request(
          "/api/schedule/export?center=Qab%20Elias&weekStart=2026-10-12&section=D",
        ),
      ),
    );
    expect(wb.worksheets[0].name).toBe("BLN-D");
    expect(wb.worksheets[0].getCell("B5").value).toBe("Zainab / Arabic");
    await expect(saved({ section: "D" })).rejects.toThrow("active");
  });
  it("allows Officer weekly export only when enabled, with own person and program scope", async () => {
    fake.tables.Users_Access[3][7] = "Yes";
    fake.tables.Users_Access[3][6] = "BLN";
    add(SHEETS.SECTIONS, {
      Center: "Marj",
      Program: "BLN",
      Section: "A",
      Shift: "Morning",
      Active: "Yes",
    });
    add(SHEETS.SECTIONS, {
      Center: "Marj",
      Program: "RS",
      Section: "Z",
      Shift: "Morning",
      Active: "Yes",
    });
    for (const [id, name] of [
      ["O1", "Hala"],
      ["O2", "Another Officer"],
    ])
      add(SHEETS.WEEKLY, {
        "Week Start": "2026-10-12",
        Date: id === "O1" ? "2026-10-12" : "2026-10-13",
        Center: "Marj",
        Program: "BLN",
        Section: "A",
        Shift: "Morning",
        Session: 1,
        "Start Time": "08:00",
        "End Time": "09:00",
        "Teacher ID": id,
        "Teacher Name": name,
        Subject: "Arabic",
        Status: "Active",
      });
    signIn("officer");
    const wb = await workbook(
      await weeklyExport.GET(
        request("/api/schedule/export?center=Marj&weekStart=2026-10-12"),
      ),
    );
    expect(wb.worksheets.map((s) => s.name)).toEqual(["BLN-A"]);
    expect(wb.worksheets[0].getCell("B5").value).toBe("Hala / Arabic");
    expect(wb.worksheets[0].getCell("C5").value).toBe("");
  });
  it("validates recurring group conflicts before creation and releases lock after errors", async () => {
    const g = {
      center: "Marj",
      program: "CSG",
      groupName: "Own",
      officerId: "O1",
      requiredSessions: 9,
      firstSessionDate: "2026-10-13",
      startTime: "10:00",
      endTime: "12:00",
    };
    await data.createProgramGroup({ user: users.officer, group: g });
    signIn("officer");
    const r = await conflict.POST(
      request("/api/conflicts", {
        kind: "group",
        center: "Marj",
        program: "FPSS",
        personId: "O1",
        requiredSessions: 9,
        firstSessionDate: "2026-10-13",
        startTime: "11:00",
        endTime: "13:00",
      }),
    );
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("Conflict");
    await expect(
      withSpreadsheetLock(() => {
        throw new Error("failed operation");
      }),
    ).rejects.toThrow("failed operation");
    expect(fake.metadata.size).toBe(0);
  });
  it("uses report API period, subject and section filters", async () => {
    await saved();
    await saved({
      session: 2,
      startTime: "10:00",
      endTime: "11:00",
      subject: "Math",
    });
    signIn("manager");
    const r = await reports.GET(
      request(
        "/api/reports?center=Qab%20Elias&month=10&year=2026&startDate=2026-10-01&endDate=2026-10-31&subject=Arabic&section=A",
      ),
    );
    expect(r.status).toBe(200);
    expect((await r.json()).totals.sessions).toBe(1);
  });
});

it("retains legacy email-owned groups and detects their person conflicts against schedules", async () => {
  add(SHEETS.GROUPS, {
    "Group ID": "legacy",
    Center: "Marj",
    Program: "CSG",
    "Group Name": "Legacy",
    "Officer ID": users.officer.email,
    "Officer Name": "Hala",
    "Required Sessions": 1,
    "First Session Date": "2026-10-13",
    "Start Time": "10:00",
    "End Time": "12:00",
    Status: "Active",
  });
  add(SHEETS.SESSIONS, {
    "Group ID": "legacy",
    "Session No": 1,
    Date: "2026-10-13",
    "Start Time": "10:00",
    "End Time": "12:00",
    Status: "Planned",
  });
  signIn("officer");
  expect(
    (await sessions.GET(request("/api/program-sessions?groupId=legacy")))
      .status,
  ).toBe(200);
  add(SHEETS.WEEKLY, {
    "Week Start": "2026-10-12",
    Date: "2026-10-13",
    Center: "Marj",
    Program: "BLN",
    Section: "A",
    Shift: "Morning",
    Session: 1,
    "Start Time": "13:00",
    "End Time": "14:00",
    "Teacher ID": "O1",
    "Teacher Name": "Hala",
    Subject: "Arabic",
    Status: "Active",
  });
  await expect(
    data.updateProgramSession({
      user: users.officer,
      groupId: "legacy",
      sessionNo: 1,
      patch: { startTime: "13:30", endTime: "14:30" },
    }),
  ).rejects.toThrow("Conflict");
});
