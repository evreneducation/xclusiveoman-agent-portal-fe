import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Admin Content & CMS Management (Task 21 — Item 34) — CMS is super_admin
// only per this task's explicit access-control override (the doc's own
// route table reads ops_admin+; this implementation deliberately narrows
// that just for /admin/cms/*, nothing else). Mirrors ProtectedRoute.jsx's
// own shape (an Outlet-wrapping guard nested inside the route tree) rather
// than inventing a different pattern — this is purely an *additional* gate
// nested inside the existing ProtectedRoute, not a replacement for it: a
// non-authenticated visitor still hits ProtectedRoute's own redirect first,
// this only ever runs for an already-authenticated staff user.
//
// Frontend-only — this is a UX convenience (don't show a broken page to a
// role that can't use it), never the actual security boundary. Every
// /admin/cms/* backend request is independently re-checked by
// requireRole('super_admin') in cms.routes.js regardless of what this
// component does.
export default function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}
