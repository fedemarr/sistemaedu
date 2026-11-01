import Decimal from "decimal.js";
import { z } from "zod";
import { amount } from "./validation";

export const serviceType = z.enum(["colecta", "ultima_milla", "voluminoso"]);
export type ServiceType = z.infer<typeof serviceType>;
export const servicePricingSchema = z.object({
  colecta: amount,
  ultima_milla: amount,
  voluminoso_50: amount,
  voluminoso_80: amount,
  voluminoso_110: amount,
  voluminoso_140: amount,
  voluminoso_180: amount,
});
export type ServicePricing = z.infer<typeof servicePricingSchema>;
export const SERVICE_LABELS = {
  colecta: "Colecta",
  ultima_milla: "Última milla",
  voluminoso: "Voluminoso",
};
export const SERVICE_BANDS = [
  { max: 50, key: "voluminoso_50", label: "0 a 50 km" },
  { max: 80, key: "voluminoso_80", label: "Más de 50 hasta 80 km" },
  { max: 110, key: "voluminoso_110", label: "Más de 80 hasta 110 km" },
  { max: 140, key: "voluminoso_140", label: "Más de 110 hasta 140 km" },
  { max: 180, key: "voluminoso_180", label: "Más de 140 hasta 180 km" },
] as const;
export function serviceQuote(
  pricing: ServicePricing,
  type: ServiceType,
  kilometers = "",
) {
  if (type !== "voluminoso")
    return {
      amount: new Decimal(pricing[type]).toFixed(2),
      band: "Tarifa fija por jornada",
    };
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(kilometers))
    throw new Error(
      "Ingresá los kilómetros recorridos, con hasta dos decimales.",
    );
  const km = new Decimal(kilometers);
  const band = SERVICE_BANDS.find((b) => km.lte(b.max));
  if (!band)
    throw new Error(
      "No hay tarifa definida para más de 180 km. Revisá los kilómetros antes de guardar.",
    );
  return {
    amount: new Decimal(pricing[band.key]).toFixed(2),
    band: band.label,
  };
}
export function workDescription(day: {
  work_type?: ServiceType | null;
  distance_km?: string | null;
}) {
  return day.work_type
    ? SERVICE_LABELS[day.work_type] +
        (day.work_type === "voluminoso" ? ` · ${day.distance_km} km` : "")
    : "";
}
