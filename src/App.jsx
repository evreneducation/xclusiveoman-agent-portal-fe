import { Route, Routes } from 'react-router-dom';
import AgentApp from './agent/App.jsx';
import AdminApp from './admin/App.jsx';
import { LoginModal } from './shared/components/LoginModal.jsx';
import CmsPage from './pages/CmsPage.jsx';

// No more "choose Agent Portal or Admin Console" picker (shared/pages/
// Landing.jsx, removed — this was its only caller) — the shared LoginModal
// itself (shared/components/LoginModal.jsx) is now the app's one starting
// point at "/", same as any unmatched path, rendered exactly as it renders
// at /admin/login and /agent/login (no props here to differ by) — it
// doesn't need to know which portal the visitor belongs to: role is read
// from the login response itself and decides the destination.
export default function App() {
  return (
    <Routes>
      <Route path="/agent/*" element={<AgentApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      {/* Public CMS Page Viewer (Task 21 — Item 34 continuation) — no auth,
          not under /admin or /agent. See src/pages/CmsPage.jsx. */}
      <Route path="/cms/:slug" element={<CmsPage />} />
      <Route path="/" element={<LoginModal />} />
      <Route path="*" element={<LoginModal />} />
    </Routes>
  );
}
