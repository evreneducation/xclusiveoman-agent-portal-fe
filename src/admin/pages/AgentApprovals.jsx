import { useEffect, useState } from 'react';
import { LuFileText, LuUserRound } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Pagination, Table, Tag, TextInput } from '../components/ui.jsx';

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

const PAGE_SIZE = 10;

// Same page-chrome convention as every other paginated admin list
// (Support.jsx, QuoteInbox.jsx, OperationsList.jsx, BookingsDocuments.jsx):
// a centered `max-w-6xl` column, not a full-bleed table.
function Modal({ title, onClose, children, footer, size = 'md' }) {
  const sizeClass = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[85vh] w-full ${sizeClass} flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

function FieldTile({ label, children }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}

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

// A quick, read-only glance at who the agency is — no decision controls.
// "View Profile" and "View Details" both open a modal over the same table
// (there's no separate agency-profile route in this app to link out to);
// this is the shorter of the two, "View Details" below is the full
// submitted-details + decision workflow.
function AgencyProfileModal({ agency, onClose }) {
  return (
    <Modal title={agency.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4 flex items-center gap-2">
        <Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge>
        <span className="text-xs text-muted">Registered {new Date(agency.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="Type">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</FieldTile>
        <FieldTile label="Country">{agency.country}</FieldTile>
        <FieldTile label="License / IATA no.">{agency.licenseNumber || '—'}</FieldTile>
        <FieldTile label="Relationship Manager">{agency.rmName || '—'}</FieldTile>
        {agency.tier && <FieldTile label="Current tier"><span className="capitalize">{agency.tier}</span></FieldTile>}
        {agency.creditLimit != null && (
          <FieldTile label="Credit limit">₹{Number(agency.creditLimit).toLocaleString('en-IN')}</FieldTile>
        )}
      </div>
    </Modal>
  );
}

// The full workflow view — submitted details plus (for Super Admins) the
// approve/reject/deactivate/reactivate decision panel.
function AgencyDetailsModal({ agency, isSuperAdmin, onClose, onDecided }) {
  return (
    <Modal title={`${agency.name} — Details`} onClose={onClose} size="lg">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line-light bg-panel/60 p-4">
        <div className="text-sm text-muted">Registered {new Date(agency.createdAt).toLocaleDateString()}</div>
        <Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge>
      </div>

      <Card label="Submitted details" className="mb-5 border-white">
        <div className="grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
          <FieldTile label="Type">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</FieldTile>
          <FieldTile label="Country">{agency.country}</FieldTile>
          <FieldTile label="License / IATA no.">{agency.licenseNumber || '—'}</FieldTile>
          {agency.tier && <FieldTile label="Current tier"><span className="capitalize">{agency.tier}</span></FieldTile>}
          {agency.creditLimit != null && (
            <FieldTile label="Credit limit">₹{Number(agency.creditLimit).toLocaleString('en-IN')}</FieldTile>
          )}
          {agency.rmUserId && (
            <div className="rounded-md bg-panel px-3 py-2">
              <div className="text-[10px] font-semibold uppercase text-muted">Relationship Manager</div>
              <div>{agency.rmName || 'Assigned'}</div>
              <div className="text-[10px] text-muted">Assigned automatically, round-robin</div>
            </div>
          )}
        </div>
      </Card>

      {isSuperAdmin ? (
        <DecisionPanel agency={agency} onDecided={onDecided} />
      ) : (
        <p className="rounded-lg border border-line-light bg-white p-4 text-sm text-muted shadow-sm">
          Only Super Admins can approve, reject, or reassign agencies — you're viewing this read-only.
        </p>
      )}
    </Modal>
  );
}

export default function AgentApprovals() {
  const { isSuperAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [agencies, setAgencies] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [profileAgency, setProfileAgency] = useState(null);
  const [detailsAgency, setDetailsAgency] = useState(null);

  function updateStatusFilter(v) {
    setStatusFilter(v);
    setPage(1);
  }
  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  // Pagination is fully server-side (Task: Agent Approvals table) — every
  // filter (status, search) *and* the page slicing itself round-trip to
  // GET /admin/agencies, matching the convention every other paginated
  // admin list already uses (Support.jsx, QuoteInbox.jsx). No page of
  // agencies beyond the current 10 is ever fetched to the browser.
  async function loadAgencies() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const { agencies: list, pagination: p } = await api.get(`/admin/agencies?${params.toString()}`);
      setAgencies(list);
      setPagination(p);
    } catch (err) {
      setError(err.message || 'Unable to load agencies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page]);

  function handleDecided(updatedAgency) {
    setDetailsAgency(updatedAgency);
    // A status-filtered view (e.g. "Pending") should drop the agency, and
    // the total count for this view has changed either way — simplest to
    // just re-fetch the current page from the server rather than patch
    // local state and second-guess whether the count/ordering still match.
    if (statusFilter && updatedAgency.status !== statusFilter) {
      setDetailsAgency(null);
    }
    loadAgencies();
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Agent Approvals</h2>
            <p className="mt-1.5 text-sm text-muted">Review agency registrations and account status.</p>
          </div>
          <Badge tone="grey">{pagination.total} Total Agencies</Badge>
        </div>

        <Card className="mb-5 border-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TextInput
              className="lg:max-w-sm"
              placeholder="Search by agency, country, or license no…"
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button key={tab.value} type="button" onClick={() => updateStatusFilter(tab.value)}>
                  <Tag active={statusFilter === tab.value}>{tab.label}</Tag>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <ErrorText>{error}</ErrorText>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : agencies.length === 0 ? (
          <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted shadow-sm">
            {search || statusFilter ? 'No agencies match this view.' : 'No agencies yet.'}
          </p>
        ) : (
          <>
            <Table
              columns={['Agency', 'Type', 'Country', 'License / IATA no.', 'Relationship Manager', 'Status', { label: 'Actions', align: 'right' }]}
              rows={agencies}
              renderRow={(agency) => (
                <tr key={agency.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                  <td className="px-3 py-3 align-middle">
                    <div className="font-semibold text-ink">{agency.name}</div>
                    <div className="text-[11px] text-muted">Registered {new Date(agency.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{agency.country}</td>
                  <td className="px-3 py-3 align-middle">{agency.licenseNumber || '—'}</td>
                  <td className="px-3 py-3 align-middle">
                    {agency.rmName ? (
                      <>
                        <div className="whitespace-nowrap">{agency.rmName}</div>
                        <div className="whitespace-nowrap text-[11px] text-muted">Assigned automatically</div>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {/* flex-nowrap, not flex-wrap — the previous version wrapped
                        onto two ragged rows even where there was room, because
                        the table's auto layout gave this column just enough
                        width to fit one button. Forcing one row here (the
                        outer overflow-x-auto wrapper scrolls horizontally on
                        a narrow viewport instead) keeps every row the same
                        height and the buttons flush to the column's right edge. */}
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                      <Button size="sm" className="whitespace-nowrap" onClick={() => setDetailsAgency(agency)}>
                        <LuFileText className="mr-1.5 flex-shrink-0" size={14} />
                        View Details
                      </Button>
                      <Button size="sm" className="whitespace-nowrap" onClick={() => setProfileAgency(agency)}>
                        <LuUserRound className="mr-1.5 flex-shrink-0" size={14} />
                        View Profile
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            />

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={setPage}
              itemLabel="agencies"
            />
          </>
        )}
      </div>

      {profileAgency && <AgencyProfileModal agency={profileAgency} onClose={() => setProfileAgency(null)} />}
      {detailsAgency && (
        <AgencyDetailsModal
          agency={detailsAgency}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setDetailsAgency(null)}
          onDecided={handleDecided}
        />
      )}
    </div>
  );
}
