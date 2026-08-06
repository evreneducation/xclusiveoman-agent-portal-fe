import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Tag, TextInput } from '../components/ui.jsx';

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

// What the panel actually lets an admin *do* next depends entirely on the
// agency's current status — a pending agency gets the tier/credit + Approve/
// Reject decision; an already-approved one only gets Deactivate; a suspended
// one only gets Reactivate; a rejected one has no further action here. Each
// status renders its own single, unambiguous action instead of always
// showing the pending-decision form (which is what made an already-approved
// agency still show an "Approve Agency" button).
const DECISION_COPY = {
  approved: {
    hint: 'This agency is active and can sign in, browse, and book. Deactivating suspends their access without deleting their data — their tier and credit limit are kept for when they\'re reactivated.',
    actionLabel: 'Deactivate Agency',
    actionLabelBusy: 'Deactivating…',
    nextStatus: 'suspended',
    actionVariant: 'danger',
  },
  suspended: {
    hint: 'This agency is suspended and cannot sign in. Reactivating restores their previous tier and credit limit.',
    actionLabel: 'Reactivate Agency',
    actionLabelBusy: 'Reactivating…',
    nextStatus: 'approved',
    actionVariant: 'accent',
  },
  rejected: {
    hint: 'This registration was rejected. No further action is available here.',
    actionLabel: null,
  },
};

function DecisionPanel({ agency, onDecided }) {
  const [tier, setTier] = useState(agency.tier || 'gold');
  const [creditLimit, setCreditLimit] = useState(agency.creditLimit ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    setTier(agency.tier || 'gold');
    setCreditLimit(agency.creditLimit ?? '');
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
        // No rmUserId here — the backend assigns the next Relationship
        // Manager automatically (round-robin) the moment status flips to
        // 'approved'.
      }
      const { agency: updated } = await api.patch(`/admin/agencies/${agency.id}`, payload);
      onDecided(updated);
    } catch (err) {
      setError(err.message || 'Unable to update agency');
    } finally {
      setSubmitting('');
    }
  }

  const isPending = agency.status === 'pending';
  const decisionCopy = DECISION_COPY[agency.status];

  return (
    <Card label="Decision" className="border-white shadow-sm">
      <div className="space-y-4 text-sm">
        {isPending && (
          <>
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
              <FieldLabel>Credit limit (INR)</FieldLabel>
              <TextInput
                type="number"
                min="0"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            <p className="rounded-md bg-panel px-3 py-2 text-xs text-muted">
              A Relationship Manager is assigned automatically (round-robin) on approval — no need to pick one.
            </p>
          </>
        )}

        {decisionCopy && <p className="rounded-md bg-panel px-3 py-2 text-xs text-muted">{decisionCopy.hint}</p>}

        <ErrorText>{error}</ErrorText>

        <div className="flex flex-wrap gap-2 pt-1">
          {isPending && (
            <>
              <Button variant="accent" className="flex-1 sm:flex-none" disabled={!!submitting} onClick={() => decide('approved')}>
                {submitting === 'approved' ? 'Approving…' : 'Approve Agency'}
              </Button>
              <Button variant="danger" disabled={!!submitting} onClick={() => decide('rejected')}>
                {submitting === 'rejected' ? 'Rejecting…' : 'Reject'}
              </Button>
            </>
          )}
          {decisionCopy?.actionLabel && (
            <Button variant={decisionCopy.actionVariant} disabled={!!submitting} onClick={() => decide(decisionCopy.nextStatus)}>
              {submitting === decisionCopy.nextStatus ? decisionCopy.actionLabelBusy : decisionCopy.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AgentApprovals() {
  const { isSuperAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [agencies, setAgencies] = useState([]);
  const [search, setSearch] = useState('');
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

  // Client-side — the status tabs already round-trip to the API, and this
  // list is a single admin's agency roster (never paginated), so filtering
  // the already-fetched page by name/country/license is enough without a
  // second network round-trip per keystroke.
  const filteredAgencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter((a) =>
      [a.name, a.country, a.licenseNumber].some((field) => field && field.toLowerCase().includes(q))
    );
  }, [agencies, search]);

  const selected = useMemo(() => agencies.find((a) => a.id === selectedId) || null, [agencies, selectedId]);

  function handleDecided(updatedAgency) {
    setAgencies((list) => list.map((a) => (a.id === updatedAgency.id ? updatedAgency : a)));
    // A pending-only view should drop the agency once it's no longer pending.
    if (statusFilter && updatedAgency.status !== statusFilter) {
      loadAgencies();
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="flex flex-col lg:flex-row">
        <div className="w-full flex-none border-b border-line-light bg-white/90 p-6 lg:min-h-screen lg:w-[26rem] lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Agent Approvals</h2>
              <p className="mt-1.5 text-sm text-muted">Review agency registrations and account status.</p>
            </div>
            <Badge tone="grey">{filteredAgencies.length}</Badge>
          </div>
          <div className="mb-3">
            <TextInput
              placeholder="Search by agency, country, or license no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
          {!loading && agencies.length > 0 && filteredAgencies.length === 0 && (
            <p className="rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">No agencies match that search.</p>
          )}

          <div className="space-y-3">
            {filteredAgencies.map((agency) => (
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
                {agency.rmName && (
                  <div className="mt-2 text-[11px] text-muted">
                    RM: <span className="font-semibold text-ink">{agency.rmName}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-10">
          {!selected && <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted">Select an agency from the list.</p>}

          {selected && (
            <div className="max-w-4xl">
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
                  {/* Current status is already shown as the badge in the header above —
                      repeating it here just duplicated it and made the grid feel cluttered. */}
                  {selected.tier && (
                    <div className="rounded-md bg-panel px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-muted">Current tier</div>
                      <div className="capitalize">{selected.tier}</div>
                    </div>
                  )}
                  {selected.creditLimit != null && (
                    <div className="rounded-md bg-panel px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-muted">Credit limit</div>
                      <div>₹{Number(selected.creditLimit).toLocaleString('en-IN')}</div>
                    </div>
                  )}
                  {selected.rmUserId && (
                    <div className="rounded-md bg-panel px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-muted">Relationship Manager</div>
                      <div>{selected.rmName || 'Assigned'}</div>
                      <div className="text-[10px] text-muted">Assigned automatically, round-robin</div>
                    </div>
                  )}
                </div>
              </Card>

              {isSuperAdmin ? (
                <DecisionPanel agency={selected} onDecided={handleDecided} />
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
