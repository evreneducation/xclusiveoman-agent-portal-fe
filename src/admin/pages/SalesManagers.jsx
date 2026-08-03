import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

function CreateSalesManagerForm({ onCreated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user } = await api.post('/admin/sales-managers', {
        fullName,
        email,
        password,
        phone: phone || undefined,
        whatsappNumber: whatsappNumber || undefined,
      });
      onCreated(user);
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setWhatsappNumber('');
    } catch (err) {
      setError(err.message || 'Unable to create sales manager');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Add sales manager" className="border-white">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
        <div>
          <FieldLabel>Full name</FieldLabel>
          <TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Work email</FieldLabel>
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Temporary password</FieldLabel>
          <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <FieldLabel>WhatsApp number</FieldLabel>
          <TextInput placeholder="+968…" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
        </div>
        <div>
          <ErrorText>{error}</ErrorText>
          <Button variant="accent" type="submit" disabled={submitting} className="mt-2 w-full justify-center">
            {submitting ? 'Creating…' : 'Create Sales Manager'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ManageSalesManagerPanel({ salesManager, onUpdated }) {
  const [fullName, setFullName] = useState(salesManager.fullName);
  const [phone, setPhone] = useState(salesManager.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(salesManager.whatsappNumber || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    setFullName(salesManager.fullName);
    setPhone(salesManager.phone || '');
    setWhatsappNumber(salesManager.whatsappNumber || '');
    setError('');
  }, [salesManager.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(fields, key) {
    setError('');
    setSubmitting(key);
    try {
      const { user } = await api.patch(`/admin/sales-managers/${salesManager.id}`, fields);
      onUpdated({ ...salesManager, ...user });
    } catch (err) {
      setError(err.message || 'Unable to update sales manager');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <Card label="Manage sales manager" className="border-white">
      <div className="space-y-4 text-sm">
        <div>
          <FieldLabel>Full name</FieldLabel>
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <FieldLabel>WhatsApp number</FieldLabel>
          <TextInput value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
        </div>

        <ErrorText>{error}</ErrorText>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="accent"
            disabled={!!submitting}
            onClick={() => save({ fullName, phone, whatsappNumber }, 'details')}
          >
            {submitting === 'details' ? 'Saving…' : 'Save Changes'}
          </Button>
          {salesManager.status === 'active' ? (
            <Button variant="danger" disabled={!!submitting} onClick={() => save({ status: 'disabled' }, 'status')}>
              {submitting === 'status' ? 'Disabling…' : 'Disable Account'}
            </Button>
          ) : (
            <Button disabled={!!submitting} onClick={() => save({ status: 'active' }, 'status')}>
              {submitting === 'status' ? 'Enabling…' : 'Re-enable Account'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function SalesManagers() {
  const [salesManagers, setSalesManagers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadSalesManagers() {
    setLoading(true);
    setError('');
    api
      .get('/admin/sales-managers')
      .then(({ salesManagers: list }) => {
        setSalesManagers(list);
        setSelectedId((current) => (list.some((s) => s.id === current) ? current : list[0]?.id || null));
      })
      .catch((err) => setError(err.message || 'Unable to load sales managers'))
      .finally(() => setLoading(false));
  }

  useEffect(loadSalesManagers, []);

  const selected = useMemo(
    () => salesManagers.find((s) => s.id === selectedId) || null,
    [salesManagers, selectedId]
  );

  function handleCreated(user) {
    setSalesManagers((list) => [user, ...list]);
    setSelectedId(user.id);
  }

  function handleUpdated(updated) {
    setSalesManagers((list) => list.map((s) => (s.id === updated.id ? updated : s)));
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="flex flex-col lg:flex-row">
        <div className="w-full flex-none border-b border-line-light bg-white/90 p-6 lg:min-h-screen lg:w-[26rem] lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Sales Managers</h2>
              <p className="mt-1.5 text-sm text-muted">Create and manage the sales manager staff pool.</p>
            </div>
            <Badge tone="grey">{salesManagers.length}</Badge>
          </div>

          {loading && <p className="rounded-lg border border-line-light bg-panel px-3 py-2 text-xs text-muted">Loading…</p>}
          <ErrorText>{error}</ErrorText>
          {!loading && salesManagers.length === 0 && (
            <p className="rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
              No sales managers yet — add one below.
            </p>
          )}

          <div className="space-y-3">
            {salesManagers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`block w-full rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  s.id === selectedId ? 'border-accent bg-[#fff8f4]' : 'border-line-light bg-white'
                }`}
              >
                <div className="text-sm font-bold">{s.fullName}</div>
                <div className="mt-1 text-xs text-muted">{s.email}</div>
                <div className="mt-2">
                  <Badge tone={s.status === 'active' ? 'green' : 'grey'}>{s.status}</Badge>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <CreateSalesManagerForm onCreated={handleCreated} />
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-10">
          {!selected && (
            <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted">
              Select a sales manager from the list, or add a new one.
            </p>
          )}
          {selected && (
            <div className="max-w-2xl">
              <h3 className="mb-4 text-2xl font-bold">{selected.fullName}</h3>
              <ManageSalesManagerPanel salesManager={selected} onUpdated={handleUpdated} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
