import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  canAccessCenter,
  getCurrentUser,
  isAdmin,
  canReadModule,
} from "../../../../lib/auth";
import { getMonthlyTimesheets } from "../../../../lib/data";

export const runtime = "nodejs";

const safeSheetName = (name, used) => {
  let base =
    String(name || "Staff")
      .replace(/[\\/*?:\[\]]/g, "-")
      .slice(0, 31) || "Staff";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `-${i++}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};
const formatDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function applyThinBorder(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadModule(user, "timesheets"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const p = new URL(request.url).searchParams;
    const center = p.get("center") || user.center;
    const month = Number(p.get("month"));
    const year = Number(p.get("year"));
    if (String(center).toLowerCase() === "all" && !isAdmin(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (
      String(center).toLowerCase() !== "all" &&
      !canAccessCenter(user, center)
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const sheets = await getMonthlyTimesheets({ user, center, month, year });
    const wb = new ExcelJS.Workbook();
    wb.creator = "MAPS Management Portal";
    let logoId = null;
    {
      const logo = fs.readFileSync(
        path.join(process.cwd(), "public", "maps-logo.jpeg"),
      );
      logoId = wb.addImage({ buffer: logo, extension: "jpeg" });
    }
    const used = new Set();
    for (const item of sheets) {
      const ws = wb.addWorksheet(safeSheetName(item.member.name, used));
      ws.pageSetup = {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.35,
          bottom: 0.35,
          header: 0.1,
          footer: 0.1,
        },
      };
      ws.columns = [
        { width: 10 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 16 },
        { width: 20 },
      ];
      ws.mergeCells("A1:C1");
      ws.getCell("A1").value = "Multi Aid Programs (MAPs)";
      ws.mergeCells("A2:C2");
      ws.getCell("A2").value = "EDUCATION PROGRAM";
      ws.mergeCells("A3:C3");
      ws.getCell("A3").value = "Save the Children - UNICEF - MSCC";
      ws.mergeCells("A4:C4");
      ws.getCell("A4").value = `Position: ${item.member.position}`;
      ws.mergeCells("A5:C5");
      ws.getCell("A5").value = `Name: ${item.member.name}`;
      ws.mergeCells("A6:C6");
      ws.getCell("A6").value =
        `Month: ${String(month).padStart(2, "0")}/${year}`;
      for (let r = 1; r <= 6; r++)
        ws.getCell(`A${r}`).font = { bold: true, size: r === 1 ? 12 : 10 };
      if (logoId !== null)
        ws.addImage(logoId, {
          tl: { col: 4.25, row: 0 },
          ext: { width: 145, height: 92 },
        });
      const headerRow = 8;
      const headers = [
        "Number",
        "Date",
        "Start Time",
        "End Time",
        "Hours number",
        "Attendance",
      ];
      headers.forEach((h, i) => {
        const c = ws.getCell(headerRow, i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        };
        applyThinBorder(c);
      });
      ws.getRow(headerRow).height = 28;
      const maxRows = Math.max(1, item.rows.length);
      for (let i = 0; i < maxRows; i++) {
        const rowNo = headerRow + 1 + i;
        const work = item.rows[i];
        const vals = [
          work ? i + 1 : "",
          work ? formatDate(work.date) : "",
          work?.startTime || "",
          work?.endTime || "",
          work ? work.hours : "",
          work?.attendance || "",
        ];
        vals.forEach((v, cidx) => {
          const c = ws.getCell(rowNo, cidx + 1);
          c.value = v;
          c.alignment = { horizontal: "center", vertical: "middle" };
          applyThinBorder(c);
        });
        ws.getRow(rowNo).height = 22;
      }
      const totalRow = headerRow + 1 + maxRows;
      ws.mergeCells(totalRow, 1, totalRow, 4);
      ws.getCell(totalRow, 1).value = "Total number of Hours";
      ws.getCell(totalRow, 1).font = { bold: true };
      ws.getCell(totalRow, 1).alignment = { horizontal: "center" };
      ws.getCell(totalRow, 5).value = item.totalHours;
      ws.getCell(totalRow, 5).font = { bold: true };
      ws.getCell(totalRow, 5).alignment = { horizontal: "center" };
      for (let c = 1; c <= 6; c++) applyThinBorder(ws.getCell(totalRow, c));
      const sigRow = totalRow + 1;
      ws.mergeCells(sigRow, 1, sigRow, 4);
      ws.getCell(sigRow, 1).value = "Signature";
      ws.getCell(sigRow, 1).font = { bold: true };
      ws.getCell(sigRow, 1).alignment = { horizontal: "center" };
      for (let c = 1; c <= 6; c++) applyThinBorder(ws.getCell(sigRow, c));
      ws.getRow(sigRow).height = 26;
      const notesRow = sigRow + 1;
      ws.mergeCells(notesRow, 1, notesRow + 1, 6);
      ws.getCell(notesRow, 1).value = "Notes";
      ws.getCell(notesRow, 1).font = { bold: true };
      ws.getCell(notesRow, 1).alignment = { vertical: "top" };
      for (let rr = notesRow; rr <= notesRow + 1; rr++)
        for (let c = 1; c <= 6; c++) applyThinBorder(ws.getCell(rr, c));
      const signatories = notesRow + 3;
      ws.mergeCells(signatories, 1, signatories, 3);
      ws.getCell(signatories, 1).value = "Project Coordinator";
      ws.getCell(signatories, 1).font = { bold: true };
      ws.getCell(signatories, 1).alignment = { horizontal: "center" };
      ws.mergeCells(signatories, 4, signatories, 6);
      ws.getCell(signatories, 4).value = "Program Manager";
      ws.getCell(signatories, 4).font = { bold: true };
      ws.getCell(signatories, 4).alignment = { horizontal: "center" };
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          cell.font = {
            name: "Arial",
            size: cell.font?.size || 10,
            bold: cell.font?.bold || false,
          };
        });
      });
      ws.pageSetup.printArea = `A1:F${signatories + 2}`;
    }
    if (!wb.worksheets.length) {
      const ws = wb.addWorksheet("No Data");
      ws.addImage(logoId, {
        tl: { col: 0, row: 2 },
        ext: { width: 145, height: 92 },
      });
      ws.getCell("A1").value =
        "No monthly timesheet data found for the selected period.";
    }
    const buffer = await wb.xlsx.writeBuffer();
    const monthName = new Intl.DateTimeFormat("en", {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${monthName}_${year}_Timesheets.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
