import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { employees as employeesApi, payroll } from '../api/endpoints';
import type { Employee } from '../api/types';
import { IconPlay, IconUsers } from '../components/icons';
import { Empty, FormError, Loading } from '../components/States';
import { useAuth } from '../context/auth';
import { useAsync } from '../hooks/useAsync';
import { currentPeriod, formatMoney, formatPeriod } from '../lib/format';

// Build a list of recent YYYY-MM periods (this month back 12 months).
function recentPeriods(count = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function RunPayrollPage() {
  const { employer } = useAuth();
  const currency = employer?.currency ?? 'INR';
  const navigate = useNavigate();

  const { data: emps, loading } = useAsync<Employee[]>(
    (signal) => employeesApi.list(signal),
    [],
  );

  const periods = useMemo(() => recentPeriods(), []);
  const [period, setPeriod] = useState(currentPeriod());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const activeCount = (emps ?? []).filter((e) => e.status === 'ACTIVE').length;

  async function onRun() {
    setRunning(true);
    setError(null);
    try {
      const { run } = await payroll.createRun({ period });
      // Land on the run result table (UC-12).
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setError(err as Error);
      setRunning(false);
    }
  }

  if (loading) return <Loading label="Loading employees…" />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Run payroll</h1>
          <div className="page-sub">
            Compute and persist a payslip for every active employee in one action.
          </div>
        </div>
      </div>

      {activeCount === 0 ? (
        <div className="card">
          <Empty
            icon={<IconUsers size={24} />}
            title="No active employees"
            text="Add at least one active employee before running payroll."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/employees')}>
                Go to employees
              </button>
            }
          />
        </div>
      ) : (
        <div className="card card-pad" style={{ maxWidth: 560 }}>
          <FormError error={error} />

          <div className="field mb-16">
            <label className="field-label" htmlFor="period">
              Pay period
            </label>
            <select
              id="period"
              className="select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {formatPeriod(p)}
                </option>
              ))}
            </select>
            <span className="field-hint">
              The ruleset effective for this period is pinned to the run (auditable).
            </span>
          </div>

          <div
            className="card"
            style={{
              background: 'var(--c-surface-sunken)',
              boxShadow: 'none',
              padding: '14px 16px',
              marginBottom: 18,
            }}
          >
            <div className="row-between">
              <span className="text-secondary">Active employees to process</span>
              <span className="mono fw-600" style={{ fontSize: 16 }}>
                {activeCount}
              </span>
            </div>
            <div className="row-between mt-8">
              <span className="text-secondary">Approx. total monthly pay</span>
              <span className="mono fw-600">
                {currency}{' '}
                {formatMoney(
                  (emps ?? [])
                    .filter((e) => e.status === 'ACTIVE')
                    .reduce((s, e) => s + e.payBasis.amount, 0),
                )}
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={onRun}
            disabled={running}
          >
            {running ? (
              <>
                <span className="spinner spinner-light" />
                Running payroll…
              </>
            ) : (
              <>
                <IconPlay size={16} />
                Run payroll for {formatPeriod(period)}
              </>
            )}
          </button>
          <p className="text-sm text-muted mt-16" style={{ textAlign: 'center' }}>
            Idempotent per period — re-running won’t double-pay.
          </p>
        </div>
      )}
    </>
  );
}
