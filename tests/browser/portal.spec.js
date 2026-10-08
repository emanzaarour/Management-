import { test, expect } from "@playwright/test";
const manager = {
  email: "manager@test.invalid",
  name: "Manager",
  role: "Manager",
  center: "Qab Elias",
};
const admin = {
  ...manager,
  email: "admin@test.invalid",
  name: "Admin",
  role: "Admin",
  center: "All",
};
const officer = {
  email: "hala@test.invalid",
  name: "Hala",
  role: "Officer",
  center: "Marj",
  staffId: "O1",
};
const setup = {
  centers: ["Qab Elias", "Marj"],
  programs: [
    { program: "BLN", active: true },
    { program: "CSG", active: true },
  ],
  sections: [
    {
      center: "Qab Elias",
      program: "BLN",
      section: "A",
      shift: "Morning",
      active: true,
    },
    {
      center: "Qab Elias",
      program: "BLN",
      section: "B",
      shift: "Morning",
      active: true,
    },
    {
      center: "Qab Elias",
      program: "BLN",
      section: "C",
      shift: "Afternoon",
      active: true,
    },
  ],
  subjects: [
    { subject: "Arabic", active: true },
    { subject: "English", active: true },
  ],
  timeSlots: [
    {
      shift: "Morning",
      session: 1,
      startTime: "08:00",
      endTime: "09:00",
      active: true,
    },
    {
      shift: "Afternoon",
      session: 1,
      startTime: "12:00",
      endTime: "13:00",
      active: true,
    },
  ],
  staff: [
    {
      id: "T1",
      name: "Zainab",
      position: "Teacher",
      type: "Teacher",
      center: "Qab Elias",
      active: true,
    },
    {
      id: "O1",
      name: "Hala",
      position: "Officer",
      type: "Officer",
      center: "Marj",
      active: true,
    },
  ],
  users: [],
  payroll: [],
  systemSettings: [],
};
const analytics = {
  totals: { hours: 3, sessions: 3, activeTeachers: 1, attendancePeople: 0 },
  teacherSummary: [
    {
      id: "T1",
      name: "Zainab",
      type: "Teacher",
      workingDays: 2,
      sessions: 3,
      hours: 3,
      hoursInMonth: 2,
      hoursInPeriod: 3,
    },
  ],
  subjectSummary: [{ subject: "Arabic", sessions: 3, hours: 3, share: 100 }],
  sectionSummary: [
    {
      program: "BLN",
      section: "A",
      subject: "Arabic",
      sessions: 3,
      sessionsInMonth: 2,
      hours: 3,
    },
  ],
  monthlyTrend: [
    {
      month: "2026-09",
      hours: 1,
      sessions: 1,
      teachers: { T1: 1 },
      subjects: { Arabic: 1 },
      sections: { "BLN-A": 1 },
    },
    {
      month: "2026-10",
      hours: 2,
      sessions: 2,
      teachers: { T1: 2 },
      subjects: { Arabic: 2 },
      sections: { "BLN-A": 2 },
    },
  ],
};
async function fixture(page, user = manager) {
  const calls = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    calls.push({
      path,
      query: url.searchParams,
      method: req.method(),
      body: req.method() === "GET" ? null : req.postDataJSON(),
    });
    let body = { ok: true };
    let status = 200;
    if (path === "/api/session") {
      body = { user: null };
      status = 401;
    }
    if (path === "/api/login") body = { user };
    if (path === "/api/setup-data") body = setup;
    if (path === "/api/dashboard") body = analytics;
    if (path === "/api/settings") body = { offDays: [5, 6] };
    if (path === "/api/staff")
      body = { staff: [{ ...setup.staff[0], submitted: false }] };
    if (path === "/api/attendance" && req.method() === "GET")
      body = { staff: setup.staff[0], attendance: [] };
    if (path === "/api/schedule" && req.method() === "GET")
      body = { entries: [] };
    if (path === "/api/program-groups" && req.method() === "GET")
      body = { groups: [] };
    if (path === "/api/workload")
      body = {
        rows: [
          {
            id: "T1",
            name: "Zainab",
            type: "Teacher",
            workingDays: 2,
            totalSessions: 3,
            totalHours: 3,
            subjects: { Arabic: 2, CBPSS: 1 },
          },
        ],
      };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "MAPS Analytics Dashboard" }),
  ).toBeVisible();
  return calls;
}

