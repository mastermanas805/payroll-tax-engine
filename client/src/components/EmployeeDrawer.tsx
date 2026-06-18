import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { employees as employeesApi, payroll } from '../api/endpoints';
import type {
  CalculationResult,
  CreateEmployeePayload,
  Declarations,
  Employee,
  PayBasisType,
  UpdateEmployeePayload,
} from '../api/types';
import { useAuth } from '../context/auth';
import { useDebounced } from '../hooks/useAsync';
import { currentPeriod } from '../lib/format';
import { IconCalc, IconClose } from './icons';
import { PayslipBreakdown } from './PayslipView';
import { FormError } from './States';

interface DrawerProps {
  mode: 'create' | 'edit';
  initial?: Employee;
  onClose: () => void;
  onSaved: (emp: Employee) => void;
}

interface FormShape {
  name: string;
  payType: PayBasisType;
  amount: string;
  regime: string;
  rentPaid: string;
  section80C: string;
  metro: boolean;
}

function fromEmployee(e?: Employee): FormShape {
  return {
    name: e?.name ?? '',
    payType: e?.payBasis.type ?? 'CTC',
    amount: e ? String(e.payBasis.amount) : '',
    regime: e?.regime ?? 'NEW',
    rentPaid: e?.declarations.rentPaid != null ? String(e.declarations.rentPaid) : '',
    section80C: e?.declarations.section80C != null ? String(e.declarations.section80C) : '',
    metro: e?.declarations.metro ?? false,
  };
}

interface DeclFields {
  regime: string;
  rentPaid: string;
  section80C: string;
  metro: boolean;
}

function buildDeclarations(f: DeclFields): Declarations {
  const d: Declarations = {};
  if (f.regime === 'OLD') {
    if (f.rentPaid) d.rentPaid = Number(f.rentPaid);
    if (f.section80C) d.section80C = Number(f.section80C);
    d.metro = f.metro;
  }
  return d;
}

/**
 * Add / Edit employee drawer (UC-4..UC-7) with a LIVE payslip preview.
 * As salary/regime/declarations change, it debounces and calls
 * POST /payroll/calculate to render the would-be payslip without persisting (UC-9).
 */
