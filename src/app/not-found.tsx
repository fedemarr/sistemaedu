import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-loading">
      <h1>No encontramos esa página</h1>
      <Link href="/" className="button">
        Volver al inicio
      </Link>
    </div>
  );
}
