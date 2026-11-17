"use client";
import Link from "next/link";
export default function Error() {
  return (
    <div className="page-loading">
      <h1>No pudimos cargar esta pantalla</h1>
      <p>
        Recargá la página para abrir la versión actual del sistema. Si estabas
        guardando un trabajo, verificá el registro antes de volver a cargarlo.
      </p>
      <button className="button" onClick={() => window.location.reload()}>
        Recargar página
      </button>
      <Link href="/" className="text-button">
        Ir al inicio
      </Link>
    </div>
  );
}
