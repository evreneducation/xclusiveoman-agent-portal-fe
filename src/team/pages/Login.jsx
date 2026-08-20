import { LoginModal } from '../../shared/components/LoginModal.jsx';

// Single shared login screen (shared/components/LoginModal.jsx) — same one
// rendered at "/", /admin/login, and /agent/login. teamDestination is where
// an LM/RM lands after a successful sign-in; agencyDestination/
// adminDestination are left at their defaults since this page is only ever
// reached by someone who might turn out to be any of the three.
export default function Login() {
  return <LoginModal teamDestination="/team/dashboard" />;
}
