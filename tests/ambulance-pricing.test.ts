import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableServices,
  serviceQuote,
  servicePricingSchema,
  workDescription,
  pricingRateFields,
} from "../src/lib/service-pricing";
const pricing = servicePricingSchema.parse({
  fija: "200000.00",
  ambulancia_100: "200000.00",
  ambulancia_50: "100000.00",
  ambulancia_chica: "80000.00",
});
test("camioneta 1: tarifa fija, ambulancia 100%, 50% y chica", () => {
  for (const [service, total] of [
    ["fija", "200000.00"],
    ["ambulancia_100", "200000.00"],
    ["ambulancia_50", "100000.00"],
    ["ambulancia_chica", "80000.00"],
  ] as const)
    assert.equal(serviceQuote(pricing, service).amount, total);
  assert.deepEqual(availableServices(pricing), [
    "fija",
    "ambulancia_100",
    "ambulancia_50",
    "ambulancia_chica",
  ]);
  assert.equal(pricingRateFields(pricing).length, 4);
  assert.equal(
    workDescription({ work_type: "ambulancia_chica" }),
    "Ambulancia chica",
  );
});
test("las opciones de una camioneta no se ofrecen ni se calculan en la otra", () => {
  assert.throws(() => serviceQuote(pricing, "colecta"), /no está habilitado/);
  assert.throws(
    () => serviceQuote(pricing, "voluminoso", "95"),
    /no está habilitado/,
  );
  const delivery = servicePricingSchema.parse({
    colecta: "180000",
    ultima_milla: "200000",
    voluminoso_50: "174000",
    voluminoso_80: "197000",
    voluminoso_110: "227000",
    voluminoso_140: "243000",
    voluminoso_180: "259000",
  });
  assert.throws(
    () => serviceQuote(delivery, "ambulancia_chica"),
    /no está habilitado/,
  );
  assert.deepEqual(availableServices(delivery), [
    "colecta",
    "ultima_milla",
    "voluminoso",
  ]);
});
test("los importes de ambulancia conservan su tarifario histórico", () => {
  const changed = servicePricingSchema.parse({
    ...pricing,
    ambulancia_chica: "90000",
  });
  assert.equal(serviceQuote(changed, "ambulancia_chica").amount, "90000.00");
  assert.equal(serviceQuote(pricing, "ambulancia_chica").amount, "80000.00");
});
