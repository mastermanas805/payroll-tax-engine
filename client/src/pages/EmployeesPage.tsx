import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employees as employeesApi } from '../api/endpoints';
import type { Employee } from '../api/types';
import { StatusBadge } from '../components/Badge';
import { EmployeeDrawer } from '../components/EmployeeDrawer';
import {
  IconChevronRight,
  IconPlus,
  IconSearch,
  IconUsers,
} from '../components/icons';
import { Empty, ErrorState, TableSkeleton } from '../components/States';
import { useAuth } from '../context/auth';
import { useAsync } from '../hooks/useAsync';
import { formatMoney, initials } from '../lib/format';

export function EmployeesPage() {
  const { employer } = useAuth();
  const currency = employer?.currency ?? 'INR';
  const navigate = useNavigate();

  const { data, loading, error, reload } = useAsync<Employee[]>(
    (signal) => employeesApi.list(signal),
    [],
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => e.name.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Employees</h1>
          <div className="page-sub">
            People on your payroll. Add someone to preview their payslip live.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
          <IconPlus size={17} />
          Add employee
        </button>
      </div>

      <div className="card">
        {!loading && !error && (data?.length ?? 0) > 0 && (
          <div className="toolbar" style={{ padding: '14px 16px 0', margin: 0 }}>
            <div className="search">
              <IconSearch size={16} />
              <input
                className="input"
                placeholder="Search by name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted">
              {filtered.length} of {data?.length} shown
            </span>
          </div>
        )}

        <div className="table-wrap">
          {loading && <TableSkeleton rows={6} cols={5} />}

          {error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && (data?.length ?? 0) === 0 && (
            <Empty
              icon={<IconUsers size={24} />}
              title="No employees yet"
              text="Add your first employee to start running payroll. You’ll see a live payslip preview as you type."
              action={
                <button className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
                  <IconPlus size={17} />
                  Add employee
                </button>
              }
            />
          )}

          {!loading && !error && filtered.length === 0 && (data?.length ?? 0) > 0 && (
            <Empty title="No matches" text={`No employee matches “${query}”.`} />
          )}

          {!loading && !error && filtered.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Regime</th>
                  <th className="num">Pay basis</th>
                  <th className="num">Monthly amount</th>
                  <th>Status</th>
                  <th aria-label="open" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="clickable"
                    onClick={() => navigate(`/employees/${e.id}`)}
                  >
                    <td>
                      <div className="name-cell">
                        <span className="avatar">{initials(e.name)}</span>
                        <div className="stack">
                          <span className="fw-600">{e.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="chip">{e.regime}</span>
                    </td>
                    <td className="num">{e.payBasis.type}</td>
                    <td className="num">
                      {currency} {formatMoney(e.payBasis.amount)}
                    </td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
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

      {drawerOpen && (
        <EmployeeDrawer
          mode="create"
          onClose={() => setDrawerOpen(false)}
          onSaved={(emp) => {
            setDrawerOpen(false);
            reload();
            navigate(`/employees/${emp.id}`);
          }}
        />
      )}
    </>
  );
}
