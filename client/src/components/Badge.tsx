import type { EmployeeStatus, PayrollRunStatus } from '../api/types';

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'badge-active',
  INACTIVE: 'badge-inactive',
  COMPLETED: 'badge-completed',
  PENDING: 'badge-pending',
  PARTIAL: 'badge-partial',
  FAILED: 'badge-failed',
};

export function StatusBadge({ status }: { status: EmployeeStatus | PayrollRunStatus }) {
  return (
    <span className={`badge ${STATUS_CLASS[status] ?? 'badge-inactive'}`}>
      <span className="badge-dot" />
      {status.toLowerCase()}
    </span>
  );
}

export function RegimeBadge({ regime }: { regime: string }) {
  return <span className="chip">{regime} regime</span>;
}
