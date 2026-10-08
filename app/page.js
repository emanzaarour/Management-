"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { canReadModule } from "../lib/policy";

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_AR = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];
const DAY_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
const pad = (n) => String(n).padStart(2, "0");
const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (iso, lang = "en") => {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-LB" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
};

const copy = {
  en: {
    portal: "MAPS Management Portal",
    dashboard: "Dashboard",
    attendance: "Attendance",
    schedule: "Class Schedule",
    sessions: "Program Sessions",
    workload: "Teacher Hours",
    reports: "Reports",
    adminSetup: "Admin Setup",
    signout: "Sign out",
    arabic: "العربية",
    english: "EN",
    center: "Center",
    program: "Program",
    shift: "Shift",
    section: "Section",
    weekStart: "Week Start",
    all: "All",
    month: "Month",
    year: "Year",
    save: "Save Changes",
    copyWeek: "Copy Previous Week",
    exportExcel: "Export to Excel",
    working: "Working",
    off: "Off",
    pending: "Pending",
    submitted: "Submitted",
    open: "Open",
    edit: "Edit",
    status: "Status",
    actions: "Actions",
    addGroup: "Add Group",
    active: "Active",
    completed: "Completed",
    planned: "Planned",
    cancelled: "Cancelled",
    totalHours: "Total Hours",
    workingDays: "Working Days",
    totalSessions: "Total Sessions",
    exportTimesheets: "Export Monthly Timesheets",
    noData: "No data found.",
    staff: "Staff",
    users: "Users",
    programs: "Programs",
    sections: "Sections",
    subjects: "Subjects",
    timeSlots: "Time Slots",
    settings: "Settings",
    saveAttendance: "Save Attendance",
    updateAttendance: "Update Attendance",
    back: "Back",
    loginSubtitle:
      "Staff attendance, schedules, program sessions and monthly timesheets",
    email: "Email address",
    continue: "Continue",
    unauthorized: "This email is not authorized.",
    tempLogin:
      "Temporary email-only access. OTP verification can be added later.",
    managerHome: "Choose what you want to manage for your center.",
    officerHome: "Manage your program groups and sessions.",
    adminHome: "Overview of all management modules.",
    subject: "Subject",
    teacher: "Teacher / Facilitator",
    group: "Group",
    targetGroup: "Target Group",
    officer: "Officer",
    requiredSessions: "Required Sessions",
    firstDate: "First Session Date",
    startTime: "Start Time",
    endTime: "End Time",
    topic: "Topic",
    addSession: "Add Session",
    sessionNo: "Session",
    progress: "Progress",
    filters: "Filters",
    morning: "Morning",
    afternoon: "Afternoon",
    type: "Type",
    position: "Position",
    name: "Name",
    activeOnly: "Active only",
    defaultStart: "Default Start",
    defaultEnd: "Default End",
    category: "Category",
    role: "Role",
    reportPrograms: "Program groups summary",
    monthlyWorkload: "Monthly Workload",
    success: "Saved successfully.",
    conflict: "Conflict",
    hours: "Hours",
    attendanceCol: "Attendance",
  },
  ar: {
    portal: "بوابة MAPS للإدارة",
    dashboard: "الرئيسية",
    attendance: "الحضور",
    schedule: "جدول الحصص",
    sessions: "جلسات البرامج",
    workload: "ساعات المعلمين",
    reports: "التقارير",
    adminSetup: "إعدادات الإدارة",
    signout: "تسجيل الخروج",
    arabic: "العربية",
    english: "EN",
    center: "المركز",
    program: "البرنامج",
    shift: "الدوام",
    section: "الشعبة",
    weekStart: "بداية الأسبوع",
    all: "الكل",
    month: "الشهر",
    year: "السنة",
    save: "حفظ التعديلات",
    copyWeek: "نسخ الأسبوع السابق",
    exportExcel: "تصدير Excel",
    working: "دوام",
    off: "عطلة",
    pending: "غير مكتمل",
    submitted: "مكتمل",
    open: "فتح",
    edit: "تعديل",
    status: "الحالة",
    actions: "الإجراءات",
    addGroup: "إضافة مجموعة",
    active: "فعّالة",
    completed: "مكتملة",
    planned: "مخططة",
    cancelled: "ملغاة",
    totalHours: "مجموع الساعات",
    workingDays: "أيام الدوام",
    totalSessions: "عدد الجلسات",
    exportTimesheets: "تصدير الجداول المالية الشهرية",
    noData: "لا توجد بيانات.",
    staff: "الموظفون",
    users: "المستخدمون",
    programs: "البرامج",
    sections: "الشعب",
    subjects: "المواد",
    timeSlots: "أوقات الحصص",
    settings: "الإعدادات",
    saveAttendance: "حفظ الحضور",
    updateAttendance: "تحديث الحضور",
    back: "رجوع",
    loginSubtitle:
      "الحضور، الجداول الأسبوعية، جلسات البرامج والجداول المالية الشهرية",
    email: "البريد الإلكتروني",
    continue: "متابعة",
    unauthorized: "هذا البريد غير مخوّل بالدخول.",
    tempLogin: "الدخول مؤقتًا عبر البريد فقط، ويمكن إضافة OTP لاحقًا.",
    managerHome: "اختاري القسم الذي تريدين إدارته للمركز.",
    officerHome: "إدارة مجموعات البرامج والجلسات.",
    adminHome: "نظرة عامة على جميع أقسام النظام.",
    subject: "المادة",
    teacher: "المعلم / الميسر",
    group: "المجموعة",
    targetGroup: "الفئة المستهدفة",
    officer: "المسؤول",
    requiredSessions: "عدد الجلسات المطلوبة",
    firstDate: "تاريخ أول جلسة",
    startTime: "وقت البداية",
    endTime: "وقت النهاية",
    topic: "الموضوع",
    addSession: "إضافة جلسة",
    sessionNo: "الجلسة",
    progress: "التقدم",
    filters: "الفلاتر",
    morning: "صباحي",
    afternoon: "مسائي",
    type: "النوع",
    position: "المسمى الوظيفي",
    name: "الاسم",
    activeOnly: "الفعال فقط",
    defaultStart: "بداية الدوام",
    defaultEnd: "نهاية الدوام",
    category: "الفئة",
    role: "الصلاحية",
    reportPrograms: "ملخص مجموعات البرامج",
    monthlyWorkload: "ساعات العمل الشهرية",
    success: "تم الحفظ بنجاح.",
    conflict: "تعارض",
    hours: "الساعات",
    attendanceCol: "الحضور",
  },
};

function Icon({ name }) {
  const icons = {
    dashboard: "⌂",
    attendance: "✓",
    schedule: "▦",
    sessions: "◫",
    workload: "◷",
    reports: "▥",
    admin: "⚙",
    menu: "☰",
    plus: "＋",
    excel: "⇩",
    edit: "✎",
    user: "●",
    logout: "↪",
    calendar: "□",
  };
  return (
    <span className="icon-glyph" aria-hidden="true">
      {icons[name] || "•"}
    </span>
  );
}

