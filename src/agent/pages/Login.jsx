import { LoginModal } from '../../shared/components/LoginModal.jsx';

// Single shared login screen (shared/components/LoginModal.jsx) — the exact
// same one rendered at "/", /admin/login, and here. Nothing to configure:
// LoginModal's own agentDestination default ("/agent/dashboard") already
// matches this page's pre-existing post-login landing spot.
export default function Login() {
  return <LoginModal />;
}
