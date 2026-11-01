"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Truck,
  Users,
  Wallet,
  ReceiptText,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { logout } from "@/app/actions";
const items = [
  ["/", "Inicio", LayoutDashboard],
  ["/registro", "Registro diario", CalendarDays],
  ["/camionetas", "Camionetas", Truck],
  ["/empleados", "Empleados", Users],
  ["/sueldos", "Sueldos", Wallet],
  ["/gastos", "Gastos", ReceiptText],
  ["/reportes", "Reportes", ChartNoAxesCombined],
  ["/configuracion", "Configuración", Settings],
] as const;
export function Shell({
  children,
  company,
  user,
}: {
  children: React.ReactNode;
  company: string;
  user: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false),
    [toast, setToast] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const listener = (e: Event) => {
      setToast((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(""), 3500);
    };
    window.addEventListener("saved", listener);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("saved", listener);
    };
  }, []);
  return (
    <div className="app-shell">
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {toast}
        </div>
      )}
      <div className="mobile-bar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Truck size={23} />
          </span>
          <span>
            Transporte<span className="brand-sub">Eduardo Martínez</span>
          </span>
        </Link>
        <button
          className="icon-button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <button
          aria-label="Cerrar navegación"
          className="nav-backdrop"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={"sidebar " + (open ? "is-open" : "")}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Truck size={25} />
          </span>
          <span>
            Transporte<span className="brand-sub">Eduardo Martínez</span>
          </span>
        </Link>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav>
          {items.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
              {path === href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-note">
            <ShieldCheck size={19} />
            <div>
              Tu empresa, en orden<small>Espacio privado y seguro</small>
            </div>
          </div>
          <div className="user-profile">
            <span className="avatar">EM</span>
            <div>
              <strong>{user}</strong>
              <small>Administrador</small>
            </div>
            <form action={logout}>
              <button
                className="icon-button"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            Administración <span>/</span>{" "}
            <strong>{items.find((i) => i[0] === path)?.[1] ?? "Inicio"}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            {company}
            <span className="avatar small">EM</span>
          </div>
        </header>
        <main>{children}</main>
        <footer className="app-footer">
          <span>Gestión Transporte Eduardo</span>
          <span>
            Administración simple. Decisiones claras. <ArrowUpRight size={13} />
          </span>
        </footer>
      </div>
    </div>
  );
}
