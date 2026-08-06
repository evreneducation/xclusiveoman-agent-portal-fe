import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorText, FieldLabel, PasswordInput, TextInput } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

const CITIES = ['Muscat', 'Nizwa', 'Salalah'];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <AuthShell
      eyebrow="Welcome back"
      heading="Sign in to manage your quotes, bookings & departures"
      tagline="Track FIT and MICE requests, message your Relationship Manager, and stay on top of every payment — all in one place."
      panelFooter={
        <div className="grid grid-cols-3 gap-3 text-sm text-white/75">
          {CITIES.map((c) => (
            <div key={c} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center">
              {c}
            </div>
          ))}
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md rounded-2xl border border-agent-line-light bg-white/95 p-7 shadow-xl shadow-black/5 sm:p-8">
        <h2 className="text-xl font-bold text-agent-ink">Sign in</h2>
        <p className="mt-1 text-sm text-agent-muted">Enter your credentials to access your agent portal.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <FieldLabel>Email address</FieldLabel>
            <TextInput
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
            />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button variant="solid" type="submit" className="w-full py-2.5 text-center text-sm" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-agent-muted">
          New to Xclusive Oman?{' '}
          <Link to="/agent/register" className="font-semibold text-agent-accent-dark hover:underline">
            Create an agency account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
