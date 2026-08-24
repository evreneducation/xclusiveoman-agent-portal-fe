import { Route, Routes } from 'react-router-dom';
import AgentApp from './agent/App.jsx';
import AdminApp from './admin/App.jsx';
import TeamApp from './team/App.jsx';
import { LoginModal } from './shared/components/LoginModal.jsx';
import LandingPage from './shared/components/landing/LandingPage.jsx';
import CmsPage from './pages/CmsPage.jsx';

// "/" is now the public marketing LandingPage (shared/components/landing/) —
// not the login screen. The shared LoginModal (shared/components/LoginModal.jsx,
// rendered identically at /admin/login and /agent/login) moved to its own
// "/login" route; every "Sign Up / Login" CTA on the landing page links
// there. It still doesn't need to know which portal the visitor belongs to:
// role is read from the login response itself and decides the destination.
// Unmatched paths also fall back to LandingPage rather than the login screen,
// same as a normal marketing site's 404 behaviour.
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
      <Route path="/login" element={<LoginModal />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
