import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { FormError } from '../../components/States';
import { useAuth } from '../../context/auth';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/employees';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err as Error);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="page-sub">Sign in to manage your company’s payroll.</p>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <FormError error={error} />

        <div className="field">
          <label className="field-label" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          className="btn btn-primary btn-lg btn-block"
          type="submit"
          disabled={submitting || !email || !password}
        >
          {submitting ? <span className="spinner spinner-light" /> : 'Sign in'}
        </button>
      </form>

      <div className="auth-switch">
        New here? <Link to="/register">Create a company account</Link>
      </div>
    </AuthLayout>
  );
}
