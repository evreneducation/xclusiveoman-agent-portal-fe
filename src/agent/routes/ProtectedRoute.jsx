import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-agent-bg font-mono text-xs text-agent-muted">
        Loading…
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/agent/login" replace />;
  }

  return <Outlet />;
}
