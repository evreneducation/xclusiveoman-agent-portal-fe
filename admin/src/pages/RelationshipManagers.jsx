import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

function CreateRmForm({ onCreated }) {
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
      const { user } = await api.post('/admin/relationship-managers', {
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
      setError(err.message || 'Unable to create relationship manager');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Add relationship manager" className="border-white">
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
            {submitting ? 'Creating…' : 'Create Relationship Manager'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ManageRmPanel({ rm, onUpdated }) {
  const [fullName, setFullName] = useState(rm.fullName);
  const [phone, setPhone] = useState(rm.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(rm.whatsappNumber || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    setFullName(rm.fullName);
    setPhone(rm.phone || '');
    setWhatsappNumber(rm.whatsappNumber || '');
    setError('');
  }, [rm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(fields, key) {
    setError('');
    setSubmitting(key);
    try {
      const { user } = await api.patch(`/admin/relationship-managers/${rm.id}`, fields);
      onUpdated({ ...rm, ...user });
    } catch (err) {
      setError(err.message || 'Unable to update relationship manager');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <div className="space-y-5">
      <Card label="Manage relationship manager" className="border-white">
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
            {rm.status === 'active' ? (
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

      <Card label={`Assigned agencies (${rm.assignedAgencies.length})`} className="border-white">
        {rm.assignedAgencies.length === 0 ? (
          <p className="text-xs text-muted">
            Not yet assigned to any agency — assign this RM from Agent Approvals.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rm.assignedAgencies.map((a) => (
              <div key={a.id} className="rounded-md bg-panel px-3 py-2 text-xs font-semibold">
                {a.name}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function RelationshipManagers() {
  const [rms, setRms] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadRms() {
    setLoading(true);
    setError('');
    api
      .get('/admin/relationship-managers')
      .then(({ relationshipManagers }) => {
        setRms(relationshipManagers);
        setSelectedId((current) =>
          relationshipManagers.some((r) => r.id === current) ? current : relationshipManagers[0]?.id || null
        );
      })
      .catch((err) => setError(err.message || 'Unable to load relationship managers'))
      .finally(() => setLoading(false));
  }

  useEffect(loadRms, []);

  const selected = useMemo(() => rms.find((r) => r.id === selectedId) || null, [rms, selectedId]);

  function handleCreated(user) {
    setRms((list) => [{ ...user, assignedAgencies: [] }, ...list]);
    setSelectedId(user.id);
  }

  function handleUpdated(updated) {
    setRms((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="flex flex-col lg:flex-row">
        <div className="w-full flex-none border-b border-line-light bg-white/90 p-6 lg:min-h-screen lg:w-[26rem] lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Relationship Managers</h2>
              <p className="mt-1.5 text-sm text-muted">Create and manage the staff assigned as agencies' RMs.</p>
            </div>
            <Badge tone="grey">{rms.length}</Badge>
          </div>

          {loading && <p className="rounded-lg border border-line-light bg-panel px-3 py-2 text-xs text-muted">Loading…</p>}
          <ErrorText>{error}</ErrorText>
          {!loading && rms.length === 0 && (
            <p className="rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
              No relationship managers yet — add one below.
            </p>
          )}

          <div className="space-y-3">
            {rms.map((rm) => (
              <button
                key={rm.id}
                type="button"
                onClick={() => setSelectedId(rm.id)}
                className={`block w-full rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  rm.id === selectedId ? 'border-accent bg-[#fff8f4]' : 'border-line-light bg-white'
                }`}
              >
                <div className="text-sm font-bold">{rm.fullName}</div>
                <div className="mt-1 text-xs text-muted">{rm.email}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={rm.status === 'active' ? 'green' : 'grey'}>{rm.status}</Badge>
                  <span className="text-[10px] text-muted">
                    {rm.assignedAgencies.length} {rm.assignedAgencies.length === 1 ? 'agency' : 'agencies'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <CreateRmForm onCreated={handleCreated} />
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-10">
          {!selected && (
            <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted">
              Select a relationship manager from the list, or add a new one.
            </p>
          )}
          {selected && (
            <div className="max-w-2xl">
              <h3 className="mb-4 text-2xl font-bold">{selected.fullName}</h3>
              <ManageRmPanel rm={selected} onUpdated={handleUpdated} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
