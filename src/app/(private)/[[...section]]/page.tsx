import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { asAdmin, loadData } from "@/lib/db";
import { parseFilters } from "@/lib/filters";
import { Shell } from "@/components/shell";
import { Dashboard } from "@/components/dashboard";
import { report } from "@/lib/domain";
import {
  DailyModule,
  VehiclesModule,
  EmployeesModule,
  ExpensesModule,
  PayrollModule,
  ReportsModule,
  SettingsModule,
} from "@/components/modules";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const route = section?.join("/") ?? "";
  const search = await searchParams;
  if (
    ![
      "",
      "registro",
      "camionetas",
      "empleados",
      "sueldos",
      "gastos",
      "reportes",
      "configuracion",
    ].includes(route)
  )
    notFound();
  const user = await requireAdmin();
  const f = parseFilters(search);
  const data = await asAdmin(user.id, (tx) => loadData(tx, f.lower, f.upper));
  const views: Record<string, React.ReactNode> = {
    "": <Dashboard data={data} month={f.month} />,
    registro: <DailyModule data={data} selected={f.selected} month={f.month} />,
    camionetas: (
      <VehiclesModule
        data={data}
        start={f.start}
        end={f.end}
        vehicleId={f.vehicle}
      />
    ),
    empleados: <EmployeesModule data={data} />,
    sueldos: <PayrollModule data={data} />,
    gastos: (
      <ExpensesModule
        data={data}
        start={f.start}
        end={f.end}
        vehicleId={f.vehicle}
        category={f.category}
      />
    ),
    reportes: (
      <ReportsModule
        data={data}
        start={f.start}
        end={f.end}
        vehicleId={f.vehicle}
      />
    ),
    configuracion: (
      <SettingsModule
        data={data}
        userName={user.name}
        email={user.email ?? ""}
        recovery={search.recovery === "1"}
      />
    ),
  };
  const missing = report(data, f.start, f.end, f.vehicle).missingSalaries;
  return (
    <Shell company={data.company.name} user={user.name}>
      {(route === "" || route === "reportes") && missing > 0 && (
        <div className="setup-banner" role="status">
          Resultado provisional: hay {missing} asistencias sin salario
          configurado en este período. Completá sus tarifas desde Registro
          diario para incluir todos los costos.
        </div>
      )}
      {views[route]}
    </Shell>
  );
}
