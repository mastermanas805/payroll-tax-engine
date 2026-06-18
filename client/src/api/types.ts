// Client-side mirror of the backend's frozen shared contract types
// (src/shared/types/*). Kept in sync by hand because the SPA is a separate
// package. Only the shapes the UI actually consumes are mirrored here.

export type Category =
  | 'EARNING'
  | 'EMPLOYEE_DEDUCTION'
  | 'EMPLOYER_CONTRIBUTION'
  | 'TAX'
  | 'EXEMPTION'
  | 'INFO';

export type Regime = 'OLD' | 'NEW';
export type PayBasisType = 'CTC' | 'GROSS';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';
export type PayrollRunStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

export interface PayBasis {
  type: PayBasisType;
  amount: number;
}

export interface Declarations {
  rentPaid?: number;
  section80C?: number;
  metro?: boolean;
  nationality?: string;
}

export interface LineItem {
  category: Category;
  label: string;
  amount: number;
  ruleKey: string;
  explanation?: string;
}

export interface Breakdown {
  earnings: LineItem[];
  employeeDeductions: LineItem[];
  employerContributions: LineItem[];
  taxes: LineItem[];
  exemptions: LineItem[];
}

export interface PayrollSummary {
  gross: number;
  totalEmployeeDeductions: number;
  netPay: number;
  totalEmployerCost: number;
  ctc: number;
}

export interface CalculationResult {
  breakdown: Breakdown;
  summary: PayrollSummary;
  rulesetVersion: string;
  traceId: string;
}

export interface CalculationInput {
  payBasis: PayBasis;
  declarations: Declarations;
  period: string;
  regime: string;
}

// Employer as returned to the client (passwordHash is never serialized).
export interface Employer {
  id: string;
  companyName: string;
  email: string;
  country: string;
  currency: string;
  state?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employerId: string;
  name: string;
  payBasis: PayBasis;
  regime: string;
  declarations: Declarations;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  employerId: string;
  period: string;
  status: PayrollRunStatus;
  payslipCount: number;
  failedEmployeeIds?: string[];
  createdAt: string;
}

export interface Payslip {
  id: string;
  employerId: string;
  runId: string;
  employeeId: string;
  period: string;
  result: CalculationResult;
  createdAt: string;
}

// ---- Request payloads ----

export interface RegisterPayload {
  companyName: string;
  country: string;
  currency: string;
  state?: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  employer: Employer;
}

// POST /payroll/runs returns the run plus the payslips it produced.
export interface CreateRunResponse {
  run: PayrollRun;
  payslips: Payslip[];
}

export interface CreateEmployeePayload {
  name: string;
  payBasis: PayBasis;
  regime: string;
  declarations: Declarations;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload> & {
  status?: EmployeeStatus;
};

export interface CreateRunPayload {
  period: string;
}

// The error envelope emitted by DomainExceptionFilter.
export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
  path?: string;
  timestamp?: string;
}
