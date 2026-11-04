import Link from "next/link";
import {
  Plus,
  ArrowRight,
  Truck,
  Users,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { VehicleJournals } from "./vehicle-journals";
import type { Data, Day } from "@/lib/types";
import { workDescription } from "@/lib/service-pricing";
import {
  today,
  period,
  report,
  currency,
  dateLabel,
  dates,
  addDays,
  balance,
  sum,
} from "@/lib/domain";
import { Modal, Badge, Table, VoidButton, SaveForm, Field, Input } from "./ui";
import {
  VehicleForm,
  EmployeeForm,
  DayForm,
  ExpenseForm,
  PayrollForm,
  MovementForm,
} from "./forms";
import { Stat, SectionHead } from "./dashboard";
import {
  RevenueChart,
  CategoryChart,
  ComparisonChart,
  MonthlyChart,
} from "./charts";
const fullName = (data: Data, id: string) => {
  const e = data.employees.find((e) => e.id === id);
  return e ? e.first_name + " " + e.last_name : "—";
};
const vehicleName = (data: Data, id: string | null) =>
  data.vehicles.find((v) => v.id === id)?.name ?? "General";
const salaryLabels = {
  daily: "Por jornada",
  weekly: "Fijo semanal",
  biweekly: "Fijo quincenal",
  monthly: "Fijo mensual",
};
const frequencyLabels = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
};
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{action}</div>
    </div>
  );
}
export function Filters({
  start,
  end,
  vehicle = "",
  data,
  category = "",
  expense = false,
}: {
  start: string;
  end: string;
  vehicle?: string;
  data: Data;
  category?: string;
  expense?: boolean;
}) {
  return (
    <form className="filters">
      <SlidersHorizontal size={18} />
      <label>
        Desde
        <input type="date" name="from" defaultValue={start} required />
      </label>
      <label>
        Hasta
        <input type="date" name="to" defaultValue={end} required />
      </label>
      <label>
        Camioneta
        <select name="vehicle" defaultValue={vehicle}>
          <option value="">Todas las unidades</option>
          {data.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      {expense && (
        <label>
          Categoría
          <select name="category" defaultValue={category}>
            <option value="">Todas las categorías</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="button secondary" type="submit">
        Aplicar filtros
      </button>
    </form>
  );
}
function DayTable({ data, days }: { data: Data; days: Day[] }) {
  return (
    <Table
      headers={[
        "Fecha",
        "Jornada",
        "Camioneta",
        "Estado",
        "Trabajo / km",
        "Personal",
        "Facturación",
        "Cobrado",
        "Acciones",
      ]}
      rows={days.map((d) => {
        const vehicle = data.vehicles.find((v) => v.id === d.vehicle_id)!;
        const collected = sum(
          data.collections
            .filter((c) => !c.voided_at && c.work_day_id === d.id)
            .map((c) => c.amount),
        );
        const outstanding = Number(
          balance(
            d.revenue_amount,
            data.collections.filter((c) => c.work_day_id === d.id),
          ),
        );
        const staff = data.attendance
          .filter((a) => a.work_day_id === d.id)
          .map(
            (a) =>
              (a.role === "chofer" ? "Chofer: " : "Ayudante: ") +
              fullName(data, a.employee_id),
          );
        return {
          key: d.id,
          search: [
            d.work_date,
            vehicle.name,
            workDescription(d),
            "Jornada " + (d.shift_number ?? 1),
            ...staff,
            d.notes,
          ].join(" "),
          cells: [
            dateLabel(d.work_date),
            "Jornada " + (d.shift_number ?? 1),
            <strong key="v">{vehicle.name}</strong>,
            <Badge key="s" tone={d.worked ? "green" : "neutral"}>
              {d.worked ? "Trabajó" : "Sin actividad"}
            </Badge>,
            workDescription(d) || "—",
            <div key="e" className="staff-list">
              {staff.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>,
            <strong key="r">{currency(d.revenue_amount)}</strong>,
            <span key="c">
              {currency(collected)}
              {outstanding > 0 && (
                <small className="negative">
                  Pendiente {currency(outstanding)}
                </small>
              )}
            </span>,
            <div className="row-actions" key="a">
              <Modal
                title={"Editar jornada · " + vehicle.name}
                trigger={<span className="text-button">Editar</span>}
              >
                <DayForm
                  data={data}
                  vehicle={vehicle}
                  date={d.work_date}
                  day={d}
                />
              </Modal>
              {outstanding > 0 && (
                <Modal
                  title="Registrar cobro"
                  trigger={<span className="text-button">Cobrar</span>}
                >
                  <MovementForm data={data} day={d} />
                </Modal>
              )}
              {d.notes && (
                <Modal
                  title="Observaciones de la jornada"
                  trigger={<span className="text-button">Notas</span>}
                >
                  <p className="whitespace">{d.notes}</p>
                </Modal>
              )}
            </div>,
          ],
        };
      })}
    />
  );
}
export function DailyModule({
  data,
  selected,
  month,
}: {
  data: Data;
  selected: string;
  month: string;
}) {
  const [start, end] = period(month + "-01", "monthly");
  const days = dates(start, end);
  const offset = (new Date(start + "T12:00:00Z").getUTCDay() + 6) % 7;
  const units = data.vehicles.filter(
    (v) =>
      v.is_active ||
      data.days.some((d) => d.vehicle_id === v.id && d.work_date === selected),
  );
  return (
    <>
      <PageHeading
        eyebrow="OPERACIÓN DIARIA"
        title="Cada jornada, registrada"
        description="Marcá la actividad de tu flota y conservá el detalle de cada día."
        action={
          <form className="period-control">
            <CalendarDays size={17} />
            <input
              type="date"
              name="date"
              defaultValue={selected}
              max={today()}
              aria-label="Fecha a registrar"
              required
            />
            <button>Ir al día</button>
          </form>
        }
      />
      <div className="daily-layout">
        <section className="panel calendar-panel">
          <div className="calendar-heading">
            <Link
              aria-label="Mes anterior"
              className="icon-button"
              href={"/registro?month=" + addDays(start, -1).slice(0, 7)}
            >
              <ChevronLeft size={18} />
            </Link>
            <strong>
              {new Intl.DateTimeFormat("es-AR", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(start + "T12:00:00Z"))}
            </strong>
            <Link
              aria-label="Mes siguiente"
              className="icon-button"
              href={"/registro?month=" + addDays(end, 1).slice(0, 7)}
            >
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="calendar-grid">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span className="weekday" key={i}>
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={"space" + i} />
            ))}
            {days.map((d) => (
              <Link
                href={"/registro?date=" + d}
                key={d}
                className={
                  "calendar-day " +
                  (d === selected ? "selected " : "") +
                  (d === today() ? "today" : "")
                }
              >
                <span>{Number(d.slice(8))}</span>
                <div>
                  {data.vehicles.map((v, i) =>
                    data.days.some(
                      (w) =>
                        w.work_date === d && w.vehicle_id === v.id && w.worked,
                    ) ? (
                      <i
                        key={v.id}
                        style={{ background: i === 0 ? "#3b82f6" : "#10b981" }}
                      />
                    ) : null,
                  )}
                </div>
                {data.days.some(
                  (w) =>
                    w.work_date === d &&
                    w.worked &&
                    w.shift_number === 2 &&
                    data.days.some(
                      (first) =>
                        first.vehicle_id === w.vehicle_id &&
                        first.work_date === d &&
                        first.worked &&
                        (first.shift_number ?? 1) === 1,
                    ),
                ) && (
                  <small
                    className="double-day-marker"
                    title="Incluye doble jornada"
                  >
                    ×2
                  </small>
                )}
              </Link>
            ))}
          </div>
          <div className="calendar-legend">
            {data.vehicles.map((v, i) => (
              <span key={v.id}>
                <i style={{ background: i === 0 ? "#3b82f6" : "#10b981" }} />
                {v.name}
              </span>
            ))}
          </div>
        </section>
        <section>
          <SectionHead
            title={dateLabel(selected)}
            subtitle="Primera y segunda jornada, cada una con su trabajo y personal"
          />
          <div className="daily-cards">
            {units.map((v) => {
              const journals = data.days.filter(
                  (d) => d.vehicle_id === v.id && d.work_date === selected,
                ),
                worked = journals.filter((d) => d.worked);
              return (
                <article className="daily-unit panel" key={v.id}>
                  <div className="daily-unit-title">
                    <Truck size={23} />
                    <h3>{v.name}</h3>
                    <Badge
                      tone={
                        worked.length
                          ? "green"
                          : journals.length
                            ? "neutral"
                            : "amber"
                      }
                    >
                      {worked.length > 1
                        ? "Doble jornada"
                        : worked.length
                          ? "Trabajó"
                          : journals.length
                            ? "Sin actividad"
                            : "Sin registrar"}
                    </Badge>
                  </div>
                  {!!journals.length && (
                    <div className="day-total">
                      <span>Total del día</span>
                      <strong>
                        {currency(sum(journals.map((d) => d.revenue_amount)))}
                      </strong>
                    </div>
                  )}
                  <VehicleJournals data={data} vehicle={v} date={selected} />
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <section className="panel">
        <SectionHead
          title="Historial del mes"
          subtitle="Consultá, corregí importes y registrá los cobros"
        />
        <DayTable
          data={data}
          days={data.days.filter(
            (d) => d.work_date >= start && d.work_date <= end,
          )}
        />
      </section>
      <MovementHistory data={data} collections />
    </>
  );
}
export function VehiclesModule({
  data,
  start,
  end,
  vehicleId,
}: {
  data: Data;
  start: string;
  end: string;
  vehicleId: string;
}) {
  const vehicle = data.vehicles.find((v) => v.id === vehicleId);
  const r = report(data, start, end, vehicleId);
  return (
    <>
      <PageHeading
        eyebrow="LA FLOTA"
        title={vehicle?.name ?? "Tus camionetas"}
        description="Actividad, costos y resultados de cada unidad."
        action={
          <Modal
            title="Nueva camioneta"
            trigger={
              <span className="button">
                <Plus size={17} /> Nueva camioneta
              </span>
            }
          >
            <VehicleForm />
          </Modal>
        }
      />
      <Filters data={data} start={start} end={end} vehicle={vehicleId} />
      <div className="fleet-grid">
        {data.vehicles.map((v) => {
          const result = report(data, start, end, v.id);
          return (
            <article className="vehicle-card" key={v.id}>
              <div className="vehicle-top">
                <span className="vehicle-icon">
                  <Truck size={25} />
                </span>
                <div>
                  <h3>{v.name}</h3>
                  <span>
                    {[v.license_plate, v.brand, v.model, v.year]
                      .filter(Boolean)
                      .join(" · ") || "Datos del vehículo pendientes"}
                  </span>
                </div>
                <Badge tone={v.is_active ? "green" : "neutral"}>
                  {v.is_active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <div className="vehicle-detail-stats">
                <div>
                  <span>Ingresos</span>
                  <strong>{currency(result.revenue)}</strong>
                </div>
                <div>
                  <span>Gastos directos</span>
                  <strong>{currency(result.cost)}</strong>
                </div>
                <div>
                  <span>Sueldos atribuibles</span>
                  <strong>{currency(result.salary)}</strong>
                </div>
                <div>
                  <span>Resultado operativo</span>
                  <strong
                    className={
                      Number(result.net) >= 0 ? "positive" : "negative"
                    }
                  >
                    {currency(result.net)}
                  </strong>
                </div>
                <div>
                  <span>Jornadas</span>
                  <strong>{result.worked}</strong>
                </div>
                <div>
                  <span>Tarifa por día</span>
                  <strong>
                    {v.service_pricing
                      ? "fija" in v.service_pricing
                        ? currency(v.service_pricing.fija)
                        : "Según el trabajo"
                      : v.default_daily_rate !== null
                        ? currency(v.default_daily_rate)
                        : "A configurar"}
                  </strong>
                </div>
              </div>
              <div className="vehicle-crew">
                {["chofer", "ayudante"].map((role) => {
                  const a = data.assignments.find(
                    (a) =>
                      a.vehicle_id === v.id && a.role === role && !a.end_date,
                  );
                  return (
                    <div key={role}>
                      <span>{role}</span>
                      <strong>
                        {a ? fullName(data, a.employee_id) : "Sin asignar"}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="vehicle-actions">
                <Link
                  className="button secondary"
                  href={
                    "/camionetas?vehicle=" +
                    v.id +
                    "&from=" +
                    start +
                    "&to=" +
                    end
                  }
                >
                  Ver historial <ArrowRight size={15} />
                </Link>
                <Modal
                  title={"Editar · " + v.name}
                  trigger={
                    <span className="text-button">Editar camioneta</span>
                  }
                >
                  <VehicleForm vehicle={v} />
                </Modal>
              </div>
            </article>
          );
        })}
      </div>
      <div className="panel">
        <SectionHead
          title="Comparación de la flota"
          subtitle="Los gastos generales y los salarios fijos sin asignar se consultan en el reporte de empresa."
        />
        <ComparisonChart data={data} start={start} end={end} />
      </div>
      {vehicle && (
        <>
          <section className="panel">
            <SectionHead title={"Jornadas · " + vehicle.name} />
            <DayTable data={data} days={r.days} />
          </section>
          <section className="panel">
            <SectionHead title={"Gastos · " + vehicle.name} />
            <ExpenseTable data={data} expenses={r.expenses} />
          </section>
        </>
      )}
    </>
  );
}
export function EmployeesModule({ data }: { data: Data }) {
  return (
    <>
      <PageHeading
        eyebrow="LAS PERSONAS"
        title="Tu equipo"
        description="Asignaciones claras y configuraciones salariales por persona."
        action={
          <Modal
            title="Nuevo empleado"
            trigger={
              <span className="button">
                <Plus size={17} /> Nuevo empleado
              </span>
            }
            wide
          >
            <EmployeeForm data={data} />
          </Modal>
        }
      />
      <div className="stats-grid three">
        <Stat
          title="Empleados activos"
          value={String(
            data.employees.filter((e) => e.is_active).length,
          ).padStart(2, "0")}
          description="Integrantes actuales del equipo"
          icon={Users}
        />
        <Stat
          title="Choferes"
          value={String(
            data.employees.filter((e) => e.is_active && e.role === "chofer")
              .length,
          ).padStart(2, "0")}
          description="Conducción de la flota"
          icon={Truck}
        />
        <Stat
          title="Por configurar"
          value={String(
            data.employees.filter(
              (e) =>
                e.is_active &&
                !data.salaries.some(
                  (s) =>
                    s.employee_id === e.id &&
                    !s.valid_until &&
                    s.amount !== null &&
                    s.payment_model &&
                    s.payment_frequency,
                ),
            ).length,
          ).padStart(2, "0")}
          description="Modalidad, importe o frecuencia pendientes"
          tone="amber"
        />
      </div>
      <section className="panel">
        <SectionHead
          title="Equipo de transporte"
          subtitle="Los cambios salariales no modifican registros históricos."
        />
        <Table
          headers={[
            "Empleado",
            "Rol",
            "Camioneta",
            "Modalidad",
            "Importe",
            "Frecuencia",
            "Estado",
            "",
          ]}
          rows={data.employees.map((e) => {
            const s = data.salaries.find(
              (s) => s.employee_id === e.id && !s.valid_until,
            );
            const a = data.assignments.find(
              (a) => a.employee_id === e.id && !a.end_date,
            );
            return {
              key: e.id,
              search: [
                e.first_name,
                e.last_name,
                e.role,
                vehicleName(data, a?.vehicle_id ?? null),
              ].join(" "),
              cells: [
                <div className="person" key="name">
                  <span className="avatar">
                    {e.first_name[0]}
                    {e.last_name[0] ?? ""}
                  </span>
                  <strong>
                    {e.first_name} {e.last_name}
                  </strong>
                </div>,
                e.role,
                vehicleName(data, a?.vehicle_id ?? null),
                s?.payment_model ? (
                  salaryLabels[s.payment_model]
                ) : (
                  <Badge key="m" tone="amber">
                    Pendiente
                  </Badge>
                ),
                s?.amount !== null && s?.amount !== undefined
                  ? currency(s.amount)
                  : "A configurar",
                s?.payment_frequency
                  ? frequencyLabels[s.payment_frequency]
                  : "A configurar",
                <Badge key="s" tone={e.is_active ? "green" : "neutral"}>
                  {e.is_active ? "Activo" : "Inactivo"}
                </Badge>,
                <Modal
                  key="edit"
                  title={"Editar · " + e.first_name}
                  trigger={<span className="text-button">Editar</span>}
                  wide
                >
                  <EmployeeForm data={data} employee={e} />
                </Modal>,
              ],
            };
          })}
        />
      </section>
    </>
  );
}
function ExpenseTable({
  data,
  expenses,
}: {
  data: Data;
  expenses: Data["expenses"];
}) {
  return (
    <Table
      headers={[
        "Fecha",
        "Categoría",
        "Camioneta",
        "Descripción",
        "Importe",
        "Estado",
        "Acciones",
      ]}
      rows={expenses.map((e) => {
        const c = data.categories.find((c) => c.id === e.category_id);
        const fuel = data.fuel.find((f) => f.expense_id === e.id);
        return {
          key: e.id,
          search: [
            e.expense_date,
            c?.name,
            vehicleName(data, e.vehicle_id),
            e.description,
            e.notes,
          ].join(" "),
          cells: [
            dateLabel(e.expense_date),
            <Badge
              key="c"
              tone={c?.name === "Combustible" ? "blue" : "neutral"}
            >
              {c?.name}
            </Badge>,
            vehicleName(data, e.vehicle_id),
            <span key="d">
              {e.description}
              {fuel && c?.name === "Combustible" && (
                <small>
                  {fuel.tank_count} cargas
                  {fuel.liters ? " · " + fuel.liters + " litros" : ""}
                </small>
              )}
            </span>,
            <strong key="a">{currency(e.amount)}</strong>,
            <Badge
              key="s"
              tone={
                e.voided_at ? "neutral" : e.payment_date ? "green" : "amber"
              }
            >
              {e.voided_at
                ? "Anulado"
                : e.payment_date
                  ? "Pagado"
                  : "Pendiente"}
            </Badge>,
            !e.voided_at ? (
              <div className="row-actions" key="edit">
                <Modal
                  title="Editar gasto"
                  trigger={<span className="text-button">Editar / pagar</span>}
                  wide
                >
                  <ExpenseForm data={data} expense={e} />
                </Modal>
                <VoidButton entity="expenses" id={e.id} />
              </div>
            ) : (
              "—"
            ),
          ],
        };
      })}
    />
  );
}
export function ExpensesModule({
  data,
  start,
  end,
  vehicleId,
  category,
}: {
  data: Data;
  start: string;
  end: string;
  vehicleId: string;
  category: string;
}) {
  const expenses = data.expenses.filter(
    (e) =>
      e.expense_date >= start &&
      e.expense_date <= end &&
      (!vehicleId || e.vehicle_id === vehicleId) &&
      (!category || e.category_id === category),
  );
  const active = expenses.filter((e) => !e.voided_at);
  const total = sum(active.map((e) => e.amount)),
    paid = sum(active.filter((e) => e.payment_date).map((e) => e.amount));
  return (
    <>
      <PageHeading
        eyebrow="CONTROL DE COSTOS"
        title="Cada gasto, en su lugar"
        description="Combustible, mantenimiento y todos los gastos de tu empresa."
        action={
          <Modal
            title="Registrar gasto"
            trigger={
              <span className="button">
                <Plus size={17} /> Nuevo gasto
              </span>
            }
            wide
          >
            <ExpenseForm data={data} />
          </Modal>
        }
      />
      <Filters
        data={data}
        start={start}
        end={end}
        vehicle={vehicleId}
        category={category}
        expense
      />
      <div className="stats-grid three">
        <Stat
          title="Gastos registrados"
          value={currency(total)}
          description="Total del período seleccionado"
          tone="amber"
        />
        <Stat
          title="Gastos pagados"
          value={currency(paid)}
          description="Importe con pago registrado"
          tone="green"
        />
        <Stat
          title="Pendientes de pago"
          value={currency(Number(total) - Number(paid))}
          description="Gastos registrados sin fecha de pago"
          tone="red"
        />
      </div>
      <section className="panel">
        <SectionHead
          title="Historial de gastos"
          subtitle="Los gastos anulados conservan su historial y no afectan los resultados."
        />
        <ExpenseTable data={data} expenses={expenses} />
      </section>
    </>
  );
}
export function PayrollModule({ data }: { data: Data }) {
  const active = data.payroll.filter((p) => !p.voided_at);
  const total = sum(active.map((p) => p.total_amount)),
    paid = sum(data.payments.filter((p) => !p.voided_at).map((p) => p.amount));
  return (
    <>
      <PageHeading
        eyebrow="SUELDOS Y LIQUIDACIONES"
        title="Tu equipo, al día"
        description="Revisá lo devengado, cerrá períodos y registrá pagos parciales."
        action={
          <Modal
            title="Nueva liquidación"
            trigger={
              <span className="button">
                <Plus size={17} /> Liquidar período
              </span>
            }
            wide
          >
            <PayrollForm data={data} />
          </Modal>
        }
      />
      <div className="stats-grid three">
        <Stat
          title="Total liquidado"
          value={currency(total)}
          description="Liquidaciones cerradas vigentes"
        />
        <Stat
          title="Total abonado"
          value={currency(paid)}
          description="Pagos efectivos registrados"
          tone="green"
        />
        <Stat
          title="Saldo pendiente"
          value={currency(Number(total) - Number(paid))}
          description="Importe por pagar de períodos cerrados"
          tone="amber"
        />
      </div>
      <section className="panel">
        <SectionHead
          title="Próximas liquidaciones"
          subtitle="Revisá el período configurado para cada persona."
        />
        <div className="payroll-reminders">
          {data.employees
            .filter((e) => e.is_active)
            .map((e) => {
              const s = data.salaries.find(
                (s) => s.employee_id === e.id && !s.valid_until,
              );
              const [start, end] = period(
                today(),
                s?.payment_frequency ?? "weekly",
              );
              const ready =
                s?.payment_model && s.amount !== null && s.payment_frequency;
              return (
                <div key={e.id}>
                  <div>
                    <strong>
                      {e.first_name} {e.last_name}
                    </strong>
                    <small>
                      {ready
                        ? `${frequencyLabels[s.payment_frequency!]} · ${dateLabel(start)} al ${dateLabel(end)}`
                        : "Salario pendiente de configurar"}
                    </small>
                  </div>
                  <Badge tone={ready ? "blue" : "amber"}>
                    {ready ? "Fin de período: " + dateLabel(end) : "Configurar"}
                  </Badge>
                </div>
              );
            })}
        </div>
      </section>
      <section className="panel">
        <SectionHead
          title="Historial de liquidaciones"
          subtitle="El pago no vuelve a descontar un sueldo ya devengado."
        />
        <Table
          headers={[
            "Empleado",
            "Período",
            "Jornadas",
            "Bruto",
            "Ajustes",
            "Total",
            "Abonado",
            "Pendiente",
            "Estado",
            "Acciones",
          ]}
          rows={data.payroll.map((p) => {
            const payments = data.payments.filter(
              (t) => t.payroll_period_id === p.id,
            );
            const left = balance(p.total_amount, payments);
            const paid = sum(
              payments.filter((t) => !t.voided_at).map((t) => t.amount),
            );
            const tone = p.voided_at
              ? "neutral"
              : Number(left) === 0
                ? "green"
                : Number(paid) > 0
                  ? "blue"
                  : "amber";
            return {
              key: p.id,
              search: [
                fullName(data, p.employee_id),
                p.start_date,
                p.end_date,
              ].join(" "),
              cells: [
                <strong key="e">{fullName(data, p.employee_id)}</strong>,
                <span key="d">
                  {dateLabel(p.start_date)}
                  <small>al {dateLabel(p.end_date)}</small>
                </span>,
                p.days_worked,
                currency(p.gross_amount),
                currency(p.adjustments),
                <strong key="t">{currency(p.total_amount)}</strong>,
                currency(paid),
                currency(left),
                <Badge key="s" tone={tone}>
                  {p.voided_at
                    ? "Anulado"
                    : Number(left) === 0
                      ? "Pagado"
                      : Number(paid) > 0
                        ? "Parcial"
                        : "Pendiente"}
                </Badge>,
                !p.voided_at ? (
                  <div className="row-actions" key="a">
                    {Number(left) > 0 && (
                      <Modal
                        title={"Pagar · " + fullName(data, p.employee_id)}
                        trigger={<span className="text-button">Pagar</span>}
                      >
                        <MovementForm data={data} payroll={p} />
                      </Modal>
                    )}
                    <VoidButton entity="payroll_periods" id={p.id} />
                  </div>
                ) : (
                  "—"
                ),
              ],
            };
          })}
        />
      </section>
      <MovementHistory data={data} />
    </>
  );
}
function MovementHistory({
  data,
  collections = false,
}: {
  data: Data;
  collections?: boolean;
}) {
  return (
    <section className="panel">
      <SectionHead
        title={collections ? "Historial de cobros" : "Historial de pagos"}
        subtitle="Para corregir un movimiento, anulalo y registrá uno nuevo."
      />
      <Table
        headers={[
          "Fecha",
          collections ? "Camioneta / jornada" : "Empleado / período",
          "Importe",
          "Medio",
          "Estado",
          "",
        ]}
        rows={
          collections
            ? data.collections.map((c) => {
                const d = data.days.find((d) => d.id === c.work_day_id);
                return {
                  key: c.id,
                  search: [
                    c.collection_date,
                    c.payment_method,
                    d?.work_date,
                  ].join(" "),
                  cells: [
                    dateLabel(c.collection_date),
                    d
                      ? vehicleName(data, d.vehicle_id) +
                        " · " +
                        dateLabel(d.work_date) +
                        " · Jornada " +
                        (d.shift_number ?? 1)
                      : c.vehicle_id && c.work_date
                        ? vehicleName(data, c.vehicle_id) +
                          " · " +
                          dateLabel(c.work_date) +
                          " · Jornada " +
                          (c.shift_number ?? 1)
                        : "Jornada fuera del período cargado",
                    currency(c.amount),
                    c.payment_method ?? "—",
                    <Badge key="s" tone={c.voided_at ? "neutral" : "green"}>
                      {c.voided_at ? "Anulado" : "Cobrado"}
                    </Badge>,
                    !c.voided_at ? (
                      <VoidButton key="v" entity="collections" id={c.id} />
                    ) : null,
                  ],
                };
              })
            : data.payments.map((p) => {
                const period = data.payroll.find(
                  (x) => x.id === p.payroll_period_id,
                );
                return {
                  key: p.id,
                  search: [
                    p.payment_date,
                    period && fullName(data, period.employee_id),
                    p.payment_method,
                  ].join(" "),
                  cells: [
                    dateLabel(p.payment_date),
                    period ? (
                      <span key="e">
                        {fullName(data, period.employee_id)}
                        <small>
                          {dateLabel(period.start_date)} al{" "}
                          {dateLabel(period.end_date)}
                        </small>
                      </span>
                    ) : (
                      "—"
                    ),
                    currency(p.amount),
                    p.payment_method ?? "—",
                    <Badge key="s" tone={p.voided_at ? "neutral" : "green"}>
                      {p.voided_at ? "Anulado" : "Pagado"}
                    </Badge>,
                    !p.voided_at ? (
                      <VoidButton key="v" entity="payroll_payments" id={p.id} />
                    ) : null,
                  ],
                };
              })
        }
      />
    </section>
  );
}
export function ReportsModule({
  data,
  start,
  end,
  vehicleId,
}: {
  data: Data;
  start: string;
  end: string;
  vehicleId: string;
}) {
  const r = report(data, start, end, vehicleId);
  const query = new URLSearchParams({
    from: start,
    to: end,
    vehicle: vehicleId,
  });
  const now = today();
  return (
    <>
      <PageHeading
        eyebrow="DECISIONES CON INFORMACIÓN"
        title="Tus números, claros"
        description="Facturación, costos devengados y movimientos reales de caja."
        action={
          <>
            <a
              className="button secondary"
              href={"/api/export?" + query + "&format=xlsx"}
            >
              <FileSpreadsheet size={17} /> Excel
            </a>
            <a className="button" href={"/api/export?" + query + "&format=pdf"}>
              <Download size={17} /> PDF
            </a>
          </>
        }
      />
      <div className="quick-periods">
        {[
          ["Hoy", now, now],
          ["Semana", ...period(now, "weekly")],
          ["Quincena", ...period(now, "biweekly")],
          ["Mes", ...period(now, "monthly")],
          ["Año", now.slice(0, 4) + "-01-01", now.slice(0, 4) + "-12-31"],
        ].map(([label, s, e]) => (
          <Link
            key={label}
            className={s === start && e === end ? "selected" : ""}
            href={"/reportes?from=" + s + "&to=" + e}
          >
            {label}
          </Link>
        ))}
      </div>
      <Filters data={data} start={start} end={end} vehicle={vehicleId} />
      <div className="stats-grid">
        <Stat
          title="Facturación"
          value={currency(r.revenue)}
          description="Ingresos registrados en jornadas"
        />
        <Stat
          title="Gastos operativos"
          value={currency(r.cost)}
          description="Gastos vigentes del período"
          tone="amber"
        />
        <Stat
          title="Sueldos devengados"
          value={currency(r.salary)}
          description="Sueldos diarios y fijos del período"
          tone="purple"
        />
        <Stat
          title="Resultado neto operativo"
          value={currency(r.net)}
          description="Facturación − gastos − sueldos"
          tone={Number(r.net) >= 0 ? "green" : "red"}
        />
      </div>
      <p className="report-note">
        <FileText size={17} /> Este resultado es operativo. No representa
        utilidad contable o fiscal definitiva: no incorpora impuestos ni
        amortizaciones no registrados.
      </p>
      <div className="charts-grid">
        <section className="panel">
          <SectionHead
            title="Facturación por día"
            subtitle={dateLabel(start) + " — " + dateLabel(end)}
          />
          <RevenueChart
            data={data}
            start={start}
            end={end}
            vehicleId={vehicleId}
          />
        </section>
        <section className="panel">
          <SectionHead
            title="Gastos por categoría"
            subtitle="Distribución del período seleccionado"
          />
          <CategoryChart
            data={data}
            start={start}
            end={end}
            vehicleId={vehicleId}
          />
        </section>
      </div>
      <section className="panel">
        <SectionHead
          title="Ingresos, costos y resultado mensual"
          subtitle={"Año " + start.slice(0, 4)}
        />
        <MonthlyChart data={data} year={start.slice(0, 4)} />
      </section>
      <section className="panel">
        <SectionHead
          title="Resultado por camioneta"
          subtitle="Los costos generales se muestran por separado, sin reparto automático."
        />
        <Table
          search={false}
          headers={[
            "Camioneta",
            "Jornadas",
            "Facturación",
            "Combustible",
            "Otros gastos",
            "Sueldos atribuibles",
            "Resultado",
          ]}
          rows={data.vehicles
            .filter((v) => !vehicleId || v.id === vehicleId)
            .map((v) => {
              const row = report(data, start, end, v.id);
              const fuel = sum(
                row.expenses
                  .filter(
                    (e) =>
                      data.categories.find((c) => c.id === e.category_id)
                        ?.name === "Combustible",
                  )
                  .map((e) => e.amount),
              );
              return {
                key: v.id,
                search: v.name,
                cells: [
                  <strong key="v">{v.name}</strong>,
                  row.worked,
                  currency(row.revenue),
                  currency(fuel),
                  currency(Number(row.cost) - Number(fuel)),
                  currency(row.salary),
                  <strong
                    key="n"
                    className={Number(row.net) >= 0 ? "positive" : "negative"}
                  >
                    {currency(row.net)}
                  </strong>,
                ],
              };
            })}
        />
        {!vehicleId && (
          <div className="general-costs">
            <span>
              Gastos generales:{" "}
              <strong>
                {currency(
                  sum(
                    r.expenses
                      .filter((e) => !e.vehicle_id)
                      .map((e) => e.amount),
                  ),
                )}
              </strong>
            </span>
            <span>
              Sueldos sin asignar:{" "}
              <strong>
                {currency(
                  sum(
                    r.accrued.filter((a) => !a.vehicle_id).map((a) => a.amount),
                  ),
                )}
              </strong>
            </span>
          </div>
        )}
      </section>
      <section className="panel">
        <SectionHead
          title="Movimiento de caja"
          subtitle="Según la fecha efectiva de cobro o pago, independientemente del período de devengamiento."
        />
        <div className="cash-report">
          <div>
            <span>Cobros recibidos</span>
            <strong className="positive">{currency(r.receipts)}</strong>
          </div>
          <div>
            <span>Pagos de gastos {vehicleId ? "" : "y sueldos"}</span>
            <strong>{currency(r.outgoing)}</strong>
          </div>
          <div>
            <span>Movimiento neto</span>
            <strong className={Number(r.cash) >= 0 ? "positive" : "negative"}>
              {currency(r.cash)}
            </strong>
          </div>
        </div>
        {vehicleId && (
          <p className="hint">
            Los pagos de sueldos se consultan en la caja general de empresa: no
            se reparten automáticamente entre unidades.
          </p>
        )}
      </section>
      <section className="panel">
        <SectionHead title="Detalle de facturación" />
        <DayTable data={data} days={r.days} />
      </section>
    </>
  );
}
export function SettingsModule({
  data,
  recovery,
  userName,
  email,
}: {
  data: Data;
  recovery: boolean;
  userName: string;
  email: string;
}) {
  return (
    <>
      <PageHeading
        eyebrow="TU ESPACIO"
        title="Configuración"
        description="Los datos de tu empresa, tus preferencias y el historial de operaciones."
      />
      {recovery && (
        <p className="setup-banner">
          Ingresaste desde la recuperación de acceso. Definí una nueva
          contraseña a continuación.
        </p>
      )}
      <div className="settings-grid">
        <section className="panel">
          <SectionHead title="Perfil del administrador" />
          <SaveForm operation="profile">
            <Field label="Nombre completo">
              <Input
                name="full_name"
                defaultValue={userName}
                required
                maxLength={150}
              />
            </Field>
            <Field label="Correo de acceso">
              <Input value={email} readOnly />
            </Field>
          </SaveForm>
        </section>
        <section className="panel">
          <SectionHead title="Datos de la empresa" />
          <SaveForm operation="company">
            <Field label="Nombre de la empresa">
              <Input name="name" defaultValue={data.company.name} required />
            </Field>
            <div className="form-grid">
              <Field label="Moneda">
                <Input value="ARS · Peso argentino" readOnly />
              </Field>
              <Field label="Zona horaria">
                <Input value="Buenos Aires · UTC−3" readOnly />
              </Field>
            </div>
          </SaveForm>
        </section>
        <section className="panel">
          <SectionHead
            title="Seguridad de la cuenta"
            subtitle="Acceso privado, sin registro público."
          />
          <SaveForm operation="password" submitLabel="Cambiar contraseña">
            <Field label="Nueva contraseña">
              <Input
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Repetir contraseña">
              <Input
                name="confirm_password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </Field>
          </SaveForm>
        </section>
        <section className="panel">
          <SectionHead
            title="Categorías de gastos"
            subtitle="Agregá categorías según las necesidades de tu empresa."
          />
          <div className="category-tags">
            {data.categories.map((c) => (
              <Badge key={c.id}>{c.name}</Badge>
            ))}
          </div>
          <SaveForm operation="category" submitLabel="Agregar categoría">
            <Field label="Nombre de la nueva categoría">
              <Input name="name" required maxLength={150} />
            </Field>
          </SaveForm>
        </section>
        <section className="panel">
          <SectionHead
            title="Flota y equipo"
            subtitle="Completá las tarifas y los salarios antes de operar."
          />
          <div className="settings-links">
            <Link href="/camionetas">
              <span>
                <Truck size={20} /> Administrar camionetas
              </span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/empleados">
              <span>
                <Users size={20} /> Empleados, sueldos y asignaciones
              </span>
              <ArrowRight size={16} />
            </Link>
          </div>
          <p className="hint">
            Las bajas se realizan desactivando. Las operaciones financieras se
            anulan y conservan su historial.
          </p>
        </section>
      </div>
      <section className="panel">
        <SectionHead
          title="Historial de operaciones"
          subtitle="Últimos 100 cambios. Incluye los valores anteriores, los nuevos y el motivo de anulación."
        />
        <Table
          headers={[
            "Fecha y hora",
            "Entidad",
            "Operación",
            "Responsable",
            "Detalle",
          ]}
          rows={data.audit.map((a) => ({
            key: a.id,
            search: [a.entity_type, a.action, a.entity_id].join(" "),
            cells: [
              new Intl.DateTimeFormat("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Argentina/Buenos_Aires",
              }).format(new Date(a.created_at)),
              a.entity_type,
              <Badge
                key="action"
                tone={a.action === "INSERT" ? "green" : "blue"}
              >
                {a.action === "INSERT"
                  ? "Creación"
                  : a.action === "UPDATE"
                    ? "Modificación"
                    : a.action}
              </Badge>,
              a.actor_id ? "Administrador" : "Inicialización",
              <Modal
                key="detail"
                title="Detalle de auditoría"
                trigger={<span className="text-button">Ver cambio</span>}
                wide
              >
                <div className="audit-detail">
                  <h3>Antes</h3>
                  <pre>{JSON.stringify(a.previous_data, null, 2)}</pre>
                  <h3>Después</h3>
                  <pre>{JSON.stringify(a.new_data, null, 2)}</pre>
                </div>
              </Modal>,
            ],
          }))}
        />
      </section>
    </>
  );
}
