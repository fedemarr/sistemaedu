"use client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X,
  Check,
  LoaderCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { mutate } from "@/app/actions";
export function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={"button " + className} {...props}>
      {children}
    </button>
  );
}
export function Submit({
  label = "Guardar cambios",
  disabled = false,
}: {
  label?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <LoaderCircle size={16} className="spin" />
          Guardando…
        </>
      ) : (
        <>
          <Check size={16} />
          {label}
        </>
      )}
    </Button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
export function Amount({
  name,
  defaultValue,
  required = true,
  label = "Importe (ARS)",
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  label?: string;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        type="number"
        step="0.01"
        min="0"
        max="99999999999.99"
        inputMode="decimal"
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder="0,00"
      />
    </Field>
  );
}
export function SaveForm({
  children,
  operation,
  onSaved,
  submitLabel = "Guardar cambios",
  disableSubmit = false,
}: {
  children: ReactNode;
  operation: string;
  onSaved?: () => void;
  submitLabel?: string;
  disableSubmit?: boolean;
}) {
  const [state, action] = useActionState(mutate, { ok: false, message: "" });
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      ref.current?.closest("dialog")?.close();
      window.dispatchEvent(new CustomEvent("saved", { detail: state.message }));
      onSaved?.();
    }
  }, [state, onSaved, router]);
  return (
    <form ref={ref} action={action} className="edit-form">
      <input type="hidden" name="operation" value={operation} />
      {children}
      {state.message && (
        <p
          role="status"
          className={"feedback " + (state.ok ? "success" : "error")}
        >
          {state.message}
        </p>
      )}
      <div className="form-footer">
        <Submit label={submitLabel} disabled={disableSubmit} />
      </div>
    </form>
  );
}
export function Modal({
  title,
  trigger,
  children,
  wide = false,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  return (
    <>
      <button
        className="modal-trigger"
        onClick={() => {
          setOpened(true);
          ref.current?.showModal();
        }}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        className={wide ? "wide" : ""}
        aria-label={title}
        onClose={() => setOpened(false)}
        onClick={(e) => {
          if (e.target === ref.current) {
            ref.current.close();
            setOpened(false);
          }
        }}
      >
        <div className="dialog-head">
          <div>
            <small>TRANSPORTE EDUARDO</small>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar"
            onClick={() => ref.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        {opened && children}
      </dialog>
    </>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "neutral" | "blue";
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">—</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Table({
  headers,
  rows,
  search = true,
}: {
  headers: string[];
  rows: { key: string; search: string; cells: ReactNode[] }[];
  search?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const found = rows.filter((r) =>
    r.search.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")),
  );
  const pages = Math.max(1, Math.ceil(found.length / 15));
  const current = Math.min(page, pages - 1);
  return (
    <>
      {search && (
        <div className="table-tools">
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Buscar en la tabla"
              placeholder="Buscar en los registros…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <span>{found.length} registros</span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {found.slice(current * 15, current * 15 + 15).map((r) => (
              <tr key={r.key}>
                {r.cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!found.length && (
          <Empty
            title="Sin registros"
            description="Los movimientos que cargues aparecerán acá."
          />
        )}
      </div>
      <div className="pagination">
        <span>
          Página {current + 1} de {pages}
        </span>
        <button
          className="icon-button"
          disabled={current === 0}
          aria-label="Página anterior"
          onClick={() => setPage(current - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="icon-button"
          disabled={current === pages - 1}
          aria-label="Página siguiente"
          onClick={() => setPage(current + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
export function Notes({ value }: { value?: string | null }) {
  return (
    <Field label="Observaciones">
      <textarea
        name="notes"
        defaultValue={value ?? ""}
        rows={3}
        maxLength={2000}
        placeholder="Información adicional (opcional)"
      />
    </Field>
  );
}
export function VoidButton({ entity, id }: { entity: string; id: string }) {
  return (
    <Modal
      title="Anular registro"
      trigger={<span className="text-button danger">Anular</span>}
    >
      <SaveForm operation="void" submitLabel="Confirmar anulación">
        <input name="entity" value={entity} type="hidden" />
        <input name="id" value={id} type="hidden" />
        <p className="callout">
          El registro y su historial se conservarán. Esta acción deja sin efecto
          el movimiento en los resultados.
        </p>
        <Field label="Motivo de la anulación">
          <textarea
            name="reason"
            minLength={5}
            maxLength={1000}
            required
            rows={3}
          />
        </Field>
      </SaveForm>
    </Modal>
  );
}
