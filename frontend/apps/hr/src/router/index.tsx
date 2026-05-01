import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import QuestionsPage from '../pages/QuestionsPage';
import AssignmentsPage from '../pages/AssignmentsPage';
import MaterialsPage from '../pages/MaterialsPage';
import ReportsPage from '../pages/ReportsPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
