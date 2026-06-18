import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/auth';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { PayslipPage } from './pages/PayslipPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { RunPayrollPage } from './pages/RunPayrollPage';
import { RunsHistoryPage } from './pages/RunsHistoryPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public auth routes — redirect to the app if already signed in. */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/employees" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/employees" replace /> : <RegisterPage />}
      />

      {/* Authenticated app shell. */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/runs" element={<RunsHistoryPage />} />
        <Route path="/runs/new" element={<RunPayrollPage />} />
        <Route path="/runs/:id" element={<RunDetailPage />} />
        <Route path="/payslips/:id" element={<PayslipPage />} />
      </Route>

      {/* Defaults. */}
      <Route path="/" element={<Navigate to="/employees" replace />} />
      <Route path="*" element={<Navigate to="/employees" replace />} />
    </Routes>
  );
}
