import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Select, Tag, TextInput } from '../components/ui.jsx';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

const TIERS = ['gold', 'silver', 'bronze'];

const STATUS_BADGE = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  suspended: 'grey',
};

function DecisionPanel({ agency, team, onDecided }) {
  const [tier, setTier] = useState(agency.tier || 'gold');
  const [creditLimit, setCreditLimit] = useState(agency.creditLimit ?? '');
  const [rmUserId, setRmUserId] = useState(agency.rmUserId || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    setTier(agency.tier || 'gold');
    setCreditLimit(agency.creditLimit ?? '');
    setRmUserId(agency.rmUserId || '');
    setError('');
  }, [agency.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(status) {
    setError('');
    setSubmitting(status);
    try {
      const payload = { status };
      if (status === 'approved') {
        payload.tier = tier;
        if (creditLimit !== '') payload.creditLimit = Number(creditLimit);
        if (rmUserId) payload.rmUserId = rmUserId;
      }
      const { agency: updated } = await api.patch(`/admin/agencies/${agency.id}`, payload);
      onDecided(updated);
    } catch (err) {
      setError(err.message || 'Unable to update agency');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <Card label="Decision" className="border-white shadow-sm">
      <div className="space-y-4 text-sm">
        <div>
          <FieldLabel>Assign tier</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <button key={t} type="button" onClick={() => setTier(t)}>
                <Tag active={tier === t}>{t[0].toUpperCase() + t.slice(1)}</Tag>
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Credit limit (OMR)</FieldLabel>
          <TextInput
            type="number"
            min="0"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="e.g. 5000"
          />
        </div>
        <div>
          <FieldLabel>Assign Relationship Manager</FieldLabel>
          <Select value={rmUserId} onChange={(e) => setRmUserId(e.target.value)}>
            <option value="">— None —</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} ({member.role})
              </option>
            ))}
          </Select>
        </div>

        <ErrorText>{error}</ErrorText>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="accent" className="flex-1 sm:flex-none" disabled={!!submitting} onClick={() => decide('approved')}>
            {submitting === 'approved' ? 'Approving…' : 'Approve Agency'}
          </Button>
          <Button variant="danger" disabled={!!submitting} onClick={() => decide('rejected')}>
            {submitting === 'rejected' ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AgentApprovals() {
  const { user, logout, socketConnected, isSuperAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [agencies, setAgencies] = useState([]);
  const [team, setTeam] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAgencies() {
    setLoading(true);
    setError('');
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const { agencies: list } = await api.get(`/admin/agencies${query}`);
      setAgencies(list);
      setSelectedId((current) => (list.some((a) => a.id === current) ? current : list[0]?.id || null));
    } catch (err) {
      setError(err.message || 'Unable to load agencies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get('/admin/team')
      .then(({ team: list }) => setTeam(list))
      .catch(() => {});
  }, [isSuperAdmin]);

  const selected = useMemo(() => agencies.find((a) => a.id === selectedId) || null, [agencies, selectedId]);

  function handleDecided(updatedAgency) {
    setAgencies((list) => list.map((a) => (a.id === updatedAgency.id ? updatedAgency : a)));
    // A pending-only view should drop the agency once it's no longer pending.
    if (statusFilter && updatedAgency.status !== statusFilter) {
      loadAgencies();
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-light bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div>
          <div className="text-sm font-bold text-ink">Xclusive Oman Admin</div>
          <div className="text-[11px] text-muted">Agency onboarding desk</div>
        </div>
        <div className="flex items-center justify-end gap-3 text-xs">
        <Link to="/catalog" className="hidden font-semibold text-ink hover:underline sm:inline">
          Product Catalog
        </Link>
        <Link to="/neft-verification" className="hidden font-semibold text-ink hover:underline sm:inline">
          NEFT Verification
        </Link>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line-light bg-panel"
          title={socketConnected ? 'Live connection active' : 'Connecting…'}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-[#2f7d32] shadow-[0_0_0_4px_rgba(47,125,50,0.12)]' : 'bg-[#ccc]'}`} />
        </div>
        <span className="hidden sm:inline">
          {user?.fullName} <span className="text-muted">({user?.role})</span>
        </span>
        <Button onClick={logout}>Log out</Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="w-full flex-none border-b border-line-light bg-white/90 p-5 lg:min-h-[calc(100vh-65px)] lg:w-96 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Agent Approvals</h2>
              <p className="mt-1 text-xs text-muted">Review agency registrations and account status.</p>
            </div>
            <Badge tone="grey">{agencies.length}</Badge>
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)}>
                <Tag active={statusFilter === tab.value}>{tab.label}</Tag>
              </button>
            ))}
          </div>

          {loading && <p className="rounded-lg border border-line-light bg-panel px-3 py-2 text-xs text-muted">Loading…</p>}
          <ErrorText>{error}</ErrorText>

          {!loading && agencies.length === 0 && (
            <p className="rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">No agencies in this view.</p>
          )}

          <div className="space-y-3">
            {agencies.map((agency) => (
              <button
                key={agency.id}
                type="button"
                onClick={() => setSelectedId(agency.id)}
                className={`block w-full rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  agency.id === selectedId ? 'border-accent bg-[#fff8f4]' : 'border-line-light bg-white'
                }`}
              >
                <div className="text-sm font-bold">{agency.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span>{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</span>
                  <span>·</span>
                  <span>{agency.country}</span>
                </div>
                <Badge tone={STATUS_BADGE[agency.status] || 'grey'} className="mt-3">
                  {agency.status}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-5 lg:p-8">
          {!selected && <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted">Select an agency from the list.</p>}

          {selected && (
            <div className="max-w-3xl">
              <div className="mb-5 rounded-xl border border-line-light bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold">{selected.name}</h3>
                    <div className="mt-1 text-sm text-muted">
                      Registered {new Date(selected.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge tone={STATUS_BADGE[selected.status] || 'grey'}>{selected.status}</Badge>
                </div>
              </div>

              <Card label="Submitted details" className="mb-5 border-white">
                <div className="grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
                  <div className="rounded-md bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase text-muted">Type</div>
                    <div>{selected.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</div>
                  </div>
                  <div className="rounded-md bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase text-muted">Country</div>
                    <div>{selected.country}</div>
                  </div>
                  <div className="rounded-md bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase text-muted">License / IATA no.</div>
                    <div>{selected.licenseNumber || '—'}</div>
                  </div>
                  <div className="rounded-md bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase text-muted">Current status</div>
                    <div className="mt-1">
                      <Badge tone={STATUS_BADGE[selected.status] || 'grey'}>{selected.status}</Badge>
                    </div>
                  </div>
                  {selected.tier && (
                    <div className="rounded-md bg-panel px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-muted">Current tier</div>
                      <div>{selected.tier}</div>
                    </div>
                  )}
                </div>
              </Card>

              {isSuperAdmin ? (
                <DecisionPanel agency={selected} team={team} onDecided={handleDecided} />
              ) : (
                <p className="rounded-lg border border-line-light bg-white p-4 text-sm text-muted shadow-sm">
                  Only Super Admins can approve, reject, or reassign agencies — you're viewing
                  this read-only.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