test("production login, logo, unauthorized APIs and cross-origin mutations", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "MAPS Management Portal", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".login-logo")).toBeVisible();
  for (const path of [
    "/api/dashboard",
    "/api/setup-data",
    "/api/schedule/export",
    "/api/timesheets/export",
  ])
    expect((await request.get(path)).status()).toBe(401);
  expect(
    (
      await request.post("/api/login", {
        headers: { Origin: "https://untrusted.invalid" },
        data: { email: "a@b.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.post("/api/login", { data: {} })).status()).toBe(400);
});

test("Manager dashboard month span, teacher, section, subject and shared Reports filters", async ({
  page,
}) => {
  const calls = await fixture(page);
  await expect(
    page.getByText("Hours in Selected Period", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Period", { exact: true }).selectOption("months");
  await page.getByLabel("From month").fill("2026-09");
  await page.getByLabel("To month").fill("2026-10");
  await page.getByLabel("Teacher / Facilitator").selectOption("T1");
  await page.getByLabel("Program", { exact: true }).selectOption("BLN");
  await page.getByLabel("Section", { exact: true }).selectOption("A");
  await page.getByLabel("Subject", { exact: true }).selectOption("Arabic");
  await expect
    .poll(() =>
      calls
        .filter((c) => c.path === "/api/dashboard")
        .at(-1)
        ?.query.get("endDate"),
    )
    .toBe("2026-10-31");
  const last = calls.filter((c) => c.path === "/api/dashboard").at(-1);
  expect(last.query.get("startDate")).toBe("2026-09-01");
  expect(last.query.get("teacherId")).toBe("T1");
  expect(last.query.get("section")).toBe("A");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Period", { exact: true })).toBeVisible();
});

test("Attendance defaults Friday/Saturday Off and saves a complete selected month", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Attendance", exact: true })
    .click();
  await page.getByLabel("Month", { exact: true }).selectOption("10");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator(".calendar-day.off")).toHaveCount(10);
  await expect(page.locator(".calendar-day.working")).toHaveCount(21);
  await page
    .getByRole("button", { name: "Save Attendance", exact: true })
    .click();
  await expect
    .poll(
      () =>
        calls.filter((c) => c.path === "/api/attendance" && c.method === "POST")
          .length,
    )
    .toBe(1);
  const saved = calls.find(
    (c) => c.path === "/api/attendance" && c.method === "POST",
  ).body;
  expect(saved.days).toHaveLength(31);
  expect(saved.days.find((d) => d.date === "2026-10-02").status).toBe("Off");
});

test("Weekly all sections, shift filtering, manager-selected dates and immediate conflict", async ({
  page,
}) => {
  await fixture(page);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Class Schedule", exact: true })
    .click();
  await page.getByLabel("Week Start").fill("2026-10-12");
  await expect(page.locator(".schedule-card")).toHaveCount(3);
  await page.getByLabel("Shift", { exact: true }).selectOption("Afternoon");
  await expect(page.locator(".schedule-card")).toHaveCount(1);
  await page.getByLabel("Shift", { exact: true }).selectOption("Morning");
  await expect(page.locator(".schedule-card")).toHaveCount(2);
  const a = page.locator(".schedule-card").nth(0);
  await expect(a.locator("thead")).toContainText("12/10/2026");
  await a.locator("tbody td select").nth(0).selectOption("T1");
  await a.locator("tbody td select").nth(1).selectOption("Arabic");
  await expect(a.locator("tbody td select").nth(0)).toHaveValue("T1");
  await page
    .locator(".schedule-card")
    .nth(1)
    .locator("tbody td select")
    .nth(0)
    .selectOption("T1");
  await expect(page.locator(".notice.error")).toContainText("Conflict");
  await expect(page.locator(".heading-actions a.excel-button")).toBeVisible();
});

test("Admin tabs keep independent forms and expose financial/system setup", async ({
  page,
}) => {
  await fixture(page, admin);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Admin Setup", exact: true })
    .click();
  await page.getByRole("button", { name: "Programs", exact: true }).click();
  await expect(page.getByLabel("Category", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(page.getByLabel("Shift", { exact: true })).toHaveValue(
    "Morning",
  );
  await page
    .getByRole("button", { name: "Payroll / Financial", exact: true })
    .click();
  await expect(page.getByLabel("Hourly Rate")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Setting", { exact: true })).toBeVisible();
});

test("Officer sees Program Sessions and cannot select another person", async ({
  page,
}) => {
  const calls = await fixture(page, officer);
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Attendance", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Teacher Hours", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Program Sessions", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Group", exact: true }).click();
  await expect(page.getByLabel("Officer", { exact: true })).toBeDisabled();
  await page.getByLabel("Group", { exact: true }).fill("CSG Group 1");
  await page.getByLabel("Program", { exact: true }).last().selectOption("CSG");
  await page.getByLabel("First Session Date").fill("2026-10-13");
  await expect(page.getByLabel("Day of Week")).toHaveValue("Tuesday");
  await page
    .locator(".modal")
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect
    .poll(
      () =>
        calls.filter(
          (c) => c.path === "/api/program-groups" && c.method === "POST",
        ).length,
    )
    .toBe(1);
  expect(
    calls.find((c) => c.path === "/api/program-groups" && c.method === "POST")
      .body.officerId,
  ).toBe("O1");
});

test("mobile layout and bilingual English LTR / Arabic RTL", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator(".app-shell")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator(".mobile-menu").click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  expect(errors).toEqual([]);
});
