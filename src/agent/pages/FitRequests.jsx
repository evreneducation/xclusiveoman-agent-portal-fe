import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { Badge, Button, Card, ErrorText, Tag } from '../components/ui.jsx';

// Merged "My Requests / Quotes" — Custom FIT (package_requests) and MICE
// (mice_rfqs) used to be two separate nav items/pages (FitRequests.jsx /
// MyMiceRequests.jsx, near-identical drafts→active→published→completed→
// declined layouts). Combined into this one page: every request — FIT or
// MICE — is tagged with a `kind` and flows through the same sections/cards,
// with a MICE-only pill on the card (see MiceTag below) as the one visual
// cue distinguishing the two, and a kind filter row narrowing which ones
// show. `/agent/mice-requests` (the old list route) now just redirects here
// (agent/App.jsx) — its own detail route (`/agent/mice-requests/:id`) is
// untouched, so every existing "View request"/back-button link elsewhere
// (MiceBuilder.jsx, MiceProposalDetail.jsx) keeps working unchanged.
const STATUS_TONE = {
  draft: 'grey',
  submitted: 'amber',
  assigned: 'amber',
  costed: 'amber',
  rfp_dispatched: 'amber',
  supplier_responses_pending: 'amber',
  supplier_responses_received: 'amber',
  negotiating: 'amber',
  published: 'teal',
  accepted: 'green',
  revision_requested: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

// "Active Requests" covers a different status set per kind (MICE has extra
// supplier-coordination statuses FIT doesn't) — kept as its own lookup
// rather than one flat array so a MICE-only status never accidentally
// matches a FIT request or vice versa.
const KIND_ACTIVE_STATUSES = {
  fit: ['submitted', 'assigned', 'costed', 'revision_requested'],
  mice: [
    'submitted',
    'rfp_dispatched',
    'supplier_responses_pending',
    'supplier_responses_received',
    'costed',
    'revision_requested',
    'negotiating',
  ],
};

// Dashboard sections — same drafts→active→published→completed→declined
// shape both original pages already used; `converted` reads as Completed
// alongside `accepted` for both kinds (an accepted+paid quote/RFQ converts
// to a booking, but is still "done" from the agent's perspective).
const SECTIONS = [
  { key: 'drafts', title: 'Drafts', match: (r) => r.status === 'draft' },
  { key: 'active', title: 'Active Requests', match: (r) => KIND_ACTIVE_STATUSES[r.kind].includes(r.status) },
  { key: 'published', title: 'Published Quotes', match: (r) => r.status === 'published' },
  { key: 'completed', title: 'Completed', match: (r) => ['accepted', 'converted'].includes(r.status) },
  { key: 'declined', title: 'Declined', match: (r) => ['declined', 'expired'].includes(r.status) },
];

const KIND_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'fit', label: 'FIT Requests' },
  { key: 'mice', label: 'MICE Requests' },
];

function formatDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  return fmt(dateFrom || dateTo);
}

// The only kind-indicator shown on a card — an unlabeled card is a plain
// FIT request, so there's no need for a symmetric "FIT" pill too.
function MiceTag() {
  return (
    <span className="inline-flex flex-none items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
      MICE
    </span>
  );
}

