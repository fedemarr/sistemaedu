"use client";
import { useEffect, useState } from "react";
import type {
  Data,
  Vehicle,
  Employee,
  Day,
  Expense,
  Payroll,
} from "@/lib/types";
import { today, dateLabel, currency, balance, sum } from "@/lib/domain";
import { previewPayroll } from "@/app/actions";
import {
  SERVICE_BANDS,
  SERVICE_LABELS,
  availableServices,
  pricingRateFields,
  serviceQuote,
  type ServiceType,
} from "@/lib/service-pricing";
import { Field, Input, Amount, SaveForm, Notes, Badge } from "./ui";

export function VehicleSelect({
  data,
  selected = "",
  name = "vehicle_id",
  optional = true,
}: {
  data: Data;
  selected?: string;
  name?: string;
  optional?: boolean;
}) {
  return (
    <select name={name} defaultValue={selected} required={!optional}>
      <option value="">
        {optional ? "General · sin asignar" : "Seleccionar camioneta"}
      </option>
      {data.vehicles
        .filter((v) => v.is_active || v.id === selected)
        .map((v) => (
          <option value={v.id} key={v.id}>
            {v.name}
          </option>
        ))}
    </select>
  );
}
export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  return (
    <SaveForm operation="vehicle">
      <input name="id" type="hidden" value={vehicle?.id ?? ""} />
      <div className="form-grid">
        <Field label="Nombre">
          <Input
            name="name"
            defaultValue={vehicle?.name}
            required
            maxLength={150}
          />
        </Field>
        <Field label="Patente (opcional)">
          <Input
            name="license_plate"
            defaultValue={vehicle?.license_plate ?? ""}
          />
        </Field>
        <Field label="Marca (opcional)">
          <Input name="brand" defaultValue={vehicle?.brand ?? ""} />
        </Field>
        <Field label="Modelo (opcional)">
          <Input name="model" defaultValue={vehicle?.model ?? ""} />
        </Field>
        <Field label="Año (opcional)">
          <Input
            name="year"
            type="number"
            min="1900"
            max="2100"
            defaultValue={vehicle?.year ?? ""}
          />
        </Field>
        {!vehicle?.service_pricing && (
          <Amount
            name="default_daily_rate"
            label="Tarifa diaria predeterminada (ARS)"
            defaultValue={vehicle?.default_daily_rate}
            required={false}
          />
        )}
      </div>
      {vehicle?.service_pricing && (
        <div className="form-section">
          <h3>Tarifas por tipo de trabajo</h3>
          <p>
            Estos importes se aplican a las nuevas jornadas. Las anteriores
            conservan su tarifario.
          </p>
          <input
            type="hidden"
            name="default_daily_rate"
            value={vehicle.default_daily_rate ?? ""}
          />
          <div className="form-grid">
            {pricingRateFields(vehicle.service_pricing).map((b) => (
              <Amount
                key={b.key}
                name={"rate_" + b.key}
                label={b.label + " (ARS)"}
                defaultValue={b.amount}
              />
            ))}
          </div>
        </div>
      )}
      <Field label="Estado">
        <select
          name="is_active"
          defaultValue={String(vehicle?.is_active ?? true)}
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
      </Field>
      <p className="hint">
        Cambiar la tarifa no modifica las jornadas ya registradas.
      </p>
      <Notes value={vehicle?.notes} />
    </SaveForm>
  );
}
const labels = {
  daily: "Por día trabajado",
  weekly: "Fijo semanal",
  biweekly: "Fijo quincenal",
  monthly: "Fijo mensual",
};
export function EmployeeForm({
  data,
  employee,
}: {
  data: Data;
  employee?: Employee;
}) {
  const salary = data.salaries.find(
    (s) => s.employee_id === employee?.id && !s.valid_until,
  );
  const assignment = data.assignments.find(
    (a) => a.employee_id === employee?.id && !a.end_date,
  );
  return (
    <SaveForm operation="employee">
      <input name="id" type="hidden" value={employee?.id ?? ""} />
      <div className="form-grid">
        <Field label="Nombre">
          <Input
            name="first_name"
            defaultValue={employee?.first_name}
            required
          />
        </Field>
        <Field label="Apellido (opcional)">
          <Input name="last_name" defaultValue={employee?.last_name} />
        </Field>
        <Field label="Rol">
          <select name="role" defaultValue={employee?.role ?? "ayudante"}>
            <option value="chofer">Chofer</option>
            <option value="ayudante">Ayudante</option>
          </select>
        </Field>
        <Field label="Camioneta asignada">
          <VehicleSelect data={data} selected={assignment?.vehicle_id} />
        </Field>
        <Field label="Estado">
          <select
            name="is_active"
            defaultValue={String(employee?.is_active ?? true)}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </Field>
      </div>
      <div className="form-section">
        <h3>Configuración salarial</h3>
        <p>
          Los cambios se aplican desde hoy. Las jornadas anteriores y las
          liquidaciones cerradas conservan sus valores.
        </p>
      </div>
      <div className="form-grid">
        <Field label="Modalidad salarial">
          <select
            name="payment_model"
            defaultValue={salary?.payment_model ?? ""}
          >
            <option value="">Pendiente de configurar</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Frecuencia de liquidación">
          <select
            name="payment_frequency"
            defaultValue={salary?.payment_frequency ?? ""}
          >
            <option value="">Pendiente de configurar</option>
            <option value="weekly">Semanal · lunes a domingo</option>
            <option value="biweekly">Quincenal · 1–15 y 16–fin de mes</option>
            <option value="monthly">Mensual</option>
          </select>
        </Field>
        <Amount
          name="amount"
          label="Importe de la modalidad (ARS)"
          defaultValue={salary?.amount}
          required={false}
        />
      </div>
      <p className="hint">
        Los sueldos fijos se devengan por día calendario de su período. Se
        muestran como costo general, sin reparto automático entre camionetas.
      </p>
      <Notes value={employee?.notes} />
    </SaveForm>
  );
}
export function DayForm({
  data,
  vehicle,
  day,
  date,
  worked: initialWorked = true,
  shiftNumber = 1,
}: {
  data: Data;
  vehicle: Vehicle;
  day?: Day;
  date: string;
  worked?: boolean;
  shiftNumber?: number;
}) {
  const [worked, setWorked] = useState(day?.worked ?? initialWorked);
  const pricing = day?.pricing_snapshot ?? vehicle.service_pricing;
  const [workType, setWorkType] = useState<ServiceType | "">(
    day?.work_type ?? (pricing && "fija" in pricing && !day ? "fija" : ""),
  );
  const [km, setKm] = useState(day?.distance_km ?? "");
  let quote: ReturnType<typeof serviceQuote> | null = null,
    pricingError = "";
  if (pricing && workType) {
    try {
      quote = serviceQuote(pricing, workType, km);
    } catch (e) {
      pricingError = (e as Error).message;
    }
  }
  const legacyManual = !!day?.worked && !day.work_type && workType === "";
  const assigned = (role: string) =>
    data.assignments.find(
      (a) =>
        a.vehicle_id === vehicle.id &&
        a.role === role &&
        a.start_date <= date &&
        (!a.end_date || a.end_date >= date),
    )?.employee_id ?? "";
  const attendance = (role: string) =>
    data.attendance.find((a) => a.work_day_id === day?.id && a.role === role);
  const crew = (
    <section className="crew-section" aria-label="Personal de la jornada">
      <h3>Chofer y ayudante que trabajaron</h3>
      <div className="form-grid">
        {(["chofer", "ayudante"] as const).map((role, i) => (
          <Field
            key={role}
            label={i === 0 ? "Chofer que trabajó" : "Ayudante que trabajó"}
          >
            <select
              name={i === 0 ? "driver_id" : "helper_id"}
              defaultValue={attendance(role)?.employee_id ?? assigned(role)}
            >
              <option value="">Sin {role}</option>
              {data.employees
                .filter(
                  (e) => e.is_active || e.id === attendance(role)?.employee_id,
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
            </select>
          </Field>
        ))}
      </div>
    </section>
  );
  return (
    <SaveForm
      operation="day"
      submitLabel={day ? "Actualizar jornada" : "Registrar jornada"}
      disableSubmit={!!(worked && pricing && !legacyManual && !quote)}
    >
      <input name="id" type="hidden" value={day?.id ?? ""} />
      <input name="version" type="hidden" value={day?.updated_at ?? ""} />
      <input name="vehicle_id" type="hidden" value={vehicle.id} />
      <input
        name="shift_number"
        type="hidden"
        value={day?.shift_number ?? shiftNumber}
      />
      <Badge tone="blue">Jornada {day?.shift_number ?? shiftNumber}</Badge>
      <div className="form-grid">
        <Field label="Camioneta">
          <Input value={vehicle.name} readOnly />
        </Field>
        <Field label="Fecha">
          <Input
            name="work_date"
            type="date"
            defaultValue={date}
            readOnly
            max={today()}
            required
          />
        </Field>
      </div>
      <Field label="Estado de la jornada">
        <select
          name="worked"
          value={String(worked)}
          onChange={(e) => setWorked(e.target.value === "true")}
        >
          <option value="true">Se trabajó</option>
          <option value="false">No se trabajó</option>
        </select>
      </Field>
      {worked ? (
        <>
          {!pricing && crew}
          {pricing && (
            <>
              <Field label="¿Qué trabajo realizó?">
                <select
                  name="work_type"
                  value={workType}
                  onChange={(e) =>
                    setWorkType(e.target.value as ServiceType | "")
                  }
                  required={!legacyManual}
                >
                  <option value="" disabled={!legacyManual}>
                    {legacyManual
                      ? "Histórico · conservar importe manual"
                      : "Elegir tipo de trabajo"}
                  </option>
                  {availableServices(pricing).map((value) => (
                    <option key={value} value={value}>
                      {SERVICE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>
              {crew}
              {workType === "voluminoso" && (
                <Field
                  label="Kilómetros recorridos"
                  hint="Ingresá el total de kilómetros. Se elige automáticamente el tramo correspondiente."
                >
                  <Input
                    name="distance_km"
                    type="number"
                    min="0"
                    max="180"
                    step="0.01"
                    inputMode="decimal"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    placeholder="Por ejemplo, 95"
                    required
                  />
                </Field>
              )}
              {quote && (
                <div className="payroll-preview" role="status">
                  <Badge tone="blue">
                    {SERVICE_LABELS[workType as ServiceType]}
                  </Badge>
                  <div>
                    <span>{quote.band}</span>
                    <strong>{currency(quote.amount)}</strong>
                  </div>
                  <p className="hint">
                    {day?.pricing_snapshot
                      ? "Tarifario conservado de esta jornada."
                      : "Importe total de la jornada, calculado automáticamente."}
                  </p>
                </div>
              )}
              {pricingError && (
                <p className="feedback error" role="status">
                  {pricingError}
                </p>
              )}
              {workType === "voluminoso" && "voluminoso_50" in pricing && (
                <details>
                  <summary className="text-button">
                    Ver tarifas de voluminoso
                  </summary>
                  <div className="payroll-preview">
                    {SERVICE_BANDS.map((b) => (
                      <div key={b.key}>
                        <span>{b.label}</span>
                        <strong>{currency(pricing[b.key])}</strong>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
          {pricing && !legacyManual ? (
            <Field label="Facturación del día (ARS)">
              <Input
                name="revenue_amount"
                value={quote?.amount ?? ""}
                readOnly
              />
            </Field>
          ) : (
            <Amount
              name="revenue_amount"
              label="Facturación del día (ARS)"
              defaultValue={day?.revenue_amount ?? vehicle.default_daily_rate}
            />
          )}
          <details>
            <summary className="text-button">
              Ajustar tarifas salariales (opcional)
            </summary>
            <div className="form-grid">
              {(["chofer", "ayudante"] as const).map((role, i) => (
                <div key={role}>
                  <Amount
                    name={i === 0 ? "driver_salary" : "helper_salary"}
                    label={
                      (i === 0 ? "Chofer" : "Ayudante") +
                      " · tarifa salarial excepcional"
                    }
                    defaultValue={
                      attendance(role)?.salary_model === "daily"
                        ? attendance(role)?.salary_amount
                        : null
                    }
                    required={false}
                  />
                </div>
              ))}
            </div>
          </details>
          <p className="hint">
            Si no indicás una excepción, se aplica el salario configurado para
            esa fecha. Registrar facturación no registra automáticamente un
            cobro.
          </p>
        </>
      ) : (
        <p className="callout">
          Se guardará la jornada sin actividad y con facturación de $0.
        </p>
      )}
      <Notes value={day?.notes} />
    </SaveForm>
  );
}
export function ExpenseForm({
  data,
  expense,
}: {
  data: Data;
  expense?: Expense;
}) {
  const [category, setCategory] = useState(
    expense?.category_id ??
      data.categories.find((c) => c.name === "Combustible")?.id ??
      "",
  );
  const fuel = data.fuel.find((f) => f.expense_id === expense?.id);
  const isFuel =
    data.categories.find((c) => c.id === category)?.name === "Combustible";
  return (
    <SaveForm
      operation="expense"
      submitLabel={expense ? "Actualizar gasto" : "Registrar gasto"}
    >
      <input name="id" type="hidden" value={expense?.id ?? ""} />
      <input name="version" type="hidden" value={expense?.updated_at ?? ""} />
      <div className="form-grid">
        <Field label="Fecha del gasto">
          <Input
            name="expense_date"
            type="date"
            defaultValue={expense?.expense_date ?? today()}
            max={today()}
            required
          />
        </Field>
        <Field label="Camioneta">
          <VehicleSelect data={data} selected={expense?.vehicle_id ?? ""} />
        </Field>
        <Field label="Categoría">
          <select
            name="category_id"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {data.categories
              .filter((c) => c.is_active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Amount name="amount" defaultValue={expense?.amount} />
      </div>
      <Field label="Descripción">
        <Input
          name="description"
          defaultValue={expense?.description}
          placeholder="Por ejemplo, carga de combustible"
          required
          maxLength={150}
        />
      </Field>
      {isFuel && (
        <div className="form-grid">
          <Amount
            name="tank_count"
            label="Cantidad de tanques / cargas"
            defaultValue={fuel?.tank_count ?? "1"}
          />
          <Amount
            name="liters"
            label="Litros (opcional)"
            defaultValue={fuel?.liters}
            required={false}
          />
        </div>
      )}
      <div className="form-section">
        <h3>Pago del gasto</h3>
        <p>Dejá la fecha vacía si todavía no se pagó.</p>
      </div>
      <div className="form-grid">
        <Field label="Fecha de pago (opcional)">
          <Input
            name="payment_date"
            type="date"
            defaultValue={expense?.payment_date ?? ""}
            max={today()}
          />
        </Field>
        <Field label="Medio de pago">
          <select
            name="payment_method"
            defaultValue={expense?.payment_method ?? ""}
          >
            <option value="">Sin especificar</option>
            <option>Efectivo</option>
            <option>Transferencia</option>
            <option>Tarjeta</option>
            <option>Otro</option>
          </select>
        </Field>
      </div>
      <Notes value={expense?.notes} />
    </SaveForm>
  );
}
export function MovementForm({
  data,
  day,
  payroll,
}: {
  data: Data;
  day?: Day;
  payroll?: Payroll;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const left = day
    ? balance(
        day.revenue_amount,
        data.collections.filter((c) => c.work_day_id === day.id),
      )
    : balance(
        payroll!.total_amount,
        data.payments.filter((p) => p.payroll_period_id === payroll!.id),
      );
  return (
    <SaveForm
      operation={day ? "collection" : "payment"}
      submitLabel={day ? "Registrar cobro" : "Registrar pago"}
    >
      <input type="hidden" name="idempotency_key" value={key} />
      <input
        type="hidden"
        name={day ? "work_day_id" : "payroll_period_id"}
        value={day?.id ?? payroll?.id}
      />
      <div className="callout">
        <strong>Saldo pendiente: {currency(left)}</strong>
        <p>
          {day
            ? dateLabel(day.work_date)
            : `${dateLabel(payroll!.start_date)} — ${dateLabel(payroll!.end_date)}`}
        </p>
      </div>
      <div className="form-grid">
        <Field label={day ? "Fecha de cobro" : "Fecha de pago"}>
          <Input
            name={day ? "collection_date" : "payment_date"}
            type="date"
            defaultValue={today()}
            max={today()}
            required
          />
        </Field>
        <Amount name="amount" defaultValue={left} />
      </div>
      <Field label="Medio de pago">
        <select name="payment_method">
          <option>Efectivo</option>
          <option>Transferencia</option>
          <option>Otro</option>
        </select>
      </Field>
      <Notes />
    </SaveForm>
  );
}
export function PayrollForm({ data }: { data: Data }) {
  const [employee, setEmployee] = useState(
      data.employees.find((e) => e.is_active)?.id ?? "",
    ),
    [chosen, setChosen] = useState(today()),
    [adjustment, setAdjustment] = useState("0");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewPayroll>
  > | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      previewPayroll(employee, chosen)
        .then((result) => {
          if (active) setPreview(result);
        })
        .catch(() => {
          if (active)
            setPreview({
              ok: false,
              start: "",
              end: "",
              gross: "0",
              days: 0,
              error:
                "No pudimos consultar el período. Volvé a seleccionar la fecha.",
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [employee, chosen]);
  return (
    <SaveForm
      operation="payroll"
      submitLabel="Cerrar liquidación"
      disableSubmit={!preview?.ok}
    >
      <Field label="Empleado">
        <select
          name="employee_id"
          value={employee}
          onChange={(e) => {
            setPreview(null);
            setEmployee(e.target.value);
          }}
        >
          {data.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Elegí una fecha dentro del período">
        <Input
          type="date"
          value={chosen}
          max={today()}
          onChange={(e) => {
            setPreview(null);
            setChosen(e.target.value);
          }}
        />
      </Field>
      <input name="start_date" type="hidden" value={preview?.start ?? ""} />
      <input name="end_date" type="hidden" value={preview?.end ?? ""} />
      <input name="expected_gross" type="hidden" value={preview?.gross ?? ""} />
      <input name="expected_days" type="hidden" value={preview?.days ?? ""} />
      <div className="payroll-preview" role="status">
        {preview?.ok ? (
          <>
            <Badge tone="blue">
              {dateLabel(preview.start)} — {dateLabel(preview.end)}
            </Badge>
            <div>
              <span>Jornadas efectivamente trabajadas</span>
              <strong>{preview.days}</strong>
            </div>
            <div>
              <span>Sueldo bruto calculado</span>
              <strong>{currency(preview.gross)}</strong>
            </div>
            <div>
              <span>Total con ajustes</span>
              <strong>
                {currency(sum([preview.gross, adjustment || "0"]))}
              </strong>
            </div>
          </>
        ) : preview ? (
          <p className="feedback error">{preview.error}</p>
        ) : (
          <p className="hint">
            Consultando las jornadas y el salario de ese período…
          </p>
        )}
      </div>
      <Field label="Ajuste o descuento (ARS)">
        <Input
          name="adjustments"
          type="number"
          step="0.01"
          value={adjustment}
          onChange={(e) => setAdjustment(e.target.value)}
          required
        />
      </Field>
      <Notes />
      <p className="callout">
        Al cerrar, los importes quedan conservados. Solo se pueden liquidar
        períodos completos finalizados. No se generan descuentos legales
        automáticos.
      </p>
    </SaveForm>
  );
}
