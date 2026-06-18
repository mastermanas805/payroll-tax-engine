import { Link, useNavigate, useParams } from 'react-router-dom';
import { employees as employeesApi, payroll } from '../api/endpoints';
import type { Employee, Payslip } from '../api/types';
import { PayslipBreakdown } from '../components/PayslipView';
import { IconArrowLeft, IconShield } from '../components/icons';
import { ErrorState, Loading } from '../components/States';
import { useAuth } from '../context/auth';
import { useAsync } from '../hooks/useAsync';
import { currencySymbol, formatMoney, formatPeriod, initials } from '../lib/format';

interface PayslipBundle {
  payslip: Payslip;
  employee: Employee | null;
}

export function PayslipPage() {
  const { id = '' } = useParams();
  const { employer } = useAuth();
  const navigate = useNavigate();
  const currency = employer?.currency ?? 'INR';
  const sym = currencySymbol(currency);

  const { data, loading, error, reload } = useAsync<PayslipBundle>(
    async (signal) => {
      const payslip = await payroll.getPayslip(id, signal);
      let employee: Employee | null = null;
      try {
        employee = await employeesApi.get(payslip.employeeId, signal);
      } catch {
        employee = null;
      }
      return { payslip, employee };
    },
    [id],
  );

  if (loading) return <Loading label="Loading payslip…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { payslip, employee } = data;
  const { summary } = payslip.result;
  const name = employee?.name ?? payslip.employeeId;

  return (
    <div className="payslip">
      <div className="breadcrumb">
        <Link to="/runs">Payroll Runs</Link>
        <span className="sep">/</span>
        <Link to={`/runs/${payslip.runId}`}>{formatPeriod(payslip.period)}</Link>
        <span className="sep">/</span>
        <span>{name}</span>
      </div>

      <div className="row-between mb-16">
        <h1 className="page-title" style={{ fontSize: 20 }}>
          Payslip
        </h1>
        <button className="btn" onClick={() => navigate(`/runs/${payslip.runId}`)}>
          <IconArrowLeft size={16} />
          Back to run
        </button>
      </div>

      <div className="payslip-doc">
        {/* Header */}
        <div className="payslip-header">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <span className="avatar" style={{ width: 46, height: 46, fontSize: 16 }}>
              {initials(name)}
            </span>
            <div className="who">
              <span className="payslip-emp-name">{name}</span>
              <span className="payslip-period">
                {formatPeriod(payslip.period)} · {employer?.companyName}
              </span>
              {employee && (
                <span className="text-sm text-muted mt-8">
                  {employee.regime} regime · {employee.payBasis.type} {sym}
                  {formatMoney(employee.payBasis.amount)}
                </span>
              )}
            </div>
          </div>
          <div className="payslip-doc-meta">
            <span className="label">Net pay</span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-accent)' }}>
              {sym}
              {formatMoney(summary.netPay)}
            </span>
          </div>
        </div>

        {/* Summary strip */}
        <div className="payslip-summary-strip">
          <SummaryCell label="Gross" value={`${sym}${formatMoney(summary.gross)}`} />
          <SummaryCell
            label="Deductions"
            value={`−${sym}${formatMoney(summary.totalEmployeeDeductions)}`}
          />
          <SummaryCell label="Cost to company" value={`${sym}${formatMoney(summary.totalEmployerCost)}`} />
          <SummaryCell net label="Net pay" value={`${sym}${formatMoney(summary.netPay)}`} />
        </div>

        {/* Grouped breakdown */}
        <div className="payslip-body">
          <PayslipBreakdown result={payslip.result} currency={currency} variant="full" />
        </div>

        {/* Audit footer */}
        <div className="payslip-audit">
          <span className="audit-tag">
            <IconShield size={14} />
            <span className="k">Ruleset</span>
            <span className="v">{payslip.result.rulesetVersion}</span>
          </span>
          <span className="audit-tag">
            <span className="k">Trace</span>
            <span className="v">{payslip.result.traceId}</span>
          </span>
          <span className="audit-tag">
            <span className="k">Payslip</span>
            <span className="v">{payslip.id}</span>
          </span>
          <span className="audit-tag">
            <span className="k">Run</span>
            <span className="v">{payslip.runId}</span>
          </span>
        </div>
      </div>

      <p className="text-sm text-muted mt-16" style={{ textAlign: 'center' }}>
        This payslip is immutable. Re-running the same period reproduces it byte-for-byte
        from the pinned ruleset version.
      </p>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  net,
}: {
  label: string;
  value: string;
  net?: boolean;
}) {
  return (
    <div className={`summary-cell ${net ? 'net' : ''}`}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}
