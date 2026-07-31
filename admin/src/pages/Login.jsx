import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

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
      navigate('/approvals', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#f7d8c6_0,#f6eee9_28%,#edf1f0_58%,#e7e5e0_100%)] px-4 py-10">
      <div className="w-full max-w-[390px]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-lg font-bold text-white shadow-lg shadow-black/10">
            XO
          </div>
          <h1 className="text-2xl font-bold text-ink">Xclusive Oman</h1>
          <div className="mt-1 text-sm text-muted">Staff &amp; Admin Console</div>
        </div>

        <Card label="Sign in" className="border-white/70 shadow-xl shadow-black/10">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <FieldLabel>Work email</FieldLabel>
              <TextInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@xclusiveoman.com"
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <TextInput
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button variant="solid" type="submit" className="w-full py-2.5 text-center" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </Card>
        <div className="mt-4 text-center text-xs text-muted">
          Access is provisioned by a Super Admin — no self-registration here.
        </div>
      </div>
    </div>
  );
}
