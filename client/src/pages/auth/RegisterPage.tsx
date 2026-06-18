import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { FormError } from '../../components/States';
import { useAuth } from '../../context/auth';
import { COUNTRIES, countryByCode } from '../../lib/countries';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [stateCode, setStateCode] = useState('KA');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const country = useMemo(() => countryByCode(countryCode), [countryCode]);
  const passwordTooShort = password.length > 0 && password.length < 8;
  const canSubmit =
    companyName.trim() && email.trim() && password.length >= 8 && country?.supported;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!country) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({
        companyName: companyName.trim(),
        country: country.code,
        currency: country.currency,
        state: country.states ? stateCode : undefined,
        email: email.trim(),
        password,
      });
      navigate('/employees', { replace: true });
    } catch (err) {
      setError(err as Error);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h2>Create your company</h2>
      <p className="page-sub">Set up your tenant. You can add employees right after.</p>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <FormError error={error} />

        <div className="field">
          <label className="field-label" htmlFor="company">
            Company name
          </label>
          <input
            id="company"
            className="input"
            placeholder="Acme Technologies Pvt Ltd"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <span className="field-label">Country</span>
          <div className="country-grid">
            {COUNTRIES.map((c) => (
              <button
                type="button"
                key={c.code}
                className={`country-opt ${countryCode === c.code ? 'selected' : ''}`}
                onClick={() => {
                  setCountryCode(c.code);
                  if (c.states?.length) setStateCode(c.states[0].code);
                }}
                disabled={!c.supported}
                title={c.supported ? c.name : `${c.name} — coming soon`}
              >
                <span className="flag" aria-hidden>
                  {c.flag}
                </span>
                {c.name}
                {c.supported ? (
                  <span className="ccy">{c.currency}</span>
                ) : (
                  <span className="soon">Soon</span>
                )}
              </button>
            ))}
          </div>
          <span className="field-hint">
            One country per company. Currency is set automatically.
          </span>
        </div>

        {country?.states && (
          <div className="field">
            <label className="field-label" htmlFor="state">
              State (professional-tax schedule)
            </label>
            <select
              id="state"
              className="select"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
            >
              {country.states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="reg-email">
            Work email
          </label>
          <input
            id="reg-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="reg-password">
            Password
          </label>
          <input
            id="reg-password"
            className={`input ${passwordTooShort ? 'has-error' : ''}`}
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {passwordTooShort ? (
            <span className="field-error">Use at least 8 characters.</span>
          ) : (
            <span className="field-hint">At least 8 characters.</span>
          )}
        </div>

        <button
          className="btn btn-primary btn-lg btn-block"
          type="submit"
          disabled={submitting || !canSubmit}
        >
          {submitting ? <span className="spinner spinner-light" /> : 'Create company account'}
        </button>
      </form>

      <div className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}
