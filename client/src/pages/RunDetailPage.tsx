import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { employees as employeesApi, payroll } from '../api/endpoints';
import type { Employee, Payslip, PayrollRun } from '../api/types';
import { StatusBadge } from '../components/Badge';
import { IconChevronRight, IconReceipt } from '../components/icons';
import { Empty, ErrorState, Loading } from '../components/States';
import { useAuth } from '../context/auth';
import { useAsync } from '../hooks/useAsync';
import { formatMoney, formatPeriod, initials } from '../lib/format';

interface RunBundle {
  run: PayrollRun;
  payslips: Payslip[];
  employees: Record<string, Employee>;
}

export function RunDetailPage() {
  const { id = '' } = useParams();
  const { employer } = useAuth();
  const navigate = useNavigate();
  const currency = employer?.currency ?? 'INR';

  const { data, loading, error, reload } = useAsync<RunBundle>(
    async (signal) => {
      const [run, payslips, empList] = await Promise.all([
        payroll.getRun(id, signal),
        payroll.runPayslips(id, signal),
        employeesApi.list(signal),
      ]);
      const employees: Record<string, Employee> = {};
      for (const e of empList) employees[e.id] = e;
      return { run, payslips, employees };
    },
    [id],
  );

  const totals = useMemo(() => {
    const slips = data?.payslips ?? [];
    return slips.reduce(
      (acc, p) => {
        const s = p.result.summary;
        acc.gross += s.gross;
        acc.deductions += s.totalEmployeeDeductions;
        acc.net += s.netPay;
        acc.cost += s.totalEmployerCost;
        return acc;
      },
      { gross: 0, deductions: 0, net: 0, cost: 0 },
    );
  }, [data]);

  if (loading) return <Loading label="Loading run…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { run, payslips, employees } = data;
  const failed = run.failedEmployeeIds ?? [];

  return (
    <>
      <div className="breadcrumb">
        <Link to="/runs">Payroll Runs</Link>
        <span className="sep">/</span>
        <span>{formatPeriod(run.period)}</span>
      </div>

      <div className="page-head">
        <div>
          <h1 className="page-title">Payroll — {formatPeriod(run.period)}</h1>
          <div className="page-sub row gap-8" style={{ marginTop: 6 }}>
            <StatusBadge status={run.status} />
            <span className="text-muted">·</span>
            <span>{run.payslipCount} payslips</span>
          </div>
        </div>
      </div>

      {run.status === 'PARTIAL' && failed.length > 0 && (
        <div className="alert alert-warning mb-16">
          <span>
            <strong>{failed.length}</strong> employee
            {failed.length > 1 ? 's' : ''} failed to process and were isolated from the
            run. The rest were paid normally.
          </span>
        </div>
      )}

      {/* Company totals (UC-12) */}
      <div className="total-band">
        <div className="cell">
          <span className="label">Total gross</span>
          <span className="value">
            {currency} {formatMoney(totals.gross)}
          </span>
        </div>
        <div className="cell">
          <span className="label">Total deductions</span>
          <span className="value">
            {currency} {formatMoney(totals.deductions)}
          </span>
        </div>
        <div className="cell accent">
          <span className="label">Total net pay</span>
          <span className="value">
            {currency} {formatMoney(totals.net)}
          </span>
        </div>
        <div className="cell">
          <span className="label">Total cost to company</span>
          <span className="value">
            {currency} {formatMoney(totals.cost)}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {payslips.length === 0 ? (
            <Empty
              icon={<IconReceipt size={24} />}
              title="No payslips in this run"
              text="This run produced no payslips."
            />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Gross</th>
                  <th className="num">Deductions</th>
                  <th className="num">Net pay</th>
                  <th className="num">Employer cost</th>
                  <th aria-label="open" />
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => {
                  const emp = employees[p.employeeId];
                  const s = p.result.summary;
                  return (
                    <tr
                      key={p.id}
                      className="clickable"
                      onClick={() => navigate(`/payslips/${p.id}`)}
                    >
                      <td>
                        <div className="name-cell">
                          <span className="avatar">
                            {initials(emp?.name ?? '??')}
                          </span>
                          <span className="fw-600">{emp?.name ?? p.employeeId}</span>
                        </div>
                      </td>
                      <td className="num">{formatMoney(s.gross)}</td>
                      <td className="num">{formatMoney(s.totalEmployeeDeductions)}</td>
                      <td className="num fw-600">{formatMoney(s.netPay)}</td>
                      <td className="num">{formatMoney(s.totalEmployerCost)}</td>
                      <td className="num">
                        <IconChevronRight size={16} style={{ color: 'var(--c-text-muted)' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Company total ({payslips.length})</td>
                  <td className="num">{formatMoney(totals.gross)}</td>
                  <td className="num">{formatMoney(totals.deductions)}</td>
                  <td className="num">{formatMoney(totals.net)}</td>
                  <td className="num">{formatMoney(totals.cost)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
