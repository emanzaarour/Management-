import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  canReadModule,
} from "../../../../lib/auth";
import {
  getScopedSetupData,
  getWeeklySchedule,
  filterScheduleForUser,
  canonicalCenter,
  addDays,
  dayName,
} from "../../../../lib/data";

export const runtime = "nodejs";

const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
function uniqueName(name, used) {
  let base = safeSheetName(name),
    candidate = base,
    i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `-${i++}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}
const safeSheetName = (name) =>
  String(name || "Schedule")
    .replace(/[\\/*?:\[\]]/g, "-")
    .slice(0, 31) || "Schedule";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "schedule"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const p = new URL(request.url).searchParams;
    const center = p.get("center") || user.center;
    const program = p.get("program") || "All";
    const shift = p.get("shift") || "All";
    const section = p.get("section") || "All";
    const weekStart = p.get("weekStart");
    if (!canAccessCenter(user, center))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [allEntries, setup] = await Promise.all([
      getWeeklySchedule({ center, weekStart }),
      getScopedSetupData(user),
    ]);
    const scopedEntries = filterScheduleForUser(user, allEntries);
    const sectionMap = new Map(
      [...setup.sections.filter((x) => x.active), ...scopedEntries].map((x) => [
        `${x.center}|${x.program}|${x.section}|${x.shift}`,
        x,
      ]),
    );
    const sections = [...sectionMap.values()].filter(
      (s) =>
        norm(s.center) === norm(canonicalCenter(center)) &&
        (norm(program) === "all" || norm(s.program) === norm(program)) &&
        (norm(shift) === "all" || norm(s.shift) === norm(shift)) &&
        (norm(section) === "all" || norm(s.section) === norm(section)),
    );
    const wb = new ExcelJS.Workbook();
    wb.creator = "MAPS Management Portal";
    const used = new Set();

    for (const sec of sections) {
      const ws = wb.addWorksheet(
        uniqueName(`${sec.program}-${sec.section}`, used),
      );
      ws.views = [{ state: "frozen", ySplit: 5, xSplit: 1 }];
      ws.mergeCells("A1:F1");
      ws.getCell("A1").value =
        `MAPS Weekly Schedule - ${sec.program}-${sec.section}`;
      ws.getCell("A1").font = { bold: true, size: 16 };
      ws.mergeCells("A2:F2");
      ws.getCell("A2").value =
        `Center: ${center}    Shift: ${sec.shift}    Week Start: ${weekStart}`;
      const headers = ["Time"];
      for (let i = 0; i < 5; i++) {
        const d = addDays(weekStart, i);
        headers.push(`${dayName(d)}\n${d}`);
      }
      ws.addRow([]);
      ws.addRow(headers);
      const head = ws.getRow(4);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      head.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E5EA8" },
      };
      const slots = setup.timeSlots
        .filter((t) => t.active && norm(t.shift) === norm(sec.shift))
        .sort((a, b) => a.session - b.session);
      const secEntries = scopedEntries.filter(
        (e) =>
          norm(e.program) === norm(sec.program) &&
          norm(e.section) === norm(sec.section) &&
          norm(e.shift) === norm(sec.shift),
      );
      for (const e of secEntries)
        if (!slots.some((t) => Number(t.session) === Number(e.session)))
          slots.push({ ...e, startTime: e.startTime, endTime: e.endTime });
      slots.sort((a, b) => a.session - b.session);
      for (const slot of slots) {
        const row = [`${slot.startTime} - ${slot.endTime}`];
        for (let i = 0; i < 5; i++) {
          const d = addDays(weekStart, i);
          const e = secEntries.find(
            (x) => x.date === d && Number(x.session) === Number(slot.session),
          );
          row.push(
            e
              ? `${e.teacherName} / ${e.subject}${e.startTime !== slot.startTime || e.endTime !== slot.endTime ? `\n${e.startTime} - ${e.endTime}` : ""}`
              : "",
          );
        }
        ws.addRow(row);
      }
      ws.columns = [
        { width: 18 },
        { width: 26 },
        { width: 26 },
        { width: 26 },
        { width: 26 },
        { width: 26 },
      ];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber >= 4) {
          row.height = 28;
          row.eachCell((cell) => {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
              wrapText: true,
            };
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }
      });
    }
    if (!wb.worksheets.length)
      wb.addWorksheet("No Schedule").getCell("A1").value =
        "No active sections found for the selected filters.";
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="MAPS-Weekly-Schedule-${weekStart}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