function Sidebar({ user, t, activeView, setActiveView, open, setOpen }) {
  const role = norm(user.role);
  const items = [{ id: "dashboard", label: t.dashboard, icon: "dashboard" }];
  if (canReadModule(user, "attendance"))
    items.push({ id: "attendance", label: t.attendance, icon: "attendance" });
  if (canReadModule(user, "schedule"))
    items.push({ id: "schedule", label: t.schedule, icon: "schedule" });
  if (canReadModule(user, "sessions"))
    items.push({ id: "sessions", label: t.sessions, icon: "sessions" });
  if (canReadModule(user, "workload"))
    items.push({ id: "workload", label: t.workload, icon: "workload" });
  if (canReadModule(user, "reports"))
    items.push({ id: "reports", label: t.reports, icon: "reports" });
  if (role === "admin")
    items.push({ id: "admin", label: t.adminSetup, icon: "admin" });
  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-title">
          <img className="sidebar-logo" src="/maps-logo.jpeg" alt="MAPS" />
          <div>
            <strong>MAPS</strong>
            <span>Management Portal</span>
          </div>
        </div>
        <nav>
          {items.map((item) => (
            <button
              key={item.id}
              className={
                activeView === item.id ? "nav-item active" : "nav-item"
              }
              onClick={() => {
                setActiveView(item.id);
                setOpen(false);
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{user.name}</span>
          <small>
            {user.role} · {user.center}
          </small>
        </div>
      </aside>
    </>
  );
}

function Header({ user, lang, setLang, logout, setSidebarOpen }) {
  const t = copy[lang];
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>
        <Icon name="menu" />
      </button>
      <div className="topbar-spacer" />
      <button
        className="lang-button"
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
      >
        {lang === "en" ? t.arabic : t.english}
      </button>
      <div className="user-chip">
        <span className="avatar">
          {(user.name || "A")
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div>
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </div>
      </div>
      <button className="ghost-button" onClick={logout}>
        <Icon name="logout" /> {t.signout}
      </button>
    </header>
  );
}

function InitialCenter({ center, setCenter, user, setup }) {
  useEffect(() => {
    if (!center && setup.centers.length)
      setCenter(norm(user.role) === "admin" ? setup.centers[0] : user.center);
  }, [center, user, setup.centers, setCenter]);
  return null;
}
function FilterSelect({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
const allowedCenters = (user, setup) =>
  norm(user.role) === "admin" ? setup.centers : [user.center].filter(Boolean);
function InputField({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function SectionCard({ title, actions, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h3>{title}</h3>
        <div className="card-actions">{actions}</div>
      </div>
      {children}
    </section>
  );
}
function Notice({ kind = "error", children }) {
  return children ? <div className={`notice ${kind}`}>{children}</div> : null;
}

function Login({ lang, setLang, onLogin }) {
  const t = copy[lang];
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.unauthorized);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page" dir={lang === "ar" ? "rtl" : "ltr"}>
      <button
        className="lang-button login-lang"
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
      >
        {lang === "en" ? t.arabic : t.english}
      </button>
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/maps-logo.jpeg" alt="MAPS" />
        <h1>{t.portal}</h1>
        <p>{t.loginSubtitle}</p>
        <InputField
          label={t.email}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.org"
          required
        />
        <Notice>{error}</Notice>
        <button className="primary-button full" disabled={busy}>
          {busy ? "..." : t.continue}
        </button>
        <small className="login-note">{t.tempLogin}</small>
      </form>
    </main>
  );
}

function DashboardView({
  user,
  setup,
  lang,
  setActiveView,
  reportsMode = false,
}) {
  const t = copy[lang];
  const role = norm(user.role);
  const now = new Date();
  const [center, setCenter] = useState(
    user.center === "All" ? "All" : user.center,
  );
  const [periodMode, setPeriodMode] = useState("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [customStart, setCustomStart] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
  );
  const [spanStart, setSpanStart] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
  );
  const [spanEnd, setSpanEnd] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
  );
  const [customEnd, setCustomEnd] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`,
  );
  const [teacherId, setTeacherId] = useState("All");
  const [program, setProgram] = useState("All");
  const [section, setSection] = useState("All");
  const [subject, setSubject] = useState("All");
  const [data, setData] = useState({
    totals: { hours: 0, sessions: 0, activeTeachers: 0, attendancePeople: 0 },
    teacherSummary: [],
    subjectSummary: [],
    sectionSummary: [],
    monthlyTrend: [],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAr = lang === "ar";
  const activePrograms = setup.programs;
  const availableStaff = setup.staff.filter(
    (s) => center === "All" || norm(s.center) === norm(center),
  );
  const availableSections = [
    ...new Set(
      setup.sections
        .filter(
          (s) =>
            (center === "All" || norm(s.center) === norm(center)) &&
            (program === "All" || norm(s.program) === norm(program)),
        )
        .map((s) => s.section),
    ),
  ];
  const activeSubjects = setup.subjects;
  const range = useMemo(() => {
    if (periodMode === "months") {
      const [y, m] = spanEnd.split("-").map(Number);
      return {
        startDate: `${spanStart}-01`,
        endDate: `${spanEnd}-${pad(new Date(y, m, 0).getDate())}`,
      };
    }
    if (periodMode === "all") return { startDate: "", endDate: "" };
    if (periodMode === "custom")
      return { startDate: customStart, endDate: customEnd };
    const last = new Date(year, month, 0).getDate();
    return {
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(last)}`,
    };
  }, [periodMode, month, year, customStart, customEnd, spanStart, spanEnd]);
  useEffect(() => {
    if (!availableSections.includes(section) && section !== "All")
      setSection("All");
  }, [center, program]);
  useEffect(() => {
    if (!availableStaff.some((s) => s.id === teacherId) && teacherId !== "All")
      setTeacherId("All");
  }, [center]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    const q = new URLSearchParams({
      center,
      teacherId,
      program,
      section,
      subject,
      referenceMonth: `${year}-${pad(month)}`,
    });
    if (range.startDate) q.set("startDate", range.startDate);
    if (range.endDate) q.set("endDate", range.endDate);
    fetch(`/api/dashboard?${q.toString()}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || "Unable to load dashboard analytics.");
        return d;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    center,
    teacherId,
    program,
    section,
    subject,
    range.startDate,
    range.endDate,
    month,
    year,
  ]);

  const cards = [];
  if (role === "admin" || role === "manager")
    cards.push(
      {
        id: "attendance",
        title: t.attendance,
        desc: isAr
          ? "دوام شهري Working / Off"
          : "Working / Off monthly attendance",
        icon: "attendance",
      },
      {
        id: "schedule",
        title: t.schedule,
        desc: isAr
          ? "الشعب والمعلمين والمواد والتوقيت"
          : "Sections, teachers, subjects and timing",
        icon: "schedule",
      },
    );
  if (canReadModule(user, "sessions"))
    cards.push({
      id: "sessions",
      title: t.sessions,
      desc: isAr
        ? "مجموعات البرامج والجلسات المتكررة"
        : "Program groups and recurring sessions",
      icon: "sessions",
    });
  cards.push(
    {
      id: "workload",
      title: t.workload,
      desc: isAr
        ? "الساعات الشهرية والجداول المالية"
        : "Monthly hours and timesheets",
      icon: "workload",
    },
    {
      id: "reports",
      title: t.reports,
      desc: isAr
        ? "تقارير المعلمين والمواد والشعب"
        : "Teacher, subject and section analytics",
      icon: "reports",
    },
  );
  if (role === "admin")
    cards.push({
      id: "admin",
      title: t.adminSetup,
      desc: isAr
        ? "المستخدمون والموظفون والبرامج والشعب"
        : "Users, staff, programs and sections",
      icon: "admin",
    });
  const maxSubject = Math.max(1, ...data.subjectSummary.map((x) => x.sessions));
  const maxTrend = Math.max(1, ...data.monthlyTrend.map((x) => x.hours));
  const periodLabel =
    periodMode === "all"
      ? isAr
        ? "كل الفترة المتاحة"
        : "All available months"
      : periodMode === "months"
        ? `${spanStart} – ${spanEnd}`
        : periodMode === "custom"
          ? `${fmtDate(customStart, lang)} – ${fmtDate(customEnd, lang)}`
          : `${isAr ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1]} ${year}`;

  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{reportsMode ? t.reports : t.dashboard}</div>
          <h1>
            {reportsMode
              ? t.reports
              : isAr
                ? "لوحة تحليلات MAPS"
                : "MAPS Analytics Dashboard"}
          </h1>
          <p>
            {isAr
              ? "متابعة ساعات المعلمين والحصص والمواد والشعب حسب الفترة المختارة."
              : "Track teacher hours, sessions, subjects and sections across the selected period."}
          </p>
        </div>
      </div>
      <div className="filters-row analytics-filters">
        <FilterSelect label={t.center} value={center} onChange={setCenter}>
          {role === "admin" && <option value="All">{t.all}</option>}
          {allowedCenters(user, setup).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={isAr ? "الفترة" : "Period"}
          value={periodMode}
          onChange={setPeriodMode}
        >
          <option value="month">{isAr ? "شهر واحد" : "Selected month"}</option>
          <option value="months">
            {isAr ? "عدة أشهر" : "Multiple months"}
          </option>
          <option value="all">
            {isAr ? "كل الأشهر" : "All available months"}
          </option>
          <option value="custom">
            {isAr ? "فترة مخصصة" : "Custom date range"}
          </option>
        </FilterSelect>
        {
          <>
            <FilterSelect
              label={t.month}
              value={month}
              onChange={(v) => setMonth(Number(v))}
            >
              {MONTHS_EN.map((m, i) => (
                <option value={i + 1} key={m}>
                  {isAr ? MONTHS_AR[i] : m}
                </option>
              ))}
            </FilterSelect>
            <InputField
              label={t.year}
              type="number"
              min="1900"
              max="9999"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </>
        }
        {periodMode === "months" && (
          <>
            <InputField
              label={isAr ? "من شهر" : "From month"}
              type="month"
              value={spanStart}
              onChange={(e) => setSpanStart(e.target.value)}
            />
            <InputField
              label={isAr ? "إلى شهر" : "To month"}
              type="month"
              value={spanEnd}
              onChange={(e) => setSpanEnd(e.target.value)}
            />
          </>
        )}
        {periodMode === "custom" && (
          <>
            <InputField
              label={isAr ? "من" : "From"}
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <InputField
              label={isAr ? "إلى" : "To"}
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        )}
        <FilterSelect
          label={t.teacher}
          value={teacherId}
          onChange={setTeacherId}
        >
          <option value="All">{t.all}</option>
          {availableStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.program} value={program} onChange={setProgram}>
          <option value="All">{t.all}</option>
          {activePrograms.map((p) => (
            <option key={p.program}>{p.program}</option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.section} value={section} onChange={setSection}>
          <option value="All">{t.all}</option>
          {availableSections.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.subject} value={subject} onChange={setSubject}>
          <option value="All">{t.all}</option>
          {activeSubjects.map((s) => (
            <option key={s.subject}>{s.subject}</option>
          ))}
        </FilterSelect>
      </div>
      <Notice>{error}</Notice>
      {busy && <div className="dashboard-loading">Loading analytics...</div>}
      <div className="analytics-period">
        {isAr ? "الفترة المختارة" : "Selected period"}:{" "}
        <strong>{periodLabel}</strong>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-icon">◷</span>
          <small>{isAr ? "ساعات المعلمين" : "Teacher Hours"}</small>
          <strong>{data.totals.hours} hrs</strong>
        </div>
        <div className="stat-card">
          <span className="stat-icon">▦</span>
          <small>{isAr ? "عدد الحصص والجلسات" : "Sessions"}</small>
          <strong>{data.totals.sessions}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-icon">●</span>
          <small>{isAr ? "معلمون / ميسرون نشطون" : "Active Teachers"}</small>
          <strong>{data.totals.activeTeachers}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✓</span>
          <small>
            {isAr ? "سجلات الحضور المكتملة" : "Submitted Attendance"}
          </small>
          <strong>{data.totals.attendancePeople}</strong>
        </div>
      </div>
      <div className="analytics-grid">
        <SectionCard title={isAr ? "ملخص المعلمين" : "Teacher Summary"}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.teacher}</th>
                  <th>{t.workingDays}</th>
                  <th>{t.totalSessions}</th>
                  <th>{isAr ? "ساعات الشهر" : "Hours in Month"}</th>
                  <th>{isAr ? "ساعات الفترة" : "Hours in Selected Period"}</th>
                </tr>
              </thead>
              <tbody>
                {data.teacherSummary.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small className="subline">{r.type}</small>
                    </td>
                    <td>{r.workingDays}</td>
                    <td>{r.sessions}</td>
                    <td>{r.hoursInMonth}</td>
                    <td>
                      <strong>{r.hoursInPeriod}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.teacherSummary.length && (
            <div className="empty-state">{t.noData}</div>
          )}
        </SectionCard>
        <SectionCard title={isAr ? "ملخص المواد" : "Subject Summary"}>
          <div className="summary-bars">
            {data.subjectSummary.map((r) => (
              <div className="summary-bar" key={r.subject}>
                <div>
                  <strong>{r.subject}</strong>
                  <span>
                    {r.sessions} {isAr ? "حصة" : "sessions"} · {r.hours} hrs ·{" "}
                    {r.share}%
                  </span>
                </div>
                <div className="bar-track">
                  <span
                    style={{
                      width: `${Math.max(4, Math.round((r.sessions / maxSubject) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!data.subjectSummary.length && (
            <div className="empty-state">{t.noData}</div>
          )}
        </SectionCard>
        <SectionCard
          title={isAr ? "ملخص الشعب والمواد" : "Section / Subject Summary"}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.program}</th>
                  <th>{t.section}</th>
                  <th>{t.subject}</th>
                  <th>{isAr ? "حصص الشهر" : "Sessions in Month"}</th>
                  <th>{isAr ? "حصص الفترة" : "Sessions in Period"}</th>
                  <th>{t.hours}</th>
                </tr>
              </thead>
              <tbody>
                {data.sectionSummary.map((r, i) => (
                  <tr key={`${r.program}-${r.section}-${r.subject}-${i}`}>
                    <td>{r.program}</td>
                    <td>{r.section}</td>
                    <td>{r.subject}</td>
                    <td>{r.sessionsInMonth}</td>
                    <td>
                      <strong>{r.sessions}</strong>
                    </td>
                    <td>{r.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.sectionSummary.length && (
            <div className="empty-state">{t.noData}</div>
          )}
        </SectionCard>
      </div>
      <SectionCard title={isAr ? "التطور الشهري" : "Monthly Trend"}>
        <div className="trend-grid">
          {data.monthlyTrend.map((r) => (
            <div className="trend-item" key={r.month}>
              <div className="trend-bars">
                <span
                  style={{
                    height: `${Math.max(8, Math.round((r.hours / maxTrend) * 100))}%`,
                  }}
                />
              </div>
              <strong>{r.hours}h</strong>
              <small>
                {r.sessions} {isAr ? "حصة" : "sessions"}
              </small>
              <label>{r.month}</label>
            </div>
          ))}
        </div>
        {!data.monthlyTrend.length && (
          <div className="empty-state">{t.noData}</div>
        )}
      </SectionCard>
      <SectionCard
        title={isAr ? "تفاصيل الاتجاهات الشهرية" : "Monthly Trend Details"}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.month}</th>
                <th>{t.teacher}</th>
                <th>{t.subject}</th>
                <th>{t.section}</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyTrend.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>
                    {Object.entries(r.teachers || {}).map(([id, hours]) => (
                      <div key={id}>
                        {data.teacherSummary.find((t) => t.id === id)?.name ||
                          id}
                        : {Number(hours.toFixed(2))}h
                      </div>
                    ))}
                  </td>
                  <td>
                    {Object.entries(r.subjects || {}).map(
                      ([subject, count]) => (
                        <div key={subject}>
                          {subject}: {count}
                        </div>
                      ),
                    )}
                  </td>
                  <td>
                    {Object.entries(r.sections || {}).map(
                      ([section, count]) => (
                        <div key={section}>
                          {section}: {count}
                        </div>
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {reportsMode && (
        <div className="two-column">
          {[
            ["programSummary", t.program, "program"],
            ["centerSummary", t.center, "center"],
            ["groupProgress", t.progress, "groupName"],
          ].map(([key, label, field]) => (
            <SectionCard key={key} title={label}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{label}</th>
                      <th>{t.totalSessions}</th>
                      <th>{t.totalHours}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data[key] || []).map((r, i) => (
                      <tr key={i}>
                        <td>{r[field]}</td>
                        <td>
                          {key === "groupProgress"
                            ? `${r.completedSessions}/${r.requiredSessions}`
                            : r.sessions}
                        </td>
                        <td>{key === "groupProgress" ? r.status : r.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
      {!reportsMode && (
        <>
          <h2 className="shortcut-heading">
            {isAr ? "أقسام النظام" : "Management Modules"}
          </h2>
          <div className="module-grid">
            {cards
              .filter((c) =>
                canReadModule(
                  user,
                  c.id === "admin"
                    ? "admin"
                    : c.id === "workload"
                      ? "workload"
                      : c.id,
                ),
              )
              .map((c) => (
                <button
                  key={c.id}
                  className="module-card"
                  onClick={() => setActiveView(c.id)}
                >
                  <span className="module-icon">
                    <Icon name={c.icon} />
                  </span>
                  <strong>{c.title}</strong>
                  <small>{c.desc}</small>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function makeMonth(year, month, existing, offDays) {
  const map = new Map(existing.map((x) => [x.date, x.status]));
  const count = new Date(year, month, 0).getDate();
  const rows = [];
  for (let day = 1; day <= count; day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const dow = new Date(`${date}T12:00:00`).getDay();
    rows.push({
      date,
      day,
      status: map.get(date) || (offDays.includes(dow) ? "Off" : "Working"),
    });
  }
  return rows;
}

function AttendanceView({ user, setup, lang }) {
  const t = copy[lang];
  const now = new Date();
  const [center, setCenter] = useState(
    user.center === "All" ? setup.centers[0] || "" : user.center,
  );
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [days, setDays] = useState([]);
  const [offDays, setOffDays] = useState([5, 6]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => d.offDays && setOffDays(d.offDays))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!center) return;
    let cancelled = false;
    setMessage("");
    fetch(
      `/api/staff?center=${encodeURIComponent(center)}&month=${month}&year=${year}`,
    )
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok)
          throw new Error(d.error || `Unable to load staff (${r.status}).`);
        return d;
      })
      .then((d) => {
        if (!cancelled) setStaff(d.staff || []);
      })
      .catch((e) => {
        if (!cancelled) {
          setStaff([]);
          setMessage(e.message || "Unable to load staff.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [center, month, year]);
  async function open(member) {
    setDays([]);
    setSelected(member);
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(
        `/api/attendance?staffId=${encodeURIComponent(member.id)}&month=${month}&year=${year}`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDays(makeMonth(year, month, d.attendance || [], offDays));
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selected.id, month, year, days }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(t.success);
      setSelected(null);
      const rr = await fetch(
        `/api/staff?center=${encodeURIComponent(center)}&month=${month}&year=${year}`,
      );
      setStaff((await rr.json()).staff || []);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (selected)
    return (
      <div>
        <InitialCenter
          center={center}
          setCenter={setCenter}
          user={user}
          setup={setup}
        />
        <div className="page-heading">
          <div>
            <div className="eyebrow">{t.attendance}</div>
            <h1>{selected.name}</h1>
            <p>
              {selected.position} · {selected.center}
            </p>
          </div>
          <button className="ghost-button" onClick={() => setSelected(null)}>
            {t.back}
          </button>
        </div>
        <Notice kind={message === t.success ? "success" : "error"}>
          {message}
        </Notice>
        {busy && !days.length ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <div className="calendar-weekdays">
              {(lang === "ar" ? DAY_AR : DAY_EN).map((d) => (
                <div key={d}>{d.slice(0, 3)}</div>
              ))}
            </div>
            <div className="calendar-grid">
              {Array.from({
                length: new Date(year, month - 1, 1).getDay(),
              }).map((_, i) => (
                <div key={i} className="calendar-day blank" />
              ))}
              {days.map((d) => (
                <button
                  key={d.date}
                  className={`calendar-day ${d.status === "Working" ? "working" : "off"}`}
                  onClick={() =>
                    setDays((x) =>
                      x.map((v) =>
                        v.date === d.date
                          ? {
                              ...v,
                              status:
                                v.status === "Working" ? "Off" : "Working",
                            }
                          : v,
                      ),
                    )
                  }
                >
                  <strong>{d.day}</strong>
                  <span>{d.status === "Working" ? t.working : t.off}</span>
                </button>
              ))}
            </div>
            <div className="footer-actions">
              <button className="primary-button" disabled={busy} onClick={save}>
                {selected.submitted ? t.updateAttendance : t.saveAttendance}
              </button>
            </div>
          </>
        )}
      </div>
    );
  return (
    <div>
      <InitialCenter
        center={center}
        setCenter={setCenter}
        user={user}
        setup={setup}
      />
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.attendance}</div>
          <h1>{t.attendance}</h1>
        </div>
      </div>
      <Notice kind={message ? "error" : "success"}>{message}</Notice>
      <div className="filters-row">
        <FilterSelect label={t.center} value={center} onChange={setCenter}>
          {allowedCenters(user, setup).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t.month}
          value={month}
          onChange={(v) => setMonth(Number(v))}
        >
          {MONTHS_EN.map((m, i) => (
            <option value={i + 1} key={m}>
              {lang === "ar" ? MONTHS_AR[i] : m}
            </option>
          ))}
        </FilterSelect>
        <InputField
          label={t.year}
          type="number"
          min="1900"
          max="9999"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>
      <SectionCard
        title={`${staff.filter((s) => s.submitted).length} / ${staff.length} ${t.submitted}`}
      >
        <div className="progress">
          <span
            style={{
              width: `${staff.length ? Math.round((staff.filter((s) => s.submitted).length / staff.length) * 100) : 0}%`,
            }}
          />
        </div>
      </SectionCard>
      <SectionCard title={t.staff}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.position}</th>
                <th>{t.status}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small className="subline">{s.id}</small>
                  </td>
                  <td>{s.position}</td>
                  <td>
                    <span className={`pill ${s.submitted ? "green" : "amber"}`}>
                      {s.submitted ? t.submitted : t.pending}
                    </span>
                  </td>
                  <td>
                    <button className="small-button" onClick={() => open(s)}>
                      {s.submitted ? t.edit : t.open}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function WeeklyScheduleView({ user, setup, lang }) {
  const t = copy[lang];
  const canEdit = norm(user.role) !== "officer";
  const [center, setCenter] = useState(
    user.center === "All" ? setup.centers[0] || "" : user.center,
  );
  const [program, setProgram] = useState("All");
  const [shift, setShift] = useState("All");
  const [section, setSection] = useState("All");
  const [weekStart, setWeekStart] = useState(todayIso());
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const activePrograms = setup.programs.filter((p) => p.active);
  const activeSubjects = setup.subjects.filter((s) => s.active);
  const teachers = setup.staff.filter(
    (s) => s.active && norm(s.center) === norm(center),
  );
  const sectionMap = new Map(
    [
      ...setup.sections.filter(
        (s) =>
          s.active &&
          activePrograms.some((p) => norm(p.program) === norm(s.program)),
      ),
      ...entries.map((e) => ({
        ...e,
        active: setup.sections.some(
          (s) =>
            s.active &&
            activePrograms.some((p) => norm(p.program) === norm(e.program)) &&
            norm(s.center) === norm(e.center) &&
            norm(s.program) === norm(e.program) &&
            norm(s.section) === norm(e.section) &&
            norm(s.shift) === norm(e.shift),
        ),
      })),
    ].map((s) => [`${s.center}|${s.program}|${s.section}|${s.shift}`, s]),
  );
  const sections = [...sectionMap.values()].filter(
    (s) =>
      true &&
      norm(s.center) === norm(center) &&
      (program === "All" || norm(s.program) === norm(program)) &&
      (shift === "All" || norm(s.shift) === norm(shift)) &&
      (section === "All" || norm(s.section) === norm(section)),
  );
  useEffect(() => {
    if (!center || !weekStart) return;
    let cancelled = false;
    setBusy(true);
    setLoaded(false);
    setEntries([]);
    setDraft({});
    setMessage("");
    fetch(
      `/api/schedule?center=${encodeURIComponent(center)}&weekStart=${weekStart}`,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        setEntries(d.entries || []);
        const next = {};
        (d.entries || []).forEach((e) => {
          next[`${e.program}|${e.section}|${e.shift}|${e.date}|${e.session}`] =
            {
              teacherId: e.teacherId,
              teacherName: e.teacherName,
              subject: e.subject,
            };
        });
        setDraft(next);
        setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [center, weekStart]);
  const dayDates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  function sectionSlots(sec) {
    const slots = setup.timeSlots.filter(
      (x) => x.active && norm(x.shift) === norm(sec.shift),
    );
    for (const e of entries.filter(
      (e) =>
        norm(e.program) === norm(sec.program) &&
        norm(e.section) === norm(sec.section) &&
        norm(e.shift) === norm(sec.shift),
    ))
      if (!slots.some((s) => Number(s.session) === Number(e.session)))
        slots.push({ ...e });
    return slots.sort((a, b) => a.session - b.session);
  }
  function cellKey(sec, date, session) {
    return `${sec.program}|${sec.section}|${sec.shift}|${date}|${session}`;
  }
  function getCell(sec, date, slot) {
    return (
      draft[cellKey(sec, date, slot.session)] || {
        teacherId: "",
        teacherName: "",
        subject: "",
      }
    );
  }
  function hasConflict(teacherId, sec, date, slot, ownKey) {
    if (!teacherId) return null;
    const a1 =
      Number(slot.startTime.split(":")[0]) * 60 +
      Number(slot.startTime.split(":")[1]);
    const a2 =
      Number(slot.endTime.split(":")[0]) * 60 +
      Number(slot.endTime.split(":")[1]);
    for (const e of entries) {
      const k = cellKey(
        { program: e.program, section: e.section, shift: e.shift },
        e.date,
        e.session,
      );
      if (
        k === ownKey ||
        e.date !== date ||
        (draft[k] ? draft[k].teacherId : e.teacherId) !== teacherId
      )
        continue;
      const b1 =
        Number(e.startTime.split(":")[0]) * 60 +
        Number(e.startTime.split(":")[1]);
      const b2 =
        Number(e.endTime.split(":")[0]) * 60 + Number(e.endTime.split(":")[1]);
      if (a1 < b2 && b1 < a2)
        return `${e.teacherName} → ${e.program}-${e.section} ${e.startTime}-${e.endTime}`;
    }
    for (const s of sectionMap.values()) {
      const slots = setup.timeSlots.filter(
        (x) => x.active && norm(x.shift) === norm(s.shift),
      );
      for (const sl of slots) {
        const k = cellKey(s, date, sl.session);
        if (k === ownKey) continue;
        const c = draft[k];
        if (c?.teacherId === teacherId) {
          const b1 =
            Number(sl.startTime.split(":")[0]) * 60 +
            Number(sl.startTime.split(":")[1]);
          const b2 =
            Number(sl.endTime.split(":")[0]) * 60 +
            Number(sl.endTime.split(":")[1]);
          if (a1 < b2 && b1 < a2)
            return `${c.teacherName} → ${s.program}-${s.section} ${sl.startTime}-${sl.endTime}`;
        }
      }
    }
    return null;
  }
  async function changeTeacher(sec, date, slot, id) {
    const key = cellKey(sec, date, slot.session);
    const member = teachers.find((x) => x.id === id);
    const previous = entries.find((e) => cellKey(e, e.date, e.session) === key);
    slot = previous || slot;
    const conflict = hasConflict(id, sec, date, slot, key);
    if (conflict) {
      setMessage(`${t.conflict}: ${conflict}`);
      return;
    }
    setMessage("");
    if (id) {
      const r = await fetch("/api/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: id,
          center,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          excludeWeeklyKey: `${date}|${center}|${sec.program}|${sec.section}|${norm(sec.shift)}|${slot.session}`,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        setMessage(result.error);
        return;
      }
    }
    setDraft((d) => ({
      ...d,
      [key]: {
        ...(d[key] || {}),
        teacherId: id,
        teacherName: member?.name || "",
      },
    }));
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const payload = [];
      for (const sec of sections.filter((s) => s.active)) {
        const slots = sectionSlots(sec);
        for (const date of dayDates)
          for (const slot of slots) {
            const c = getCell(sec, date, slot);
            const previous = entries.find(
              (e) =>
                cellKey(e, e.date, e.session) ===
                cellKey(sec, date, slot.session),
            );
            if (
              previous &&
              c.teacherId === previous.teacherId &&
              c.subject === previous.subject &&
              c.teacherId &&
              (!teachers.some((t) => t.id === c.teacherId) ||
                !activeSubjects.some((s) => s.subject === c.subject))
            )
              continue;
            payload.push({
              weekStart,
              date,
              center,
              program: sec.program,
              section: sec.section,
              shift: sec.shift,
              session: slot.session,
              startTime: previous?.startTime || slot.startTime,
              endTime: previous?.endTime || slot.endTime,
              teacherId: c.teacherId || "",
              teacherName: c.teacherName || "",
              subject: c.subject || "",
            });
          }
      }
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(t.success);
      const rr = await fetch(
        `/api/schedule?center=${encodeURIComponent(center)}&weekStart=${weekStart}`,
      );
      setEntries((await rr.json()).entries || []);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function copyPrev() {
    if (!confirm("Copy previous week into this week?")) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/schedule/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center,
          program,
          shift,
          section,
          targetWeekStart: weekStart,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(`${d.copied} entries copied.`);
      const rr = await fetch(
        `/api/schedule?center=${encodeURIComponent(center)}&weekStart=${weekStart}`,
      );
      const data = await rr.json();
      setEntries(data.entries || []);
      const next = {};
      (data.entries || []).forEach(
        (e) =>
          (next[`${e.program}|${e.section}|${e.shift}|${e.date}|${e.session}`] =
            {
              teacherId: e.teacherId,
              teacherName: e.teacherName,
              subject: e.subject,
            }),
      );
      setDraft(next);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  const exportUrl = `/api/schedule/export?center=${encodeURIComponent(center)}&program=${encodeURIComponent(program)}&shift=${encodeURIComponent(shift)}&section=${encodeURIComponent(section)}&weekStart=${weekStart}`;
  return (
    <div>
      <InitialCenter
        center={center}
        setCenter={setCenter}
        user={user}
        setup={setup}
      />
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.schedule}</div>
          <h1>{t.schedule}</h1>
          <p>
            Each active section has its own timetable. Historical closed
            sections remain available as read-only tables.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="ghost-button"
            hidden={!canEdit}
            onClick={copyPrev}
            disabled={busy || !loaded}
          >
            {t.copyWeek}
          </button>
          <a className="excel-button" href={exportUrl}>
            <Icon name="excel" /> {t.exportExcel}
          </a>
          <button
            className="primary-button"
            hidden={!canEdit}
            onClick={save}
            disabled={busy || !loaded}
          >
            {t.save}
          </button>
        </div>
      </div>
      <div className="filters-row schedule-filters">
        <FilterSelect label={t.center} value={center} onChange={setCenter}>
          {allowedCenters(user, setup).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.program} value={program} onChange={setProgram}>
          <option>All</option>
          {activePrograms.map((p) => (
            <option key={p.program}>{p.program}</option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.shift} value={shift} onChange={setShift}>
          <option>All</option>
          <option>Morning</option>
          <option>Afternoon</option>
        </FilterSelect>
        <FilterSelect label={t.section} value={section} onChange={setSection}>
          <option>All</option>
          {[
            ...new Set(
              setup.sections
                .filter(
                  (s) =>
                    s.active &&
                    norm(s.center) === norm(center) &&
                    (program === "All" || norm(s.program) === norm(program)) &&
                    (shift === "All" || norm(s.shift) === norm(shift)),
                )
                .map((s) => s.section),
            ),
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </FilterSelect>
        <InputField
          label={t.weekStart}
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
      </div>
      <Notice kind={message === t.success ? "success" : "error"}>
        {message}
      </Notice>
      {busy && <div className="loading">Loading...</div>}
      {sections.map((sec) => {
        const slots = sectionSlots(sec);
        return (
          <SectionCard
            key={`${sec.program}-${sec.section}-${sec.shift}`}
            title={`${sec.program} - ${sec.section}`}
            actions={<span className="pill blue">{sec.shift}</span>}
            className="schedule-card"
          >
            <div className="schedule-table-wrap">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>{lang === "ar" ? "الوقت" : "Time"}</th>
                    {dayDates.map((d) => (
                      <th key={d}>
                        <span>
                          {
                            (lang === "ar" ? DAY_AR : DAY_EN)[
                              new Date(`${d}T12:00:00Z`).getUTCDay()
                            ]
                          }
                        </span>
                        <small>{fmtDate(d, lang)}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.session}>
                      <th>
                        {slot.startTime} - {slot.endTime}
                      </th>
                      {dayDates.map((date) => {
                        const c = getCell(sec, date, slot);
                        const previous = entries.find(
                          (e) =>
                            cellKey(e, e.date, e.session) ===
                            cellKey(sec, date, slot.session),
                        );
                        return (
                          <td key={date}>
                            {previous &&
                              (previous.startTime !== slot.startTime ||
                                previous.endTime !== slot.endTime) && (
                                <small className="subline">
                                  {previous.startTime} - {previous.endTime}
                                </small>
                              )}
                            <select
                              disabled={!canEdit || !sec.active}
                              value={c.teacherId || ""}
                              onChange={(e) =>
                                changeTeacher(sec, date, slot, e.target.value)
                              }
                            >
                              <option value="">—</option>
                              {c.teacherId &&
                                !teachers.some((x) => x.id === c.teacherId) && (
                                  <option value={c.teacherId}>
                                    {c.teacherName || c.teacherId}
                                  </option>
                                )}
                              {teachers.map((x) => (
                                <option value={x.id} key={x.id}>
                                  {x.name}
                                </option>
                              ))}
                            </select>
                            <select
                              disabled={!canEdit || !sec.active}
                              value={c.subject || ""}
                              onChange={(e) => {
                                const k = cellKey(sec, date, slot.session);
                                setDraft((d) => ({
                                  ...d,
                                  [k]: {
                                    ...(d[k] || {}),
                                    subject: e.target.value,
                                  },
                                }));
                              }}
                            >
                              <option value="">—</option>
                              {c.subject &&
                                !activeSubjects.some(
                                  (s) => s.subject === c.subject,
                                ) && (
                                  <option value={c.subject}>{c.subject}</option>
                                )}
                              {activeSubjects.map((s) => (
                                <option key={s.subject}>{s.subject}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );
      })}
      {!sections.length && (
        <div className="empty-state">
          {t.noData} Add or activate sections in Admin Setup.
        </div>
      )}
    </div>
  );
}

function ProgramSessionsView({ user, setup, lang }) {
  const t = copy[lang];
  const [center, setCenter] = useState(
    user.center === "All" ? setup.centers[0] || "" : user.center,
  );
  const [program, setProgram] = useState("All");
  const [status, setStatus] = useState("All");
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const programs = setup.programs.filter((p) => p.active);
  const staffOptions = setup.staff.filter(
    (s) => s.active && norm(s.center) === norm(center),
  );
  const officerMatch = staffOptions.find(
    (s) => norm(s.name) === norm(user.name),
  );
  const sessionChecks = useRef({});
  const [groupConflict, setGroupConflict] = useState("");
  const [groupChecking, setGroupChecking] = useState(false);
  const [form, setForm] = useState({
    program: "",
    groupName: "",
    targetGroup: "",
    officerId: "",
    requiredSessions:
      programs.find(
        (p) =>
          p.program === (program === "All" ? programs[0]?.program : program),
      )?.requiredSessions || 9,
    firstSessionDate: todayIso(),
    startTime: "10:00",
    endTime: "12:00",
  });
  useEffect(() => {
    if (!showForm || !form.program || !form.officerId) return;
    let cancelled = false;
    const controller = new AbortController();
    setGroupChecking(true);
    const timer = setTimeout(() => {
      fetch("/api/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind: "group",
          center,
          program: form.program,
          personId: form.officerId,
          firstSessionDate: form.firstSessionDate,
          requiredSessions: form.requiredSessions,
          startTime: form.startTime,
          endTime: form.endTime,
        }),
      })
        .then(async (r) => {
          const d = await r.json();
          if (!cancelled) setGroupConflict(r.ok ? "" : d.error);
        })
        .catch((e) => {
          if (!cancelled) setGroupConflict(e.message);
        })
        .finally(() => {
          if (!cancelled) setGroupChecking(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    showForm,
    center,
    form.program,
    form.officerId,
    form.firstSessionDate,
    form.requiredSessions,
    form.startTime,
    form.endTime,
  ]);
  async function loadGroups() {
    if (!center) return;
    const r = await fetch(
      `/api/program-groups?center=${encodeURIComponent(center)}&program=${encodeURIComponent(program)}&status=${encodeURIComponent(status)}`,
    );
    const d = await r.json();
    setGroups(d.groups || []);
    if (selected) {
      const fresh = (d.groups || []).find(
        (g) => g.groupId === selected.groupId,
      );
      if (fresh) setSelected(fresh);
    }
  }
  useEffect(() => {
    loadGroups();
  }, [center, program, status]);
  async function loadSessions(group) {
    setSelected(group);
    const r = await fetch(
      `/api/program-sessions?groupId=${encodeURIComponent(group.groupId)}`,
    );
    const d = await r.json();
    setSessions(d.sessions || []);
  }
  function newGroup() {
    setGroupConflict("");
    const defaultOfficer =
      norm(user.role) === "officer" ? officerMatch?.id || user.email : "";
    setForm({
      program: program === "All" ? programs[0]?.program || "" : program,
      groupName: "",
      targetGroup: "",
      officerId: defaultOfficer,
      requiredSessions:
        programs.find(
          (p) =>
            p.program === (program === "All" ? programs[0]?.program : program),
        )?.requiredSessions || 9,
      firstSessionDate: todayIso(),
      startTime: "10:00",
      endTime: "12:00",
    });
    setShowForm(true);
  }
  async function createGroup(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const officer = staffOptions.find((s) => s.id === form.officerId);
      const r = await fetch("/api/program-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          center,
          officerName: officer?.name || user.name,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowForm(false);
      setMessage(t.success);
      await loadGroups();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSession(row) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/program-sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selected.groupId,
          sessionNo: row.sessionNo,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          status: row.status,
          topic: row.topic,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(t.success);
      await loadSessions(selected);
      await loadGroups();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  const canEdit = norm(user.role) === "admin" || norm(user.role) === "officer";
  return (
    <div>
      <InitialCenter
        center={center}
        setCenter={setCenter}
        user={user}
        setup={setup}
      />
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.sessions}</div>
          <h1>{t.sessions}</h1>
          <p>
            Create the group once. The system automatically generates the
            recurring weekly sessions.
          </p>
        </div>
        {canEdit && (
          <button className="primary-button" onClick={newGroup}>
            <Icon name="plus" /> {t.addGroup}
          </button>
        )}
      </div>
      <div className="filters-row">
        <FilterSelect label={t.center} value={center} onChange={setCenter}>
          {allowedCenters(user, setup).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.program} value={program} onChange={setProgram}>
          <option>All</option>
          {setup.programs.map((p) => (
            <option key={p.program}>{p.program}</option>
          ))}
        </FilterSelect>
        <FilterSelect label={t.status} value={status} onChange={setStatus}>
          <option>All</option>
          <option>Active</option>
          <option>Completed</option>
        </FilterSelect>
      </div>
      <Notice kind={message === t.success ? "success" : "error"}>
        {message}
      </Notice>
      <div className="two-column">
        <SectionCard title={t.group}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.group}</th>
                  <th>{t.program}</th>
                  <th>{t.officer}</th>
                  <th>{t.progress}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr
                    key={g.groupId}
                    className={
                      selected?.groupId === g.groupId ? "selected-row" : ""
                    }
                    onClick={() => loadSessions(g)}
                  >
                    <td>
                      <strong>{g.groupName}</strong>
                      <small className="subline">{g.targetGroup}</small>
                    </td>
                    <td>{g.program}</td>
                    <td>{g.officerName}</td>
                    <td>
                      {g.completedSessions}/{g.requiredSessions}
                    </td>
                    <td>
                      <span
                        className={`pill ${norm(g.status) === "completed" ? "green" : "blue"}`}
                      >
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard
          title={
            selected
              ? `${selected.groupName} · ${selected.completedSessions}/${selected.requiredSessions}`
              : t.sessions
          }
        >
          {selected ? (
            <div className="table-wrap">
              <table className="session-edit-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>{t.startTime}</th>
                    <th>{t.endTime}</th>
                    <th>{t.status}</th>
                    <th>{t.topic}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <SessionEditRow
                      key={`${s.groupId}-${s.sessionNo}`}
                      row={s}
                      index={i}
                      canEdit={canEdit}
                      onChange={async (patch) => {
                        const candidate = { ...s, ...patch };
                        const check =
                          (sessionChecks.current[s.sessionNo] || 0) + 1;
                        sessionChecks.current[s.sessionNo] = check;
                        setSessions((rows) =>
                          rows.map((x) =>
                            x.sessionNo === s.sessionNo ? candidate : x,
                          ),
                        );
                        setMessage("");
                        if (candidate.status !== "Cancelled") {
                          const r = await fetch("/api/conflicts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              groupId: selected.groupId,
                              sessionNo: s.sessionNo,
                              date: candidate.date,
                              startTime: candidate.startTime,
                              endTime: candidate.endTime,
                            }),
                          });
                          const result = await r.json();
                          if (
                            !r.ok &&
                            sessionChecks.current[s.sessionNo] === check
                          ) {
                            setMessage(result.error);
                          }
                        }
                      }}
                      onSave={() => saveSession(s)}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              Select a group to view its sessions.
            </div>
          )}
        </SectionCard>
      </div>
      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={createGroup}>
            <div className="modal-head">
              <h2>{t.addGroup}</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>
            <div className="form-grid">
              <FilterSelect
                label={t.program}
                value={form.program}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    program: v,
                    requiredSessions:
                      programs.find((p) => p.program === v)?.requiredSessions ||
                      9,
                  }))
                }
              >
                {programs.map((p) => (
                  <option key={p.program}>{p.program}</option>
                ))}
              </FilterSelect>
              <InputField
                label={t.group}
                value={form.groupName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, groupName: e.target.value }))
                }
                required
              />
              <InputField
                label={t.targetGroup}
                value={form.targetGroup}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetGroup: e.target.value }))
                }
              />
              <FilterSelect
                disabled={norm(user.role) === "officer"}
                label={t.officer}
                value={form.officerId}
                onChange={(v) => setForm((f) => ({ ...f, officerId: v }))}
              >
                <option value="">Select</option>
                {norm(user.role) === "officer" && !officerMatch && (
                  <option value={user.email}>{user.name}</option>
                )}
                {staffOptions.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </FilterSelect>
              <InputField
                label={t.requiredSessions}
                type="number"
                min="1"
                value={form.requiredSessions}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    requiredSessions: Number(e.target.value),
                  }))
                }
              />
              <FilterSelect
                label={lang === "ar" ? "يوم الأسبوع" : "Day of Week"}
                value={
                  DAY_EN[
                    new Date(`${form.firstSessionDate}T12:00:00Z`).getUTCDay()
                  ] || "Sunday"
                }
                onChange={(day) => {
                  const delta =
                    (DAY_EN.indexOf(day) -
                      new Date(
                        `${form.firstSessionDate}T12:00:00Z`,
                      ).getUTCDay() +
                      7) %
                    7;
                  setForm((f) => ({
                    ...f,
                    firstSessionDate: addDays(f.firstSessionDate, delta),
                  }));
                }}
              >
                {DAY_EN.map((day, i) => (
                  <option key={day} value={day}>
                    {lang === "ar" ? DAY_AR[i] : day}
                  </option>
                ))}
              </FilterSelect>
              <InputField
                label={t.firstDate}
                type="date"
                value={form.firstSessionDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstSessionDate: e.target.value }))
                }
              />
              <InputField
                label={t.startTime}
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
              <InputField
                label={t.endTime}
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </div>
            <div className="footer-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <Notice>{groupConflict}</Notice>
              <button
                className="primary-button"
                disabled={busy || groupChecking || !!groupConflict}
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function SessionEditRow({ row, canEdit, onChange, onSave, t }) {
  return (
    <tr>
      <td>{row.sessionNo}</td>
      <td>
        <input
          type="date"
          value={row.date}
          disabled={!canEdit}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </td>
      <td>
        <input
          type="time"
          value={row.startTime}
          disabled={!canEdit}
          onChange={(e) => onChange({ startTime: e.target.value })}
        />
      </td>
      <td>
        <input
          type="time"
          value={row.endTime}
          disabled={!canEdit}
          onChange={(e) => onChange({ endTime: e.target.value })}
        />
      </td>
      <td>
        <select
          value={row.status}
          disabled={!canEdit}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option>Planned</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
      </td>
      <td>
        <input
          value={row.topic || ""}
          disabled={!canEdit}
          onChange={(e) => onChange({ topic: e.target.value })}
        />
      </td>
      <td>
        {canEdit && (
          <button className="small-button" onClick={onSave}>
            {t.save}
          </button>
        )}
      </td>
    </tr>
  );
}

function WorkloadView({ user, setup, lang }) {
  const t = copy[lang];
  const now = new Date();
  const [center, setCenter] = useState(
    user.center === "All" ? setup.centers[0] || "" : user.center,
  );
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [program, setProgram] = useState("All");
  const [rows, setRows] = useState([]);
  const [teacherId, setTeacherId] = useState("All");
  const [section, setSection] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const programs = setup.programs;
  const subjects = ["Arabic", "English", "Math", "Other"];
  useEffect(() => {
    if (!center) return;
    setError("");
    fetch(
      `/api/workload?${new URLSearchParams({ center, month, year, program, teacherId, section, startDate, endDate })}`,
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d) => setRows(d.rows || []))
      .catch((e) => setError(e.message));
  }, [center, month, year, program, teacherId, section, startDate, endDate]);
  const exportUrl = `/api/timesheets/export?center=${encodeURIComponent(center)}&month=${month}&year=${year}`;
  return (
    <div>
      <InitialCenter
        center={center}
        setCenter={setCenter}
        user={user}
        setup={setup}
      />
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.monthlyWorkload}</div>
          <h1>{t.workload}</h1>
          <p>
            Select any month to see exactly how many days, sessions and hours
            each person delivered.
          </p>
        </div>
        <a className="excel-button" href={exportUrl}>
          <Icon name="excel" /> {t.exportTimesheets}
        </a>
      </div>
      <div className="filters-row">
        <FilterSelect label={t.center} value={center} onChange={setCenter}>
          {allowedCenters(user, setup).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t.month}
          value={month}
          onChange={(v) => setMonth(Number(v))}
        >
          {MONTHS_EN.map((m, i) => (
            <option value={i + 1} key={m}>
              {lang === "ar" ? MONTHS_AR[i] : m}
            </option>
          ))}
        </FilterSelect>
        <InputField
          label={t.year}
          type="number"
          min="1900"
          max="9999"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <FilterSelect label={t.program} value={program} onChange={setProgram}>
          <option>All</option>
          {programs.map((p) => (
            <option key={p.program}>{p.program}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t.teacher}
          value={teacherId}
          onChange={setTeacherId}
        >
          <option>All</option>
          {setup.staff
            .filter((s) => norm(s.center) === norm(center))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </FilterSelect>
        <FilterSelect label={t.section} value={section} onChange={setSection}>
          <option>All</option>
          {[
            ...new Set(
              setup.sections
                .filter(
                  (s) =>
                    norm(s.center) === norm(center) &&
                    (program === "All" || s.program === program),
                )
                .map((s) => s.section),
            ),
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </FilterSelect>
        <InputField
          label={lang === "ar" ? "من (اختياري)" : "Period start (optional)"}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <InputField
          label={lang === "ar" ? "إلى (اختياري)" : "Period end (optional)"}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <Notice>{error}</Notice>
      <SectionCard title={t.monthlyWorkload}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.type}</th>
                <th>{t.workingDays}</th>
                <th>{t.totalSessions}</th>
                {subjects.map((s) => (
                  <th key={s}>{s}</th>
                ))}
                <th>{t.totalHours}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.type}</td>
                  <td>{r.workingDays}</td>
                  <td>{r.totalSessions}</td>
                  {subjects.map((s) => (
                    <td key={s}>
                      {s === "Other"
                        ? Object.entries(r.subjects || {})
                            .filter(
                              ([k]) =>
                                !["Arabic", "English", "Math"].includes(k),
                            )
                            .reduce((sum, [, n]) => sum + n, 0)
                        : r.subjects?.[s] || 0}
                    </td>
                  ))}
                  <td>
                    <strong>{r.totalHours}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty-state">{t.noData}</div>}
      </SectionCard>
      <div className="info-banner">
        <strong>Monthly Excel:</strong> one workbook, one sheet per
        teacher/facilitator/staff member. The MAPS logo appears inside every
        exported financial sheet.
      </div>
    </div>
  );
}

function ReportsView(props) {
  return <DashboardView {...props} reportsMode />;
}

function AdminSetupView({ setup, refreshSetup, lang }) {
  const t = copy[lang];
  const [tab, setTab] = useState("staff");
  const tabs = [
    ["staff", t.staff],
    ["users", t.users],
    ["programs", t.programs],
    ["sections", t.sections],
    ["subjects", t.subjects],
    ["timeSlots", t.timeSlots],
    ["payroll", "Payroll / Financial"],
    ["systemSettings", t.settings],
  ];
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.adminSetup}</div>
          <h1>{t.adminSetup}</h1>
          <p>Only Admin users can change these setup lists.</p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "staff" ? (
        <StaffAdmin setup={setup} refreshSetup={refreshSetup} t={t} />
      ) : tab === "users" ? (
        <UsersAdmin setup={setup} refreshSetup={refreshSetup} t={t} />
      ) : (
        <GenericSetup
          key={tab}
          entity={tab}
          setup={setup}
          refreshSetup={refreshSetup}
          t={t}
        />
      )}
    </div>
  );
}

function StaffAdmin({ setup, refreshSetup, t }) {
  const [form, setForm] = useState({
    id: "",
    name: "",
    position: "",
    center: setup.centers[0] || "",
    type: "Staff",
    active: true,
    defaultStart: "",
    defaultEnd: "",
  });
  const [editing, setEditing] = useState("");
  const [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    const method = editing ? "PUT" : "POST";
    const r = await fetch("/api/admin/staff", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, staffId: editing }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setMessage(t.success);
    setEditing("");
    setForm({
      id: "",
      name: "",
      position: "",
      center: setup.centers[0] || "",
      type: "Staff",
      active: true,
      defaultStart: "",
      defaultEnd: "",
    });
    await refreshSetup();
  }
  function edit(s) {
    setEditing(s.id);
    setForm({
      id: s.id,
      name: s.name,
      position: s.position,
      center: s.center,
      type: s.type,
      active: s.active,
      defaultStart: s.defaultStart || "",
      defaultEnd: s.defaultEnd || "",
    });
  }
  return (
    <>
      <SectionCard title={editing ? `${t.edit}: ${form.name}` : `+ ${t.staff}`}>
        <form className="admin-form-row" onSubmit={save}>
          <InputField
            label="Staff ID"
            value={form.id}
            disabled={!!editing}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            required
          />
          <InputField
            label={t.name}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <InputField
            label={t.position}
            value={form.position}
            onChange={(e) =>
              setForm((f) => ({ ...f, position: e.target.value }))
            }
            required
          />
          <FilterSelect
            label={t.center}
            value={form.center}
            onChange={(v) => setForm((f) => ({ ...f, center: v }))}
          >
            {setup.centers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label={t.type}
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
          >
            <option>Staff</option>
            <option>Teacher</option>
            <option>Facilitator</option>
            <option>Officer</option>
          </FilterSelect>
          <InputField
            label={t.defaultStart}
            type="time"
            value={form.defaultStart}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultStart: e.target.value }))
            }
          />
          <InputField
            label={t.defaultEnd}
            type="time"
            value={form.defaultEnd}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultEnd: e.target.value }))
            }
          />
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />{" "}
            Active
          </label>
          <button className="primary-button">{t.save}</button>
          {editing && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => setEditing("")}
            >
              Cancel
            </button>
          )}
        </form>
        <Notice kind={message === t.success ? "success" : "error"}>
          {message}
        </Notice>
      </SectionCard>
      <SectionCard title={t.staff}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t.name}</th>
                <th>{t.position}</th>
                <th>{t.type}</th>
                <th>{t.center}</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {setup.staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.position}</td>
                  <td>{s.type}</td>
                  <td>{s.center}</td>
                  <td>{s.active ? "Yes" : "No"}</td>
                  <td>
                    <button className="small-button" onClick={() => edit(s)}>
                      {t.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

function UsersAdmin({ setup, refreshSetup, t }) {
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "Manager",
    center: setup.centers[0] || "",
    active: true,
  });
  const [editing, setEditing] = useState("");
  const [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    const method = editing ? "PUT" : "POST";
    const r = await fetch("/api/admin/users", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setMessage(t.success);
    setEditing("");
    setForm({
      email: "",
      name: "",
      role: "Manager",
      center: setup.centers[0] || "",
      active: true,
    });
    await refreshSetup();
  }
  function edit(u) {
    setEditing(u.email);
    setForm({
      email: u.email,
      name: u.name,
      role: u.role,
      center: u.center,
      active: u.active,
      staffId: u.staffId || "",
      programs: u.programs || "",
      scheduleAccess: u.scheduleAccess || false,
      timesheetAccess: u.timesheetAccess || false,
      reportsAccess: u.reportsAccess || false,
    });
  }
  return (
    <>
      <SectionCard
        title={editing ? `${t.edit}: ${form.email}` : `+ ${t.users}`}
      >
        <form className="admin-form-row" onSubmit={save}>
          <InputField
            label="Email"
            type="email"
            value={form.email}
            disabled={!!editing}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <InputField
            label={t.name}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <FilterSelect
            label={t.role}
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
          >
            <option>Manager</option>
            <option>Officer</option>
            <option>Admin</option>
          </FilterSelect>
          <FilterSelect
            label={t.center}
            value={form.center}
            onChange={(v) => setForm((f) => ({ ...f, center: v }))}
          >
            {form.role === "Admin" && <option>All</option>}
            {setup.centers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </FilterSelect>
          <InputField
            label="Staff ID (Officer)"
            value={form.staffId || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, staffId: e.target.value }))
            }
          />
          <InputField
            label="Allowed Programs (comma-separated)"
            value={form.programs || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, programs: e.target.value }))
            }
          />
          {[
            ["scheduleAccess", "Officer Schedule Access"],
            ["timesheetAccess", "Officer Timesheet Access"],
            ["reportsAccess", "Officer Reports Access"],
          ].map(([key, label]) => (
            <label className="check-field" key={key}>
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />{" "}
            Active
          </label>
          <button className="primary-button">{t.save}</button>
        </form>
        <Notice kind={message === t.success ? "success" : "error"}>
          {message}
        </Notice>
      </SectionCard>
      <SectionCard title={t.users}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>{t.name}</th>
                <th>{t.role}</th>
                <th>{t.center}</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {setup.users.map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td>{u.center}</td>
                  <td>{u.active ? "Yes" : "No"}</td>
                  <td>
                    <button className="small-button" onClick={() => edit(u)}>
                      {t.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

function GenericSetup({ entity, setup, refreshSetup, t }) {
  const config = {
    payroll: {
      key: "payroll",
      fields: [
        ["position", t.position, "text"],
        ["hourlyRate", "Hourly Rate", "number"],
        ["currency", "Currency", "text"],
      ],
    },
    systemSettings: {
      key: "setting",
      fields: [
        ["setting", "Setting", "text"],
        ["value", "Value", "text"],
      ],
    },
    programs: {
      key: "program",
      fields: [
        ["program", t.program, "text"],
        ["category", t.category, "text"],
      ],
    },
    sections: {
      key: "section",
      fields: [
        ["center", t.center, "center"],
        ["program", t.program, "program"],
        ["section", t.section, "text"],
        ["shift", t.shift, "shift"],
      ],
    },
    subjects: { key: "subject", fields: [["subject", t.subject, "text"]] },
    timeSlots: {
      key: "timeSlot",
      fields: [
        ["shift", t.shift, "shift"],
        ["session", "Session #", "number"],
        ["startTime", t.startTime, "time"],
        ["endTime", t.endTime, "time"],
      ],
    },
  }[entity];
  const list = setup[entity] || [];
  const empty = Object.fromEntries(
    config.fields.map(([k, , ,]) => [
      k,
      k === "session"
        ? 1
        : k === "shift"
          ? "Morning"
          : k === "center"
            ? setup.centers[0] || ""
            : k === "program"
              ? setup.programs.find((p) => p.active)?.program || ""
              : "",
    ]),
  );
  empty.active = true;
  const [form, setForm] = useState(empty);
  const [rowNumber, setRowNumber] = useState(null);
  const [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    const r = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: config.key, rowNumber, data: form }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setMessage(t.success);
    setForm({ ...empty });
    setRowNumber(null);
    await refreshSetup();
  }
  function edit(row) {
    setRowNumber(row.rowNumber);
    setForm({ ...row });
  }
  return (
    <>
      <SectionCard title={`+ ${t[entity] || entity}`}>
        <form className="admin-form-row" onSubmit={save}>
          {config.fields.map(([k, label, type]) =>
            type === "center" ? (
              <FilterSelect
                key={k}
                label={label}
                value={form[k] || ""}
                onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
              >
                {setup.centers.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </FilterSelect>
            ) : type === "program" ? (
              <FilterSelect
                key={k}
                label={label}
                value={form[k] || ""}
                onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
              >
                {setup.programs
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.program}>{p.program}</option>
                  ))}
              </FilterSelect>
            ) : type === "shift" ? (
              <FilterSelect
                key={k}
                label={label}
                value={form[k] || "Morning"}
                onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
              >
                <option>Morning</option>
                <option>Afternoon</option>
              </FilterSelect>
            ) : (
              <InputField
                key={k}
                label={label}
                type={type}
                value={form[k] ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [k]:
                      type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  }))
                }
                required
              />
            ),
          )}
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active !== false}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />{" "}
            Active
          </label>
          <button className="primary-button">{t.save}</button>
          {rowNumber && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setRowNumber(null);
                setForm({ ...empty });
              }}
            >
              Cancel
            </button>
          )}
        </form>
        <Notice kind={message === t.success ? "success" : "error"}>
          {message}
        </Notice>
      </SectionCard>
      <SectionCard title={t[entity] || entity}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {config.fields.map(([k, label]) => (
                  <th key={k}>{label}</th>
                ))}
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, i) => (
                <tr key={row.rowNumber || i}>
                  {config.fields.map(([k]) => (
                    <td key={k}>{row[k]}</td>
                  ))}
                  <td>{row.active ? "Yes" : "No"}</td>
                  <td>
                    <button className="small-button" onClick={() => edit(row)}>
                      {t.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

export default function Page() {
  const [lang, setLang] = useState("en");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [setup, setSetup] = useState({
    programs: [],
    sections: [],
    subjects: [],
    timeSlots: [],
    staff: [],
    users: [],
    centers: [],
  });
  const [setupError, setSetupError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = copy[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  async function refreshSetup() {
    try {
      const r = await fetch("/api/setup-data");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Setup unavailable");
      setSetup(d);
      setSetupError("");
    } catch (e) {
      setSetupError(e.message);
    }
  }
  useEffect(() => {
    fetch("/api/session")
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          setUser(d.user);
        }
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (user) refreshSetup();
  }, [user]);
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setActiveView("dashboard");
  }
  if (checking) return <main className="loading-screen">Loading...</main>;
  if (!user)
    return (
      <Login
        lang={lang}
        setLang={setLang}
        onLogin={(u) => {
          setUser(u);
          setActiveView("dashboard");
        }}
      />
    );
  const rtl = lang === "ar";
  let content = (
    <DashboardView
      user={user}
      setup={setup}
      lang={lang}
      setActiveView={setActiveView}
    />
  );
  if (activeView === "attendance")
    content = <AttendanceView user={user} setup={setup} lang={lang} />;
  if (activeView === "schedule")
    content = <WeeklyScheduleView user={user} setup={setup} lang={lang} />;
  if (activeView === "sessions")
    content = <ProgramSessionsView user={user} setup={setup} lang={lang} />;
  if (activeView === "workload")
    content = <WorkloadView user={user} setup={setup} lang={lang} />;
  if (activeView === "reports")
    content = <ReportsView user={user} setup={setup} lang={lang} />;
  if (activeView === "admin")
    content = (
      <AdminSetupView setup={setup} refreshSetup={refreshSetup} lang={lang} />
    );
  return (
    <div className="app-shell" dir={rtl ? "rtl" : "ltr"}>
      <Sidebar
        user={user}
        t={t}
        activeView={activeView}
        setActiveView={setActiveView}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />
      <div className="main-shell">
        <Header
          user={user}
          lang={lang}
          setLang={setLang}
          logout={logout}
          setSidebarOpen={setSidebarOpen}
        />
        <main className="main-content">
          <Notice>{setupError}</Notice>
          {content}
        </main>
      </div>
    </div>
  );
}
