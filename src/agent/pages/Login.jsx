import { Navigate } from 'react-router-dom';
import { LoginModal } from '../../shared/components/LoginModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Agent Portal login — mounted at /agent (the AgentApp index route). Scoped
// to travel agents (restrictTo="agent"): a staff/admin account that verifies
// here is refused and pointed at /login instead. An already-signed-in agent
// who lands on /agent skips straight to the dashboard.
export default function Login() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/agent/dashboard" replace />;
  return <LoginModal restrictTo="agent" />;
}
