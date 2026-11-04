import { Plus, CheckCircle2 } from "lucide-react";
import type { Data, Vehicle } from "@/lib/types";
import { currency } from "@/lib/domain";
import { workDescription } from "@/lib/service-pricing";
import { Badge, Modal } from "./ui";
import { DayForm } from "./forms";

export function VehicleJournals({
  data,
  vehicle,
  date,
  dashboard = false,
}: {
  data: Data;
  vehicle: Vehicle;
  date: string;
  dashboard?: boolean;
}) {
  const days = data.days
    .filter((d) => d.vehicle_id === vehicle.id && d.work_date === date)
    .sort((a, b) => (a.shift_number ?? 1) - (b.shift_number ?? 1));
  return (
    <div className="vehicle-journals">
      {days.map((day) => (
        <section
          className="shift-row"
          key={day.id}
          aria-label={"Jornada " + (day.shift_number ?? 1)}
        >
          <div className="shift-heading">
            <strong>Jornada {day.shift_number ?? 1}</strong>
            <Badge tone={day.worked ? "green" : "neutral"}>
              {day.worked ? "Trabajó" : "Sin actividad"}
            </Badge>
            <strong className="shift-amount">
              {currency(day.revenue_amount)}
            </strong>
          </div>
          {day.worked && (
            <>
              <p className="hint">
                {workDescription(day) || "Trabajo registrado"}
              </p>
              <div className="vehicle-crew">
                {(["chofer", "ayudante"] as const).map((role) => {
                  const a = data.attendance.find(
                      (a) => a.work_day_id === day.id && a.role === role,
                    ),
                    e = data.employees.find((e) => e.id === a?.employee_id);
                  return (
                    <div key={role}>
                      <span>{role === "chofer" ? "Chofer" : "Ayudante"}</span>
                      <strong>
                        {e ? e.first_name + " " + e.last_name : "Sin registrar"}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <Modal
            title={
              "Editar jornada " + (day.shift_number ?? 1) + " · " + vehicle.name
            }
            trigger={<span className="button secondary">Editar registro</span>}
          >
            <DayForm data={data} vehicle={vehicle} date={date} day={day} />
          </Modal>
        </section>
      ))}
      {!days.length && (
        <div className="journal-actions">
          <Modal
            title={"Registrar jornada 1 · " + vehicle.name}
            trigger={
              <span className="button">
                <CheckCircle2 size={16} />
                {dashboard ? "Se trabajó hoy" : "Registrar jornada"}
              </span>
            }
          >
            <DayForm data={data} vehicle={vehicle} date={date} />
          </Modal>
          <Modal
            title={"Sin actividad · " + vehicle.name}
            trigger={<span className="button secondary">No se trabajó</span>}
          >
            <DayForm data={data} vehicle={vehicle} date={date} worked={false} />
          </Modal>
        </div>
      )}
      {!!days.length &&
        !days.some((d) => d.shift_number === 2) &&
        vehicle.is_active && (
          <Modal
            title={"Segunda jornada · " + vehicle.name}
            trigger={
              <span className="button secondary add-shift">
                <Plus size={17} />
                Agregar segunda jornada
              </span>
            }
          >
            <DayForm
              data={data}
              vehicle={vehicle}
              date={date}
              shiftNumber={2}
            />
          </Modal>
        )}
    </div>
  );
}
