import { z } from "zod";
export const uuid = z.uuid();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Fecha inválida");
export const amount = z
  .string()
  .regex(
    /^\d{1,11}(\.\d{1,2})?$/,
    "Usá un importe positivo con hasta dos decimales",
  );
export const signedAmount = z
  .string()
  .regex(/^-?\d{1,11}(\.\d{1,2})?$/, "Importe inválido");
export const optionalAmount = z
  .union([amount, z.literal("")])
  .transform((v) => v || null);
export const text = z.string().trim().max(2000);
export const name = z.string().trim().min(1, "Completá el nombre").max(150);
export const optionalId = z
  .union([uuid, z.literal("")])
  .transform((v) => v || null);
export const model = z.enum(["daily", "weekly", "biweekly", "monthly"]);
export const frequency = z.enum(["weekly", "biweekly", "monthly"]);
