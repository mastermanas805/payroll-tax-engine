import { http } from './client';
import type {
  AuthResponse,
  CalculationInput,
  CalculationResult,
  CreateEmployeePayload,
  CreateRunPayload,
  CreateRunResponse,
  Employee,
  LoginPayload,
  PayrollRun,
  Payslip,
  RegisterPayload,
  UpdateEmployeePayload,
} from './types';

// ---- Auth (UC-1, UC-2) ----
export const auth = {
  register: (body: RegisterPayload) =>
    http.post<AuthResponse>('/auth/register', body, { anonymous: true }),
  login: (body: LoginPayload) =>
    http.post<AuthResponse>('/auth/login', body, { anonymous: true }),
};

// ---- Employees (UC-3..UC-7) ----
export const employees = {
  list: (signal?: AbortSignal) => http.get<Employee[]>('/employees', signal),
  get: (id: string, signal?: AbortSignal) =>
    http.get<Employee>(`/employees/${id}`, signal),
  create: (body: CreateEmployeePayload) => http.post<Employee>('/employees', body),
  update: (id: string, body: UpdateEmployeePayload) =>
    http.patch<Employee>(`/employees/${id}`, body),
};

// ---- Payroll calculation + runs (UC-9..UC-15) ----
export const payroll = {
  // Live payslip preview — does NOT persist (UC-9).
  calculate: (body: CalculationInput, signal?: AbortSignal) =>
    http.post<CalculationResult>('/payroll/calculate', body, { signal }),

  // Execute a run for a period across active employees (UC-11).
  // Backend responds with { run, payslips }.
  createRun: (body: CreateRunPayload) =>
    http.post<CreateRunResponse>('/payroll/runs', body),

  // Payroll history (UC-15).
  listRuns: (signal?: AbortSignal) => http.get<PayrollRun[]>('/payroll/runs', signal),
  getRun: (id: string, signal?: AbortSignal) =>
    http.get<PayrollRun>(`/payroll/runs/${id}`, signal),

  // Payslips produced by a run (UC-12) and a single payslip (UC-13).
  runPayslips: (runId: string, signal?: AbortSignal) =>
    http.get<Payslip[]>(`/payroll/runs/${runId}/payslips`, signal),
  getPayslip: (id: string, signal?: AbortSignal) =>
    http.get<Payslip>(`/payslips/${id}`, signal),
};
