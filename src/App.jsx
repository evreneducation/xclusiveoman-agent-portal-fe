import { Navigate, Route, Routes } from 'react-router-dom';
import AgentApp from './agent/App.jsx';
import AdminApp from './admin/App.jsx';
import TeamApp from './team/App.jsx';
import LandingPage from './shared/components/landing/LandingPage.jsx';
import CmsPage from './pages/CmsPage.jsx';

// "/" is the public marketing LandingPage (shared/components/landing/).
// The logins are separate, portal-scoped routes, each the index route of its
// own portal app and sharing one LoginModal:
//   /admin -> staff/admin (restrictTo="admin", Sign up hidden; request-otp is
//             refused server-side for non-staff so an agent never gets a code)
//   /agent -> travel agents (Sign up shown)
//   /team/login -> team roles (unrestricted; they route themselves)
// Every "Sign Up / Login" CTA on the landing page points at /agent. /agent/login
// redirects to /agent; /admin/login redirects to /admin; a generic /login goes
// to /agent (the Admin Console login is only reachable at /admin, by someone
// who knows the route). Unmatched paths fall back to LandingPage.
export default function App() {
  return (
    <Routes>
      <Route path="/agent/*" element={<AgentApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      {/* Team Portal — Lead Managers (sales_manager) and Relationship
          Managers (relationship_manager) sign in here, never at /admin. */}
      <Route path="/team/*" element={<TeamApp />} />
      {/* Public CMS Page Viewer (Task 21 — Item 34 continuation) — no auth,
          not under /admin or /agent. See src/pages/CmsPage.jsx. */}
      <Route path="/cms/:slug" element={<CmsPage />} />
      {/* /login is deliberately NOT the admin login — the Admin Console
          login lives at /admin and is only reachable by someone who knows
          that route. A generic /login lands on the public Agent Portal
          login instead. */}
      <Route path="/login" element={<Navigate to="/agent" replace />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
