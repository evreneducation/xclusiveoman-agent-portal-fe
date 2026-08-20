import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-team-bg font-mono text-xs text-team-muted">
        Loading…
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/team/login" replace />;
  }

  return <Outlet />;
}
