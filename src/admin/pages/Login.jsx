import { Navigate } from 'react-router-dom';
import { LoginModal } from '../../shared/components/LoginModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Admin Console login — mounted at /admin (the AdminApp index route). Scoped
// to staff (restrictTo="admin"): request-otp is refused server-side for a
// non-staff email, so an agent never even receives a code here. Sign up is
// hidden. An already-signed-in admin who lands on /admin skips to the
// dashboard.
export default function Login() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/admin/dashboard" replace />;
  return <LoginModal restrictTo="admin" showSignUp={false} />;
}
