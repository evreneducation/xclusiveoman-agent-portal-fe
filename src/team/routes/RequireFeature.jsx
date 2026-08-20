import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Frontend-only convenience — don't show a broken/empty page for a checkbox
// an admin never enabled for this LM/RM. Never the real security boundary:
// every underlying admin.* API route independently re-checks the exact same
// Access Feature via requireFeature (backend middleware/auth.js), same
// "frontend guard is UX only" split as admin/routes/SuperAdminRoute.jsx.
export default function RequireFeature({ feature }) {
  const { hasFeature } = useAuth();

  if (!hasFeature(feature)) {
    return <Navigate to="/team/dashboard" replace />;
  }

  return <Outlet />;
}
