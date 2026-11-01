"use client";
import Link from "next/link";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page-loading">
      <h1>No pudimos cargar esta pantalla</h1>
      <p>
        Revisá la conexión y volvé a intentar. Tus registros están guardados.
      </p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
      <Link href="/" className="text-button">
        Ir al inicio
      </Link>
    </div>
  );
}
