import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

// AUTH-6 "Company profile management" — reuses the existing GET/PATCH
// /agencies/me endpoint (already called by Dashboard.jsx for read access).
export default function Profile() {
  const { user } = useAuth();
  const [agency, setAgency] = useState(null);
  const [form, setForm] = useState({ name: '', country: '', currencyPreference: '', logoAssetUrl: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/agencies/me')
      .then(({ agency: a }) => {
        setAgency(a);
        setForm({
          name: a.name || '',
          country: a.country || '',
          currencyPreference: a.currencyPreference || '',
          logoAssetUrl: a.logoAssetUrl || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const payload = {};
      if (form.name) payload.name = form.name;
      if (form.country) payload.country = form.country;
      if (form.currencyPreference) payload.currencyPreference = form.currencyPreference;
      if (form.logoAssetUrl) payload.logoAssetUrl = form.logoAssetUrl;
      const { agency: updated } = await api.patch('/agencies/me', payload);
      setAgency(updated);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  }

  const canEdit = user?.role === 'agency_owner';

  if (loading) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-5 lg:p-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold text-agent-ink">Profile</h2>
        <p className="text-sm text-agent-muted">Your agency's company details, as seen by Xclusive Oman.</p>
      </div>

      <Card label="Account status" className="border-white">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Status: <span className="font-semibold capitalize">{agency?.status}</span></span>
        </div>
        <p className="mt-2 text-xs text-agent-muted">
          Signed in as {user?.fullName} ({user?.email}) — {user?.role?.replace(/_/g, ' ')}
        </p>
      </Card>

      <Card label="Company details" className="border-white">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <FieldLabel>Company name</FieldLabel>
            <TextInput value={form.name} disabled={!canEdit} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div>
            <FieldLabel>Country</FieldLabel>
            <TextInput value={form.country} disabled={!canEdit} onChange={(e) => update('country', e.target.value)} />
          </div>
          <div>
            <FieldLabel>Currency preference</FieldLabel>
            <TextInput
              placeholder="e.g. INR"
              value={form.currencyPreference}
              disabled={!canEdit}
              onChange={(e) => update('currencyPreference', e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Logo URL</FieldLabel>
            <TextInput
              placeholder="https://…"
              value={form.logoAssetUrl}
              disabled={!canEdit}
              onChange={(e) => update('logoAssetUrl', e.target.value)}
            />
          </div>
          {!canEdit && (
            <p className="text-xs text-agent-muted">Only the agency owner can edit company details.</p>
          )}
          <ErrorText>{error}</ErrorText>
          {success && <p className="text-xs font-semibold text-[#227647]">Saved.</p>}
          {canEdit && (
            <Button variant="accent" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </form>
      </Card>
    </div>
  );
}
