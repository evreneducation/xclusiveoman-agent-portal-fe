import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx';

const STATUS_TONE = {
  draft: 'grey',
  submitted: 'amber',
  rfp_dispatched: 'amber',
  supplier_responses_pending: 'amber',
  supplier_responses_received: 'amber',
  costed: 'amber',
  published: 'teal',
  accepted: 'green',
  revision_requested: 'amber',
  negotiating: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

// Item 2/8-style dashboard sections, mirroring "My FIT Requests / Quotes"
// (FitRequests.jsx): revision_requested/negotiating sit in Active Requests
// (still back with our team); converted reads as Completed alongside
// accepted (MICE-14: an accepted+paid RFQ converts to a booking, but is
// still "done" from the agent's perspective).
const SECTIONS = [
  { key: 'drafts', title: 'Drafts', match: (r) => r.status === 'draft' },
  {
    key: 'active',
    title: 'Active Requests',
    match: (r) =>
      ['submitted', 'rfp_dispatched', 'supplier_responses_pending', 'supplier_responses_received', 'costed', 'revision_requested', 'negotiating'].includes(
        r.status
      ),
  },
  { key: 'published', title: 'Published Proposals', match: (r) => r.status === 'published' },
  { key: 'completed', title: 'Completed', match: (r) => ['accepted', 'converted'].includes(r.status) },
  { key: 'declined', title: 'Declined', match: (r) => ['declined', 'expired'].includes(r.status) },
];

function formatDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  return fmt(dateFrom || dateTo);
}

// Item 1 — Draft card: Draft badge, Last Updated, Company Name, Destination,
// Event Dates, Continue Editing / Delete Draft.
function DraftCard({ request, companyName, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const dateRange = formatDateRange(request.eventDateFrom, request.eventDateTo);

  async function handleDelete() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setError('');
    setDeleting(true);
    try {
      await api.del(`/mice/rfqs/${request.id}`);
      onDeleted(request.id);
    } catch (err) {
      setError(err.message || 'Unable to delete draft');
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-agent-line-light bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase text-agent-muted">{companyName}</div>
          <div className="text-sm font-bold text-agent-ink">{request.destination || 'Untitled destination'}</div>
          <div className="mt-1 text-xs text-agent-muted">{dateRange || 'Event dates not set yet'}</div>
        </div>
        <Badge tone="grey">Draft</Badge>
      </div>
      <div className="mt-2 text-[11px] text-agent-muted">Last updated {new Date(request.updatedAt).toLocaleString()}</div>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="accent" onClick={() => navigate(`/agent/mice-builder/${request.id}`)}>
          Continue Editing
        </Button>
        <Button variant="danger" disabled={deleting} onClick={handleDelete}>
          {deleting ? 'Deleting…' : 'Delete Draft'}
        </Button>
      </div>
    </div>
  );
}

// Item 2 — Submitted/priced/published/etc. card: Quote ID, Company Name,
// Destination, Event Dates, Group Size, Status, Lead Manager, Last Updated.
function RequestCard({ request, companyName }) {
  const dateRange = formatDateRange(request.eventDateFrom, request.eventDateTo);
  return (
    <Link
      to={`/agent/mice-requests/${request.id}`}
      className="block rounded-lg border border-agent-line-light bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-agent-ink hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase text-agent-muted">{companyName}</div>
          <div className="text-sm font-bold text-agent-ink">{request.destination || 'Untitled destination'}</div>
          <div className="mt-1 text-xs text-agent-muted">{dateRange || 'Event dates not set'}</div>
        </div>
        <Badge tone={STATUS_TONE[request.status] || 'grey'}>{request.statusLabel}</Badge>
      </div>
      <div className="mt-2 font-mono text-[10px] text-agent-muted">Quote ID: {request.id}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-agent-muted">
        <span>{request.groupSize ? `${request.groupSize} pax` : 'Group size —'}</span>
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

function Section({ title, requests, companyName, onDraftDeleted }) {
  if (requests.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-agent-muted">
        {title} <span className="text-agent-line">({requests.length})</span>
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((r) =>
          r.status === 'draft' ? (
            <DraftCard key={r.id} request={r} companyName={companyName} onDeleted={onDraftDeleted} />
          ) : (
            <RequestCard key={r.id} request={r} companyName={companyName} />
          )
        )}
      </div>
    </div>
  );
}

export default function MyMiceRequests() {
  const [requests, setRequests] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.get('/mice/rfqs'), api.get('/agencies/me')])
      .then(([{ miceRfqs }, { agency }]) => {
        setRequests(miceRfqs);
        setCompanyName(agency?.name || '');
      })
      .catch((err) => setError(err.message || 'Unable to load your MICE requests'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Item 7 — live status updates (Lead Manager assigned, proposal published,
  // admin responding to a revision) reuse the same socket connection/room
  // every agent page already joins on login; no new notification plumbing.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    socket.on('quote:status_changed', load);
    return () => socket.off('quote:status_changed', load);
  }, []);

  function handleDraftDeleted(id) {
    setRequests((list) => list.filter((r) => r.id !== id));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="mb-1 text-2xl font-bold text-agent-ink">My MICE Requests</h2>
          <p className="text-sm text-agent-muted">Track every MICE request from draft through to a published proposal.</p>
        </div>
        <Link to="/agent/mice-builder">
          <Button variant="accent">+ Start a new MICE request</Button>
        </Link>
      </div>

      {loading && <p className="text-sm text-agent-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {!loading && requests.length === 0 && (
        <Card className="border-white text-center">
          <p className="text-sm text-agent-muted">You haven't started a MICE request yet.</p>
          <Link to="/agent/mice-builder">
            <Button variant="accent" className="mt-3">
              Start a new MICE request
            </Button>
          </Link>
        </Card>
      )}

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <Section
            key={section.key}
            title={section.title}
            requests={requests.filter(section.match)}
            companyName={companyName}
            onDraftDeleted={handleDraftDeleted}
          />
        ))}
      </div>
    </div>
  );
}
