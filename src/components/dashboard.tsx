import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Truck,
  CalendarDays,
  Wallet,
  TrendingUp,
  ReceiptText,
  Clock3,
  Banknote,
  AlertCircle,
} from "lucide-react";
import type { Data, Vehicle } from "@/lib/types";
import { VehicleJournals } from "./vehicle-journals";
import {
  today,
  currency,
  report,
  period,
  balance,
  sum,
  dateLabel,
} from "@/lib/domain";
import { Badge, Modal, Empty } from "./ui";
import { VehicleForm, ExpenseForm } from "./forms";
import { RevenueChart, CategoryChart } from "./charts";
export function Stat({
  title,
  value,
  description,
  icon: Icon = TrendingUp,
  tone = "blue",
}: {
  title: string;
  value: string;
  description: string;
  icon?: typeof TrendingUp;
  tone?: string;
}) {
  return (
    <article className={"stat-card " + tone}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-description">{description}</div>
    </article>
  );
}
export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function VehicleCard({
  data,
  vehicle,
  date,
}: {
  data: Data;
  vehicle: Vehicle;
  date: string;
}) {
  const journals = data.days
    .filter((d) => d.vehicle_id === vehicle.id && d.work_date === date)
    .sort((a, b) => (a.shift_number ?? 1) - (b.shift_number ?? 1));
  const day = journals[0],
    worked = journals.filter((d) => d.worked);
  const [ms, me] = period(date, "monthly");
  const monthly = report(data, ms, me, vehicle.id);
  const assigned = (role: string) => {
    if (day?.worked) {
      const actual = data.attendance.find(
        (a) => a.work_day_id === day.id && a.role === role,
      );
      const employee = data.employees.find((e) => e.id === actual?.employee_id);
      return employee
        ? employee.first_name + " " + employee.last_name
        : "Sin " + role + " registrado";
    }
    const a = data.assignments.find(
      (a) =>
        a.vehicle_id === vehicle.id &&
        a.role === role &&
        a.start_date <= date &&
        (!a.end_date || a.end_date >= date),
    );
    const e = data.employees.find((e) => e.id === a?.employee_id);
    return e ? e.first_name + " " + e.last_name : "Sin asignar";
  };
  const last = data.days
    .filter(
      (d) => d.vehicle_id === vehicle.id && d.worked && d.work_date <= date,
    )
    .sort((a, b) => b.work_date.localeCompare(a.work_date))[0];
  return (
    <article className="vehicle-card">
      <div className="vehicle-top">
        <span className="vehicle-icon">
          <Truck size={25} />
        </span>
        <div>
          <h3>{vehicle.name}</h3>
          <span>{vehicle.license_plate || "Patente pendiente"}</span>
        </div>
        <Badge tone={worked.length ? "green" : day ? "neutral" : "amber"}>
          {worked.length > 1
            ? "Doble jornada"
            : worked.length
              ? "Trabajó"
              : day
                ? "Sin actividad"
                : "Sin registrar"}
        </Badge>
      </div>
      {!day && (
        <div className="vehicle-crew">
          <div>
            <span>Chofer</span>
            <strong>{assigned("chofer")}</strong>
          </div>
          <div>
            <span>Ayudante</span>
            <strong>{assigned("ayudante")}</strong>
          </div>
        </div>
      )}
      <div className="vehicle-numbers">
        <div>
          <span>{day ? "Facturación del día" : "Tarifa diaria"}</span>
          <strong>
            {day
              ? currency(sum(journals.map((d) => d.revenue_amount)))
              : vehicle.service_pricing
                ? "fija" in vehicle.service_pricing
                  ? currency(vehicle.service_pricing.fija)
                  : "Según el trabajo"
                : vehicle.default_daily_rate !== null
                  ? currency(vehicle.default_daily_rate)
                  : "A configurar"}
          </strong>
        </div>
        <div>
          <span>Acumulado del mes</span>
          <strong>{currency(monthly.revenue)}</strong>
        </div>
      </div>
      <p className="last-day">
        <CalendarDays size={14} />
        {last
          ? "Último día trabajado: " + dateLabel(last.work_date)
          : "Todavía no se registraron jornadas trabajadas"}
      </p>
      <VehicleJournals data={data} vehicle={vehicle} date={date} dashboard />
    </article>
  );
}
export function Dashboard({ data, month }: { data: Data; month: string }) {
  const now = today(),
    [ms, me] = period(month + "-01", "monthly"),
    [ws, we] = period(now, "weekly");
  const m = report(data, ms, me),
    daily = report(data, now, now),
    weekly = report(data, ws, we);
  const outstanding = sum(
    data.payroll
      .filter((p) => !p.voided_at)
      .map((p) =>
        balance(
          p.total_amount,
          data.payments.filter((t) => t.payroll_period_id === p.id),
        ),
      ),
  );
  const pending = data.employees.filter(
    (e) =>
      e.is_active &&
      data.salaries.some(
        (s) =>
          s.employee_id === e.id &&
          !s.valid_until &&
          (!s.payment_model || s.amount === null || !s.payment_frequency),
      ),
  );
  const missingRates = data.vehicles.filter(
    (v) => v.is_active && v.default_daily_rate === null && !v.service_pricing,
  );
  const fmtMonth = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms + "T12:00:00Z"));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EL PULSO DE TU EMPRESA</span>
          <h1>
            Tu gestión, al día<span className="heading-dot">.</span>
          </h1>
          <p>Una mirada clara a tus jornadas, tu flota y tus números.</p>
        </div>
        <div className="heading-actions">
          <form className="period-control">
            <CalendarDays size={16} />
            <input
              name="month"
              type="month"
              defaultValue={month}
              aria-label="Mes del resumen"
            />
            <button type="submit">Ver</button>
          </form>
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
        </div>
      </div>
      <div className="overview-label">
        <span className="live-dot" /> Resumen de {fmtMonth}
        <Badge tone="blue">ARS · pesos argentinos</Badge>
      </div>
      <div className="stats-grid">
        <Stat
          title="Facturación de hoy"
          value={currency(daily.revenue)}
          description={dateLabel(now)}
          icon={Banknote}
        />
        <Stat
          title="Facturación de la semana"
          value={currency(weekly.revenue)}
          description="Semana actual · lunes a domingo"
          icon={CalendarDays}
        />
        <Stat
          title="Facturación del mes"
          value={currency(m.revenue)}
          description={`${m.worked} jornadas en el período`}
          icon={TrendingUp}
        />
        <Stat
          title="Resultado neto operativo"
          value={currency(m.net)}
          description="Facturación − gastos − sueldos"
          icon={ArrowUpRight}
          tone={Number(m.net) >= 0 ? "green" : "red"}
        />
        <Stat
          title="Gastos del mes"
          value={currency(m.cost)}
          description="Gastos operativos registrados"
          icon={ReceiptText}
          tone="amber"
        />
        <Stat
          title="Sueldos devengados"
          value={currency(m.salary)}
          description="Costo generado en el mes"
          icon={Wallet}
          tone="purple"
        />
        <Stat
          title="Sueldos pendientes"
          value={currency(outstanding)}
          description="Saldo de liquidaciones cerradas"
          icon={Clock3}
          tone="amber"
        />
        <Stat
          title="Jornadas trabajadas"
          value={String(m.worked).padStart(2, "0")}
          description="Total de jornadas de la flota"
          icon={Truck}
        />
      </div>
      {(pending.length > 0 || missingRates.length > 0) && (
        <div className="setup-banner">
          <span className="setup-icon">
            <AlertCircle size={20} />
          </span>
          <div>
            <strong>Unos datos más para tener el panorama completo</strong>
            <p>
              {pending.length > 0
                ? `${pending.length} empleados con configuración salarial pendiente. `
                : ""}
              {missingRates.length > 0
                ? `${missingRates.length} camionetas sin tarifa predeterminada.`
                : ""}
            </p>
          </div>
          <Link href="/configuracion">
            Completar configuración <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <SectionHead
        title="Tu flota, hoy"
        subtitle={"Actividad del " + dateLabel(now)}
        action={
          <Link href="/registro" className="text-button">
            Ver registro diario <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="fleet-grid">
        {data.vehicles
          .filter((v) => v.is_active)
          .map((v) => (
            <VehicleCard key={v.id} data={data} vehicle={v} date={now} />
          ))}
      </div>
      {!data.vehicles.some((v) => v.is_active) && (
        <Empty
          title="Tu flota empieza acá"
          description="Agregá una camioneta para registrar sus jornadas."
          action={
            <Modal
              title="Nueva camioneta"
              trigger={<span className="button">Agregar camioneta</span>}
            >
              <VehicleForm />
            </Modal>
          }
        />
      )}
      <div className="charts-grid">
        <section className="panel">
          <SectionHead
            title="Facturación diaria"
            subtitle={fmtMonth}
            action={
              <span className="chart-key">
                <i />
                Ingresos
              </span>
            }
          />
          <RevenueChart data={data} start={ms} end={me} />
        </section>
        <section className="panel">
          <SectionHead
            title="¿En qué se gastó?"
            subtitle="Distribución de gastos del mes"
          />
          <CategoryChart data={data} start={ms} end={me} />
        </section>
      </div>
      <div className="cash-strip">
        <span className="cash-icon">
          <Wallet size={23} />
        </span>
        <div>
          <h3>Una cosa es facturar. Otra, cobrar.</h3>
          <p>
            Movimiento de caja del mes: cobros {currency(m.receipts)} · pagos{" "}
            {currency(m.outgoing)}
          </p>
        </div>
        <strong className={Number(m.cash) >= 0 ? "positive" : "negative"}>
          {currency(m.cash)}
        </strong>
        <Link href="/reportes" className="text-button">
          Ver reportes <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
