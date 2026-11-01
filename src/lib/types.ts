export type Model = "daily" | "weekly" | "biweekly" | "monthly";
export type Frequency = "weekly" | "biweekly" | "monthly";
import type { ServicePricing, ServiceType } from "./service-pricing";
export interface Vehicle {
  id: string;
  name: string;
  license_plate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  default_daily_rate: string | null;
  service_pricing?: ServicePricing | null;
  is_active: boolean;
  notes: string | null;
}
export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  role: "chofer" | "ayudante";
  is_active: boolean;
  notes: string | null;
}
export interface Assignment {
  id: string;
  employee_id: string;
  vehicle_id: string;
  role: string;
  start_date: string;
  end_date: string | null;
}
export interface Salary {
  id: string;
  employee_id: string;
  payment_model: Model | null;
  payment_frequency: Frequency | null;
  amount: string | null;
  valid_from: string;
  valid_until: string | null;
}
export interface Day {
  id: string;
  vehicle_id: string;
  work_date: string;
  worked: boolean;
  revenue_amount: string;
  work_type?: ServiceType | null;
  distance_km?: string | null;
  pricing_snapshot?: ServicePricing | null;
  notes: string | null;
  updated_at: string;
}
export interface Attendance {
  id: string;
  work_day_id: string;
  employee_id: string;
  role: string;
  salary_amount: string | null;
  salary_model: Model | null;
}
export interface Category {
  id: string;
  name: string;
  is_active: boolean;
}
export interface Expense {
  id: string;
  vehicle_id: string | null;
  category_id: string;
  expense_date: string;
  description: string;
  amount: string;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  voided_at: string | null;
  updated_at: string;
}
export interface Fuel {
  id: string;
  expense_id: string;
  tank_count: string;
  liters: string | null;
}
export interface Payroll {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  days_worked: number;
  gross_amount: string;
  adjustments: string;
  total_amount: string;
  notes: string | null;
  voided_at: string | null;
  closed_at: string;
}
export interface Payment {
  id: string;
  payroll_period_id: string;
  payment_date: string;
  amount: string;
  payment_method: string | null;
  notes: string | null;
  voided_at: string | null;
}
export interface Collection {
  id: string;
  work_day_id: string;
  collection_date: string;
  amount: string;
  payment_method: string | null;
  notes: string | null;
  voided_at: string | null;
  vehicle_id?: string;
  work_date?: string;
}
export interface Accrual {
  payroll_period_id?: string;
  employee_id?: string;
  accrual_date: string;
  vehicle_id: string | null;
  amount: string;
}
export interface Audit {
  id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  created_at: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}
export interface Data {
  vehicles: Vehicle[];
  employees: Employee[];
  assignments: Assignment[];
  salaries: Salary[];
  days: Day[];
  attendance: Attendance[];
  categories: Category[];
  expenses: Expense[];
  fuel: Fuel[];
  payroll: Payroll[];
  payments: Payment[];
  collections: Collection[];
  accruals: Accrual[];
  company: { name: string };
  audit: Audit[];
}
