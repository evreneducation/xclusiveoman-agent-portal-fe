import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorText, FieldLabel, Select, Tag, TextInput } from '../components/ui.jsx';

const COUNTRIES = ['Oman', 'India', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Other'];

function SignInPanel() {
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
    <Card label="Sign in" className="border-white shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel>Email address</FieldLabel>
          <TextInput
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
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
  );
}

function RegisterPanel() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    agencyName: '',
    agencyType: 'travel_agent',
    licenseNumber: '',
    country: 'Oman',
    ownerFullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to submit registration');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card label="New agency? Register" className="border-white shadow-sm">
        <p className="text-sm leading-relaxed">
          Thanks — your registration has been submitted. Your account is now{' '}
          <span className="font-semibold">Pending Approval</span>. A Super Admin will review it,
          assign your tier, and you'll be able to sign in once approved.
        </p>
      </Card>
    );
  }

  return (
    <Card label="New agency? Register" className="border-white shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel>Company name</FieldLabel>
          <TextInput required value={form.agencyName} onChange={(e) => update('agencyName', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Agency type</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => update('agencyType', 'travel_agent')}>
              <Tag active={form.agencyType === 'travel_agent'}>Travel Agent</Tag>
            </button>
            <button type="button" onClick={() => update('agencyType', 'mice_company')}>
              <Tag active={form.agencyType === 'mice_company'}>MICE Company</Tag>
            </button>
          </div>
        </div>
        <div>
          <FieldLabel>IATA / License No. (optional)</FieldLabel>
          <TextInput value={form.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Country</FieldLabel>
          <Select value={form.country} onChange={(e) => update('country', e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Owner full name</FieldLabel>
          <TextInput required value={form.ownerFullName} onChange={(e) => update('ownerFullName', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Email address</FieldLabel>
          <TextInput type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <TextInput required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Password</FieldLabel>
          <TextInput
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button variant="accent" type="submit" className="mt-1 w-full py-2.5 text-center" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </Button>
      </form>
    </Card>
  );
}

export default function Login() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7d8c6_0,#f6eee9_28%,#edf1f0_58%,#e7e5e0_100%)] px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between rounded-2xl bg-ink p-8 text-white shadow-xl shadow-black/15">
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-ink shadow-lg shadow-black/10">
              XO
            </div>
            <h1 className="text-3xl font-bold">Xclusive Oman</h1>
            <div className="mt-2 text-sm text-white/70">B2B &amp; MICE Trade Portal</div>
          </div>
          <div className="mt-12 grid gap-3 text-sm text-white/75">
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">Muscat</div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">Nizwa</div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">Salalah</div>
          </div>
        </div>
        <div className="space-y-5">
          <SignInPanel />
          <RegisterPanel />
        </div>
      </div>
    </div>
  );
}
