import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { requireAdmin } from "@/lib/auth";
import { asAdmin, loadData } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { report, dateLabel, currency } from "@/lib/domain";
import { SERVICE_LABELS } from "@/lib/service-pricing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  const f = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const data = await asAdmin(user.id, (tx) => loadData(tx, f.lower, f.upper));
  const r = report(data, f.start, f.end, f.vehicle);
  const title = data.company.name;
  const selected =
    data.vehicles.find((v) => v.id === f.vehicle)?.name ?? "Toda la empresa";
  const summary = [
    ["Facturación", Number(r.revenue)],
    ["Gastos operativos", Number(r.cost)],
    ["Sueldos devengados", Number(r.salary)],
    ["Resultado neto operativo", Number(r.net)],
    ["Cobros efectivos", Number(r.receipts)],
    ["Pagos efectivos", Number(r.outgoing)],
    ["Movimiento neto de caja", Number(r.cash)],
  ] as [string, number][];
  const detail = r.days.map((d) => [
    d.work_date,
    data.vehicles.find((v) => v.id === d.vehicle_id)?.name ?? "",
    d.worked ? "Sí" : "No",
    Number(d.revenue_amount),
    data.attendance
      .filter((a) => a.work_day_id === d.id)
      .map((a) => {
        const e = data.employees.find((e) => e.id === a.employee_id);
        return (
          (a.role === "chofer" ? "Chofer: " : "Ayudante: ") +
          (e ? e.first_name + " " + e.last_name : "Sin identificar")
        );
      })
      .join(", "),
    d.notes ?? "",
    d.work_type ? SERVICE_LABELS[d.work_type] : "",
    d.distance_km ?? "",
    d.shift_number ?? 1,
  ]);
  const expenses = r.expenses.map((e) => [
    e.expense_date,
    data.categories.find((c) => c.id === e.category_id)?.name ?? "",
    data.vehicles.find((v) => v.id === e.vehicle_id)?.name ?? "General",
    e.description,
    Number(e.amount),
    e.payment_date ?? "Pendiente",
  ]);
  const vehicleRows = data.vehicles
    .filter((v) => !f.vehicle || v.id === f.vehicle)
    .map((v) => {
      const x = report(data, f.start, f.end, v.id);
      return [
        v.name,
        x.worked,
        Number(x.revenue),
        Number(x.cost),
        Number(x.salary),
        Number(x.net),
      ];
    });
  const file = "transporte-eduardo-" + f.start + "-" + f.end;
  const note =
    (r.missingSalaries
      ? `Resultado provisional: ${r.missingSalaries} asistencias sin salario configurado. `
      : "") +
    "Resultado operativo: no incluye impuestos ni amortizaciones no registrados. Los salarios fijos sin asignar y los gastos generales no se distribuyen entre unidades.";
  if (request.nextUrl.searchParams.get("format") === "xlsx") {
    const book = new ExcelJS.Workbook();
    book.creator = "Transporte Eduardo";
    function sheet(
      name: string,
      headers: string[],
      rows: (string | number)[][],
    ) {
      const s = book.addWorksheet(name);
      s.addRow([title]);
      s.addRow([`${dateLabel(f.start)} al ${dateLabel(f.end)} · ${selected}`]);
      s.addRow([]);
      s.addRow(headers);
      rows.forEach((row) => s.addRow(row));
      s.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
      s.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF10213B" },
      };
      s.columns.forEach((c, i) => {
        c.width = i === 0 ? 28 : 24;
      });
      s.views = [{ state: "frozen", ySplit: 4 }];
      s.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: headers.length },
      };
      for (let row = 5; row <= s.rowCount; row++)
        s.getRow(row).eachCell((c) => {
          if (typeof c.value === "number") c.numFmt = "#,##0.00;[Red]-#,##0.00";
        });
      return s;
    }
    const s = sheet("Resumen", ["Concepto", "ARS"], summary);
    s.addRow([]);
    s.addRow([note]);
    sheet(
      "Jornadas",
      [
        "Fecha",
        "Camioneta",
        "Trabajó",
        "Facturación ARS",
        "Personal",
        "Observaciones",
        "Tipo de trabajo",
        "Kilómetros",
        "Jornada",
      ],
      detail,
    );
    sheet(
      "Gastos",
      ["Fecha", "Categoría", "Camioneta", "Descripción", "Importe ARS", "Pago"],
      expenses,
    );
    sheet(
      "Por camioneta",
      [
        "Camioneta",
        "Jornadas",
        "Ingresos ARS",
        "Gastos ARS",
        "Sueldos ARS",
        "Resultado ARS",
      ],
      vehicleRows,
    );
    sheet(
      "Sueldos devengados",
      ["Fecha", "Camioneta", "Importe ARS"],
      r.accrued.map((a) => [
        a.accrual_date,
        data.vehicles.find((v) => v.id === a.vehicle_id)?.name ??
          "General / sin asignar",
        Number(a.amount),
      ]),
    );
    sheet(
      "Cobros",
      [
        "Fecha de cobro",
        "Fecha de jornada",
        "Camioneta",
        "Importe ARS",
        "Medio",
      ],
      data.collections
        .filter(
          (c) =>
            !c.voided_at &&
            c.collection_date >= f.start &&
            c.collection_date <= f.end &&
            (!f.vehicle || c.vehicle_id === f.vehicle),
        )
        .map((c) => [
          c.collection_date,
          c.work_date ?? "",
          data.vehicles.find((v) => v.id === c.vehicle_id)?.name ?? "",
          Number(c.amount),
          c.payment_method ?? "",
        ]),
    );
    sheet(
      "Pagos de gastos",
      ["Fecha de pago", "Descripción", "Camioneta", "Importe ARS"],
      data.expenses
        .filter(
          (e) =>
            !e.voided_at &&
            e.payment_date &&
            e.payment_date >= f.start &&
            e.payment_date <= f.end &&
            (!f.vehicle || e.vehicle_id === f.vehicle),
        )
        .map((e) => [
          e.payment_date!,
          e.description,
          data.vehicles.find((v) => v.id === e.vehicle_id)?.name ?? "General",
          Number(e.amount),
        ]),
    );
    if (!f.vehicle)
      sheet(
        "Pagos de sueldos",
        ["Fecha de pago", "Empleado", "Importe ARS", "Medio"],
        data.payments
          .filter(
            (p) =>
              !p.voided_at &&
              p.payment_date >= f.start &&
              p.payment_date <= f.end,
          )
          .map((p) => {
            const payroll = data.payroll.find(
              (x) => x.id === p.payroll_period_id,
            );
            const employee = data.employees.find(
              (e) => e.id === payroll?.employee_id,
            );
            return [
              p.payment_date,
              employee ? employee.first_name + " " + employee.last_name : "",
              Number(p.amount),
              p.payment_method ?? "",
            ];
          }),
      );
    return new NextResponse(new Uint8Array(await book.xlsx.writeBuffer()), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const doc = new jsPDF();
  doc.setFillColor(16, 33, 59);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.text(
    `${dateLabel(f.start)} al ${dateLabel(f.end)} | ${selected}`,
    14,
    29,
  );
  doc.setTextColor(35);
  doc.setFontSize(13);
  doc.text("Resumen económico", 14, 52);
  autoTable(doc, {
    startY: 58,
    head: [["Concepto", "Importe ARS"]],
    body: summary.map(([label, value]) => [label, currency(value)]),
    headStyles: { fillColor: [16, 33, 59] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" } },
  });
  doc.addPage();
  doc.text("Resultado por camioneta", 14, 20);
  autoTable(doc, {
    startY: 26,
    head: [["Camioneta", "Días", "Ingresos", "Gastos", "Sueldos", "Resultado"]],
    body: vehicleRows.map((row) =>
      row.map((v, i) => (i >= 2 ? currency(v) : String(v))),
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 33, 59] },
  });
  doc.addPage();
  doc.text("Detalle de jornadas", 14, 20);
  autoTable(doc, {
    startY: 26,
    head: [
      [
        "Fecha",
        "Camioneta",
        "Trabajó",
        "Facturación",
        "Personal",
        "Trabajo",
        "Km",
        "Jornada",
      ],
    ],
    body: detail.map((row) =>
      [...row.slice(0, 5), row[6], row[7], row[8]].map((v, i) =>
        i === 3 ? currency(v) : String(v),
      ),
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 33, 59] },
  });
  doc.addPage();
  doc.text("Detalle de gastos", 14, 20);
  autoTable(doc, {
    startY: 26,
    head: [
      ["Fecha", "Categoría", "Camioneta", "Descripción", "Importe", "Pago"],
    ],
    body: expenses.map((row) =>
      row.map((v, i) => (i === 4 ? currency(v) : String(v))),
    ),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 33, 59] },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(doc.splitTextToSize(note, 180), 14, 282);
    doc.text(`${i} / ${pages}`, 190, 292, { align: "right" });
  }
  return new NextResponse(new Uint8Array(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
