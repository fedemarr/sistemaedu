"use client";
import { useActionState, useState } from "react";
import { Truck, ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import { login, recover } from "@/app/actions";
import { Field, Input, Submit } from "./ui";
export function Login() {
  const [forgot, setForgot] = useState(false),
    [visible, setVisible] = useState(false);
  const [state, action] = useActionState(forgot ? recover : login, {
    ok: false,
    message: "",
  });
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Truck size={28} />
          </span>
          <span>
            Transporte<span className="brand-sub">Eduardo Martínez</span>
          </span>
        </div>
        <div>
          <span className="eyebrow light">CADA JORNADA CUENTA</span>
          <h1>
            El control de tu empresa.
            <br />
            <em>La tranquilidad de saber.</em>
          </h1>
          <p>
            Tu flota, tus jornadas y tus números.
            <br />
            Todo en un solo lugar, estés donde estés.
          </p>
          <div className="login-road">
            <Truck size={76} strokeWidth={1} />
            <div />
            <Truck size={62} strokeWidth={1} />
          </div>
        </div>
        <span className="login-note">
          <ShieldCheck size={17} /> Gestión privada · Buenos Aires, Argentina
        </span>
      </section>
      <section className="login-form-area">
        <div className="login-box">
          <div className="login-mark">
            <Truck size={28} />
          </div>
          <span className="eyebrow">BIENVENIDO A TU GESTIÓN</span>
          <h2>{forgot ? "Recuperá tu acceso" : "Todo listo para comenzar"}</h2>
          <p>
            {forgot
              ? "Te enviaremos un enlace para cambiar tu contraseña."
              : "Ingresá a tu espacio de administración."}
          </p>
          <form action={action} key={String(forgot)} className="edit-form">
            <Field label="Correo electrónico">
              <Input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="tu@correo.com"
                required
              />
            </Field>
            {!forgot && (
              <Field label="Contraseña">
                <div className="password-wrap">
                  <Input
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresá tu contraseña"
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setVisible(!visible)}
                    aria-label={
                      visible ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
            )}
            {state.message && (
              <p
                role="status"
                className={"feedback " + (state.ok ? "success" : "error")}
              >
                {state.message}
              </p>
            )}
            <Submit
              label={forgot ? "Enviar instrucciones" : "Ingresar al sistema"}
            />
          </form>
          <button className="recovery-link" onClick={() => setForgot(!forgot)}>
            {forgot
              ? "Volver al inicio de sesión"
              : "¿Olvidaste tu contraseña?"}
            <ArrowRight size={14} />
          </button>
          <div className="login-security">
            <ShieldCheck size={16} /> Acceso exclusivo para administración
          </div>
        </div>
        <small className="login-footer">
          Transporte Eduardo · Sistema de gestión
        </small>
      </section>
    </div>
  );
}
