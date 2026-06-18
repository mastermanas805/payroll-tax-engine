import type { ReactNode } from 'react';
import { IconCheck } from '../../components/icons';

const POINTS = [
  'Country-aware tax engine — earnings, deductions, contributions, taxes',
  'Every payslip reconciles to the paisa, with a full audit trace',
  'Run monthly payroll across your team in one action',
];

/** Split-screen auth layout: trust-building brand panel + form slot. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>Payroll</span>
        </div>

        <div className="auth-pitch">
          <h1>Payroll your accountant can audit, line by line.</h1>
          <p>
            A multi-tenant payroll platform with a fully data-driven tax engine.
            Onboard your company, enroll employees, and run compliant payroll every
            month.
          </p>
          <div className="auth-points">
            {POINTS.map((p) => (
              <div className="auth-point" key={p}>
                <span className="auth-point-tick">
                  <IconCheck size={13} />
                </span>
                {p}
              </div>
            ))}
          </div>
        </div>

        <div className="auth-foot">India · Old &amp; New regimes · FY 2025-26 · more countries are config, not code</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}
