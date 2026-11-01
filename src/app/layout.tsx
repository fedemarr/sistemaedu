import type { Metadata } from "next";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Transporte Eduardo · Gestión",
    template: "%s · Transporte Eduardo",
  },
  description: "Administración privada de flota, jornadas y finanzas",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
