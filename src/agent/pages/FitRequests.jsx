import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx';

const STATUS_TONE = {
  draft: 'grey',
  submitted: 'amber',
  assigned: 'amber',
  costed: 'amber',
  published: 'teal',
  accepted: 'green',
  revision_requested: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

// Item 8 — dashboard sections. revision_requested sits in Active Requests
// (it's back with our team, same as submitted/assigned/costed); converted
// reads as Completed alongside accepted (FIT-13: an accepted+paid quote
// converts to a booking, but is still "done" from the agent's perspective).
const SECTIONS = [
  { key: 'drafts', title: 'Drafts', match: (r) => r.status === 'draft' },
  {
    key: 'active',
    title: 'Active Requests',
    match: (r) => ['submitted', 'assigned', 'costed', 'revision_requested'].includes(r.status),
  },
  { key: 'published', title: 'Published Quotes', match: (r) => r.status === 'published' },
  { key: 'completed', title: 'Completed', match: (r) => ['accepted', 'converted'].includes(r.status) },
  { key: 'declined', title: 'Declined', match: (r) => ['declined', 'expired'].includes(r.status) },
];

function formatDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  return fmt(dateFrom || dateTo);
}

// Item 1 — Draft card: Draft badge, Last Updated, Destination, Travel Dates
// (if available), Continue Editing / Delete Draft.
function DraftCard({ request, onDeleted }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const dateRange = formatDateRange(request.dateFrom, request.dateTo);

  async function handleDelete() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setError('');
    setDeleting(true);
    try {
      await api.del(`/package-requests/${request.id}`);
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
          <div className="text-sm font-bold text-agent-ink">{request.destination || 'Untitled destination'}</div>
          <div className="mt-1 text-xs text-agent-muted">{dateRange || 'Travel dates not set yet'}</div>
        </div>
        <Badge tone="grey">Draft</Badge>
      </div>
      <div className="mt-2 text-[11px] text-agent-muted">Last updated {new Date(request.updatedAt).toLocaleString()}</div>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="accent" onClick={() => navigate(`/agent/package-builder/${request.id}`)}>
          Continue Editing
        </Button>
        <Button variant="danger" disabled={deleting} onClick={handleDelete}>
          {deleting ? 'Deleting…' : 'Delete Draft'}
        </Button>
      </div>
    </div>
  );
}

// Item 2 — Submitted/priced/published/etc. card: Quote ID, Destination,
// Travel Dates, Submission Date, Current Status, Lead Manager, Last Updated.
function RequestCard({ request }) {
  const dateRange = formatDateRange(request.dateFrom, request.dateTo);
  return (
    <Link
      to={`/agent/fit-requests/${request.id}`}
      className="block rounded-lg border border-agent-line-light bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-agent-ink hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-agent-ink">{request.destination || 'Untitled destination'}</div>
          <div className="mt-1 text-xs text-agent-muted">{dateRange || 'Travel dates not set'}</div>
        </div>
        <Badge tone={STATUS_TONE[request.status] || 'grey'}>{request.statusLabel}</Badge>
      </div>
      <div className="mt-2 font-mono text-[10px] text-agent-muted">Quote ID: {request.id}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-agent-muted">
        <span>Submitted {new Date(request.createdAt).toLocaleDateString()}</span>
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
            <DraftCard key={r.id} request={r} onDeleted={onDraftDeleted} />
          ) : (
            <RequestCard key={r.id} request={r} />
          )
        )}
      </div>
    </div>
  );
}

export default function FitRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get('/package-requests')
      .then(({ packageRequests }) => setRequests(packageRequests))
      .catch((err) => setError(err.message || 'Unable to load your FIT requests'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Item 7 — live status updates (Lead Manager assigned, quote published,
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
          <h2 className="mb-1 text-2xl font-bold text-agent-ink">My FIT Requests / Quotes</h2>
          <p className="text-sm text-agent-muted">Track every Custom FIT request from draft through to a published quote.</p>
        </div>
        <Link to="/agent/package-builder">
          <Button variant="accent">+ Start a new FIT request</Button>
        </Link>
      </div>

      {loading && <p className="text-sm text-agent-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {!loading && requests.length === 0 && (
        <Card className="border-white text-center">
          <p className="text-sm text-agent-muted">You haven't started a Custom FIT request yet.</p>
          <Link to="/agent/package-builder">
            <Button variant="accent" className="mt-3">
              Start a new FIT request
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
            onDraftDeleted={handleDraftDeleted}
          />
        ))}
      </div>
    </div>
  );
}
