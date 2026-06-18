import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { countryFlag, countryName } from '../lib/countries';
import { IconLogout, IconReceipt, IconRuns, IconUsers } from './icons';

/**
 * Authenticated app shell (UC-3): top bar with company + country chip + logout,
 * and a left nav (Employees / Payroll Runs). Content renders via <Outlet/>.
 */
export function AppShell() {
  const { employer, logout } = useAuth();
  if (!employer) return null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>Payroll</span>
        </div>
        <div className="topbar-spacer" />
        <div className="company-meta">
          <span className="company-name">{employer.companyName}</span>
          <span className="chip" title={`${countryName(employer.country)} · ${employer.currency}`}>
            <span aria-hidden>{countryFlag(employer.country)}</span>
            {employer.country} · {employer.currency}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={logout} title="Log out">
            <IconLogout size={16} />
            Logout
          </button>
        </div>
      </header>

      <nav className="nav" aria-label="Primary">
        <div className="nav-section">Manage</div>
        <NavLink to="/employees" className={navClass}>
          <IconUsers size={18} />
          Employees
        </NavLink>
        <NavLink to="/runs" className={navClass}>
          <IconRuns size={18} />
          Payroll Runs
        </NavLink>
        <div className="nav-section">Actions</div>
        <NavLink to="/runs/new" className={navClass}>
          <IconReceipt size={18} />
          Run Payroll
        </NavLink>
      </nav>

      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-item active' : 'nav-item';
}
