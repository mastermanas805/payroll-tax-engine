import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { employees as employeesApi } from '../api/endpoints';
import type { Employee } from '../api/types';
import { RegimeBadge, StatusBadge } from '../components/Badge';
import { EmployeeDrawer } from '../components/EmployeeDrawer';
import { IconArrowLeft, IconEdit } from '../components/icons';
import { ErrorState, Loading } from '../components/States';
import { useAuth } from '../context/auth';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatMoney, initials } from '../lib/format';

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { employer } = useAuth();
  const navigate = useNavigate();
  const currency = employer?.currency ?? 'INR';

  const { data, loading, error, reload } = useAsync<Employee>(
    (signal) => employeesApi.get(id, signal),
    [id],
  );

  const [editing, setEditing] = useState(false);

  if (loading) return <Loading label="Loading employee…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const decl = data.declarations;
  const hasDeclarations =
    decl.rentPaid != null || decl.section80C != null || decl.metro != null;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/employees">Employees</Link>
        <span className="sep">/</span>
        <span>{data.name}</span>
      </div>

      <div className="page-head">
        <div className="name-cell" style={{ gap: 14 }}>
          <span className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
            {initials(data.name)}
          </span>
          <div className="stack gap-4">
            <h1 className="page-title" style={{ fontSize: 20 }}>
              {data.name}
            </h1>
            <div className="row gap-8">
              <StatusBadge status={data.status} />
              <RegimeBadge regime={data.regime} />
            </div>
          </div>
        </div>
        <div className="row gap-8">
          <button className="btn" onClick={() => navigate('/employees')}>
            <IconArrowLeft size={16} />
            Back
          </button>
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            <IconEdit size={16} />
            Edit
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
          <Detail label="Pay basis" value={data.payBasis.type === 'CTC' ? 'Cost to company' : 'Gross'} />
          <Detail
            label={`Monthly ${data.payBasis.type === 'CTC' ? 'CTC' : 'gross'}`}
            value={`${currency} ${formatMoney(data.payBasis.amount)}`}
            mono
          />
          <Detail label="Tax regime" value={`${data.regime} regime`} />
          <Detail label="Status" value={data.status} />
          <Detail label="Added" value={formatDate(data.createdAt)} />
          <Detail label="Last updated" value={formatDate(data.updatedAt)} />
        </div>

        {data.regime === 'OLD' && hasDeclarations && (
          <>
            <div className="fieldset-legend mt-24" style={{ paddingBottom: 8 }}>
              Declarations
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
              <Detail
                label="Monthly rent paid"
                value={decl.rentPaid != null ? `${currency} ${formatMoney(decl.rentPaid)}` : '—'}
                mono
              />
              <Detail
                label="80C investments"
                value={decl.section80C != null ? `${currency} ${formatMoney(decl.section80C)}` : '—'}
                mono
              />
              <Detail label="Metro city" value={decl.metro ? 'Yes' : 'No'} />
            </div>
          </>
        )}
      </div>

      {editing && (
        <EmployeeDrawer
          mode="edit"
          initial={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="stack gap-4">
      <span className="field-label">{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: 15, fontWeight: 550 }}>
        {value}
      </span>
    </div>
  );
}
