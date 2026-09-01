import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e7e5e0] font-mono text-xs text-muted">
        Loading…
      </div>
    );
  }

  if (status === 'anonymous') {
    // "/" (the public landing page), not "/admin" — an unauthenticated
    // visitor (including one who just logged out) lands on the marketing
    // site, not straight back at the login form; LoginModal's own Home
    // button is the way back here from there.
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
