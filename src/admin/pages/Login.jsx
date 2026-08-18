import { LoginModal } from '../../shared/components/LoginModal.jsx';

// Single shared login screen (shared/components/LoginModal.jsx) — the exact
// same one rendered at "/", /agent/login, and here. No props differ it from
// those (see that file's own top comment for why); adminDestination is
// overridden below only to preserve this page's pre-existing post-login
// landing spot (Agent Approvals, not the default /admin/dashboard) — a
// destination difference, never a visual one.
export default function Login() {
  return <LoginModal adminDestination="/admin/approvals" />;
}
