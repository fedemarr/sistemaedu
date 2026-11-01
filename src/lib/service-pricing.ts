import Decimal from "decimal.js";
import { z } from "zod";
import { amount } from "./validation";

export const serviceType = z.enum([
  "colecta",
  "ultima_milla",
  "voluminoso",
  "fija",
  "ambulancia_100",
  "ambulancia_50",
  "ambulancia_chica",
]);
export type ServiceType = z.infer<typeof serviceType>;
const deliveryPricingSchema = z.object({
  colecta: amount,
  ultima_milla: amount,
  voluminoso_50: amount,
  voluminoso_80: amount,
  voluminoso_110: amount,
  voluminoso_140: amount,
  voluminoso_180: amount,
});
const ambulancePricingSchema = z.object({
  fija: amount,
  ambulancia_100: amount,
  ambulancia_50: amount,
  ambulancia_chica: amount,
});
export const servicePricingSchema = z.union([
  deliveryPricingSchema,
  ambulancePricingSchema,
]);
export type ServicePricing = z.infer<typeof servicePricingSchema>;
export const SERVICE_LABELS = {
  colecta: "Colecta",
  ultima_milla: "Última milla",
  voluminoso: "Voluminoso",
  fija: "Jornada fija",
  ambulancia_100: "Ambulancia · 100%",
  ambulancia_50: "Ambulancia · 50%",
  ambulancia_chica: "Ambulancia chica",
};
export const SERVICE_BANDS = [
  { max: 50, key: "voluminoso_50", label: "0 a 50 km" },
  { max: 80, key: "voluminoso_80", label: "Más de 50 hasta 80 km" },
  { max: 110, key: "voluminoso_110", label: "Más de 80 hasta 110 km" },
  { max: 140, key: "voluminoso_140", label: "Más de 110 hasta 140 km" },
  { max: 180, key: "voluminoso_180", label: "Más de 140 hasta 180 km" },
] as const;
export function availableServices(pricing: ServicePricing): ServiceType[] {
  return "fija" in pricing
    ? ["fija", "ambulancia_100", "ambulancia_50", "ambulancia_chica"]
    : ["colecta", "ultima_milla", "voluminoso"];
}
export function pricingRateFields(pricing: ServicePricing) {
  if ("fija" in pricing)
    return availableServices(pricing).map((type) => ({
      key: type,
      label: SERVICE_LABELS[type],
      amount: pricing[type as keyof typeof pricing],
    }));
  return [
    { key: "colecta", label: SERVICE_LABELS.colecta, amount: pricing.colecta },
    {
      key: "ultima_milla",
      label: SERVICE_LABELS.ultima_milla,
      amount: pricing.ultima_milla,
    },
    ...SERVICE_BANDS.map((b) => ({
      key: b.key,
      label: "Voluminoso · " + b.label,
      amount: pricing[b.key],
    })),
  ];
}
export function serviceQuote(
  pricing: ServicePricing,
  type: ServiceType,
  kilometers = "",
) {
  if (!availableServices(pricing).includes(type))
    throw new Error(
      "Ese tipo de trabajo no está habilitado para esta camioneta.",
    );
  if (type !== "voluminoso")
    return {
      amount: new Decimal((pricing as Record<string, string>)[type]).toFixed(2),
      band: "Tarifa fija por jornada",
    };
  if (!("voluminoso_50" in pricing))
    throw new Error("Esta camioneta no tiene tarifa por kilómetros.");
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
