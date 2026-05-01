import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import TestsPage from '../pages/TestsPage';
import TestAttemptPage from '../pages/TestAttemptPage';
import ResultsPage from '../pages/ResultsPage';
import RecommendationsPage from '../pages/RecommendationsPage';
import DynamicsPage from '../pages/DynamicsPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-700">{title}</p>
        <p className="text-gray-400 text-sm mt-2">Раздел в разработке</p>
      </div>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />

      {/* Employee-only */}
      <Route element={<PrivateRoute allowedRoles={['employee']} />}>
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Тесты */}
        <Route path="/tests" element={<TestsPage />} />
        <Route path="/tests/attempt/:attemptId" element={<TestAttemptPage />} />
        <Route path="/tests/attempt/:attemptId/results" element={<ResultsPage />} />

        {/* Рекомендации ИИ */}
        <Route path="/recommendations" element={<RecommendationsPage />} />

        {/* Динамика компетенций */}
        <Route path="/dynamics" element={<DynamicsPage />} />

        {/* История аттестаций — stub, реализация после GET /v1/attempts/my */}
        <Route path="/results" element={<PlaceholderPage title="История аттестаций" />} />

        {/* Каталог курсов — stub, реализация после Courses API */}
        <Route path="/courses" element={<PlaceholderPage title="Каталог курсов" />} />
      </Route>

      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
