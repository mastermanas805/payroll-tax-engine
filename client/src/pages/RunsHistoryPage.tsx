import { useNavigate } from 'react-router-dom';
import { payroll } from '../api/endpoints';
import type { PayrollRun } from '../api/types';
import { StatusBadge } from '../components/Badge';
import { IconChevronRight, IconPlay, IconRuns } from '../components/icons';
import { Empty, ErrorState, TableSkeleton } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatPeriod } from '../lib/format';

export function RunsHistoryPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync<PayrollRun[]>(
    (signal) => payroll.listRuns(signal),
    [],
  );

  // Most recent first.
  const runs = (data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Payroll runs</h1>
          <div className="page-sub">Every monthly run, with its status and payslip count.</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/runs/new')}>
          <IconPlay size={16} />
          Run payroll
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading && <TableSkeleton rows={5} cols={4} />}

          {error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && runs.length === 0 && (
            <Empty
              icon={<IconRuns size={24} />}
              title="No payroll runs yet"
              text="Run payroll for a period and it’ll appear here with a full audit trail."
              action={
                <button className="btn btn-primary" onClick={() => navigate('/runs/new')}>
                  <IconPlay size={16} />
                  Run payroll
                </button>
              }
            />
          )}

          {!loading && !error && runs.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th className="num">Payslips</th>
                  <th>Run on</th>
                  <th aria-label="open" />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => navigate(`/runs/${r.id}`)}
                  >
                    <td className="fw-600">{formatPeriod(r.period)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="num">{r.payslipCount}</td>
                    <td className="text-secondary">{formatDate(r.createdAt)}</td>
                    <td className="num">
                      <IconChevronRight size={16} style={{ color: 'var(--c-text-muted)' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