export function EmployeeDrawer({ mode, initial, onClose, onSaved }: DrawerProps) {
  const { employer } = useAuth();
  const currency = employer?.currency ?? 'INR';

  const [form, setForm] = useState<FormShape>(() => fromEmployee(initial));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | Error | null>(null);

  const [preview, setPreview] = useState<CalculationResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<ApiError | null>(null);

  function set<K extends keyof FormShape>(key: K, value: FormShape[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const amountNum = Number(form.amount);
  const amountValid = form.amount !== '' && Number.isFinite(amountNum) && amountNum > 0;

  // Debounce the inputs that drive the calculation so we don't spam the API.
  const debounced = useDebounced(
    useMemo(
      () => ({
        payType: form.payType,
        amount: amountValid ? amountNum : null,
        regime: form.regime,
        rentPaid: form.rentPaid,
        section80C: form.section80C,
        metro: form.metro,
      }),
      [form.payType, amountValid, amountNum, form.regime, form.rentPaid, form.section80C, form.metro],
    ),
    400,
  );

  useEffect(() => {
    if (debounced.amount == null) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);

    payroll
      .calculate(
        {
          payBasis: { type: debounced.payType, amount: debounced.amount },
          declarations: buildDeclarations(debounced),
          period: currentPeriod(),
          regime: debounced.regime,
        },
        controller.signal,
      )
      .then((res) => {
        if (active) {
          setPreview(res);
          setPreviewLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPreviewError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Preview failed'));
        setPreviewLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !amountValid) return;
    setSaving(true);
    setSaveError(null);

    const payload: CreateEmployeePayload = {
      name: form.name.trim(),
      payBasis: { type: form.payType, amount: amountNum },
      regime: form.regime,
      declarations: buildDeclarations(form),
    };

    try {
      let saved: Employee;
      if (mode === 'edit' && initial) {
        saved = await employeesApi.update(initial.id, payload as UpdateEmployeePayload);
      } else {
        saved = await employeesApi.create(payload);
      }
      onSaved(saved);
    } catch (err) {
      setSaveError(err as Error);
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={mode === 'edit' ? 'Edit employee' : 'Add employee'}>
        <div className="drawer-head">
          <span className="drawer-title">
            {mode === 'edit' ? `Edit ${initial?.name}` : 'Add employee'}
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        <form className="drawer-shell" onSubmit={onSubmit}>
          <div className="drawer-body">
          <div className="drawer-form">
            <FormError error={saveError} />

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Details</legend>
              <div className="field">
                <label className="field-label" htmlFor="emp-name">
                  Full name
                </label>
                <input
                  id="emp-name"
                  className="input"
                  placeholder="Priya Sharma"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Compensation</legend>
              <div className="field">
                <span className="field-label">Pay basis</span>
                <div className="segmented block">
                  {(['CTC', 'GROSS'] as PayBasisType[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={form.payType === t ? 'active' : ''}
                      onClick={() => set('payType', t)}
                    >
                      {t === 'CTC' ? 'Cost to company' : 'Gross'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="emp-amount">
                  Monthly {form.payType === 'CTC' ? 'CTC' : 'gross'} ({currency})
                </label>
                <input
                  id="emp-amount"
                  className="input input-money"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="120000"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  required
                />
                {!amountValid && form.amount !== '' && (
                  <span className="field-error">Enter a positive amount.</span>
                )}
              </div>
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Tax regime</legend>
              <div className="segmented block">
                {['NEW', 'OLD'].map((r) => (
                  <button
                    type="button"
                    key={r}
                    className={form.regime === r ? 'active' : ''}
                    onClick={() => set('regime', r)}
                  >
                    {r === 'NEW' ? 'New regime' : 'Old regime'}
                  </button>
                ))}
              </div>
              <span className="field-hint">
                {form.regime === 'OLD'
                  ? 'Old regime allows HRA exemption and 80C deductions.'
                  : 'New regime: lower slabs, standard deduction only.'}
              </span>
            </fieldset>

            {form.regime === 'OLD' && (
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Declarations (old regime)</legend>
                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="rent">
                      Monthly rent paid
                    </label>
                    <input
                      id="rent"
                      className="input input-money"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={form.rentPaid}
                      onChange={(e) => set('rentPaid', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="s80c">
                      80C investments
                    </label>
                    <input
                      id="s80c"
                      className="input input-money"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={form.section80C}
                      onChange={(e) => set('section80C', e.target.value)}
                    />
                  </div>
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.metro}
                    onChange={(e) => set('metro', e.target.checked)}
                  />
                  Lives in a metro city (affects HRA exemption)
                </label>
              </fieldset>
            )}
          </div>

          <aside className="drawer-preview">
            <div className="row-between mb-16">
              <span className="fieldset-legend" style={{ border: 'none', margin: 0 }}>
                Live payslip preview
              </span>
              {previewLoading && <span className="spinner" />}
            </div>

            {!amountValid && (
              <div className="state" style={{ padding: '40px 12px' }}>
                <div className="state-icon">
                  <IconCalc size={22} />
                </div>
                <div className="state-text">
                  Enter a salary to preview the full breakdown — earnings, deductions,
                  employer cost, and taxes — computed live.
                </div>
              </div>
            )}

            {previewError && (
              <div className="alert alert-warning">
                <span>
                  Couldn’t compute preview: {previewError.message}
                </span>
              </div>
            )}

            {preview && amountValid && !previewError && (
              <PayslipBreakdown result={preview} currency={currency} variant="preview" />
            )}
          </aside>
          </div>

          <div className="drawer-foot">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.name.trim() || !amountValid}
            >
              {saving ? (
                <span className="spinner spinner-light" />
              ) : mode === 'edit' ? (
                'Save changes'
              ) : (
                'Add employee'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
