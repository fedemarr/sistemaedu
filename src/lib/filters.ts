import { z } from "zod";
import { date } from "./validation";
import { today, period } from "./domain";
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
) {
  const str = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : "";
  const validDate = (v: string, fallback: string) =>
    date.safeParse(v).success ? v : fallback;
  const current = today();
  const selected = validDate(str("date"), current);
  const month = /^\d{4}-(0[1-9]|1[012])$/.test(str("month"))
    ? str("month")
    : selected.slice(0, 7);
  const [ms, me] = period(month + "-01", "monthly");
  let start = validDate(str("from"), ms),
    end = validDate(str("to"), me);
  if (start > end) [start, end] = [end, start];
  if (new Date(end).getTime() - new Date(start).getTime() > 366 * 86400000)
    end = period(start, "monthly")[1];
  const vehicle = z.uuid().safeParse(str("vehicle")).success
    ? str("vehicle")
    : "";
  const category = z.uuid().safeParse(str("category")).success
    ? str("category")
    : "";
  // Load complete calendar years for salary previews and the monthly comparison, plus the current week.
  const lower = [
    start.slice(0, 4) + "-01-01",
    selected.slice(0, 4) + "-01-01",
    month.slice(0, 4) + "-01-01",
    period(current, "weekly")[0],
    current.slice(0, 4) + "-01-01",
  ].sort()[0];
  const upper = [end, selected, me, current].sort().at(-1)!;
  return {
    current,
    selected,
    month,
    start,
    end,
    vehicle,
    category,
    lower,
    upper,
  };
}
