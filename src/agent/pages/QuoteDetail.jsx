import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Table, Textarea } from '../components/ui.jsx';
import ItineraryTimeline from '../components/ItineraryTimeline.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Item 2 — agent-facing status labels/tones match the wireframe's colour
// language (green = good, amber = in progress, red = stop).
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

// Item 3 — same shape as the admin Quote Details' CatalogGrid, themed for
// the agent portal. No price is ever rendered here (blind pricing extends
// to the agent's own view of their selections, same as the builder itself).
function CatalogList({ label, items, empty, renderMeta }) {
  return (
    <Card label={label} className="border-white">
      {items.length === 0 ? (
        <p className="text-sm text-agent-muted">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" className="h-24 w-full rounded-md border border-agent-line-light object-cover" />
              ) : item.images !== undefined ? (
                <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-agent-line-light font-mono text-[9px] text-agent-muted">
                  No image
                </div>
              ) : null}
              <div className="mt-2 text-sm font-bold">{item.name}</div>
              <div className="text-xs text-agent-muted">{renderMeta(item)}</div>
              {item.description && <p className="mt-1 text-xs text-agent-muted">{item.description}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Same contact-card pattern as Support.jsx's Relationship Manager card
// (REL-4: Lead Manager's contact card once assigned to this enquiry).
function LeadManagerCard({ leadManager }) {
  if (!leadManager) {
    return (
      <Card label="Your Lead Manager for this enquiry" className="border-white">
        <p className="text-sm text-agent-muted">Not assigned yet — one of our team will pick this up shortly.</p>
      </Card>
    );
  }

  const initials = (leadManager.fullName || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-start gap-4 rounded-xl border border-agent-line-light bg-white p-5 shadow-sm">
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-agent-ink text-sm font-bold text-white shadow-sm">
        {initials}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase text-agent-muted">Your Lead Manager for this enquiry</div>
        <div className="text-base font-bold text-agent-ink">
          {leadManager.fullName} <span className="font-normal text-agent-muted">— Xclusive Oman</span>
        </div>
        <div className="mt-1 text-sm text-agent-muted">
          {leadManager.email} {leadManager.phone ? `· ${leadManager.phone}` : ''}
        </div>
        {leadManager.whatsappNumber && (
          <a
            href={`https://wa.me/${leadManager.whatsappNumber.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#2f7d32] bg-[#eef7ee] px-3 py-1.5 text-[11px] font-semibold text-[#2f7d32]"
          >
            💬 Chat on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// Item 5 — only ever rendered while status === 'published'.
function AgentActions({ packageRequest, onUpdated }) {
  const [mode, setMode] = useState(''); // '' | 'revision' | 'decline'
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [error, setError] = useState('');

  async function respond(action, extra = {}) {
    setError('');
    setSubmitting(action);
    try {
      const { packageRequest: updated } = await api.post(`/package-requests/${packageRequest.id}/respond`, { action, ...extra });
      onUpdated(updated);
      setMode('');
      setComments('');
    } catch (err) {
      setError(err.message || 'Unable to submit your response');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <Card label="Your response" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        Review the final selling price above, then accept, ask for a revision, or decline this quote.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" disabled={!!submitting} onClick={() => respond('accept')}>
          {submitting === 'accept' ? 'Accepting…' : 'Accept Quote'}
        </Button>
        <Button disabled={!!submitting} onClick={() => setMode((m) => (m === 'revision' ? '' : 'revision'))}>
          Request Revision
        </Button>
        <Button variant="danger" disabled={!!submitting} onClick={() => setMode((m) => (m === 'decline' ? '' : 'decline'))}>
          Decline Quote
        </Button>
      </div>

      {mode === 'revision' && (
        <div className="mt-3">
          <FieldLabel>What would you like changed? *</FieldLabel>
          <Textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. Please look for a 4-star alternative closer to the beach…"
          />
          <Button className="mt-2" variant="accent" disabled={!!submitting || !comments.trim()} onClick={() => respond('revision', { comments })}>
            {submitting === 'revision' ? 'Sending…' : 'Send Revision Request'}
          </Button>
        </div>
      )}

      {mode === 'decline' && (
        <div className="mt-3">
          <FieldLabel>Reason (optional)</FieldLabel>
          <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional — let us know why" />
          <Button className="mt-2" variant="danger" disabled={!!submitting} onClick={() => respond('decline', { comments })}>
            {submitting === 'decline' ? 'Declining…' : 'Confirm Decline'}
          </Button>
        </div>
      )}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

// Item 6 — timeline. Only the events the agent-facing API returns (Draft
// Saved/Submitted/Lead Manager Assigned/Quote Published/Accepted/Revision
// Requested/Declined) — costing/markup edits are admin-internal and never
// included in this list by the backend.
function ActivityHistory({ history }) {
  return (
    <Card label="Timeline" className="border-white">
      {!history || history.length === 0 ? (
        <p className="text-sm text-agent-muted">No activity yet.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-agent-line-light pl-4">
          {history.map((event, idx) => (
            <li key={idx} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-agent-ink" />
              <div className="text-sm font-semibold text-agent-ink">{event.label}</div>
              <div className="text-xs text-agent-muted">
                {event.at ? new Date(event.at).toLocaleString() : '—'}
                {event.by ? ` · ${event.by}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [packageRequest, setPackageRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get(`/package-requests/${id}`)
      .then(({ packageRequest: pr }) => setPackageRequest(pr))
      .catch((err) => setError(err.message || 'Unable to load this quote'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Item 7 — the admin side emits quote:status_changed (agency:<id> room,
  // already joined on login) whenever a Lead Manager is assigned or the
  // quote is (re)published, so this reloads live instead of on next visit.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    function handleStatusChanged(payload) {
      if (payload?.packageRequestId === id) load();
    }
    socket.on('quote:status_changed', handleStatusChanged);
    return () => socket.off('quote:status_changed', handleStatusChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isPublishedOrLater =
    packageRequest && ['published', 'accepted', 'revision_requested', 'declined', 'converted'].includes(packageRequest.status);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-5 lg:p-8">
      <button onClick={() => navigate('/agent/fit-requests')} className="text-xs text-agent-muted hover:text-agent-ink">
        ← Back to My FIT Requests
      </button>

      {loading && <p className="text-sm text-agent-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {packageRequest && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-agent-ink">Custom FIT Quote</h2>
              <p className="font-mono text-xs text-agent-muted">Quote ID: {packageRequest.id}</p>
            </div>
            <Badge tone={STATUS_TONE[packageRequest.status] || 'grey'}>{packageRequest.statusLabel}</Badge>
          </div>

          <Card label="Trip information" className="border-white">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[10px] font-semibold uppercase text-agent-muted">Destination</dt>
                <dd>{packageRequest.destination || '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-agent-muted">Travel dates</dt>
                <dd>
                  {packageRequest.dateFrom ? new Date(packageRequest.dateFrom).toLocaleDateString() : '—'} –{' '}
                  {packageRequest.dateTo ? new Date(packageRequest.dateTo).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-agent-muted">Adults</dt>
                <dd>{packageRequest.paxAdults}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-agent-muted">Children</dt>
                <dd>{packageRequest.paxChildren}</dd>
              </div>
            </dl>
          </Card>

          {/* Item 4 — Published Quote: Final Selling Price only, never the
              landing cost/markup behind it (blind pricing, FIT-6). */}
          {isPublishedOrLater && (
            <Card label="Published quote" className="border-white">
              <div className="flex items-center justify-between rounded-md bg-agent-panel px-4 py-3">
                <span className="text-sm font-semibold text-agent-ink">Final Selling Price</span>
                <span className="text-lg font-bold text-agent-accent-dark">{formatCurrency(packageRequest.sellPrice)}</span>
              </div>
              {packageRequest.publishedAt && (
                <p className="mt-2 text-xs text-agent-muted">Published {new Date(packageRequest.publishedAt).toLocaleString()}</p>
              )}
            </Card>
          )}

          {/* Inclusions/Exclusions — admin-authored free text set alongside
              costing when the quotation was prepared (Quote Inbox's Costing
              panel), read-only here, same gating as the Published Quote
              card above (not shown until the admin has actually published). */}
          {isPublishedOrLater && (packageRequest.inclusions || packageRequest.exclusions) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {packageRequest.inclusions && (
                <Card label="Inclusions" className="border-white">
                  <p className="whitespace-pre-line text-sm text-agent-ink">{packageRequest.inclusions}</p>
                </Card>
              )}
              {packageRequest.exclusions && (
                <Card label="Exclusions" className="border-white">
                  <p className="whitespace-pre-line text-sm text-agent-ink">{packageRequest.exclusions}</p>
                </Card>
              )}
            </div>
          )}

          <LeadManagerCard leadManager={packageRequest.leadManager} />

          <Card label="Traveller details" className="border-white">
            {packageRequest.travelers.length === 0 ? (
              <p className="text-sm text-agent-muted">No traveller details captured.</p>
            ) : (
              <Table
                columns={['Name', 'Passport No.', 'DOB', 'Room share']}
                rows={packageRequest.travelers}
                renderRow={(t) => (
                  <tr key={t.id} className="border-b border-agent-line-light last:border-0">
                    <td className="px-3 py-2 font-semibold">{t.name}</td>
                    <td className="px-3 py-2">{t.passportNo || '—'}</td>
                    <td className="px-3 py-2">{t.dob ? new Date(t.dob).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2">{t.roomShareGroup || '—'}</td>
                  </tr>
                )}
              />
            )}
          </Card>

          <CatalogList
            label="Selected hotel"
            items={packageRequest.hotels}
            empty="No hotel selected."
            renderMeta={(h) => `${h.city || '—'}${h.category ? ` · ${h.category}★` : ''}`}
          />
          <CatalogList
            label="Selected tours"
            items={packageRequest.tours}
            empty="No tours selected."
            renderMeta={(t) => `${t.city || '—'}${t.category ? ` · ${t.category}` : ''}${t.duration ? ` · ${t.duration}` : ''}`}
          />
          <CatalogList
            label="Selected transfers"
            items={packageRequest.transfers}
            empty="No transfers selected."
            renderMeta={(t) => `${t.type ? t.type.replace(/_/g, ' ') : '—'}${t.vehicleClass ? ` · ${t.vehicleClass}` : ''}${t.city ? ` · ${t.city}` : ''}`}
          />
          <CatalogList
            label="Selected extras"
            items={packageRequest.activities}
            empty="No extras selected."
            renderMeta={(a) => `${a.city || '—'}${a.duration ? ` · ${a.duration}` : ''}`}
          />

          {/* Day-wise Itinerary Planner (FIT-5) — whatever's here is exactly
              what was submitted, or what the admin has since rearranged;
              both write through the same rows this reads. */}
          <ItineraryTimeline
            days={packageRequest.itinerary}
            emptyLabel="No day-wise itinerary was added for this request."
          />

          {packageRequest.status === 'published' && <AgentActions packageRequest={packageRequest} onUpdated={setPackageRequest} />}

          <ActivityHistory history={packageRequest.activityHistory} />
        </>
      )}
    </div>
  );
}
