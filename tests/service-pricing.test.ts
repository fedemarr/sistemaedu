import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serviceQuote,
  servicePricingSchema,
  workDescription,
  type ServicePricing,
} from "../src/lib/service-pricing";
const pricing: ServicePricing = {
  colecta: "180000",
  ultima_milla: "200000",
  voluminoso_50: "174000",
  voluminoso_80: "197000",
  voluminoso_110: "227000",
  voluminoso_140: "243000",
  voluminoso_180: "259000",
};
test("colecta y última milla tienen importe fijo y no requieren kilómetros", () => {
  assert.equal(serviceQuote(pricing, "colecta").amount, "180000.00");
  assert.equal(serviceQuote(pricing, "ultima_milla").amount, "200000.00");
});
test("voluminoso calcula el importe total por tramo, incluidos todos los límites", () => {
  for (const [km, expected] of [
    ["0", "174000.00"],
    ["49.99", "174000.00"],
    ["50", "174000.00"],
    ["50.01", "197000.00"],
    ["80", "197000.00"],
    ["80.01", "227000.00"],
    ["95", "227000.00"],
    ["110", "227000.00"],
    ["110.01", "243000.00"],
    ["140", "243000.00"],
    ["140.01", "259000.00"],
    ["180", "259000.00"],
  ])
    assert.equal(serviceQuote(pricing, "voluminoso", km).amount, expected, km);
});
test("sin km válidos o por encima de 180 no inventa tarifas", () => {
  for (const km of ["", "-1", "NaN", "Infinity", "180.01", "500", "5.555"])
    assert.throws(() => serviceQuote(pricing, "voluminoso", km));
});
test("el tarifario guardado conserva los importes al cambiar la configuración", () => {
  const snapshot = servicePricingSchema.parse(pricing);
  const changed = { ...pricing, voluminoso_110: "300000" };
  assert.equal(serviceQuote(snapshot, "voluminoso", "95").amount, "227000.00");
  assert.equal(serviceQuote(changed, "voluminoso", "95").amount, "300000.00");
  assert.equal(
    workDescription({ work_type: "voluminoso", distance_km: "95.00" }),
    "Voluminoso · 95.00 km",
  );
});