// Draft card: Draft badge, Last Updated, (Company Name for MICE), Destination,
// Travel/Event Dates (if available), Continue Editing / Delete Draft.
function DraftCard({ request, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const isMice = request.kind === 'mice';
  const dateRange = formatDateRange(request.dateFrom, request.dateTo);

  async function handleDelete() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setError('');
    setDeleting(true);
    try {
      await api.del(isMice ? `/mice/rfqs/${request.id}` : `/package-requests/${request.id}`);
      onDeleted(request.kind, request.id);
    } catch (err) {
      setError(err.message || 'Unable to delete draft');
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-agent-line-light bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          {isMice && request.companyName && (
            <div className="text-[10px] font-semibold uppercase text-agent-muted">{request.companyName}</div>
          )}
          <div className="text-sm font-bold text-agent-ink">{request.destination || 'Untitled destination'}</div>
          <div className="mt-1 text-xs text-agent-muted">
            {dateRange || (isMice ? 'Event dates not set yet' : 'Travel dates not set yet')}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {isMice && <MiceTag />}
          <Badge tone="grey">Draft</Badge>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-agent-muted">Last updated {new Date(request.updatedAt).toLocaleString()}</div>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="accent"
          onClick={() => navigate(isMice ? `/agent/mice-builder/${request.id}` : `/agent/package-builder/${request.id}`)}
        >
          Continue Editing
        </Button>
        <Button variant="danger" disabled={deleting} onClick={handleDelete}>
          {deleting ? 'Deleting…' : 'Delete Draft'}
        </Button>
      </div>
    </div>
  );
}

// Submitted/priced/published/etc. card: Quote ID, (Company Name for MICE),
// Destination, Dates, Group size (MICE) or Submission date (FIT), Status,
// Lead Manager, Last Updated.
function RequestCard({ request }) {
  const isMice = request.kind === 'mice';
  const dateRange = formatDateRange(request.dateFrom, request.dateTo);
  return (
    <Link
      to={isMice ? `/agent/mice-requests/${request.id}` : `/agent/fit-requests/${request.id}`}
      className="block rounded-lg border border-agent-line-light bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-agent-ink hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {isMice && request.companyName && (
            <div className="text-[10px] font-semibold uppercase text-agent-muted">{request.companyName}</div>
          )}
          <div className="text-sm font-bold text-agent-ink">{request.destination || 'Untitled destination'}</div>
          <div className="mt-1 text-xs text-agent-muted">{dateRange || 'Dates not set'}</div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {isMice && <MiceTag />}
          <Badge tone={STATUS_TONE[request.status] || 'grey'}>{request.statusLabel}</Badge>
        </div>
      </div>
      <div className="mt-2 font-mono text-[10px] text-agent-muted">Quote ID: {request.id}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-agent-muted">
        {isMice ? (
          <span>{request.groupSize ? `${request.groupSize} pax` : 'Group size —'}</span>
        ) : (
          <span>Submitted {new Date(request.createdAt).toLocaleDateString()}</span>
        )}
        <span>· Updated {new Date(request.updatedAt).toLocaleDateString()}</span>
        {request.leadManager && (
          <span>
            · Lead Manager: <span className="font-semibold text-agent-ink">{request.leadManager.fullName}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

function Section({ title, requests, onDraftDeleted }) {
  if (requests.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-agent-muted">
        {title} <span className="text-agent-line">({requests.length})</span>
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((r) =>
          r.status === 'draft' ? (
            <DraftCard key={`${r.kind}-${r.id}`} request={r} onDeleted={onDraftDeleted} />
          ) : (
            <RequestCard key={`${r.kind}-${r.id}`} request={r} />
          )
        )}
      </div>
    </div>
  );
}

export default function FitRequests() {
  const [fitRequests, setFitRequests] = useState([]);
  const [miceRequests, setMiceRequests] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Kind filter — narrows the combined list before it's grouped into the
  // status sections below (so "Active Requests (2)" etc. always reflects
  // whatever's currently visible, not the full unfiltered set).
  const [kindFilter, setKindFilter] = useState('all');

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.get('/package-requests'), api.get('/mice/rfqs'), api.get('/agencies/me')])
      .then(([{ packageRequests }, { miceRfqs }, { agency }]) => {
        setFitRequests(packageRequests);
        setMiceRequests(miceRfqs);
        setCompanyName(agency?.name || '');
      })
      .catch((err) => setError(err.message || 'Unable to load your requests'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Item 7 — live status updates (Lead Manager assigned, quote/proposal
  // published, admin responding to a revision) reuse the same socket
  // connection/room every agent page already joins on login; no new
  // notification plumbing. One shared event covers both kinds already.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    socket.on('quote:status_changed', load);
    return () => socket.off('quote:status_changed', load);
  }, []);

  function handleDraftDeleted(kind, id) {
    if (kind === 'mice') setMiceRequests((list) => list.filter((r) => r.id !== id));
    else setFitRequests((list) => list.filter((r) => r.id !== id));
  }

  // One combined, kind-tagged list — FIT and MICE requests otherwise share
  // an (almost) identical shape (destination/status/dates/leadManager), so
  // everything downstream (kind filter, section grouping, card rendering)
  // works off this single array rather than juggling two parallel ones.
  // MICE rows are normalized onto the same dateFrom/dateTo names FIT
  // already uses (their own fields are eventDateFrom/eventDateTo) and get
  // the agency's companyName attached, mirroring MyMiceRequests.jsx's own
  // per-card companyName prop.
  const allRequests = useMemo(
    () => [
      ...fitRequests.map((r) => ({ ...r, kind: 'fit' })),
      ...miceRequests.map((r) => ({ ...r, kind: 'mice', dateFrom: r.eventDateFrom, dateTo: r.eventDateTo, companyName })),
    ],
    [fitRequests, miceRequests, companyName]
  );

  const visibleRequests = kindFilter === 'all' ? allRequests : allRequests.filter((r) => r.kind === kindFilter);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="mb-1 text-2xl font-bold text-agent-ink">My Requests / Quotes</h2>
          <p className="text-sm text-agent-muted">
            Track every Custom FIT and MICE request from draft through to a published quote.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/agent/package-builder">
            <Button variant="accent">+ New FIT Request</Button>
          </Link>
          <Link to="/agent/mice-builder">
            <Button variant="accent">+ New MICE Request</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => {
          const count = f.key === 'all' ? allRequests.length : f.key === 'fit' ? fitRequests.length : miceRequests.length;
          return (
            <button key={f.key} type="button" onClick={() => setKindFilter(f.key)}>
              <Tag active={kindFilter === f.key}>
                {f.label} ({count})
              </Tag>
            </button>
          );
        })}
      </div>

      {loading && <p className="text-sm text-agent-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {!loading && visibleRequests.length === 0 && (
        <Card className="border-white text-center">
          <p className="text-sm text-agent-muted">
            {kindFilter === 'mice'
              ? "You haven't started a MICE request yet."
              : kindFilter === 'fit'
                ? "You haven't started a Custom FIT request yet."
                : "You haven't started a request yet."}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {kindFilter !== 'mice' && (
              <Link to="/agent/package-builder">
                <Button variant="accent">Start a new FIT request</Button>
              </Link>
            )}
            {kindFilter !== 'fit' && (
              <Link to="/agent/mice-builder">
                <Button variant="accent">Start a new MICE request</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <Section
            key={section.key}
            title={section.title}
            requests={visibleRequests.filter(section.match)}
            onDraftDeleted={handleDraftDeleted}
          />
        ))}
      </div>
    </div>
  );
}
