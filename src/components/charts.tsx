"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { currency, dates, report, sum } from "@/lib/domain";
import type { Data } from "@/lib/types";
const colors = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#06b6d4",
  "#64748b",
];
const compact = (v: number) =>
  Math.abs(v) >= 1000000
    ? `${(v / 1000000).toFixed(1)} M`
    : Math.abs(v) >= 1000
      ? `${Math.round(v / 1000)} mil`
      : String(v);
export function RevenueChart({
  data,
  start,
  end,
  vehicleId = "",
}: {
  data: Data;
  start: string;
  end: string;
  vehicleId?: string;
}) {
  const rows = dates(start, end).map((date) => ({
    date: date.slice(8) + "/" + date.slice(5, 7),
    Ingresos: Number(
      sum(
        data.days
          .filter(
            (d) =>
              d.work_date === date &&
              (!vehicleId || d.vehicle_id === vehicleId),
          )
          .map((d) => d.revenue_amount),
      ),
    ),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="#e9edf3"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            minTickGap={35}
            tick={{ fontSize: 11, fill: "#8894a7" }}
          />
          <YAxis
            tickFormatter={compact}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8894a7" }}
            width={65}
          />
          <Tooltip
            formatter={(v) => currency(Number(v))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5eaf1",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="Ingresos"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#revenue-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({
  data,
  start,
  end,
  vehicleId = "",
}: {
  data: Data;
  start: string;
  end: string;
  vehicleId?: string;
}) {
  const result = report(data, start, end, vehicleId);
  const rows = data.categories
    .map((c) => ({
      name: c.name,
      value: Number(
        sum(
          result.expenses
            .filter((e) => e.category_id === c.id)
            .map((e) => e.amount),
        ),
      ),
    }))
    .filter((c) => c.value > 0);
  return (
    <div className="category-chart">
      {rows.length ? (
        <>
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {rows.map((r, i) => (
                    <Cell key={r.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => currency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {rows.map((r, i) => (
              <div key={r.name}>
                <span style={{ background: colors[i % colors.length] }} />
                {r.name}
                <strong>{currency(r.value)}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="chart-empty">
          <div className="empty-donut" />
          <span>Todavía no hay gastos en este período</span>
        </div>
      )}
    </div>
  );
}
export function ComparisonChart({
  data,
  start,
  end,
}: {
  data: Data;
  start: string;
  end: string;
}) {
  const rows = data.vehicles.map((v) => {
    const r = report(data, start, end, v.id);
    return {
      name: v.name,
      Facturación: Number(r.revenue),
      Gastos: Number(r.cost),
      Sueldos: Number(r.salary),
    };
  });
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ left: 0, right: 16, top: 16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={compact}
            axisLine={false}
            tickLine={false}
            width={65}
            tick={{ fontSize: 11 }}
          />
          <Tooltip formatter={(v) => currency(Number(v))} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Facturación" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gastos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Sueldos" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function MonthlyChart({ data, year }: { data: Data; year: string }) {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const month = year + "-" + String(i + 1).padStart(2, "0");
    const end = new Date(Date.UTC(Number(year), i + 1, 0))
      .toISOString()
      .slice(0, 10);
    const r = report(data, month + "-01", end);
    return {
      name: [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ][i],
      Ingresos: Number(r.revenue),
      Costos: Number(r.cost) + Number(r.salary),
      Resultado: Number(r.net),
    };
  });
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={compact}
            axisLine={false}
            tickLine={false}
            width={65}
            tick={{ fontSize: 11 }}
          />
          <Tooltip formatter={(v) => currency(Number(v))} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Ingresos" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Costos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Resultado" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
