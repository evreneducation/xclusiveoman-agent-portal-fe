import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Checkbox, ErrorText, FieldLabel, PasswordInput, TextInput } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

// Matches the reference design exactly: logo + tagline centered up top, then
// just the two fields the account actually needs — Email and Password, no
// extra fields. Remember me / Forgot password / Sign up are the only other
// interactive pieces, same as the reference.
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/agent/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="h-11 w-auto object-contain" />
          <p className="mt-2 text-sm text-agent-muted">Your trade gateway to exclusive Oman experiences</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
          <div>
            <FieldLabel>Email*</FieldLabel>
            <div className="relative">
              <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-agent-muted" size={16} />
              <TextInput
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Password*</FieldLabel>
            <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>

          <div className="flex items-center justify-between">
            <Checkbox checked={rememberMe} onChange={setRememberMe} label="Remember me" />
            <Link to="/agent/forgot-password" className="text-xs font-semibold text-agent-accent-dark hover:underline">
              Forgot password?
            </Link>
          </div>

          <ErrorText>{error}</ErrorText>

          <Button variant="solid" type="submit" className="w-full justify-center rounded-full py-2.5 text-sm" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-agent-muted">
          Don't have an account?{' '}
          <Link to="/agent/register" className="font-semibold text-agent-accent-dark hover:underline">
            Sign up
          </Link>
        </p>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-agent-muted">
          By logging in, you agree to Xclusive Oman's current Terms of Service and Privacy Policy.
        </p>
      </div>
    </AuthShell>
  );
}
