import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Button, Card, ErrorText, FieldLabel, Select, Textarea, TextInput } from '../components/ui.jsx';

const KINDS = {
  fit: {
    label: 'FIT Quote',
    endpoint: (id) => `/admin/package-requests/${id}`,
    costingEndpoint: (id) => `/admin/package-requests/${id}/costing`,
    publishEndpoint: (id) => `/admin/package-requests/${id}/publish`,
    detailKey: 'packageRequest',
    // Every *Cost override field the backend's costing schema requires —
    // always sent as null ("use the Product Catalog auto total"). This
    // portal's costing panel only ever edits markup/notes, not individual
    // line-item overrides (that stays the Admin Console's own Quote Details
    // screen) — a deliberately smaller surface than the full admin editor.
    costingOverrides: { hotelCost: null, tourCost: null, transferCost: null, extraCost: null, visaCost: null },
  },
  mice: {
    label: 'MICE Request',
    endpoint: (id) => `/admin/mice-rfqs/${id}`,
    costingEndpoint: (id) => `/admin/mice-rfqs/${id}/costing`,
    publishEndpoint: (id) => `/admin/mice-rfqs/${id}/publish`,
    detailKey: 'miceRfq',
    costingOverrides: { hotelCost: null, toursActivitiesCost: null, transferCost: null, venueCost: null, miscellaneousCost: null },
  },
};

export default function QuoteDetail() {
  const { kind, id } = useParams();
  const cfg = KINDS[kind];
  const { isLeadManager } = useAuth();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markupType, setMarkupType] = useState('percentage');
  const [markupValue, setMarkupValue] = useState(0);
  const [internalNotes, setInternalNotes] = useState('');
  const [inclusions, setInclusions] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    api
      .get(cfg.endpoint(id))
      .then((data) => {
        const q = data[cfg.detailKey];
        setQuote(q);
        setMarkupType(q.markupType || 'percentage');
        setMarkupValue(q.markupValue ?? 0);
        setInternalNotes(q.internalNotes || '');
        setInclusions(q.inclusions || '');
        setExclusions(q.exclusions || '');
      })
      .catch((err) => setError(err.message || 'Unable to load'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCosting() {
    setError('');
    setSaving(true);
    try {
      const body = {
        ...cfg.costingOverrides,
        markupType,
        markupValue: Number(markupValue) || 0,
        internalNotes,
        ...(kind === 'fit' ? { inclusions, exclusions } : {}),
      };
      const data = await api.patch(cfg.costingEndpoint(id), body);
      setQuote(data[cfg.detailKey]);
    } catch (err) {
      setError(err.message || 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setError('');
    setPublishing(true);
    try {
      await saveCosting();
      const data = await api.post(cfg.publishEndpoint(id));
      setQuote(data[cfg.detailKey] || data.packageRequest || data.miceRfq);
    } catch (err) {
      setError(err.message || 'Unable to publish');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p className="p-10 text-xs text-team-muted">Loading…</p>;
  if (!quote) return <p className="p-10 text-sm text-team-muted">{error || 'Not found.'}</p>;

  const canEdit = isLeadManager && quote.status !== 'published' && quote.status !== 'accepted';

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 lg:p-10">
      <Link to="/team/quotes-pricing" className="text-xs font-semibold text-team-accent-dark hover:underline">
        ← Back to Quotes & Pricing
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-team-ink">{quote.agencyName}</h2>
          <p className="mt-1 text-sm text-team-muted">
            {quote.destination} — {cfg.label}
          </p>
        </div>
        <Badge tone={quote.status === 'published' || quote.status === 'accepted' ? 'green' : 'grey'}>{quote.status?.replace(/_/g, ' ')}</Badge>
      </div>

      <Card label="Request Details">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase text-team-muted">Agent</div>
            <div className="font-semibold text-team-ink">{quote.agentName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-team-muted">Submitted</div>
            <div className="font-semibold text-team-ink">{quote.submittedAt ? new Date(quote.submittedAt).toLocaleDateString() : '—'}</div>
          </div>
          {kind === 'fit' ? (
            <>
              <div>
                <div className="text-[10px] uppercase text-team-muted">Dates</div>
                <div className="font-semibold text-team-ink">{quote.dateFrom} → {quote.dateTo}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-team-muted">Pax</div>
                <div className="font-semibold text-team-ink">{quote.paxAdults} adults, {quote.paxChildren} children</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase text-team-muted">Event Dates</div>
                <div className="font-semibold text-team-ink">{quote.eventDateFrom} → {quote.eventDateTo}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-team-muted">Group Size</div>
                <div className="font-semibold text-team-ink">{quote.groupSize}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-[10px] uppercase text-team-muted">Lead Manager</div>
            <div className="font-semibold text-team-ink">{quote.leadManager?.fullName || 'Unassigned'}</div>
          </div>
        </div>
      </Card>

      <Card label="Costing & Markup">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase text-team-muted">Landing Cost (auto)</div>
            <div className="text-lg font-bold text-team-ink">{quote.landingCost != null ? quote.landingCost.toFixed(2) : '—'}</div>
          </div>
          <div>
            <FieldLabel>Markup type</FieldLabel>
            <Select value={markupType} onChange={(e) => setMarkupType(e.target.value)} disabled={!canEdit}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Markup value</FieldLabel>
            <TextInput type="number" min="0" value={markupValue} onChange={(e) => setMarkupValue(e.target.value)} disabled={!canEdit} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] uppercase text-team-muted">Sell Price</div>
          <div className="text-lg font-bold text-team-accent-dark">{quote.sellPrice != null ? quote.sellPrice.toFixed(2) : '—'}</div>
        </div>

        <div className="mt-4">
          <FieldLabel>Internal notes</FieldLabel>
          <Textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} disabled={!canEdit} />
        </div>

        {kind === 'fit' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Inclusions</FieldLabel>
              <Textarea rows={3} value={inclusions} onChange={(e) => setInclusions(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel>Exclusions</FieldLabel>
              <Textarea rows={3} value={exclusions} onChange={(e) => setExclusions(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="default" disabled={saving || publishing} onClick={saveCosting}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button variant="accent" disabled={saving || publishing} onClick={publish}>
              {publishing ? 'Publishing…' : 'Publish Quote'}
            </Button>
          </div>
        )}
        {!isLeadManager && <p className="mt-4 text-xs text-team-muted">Quotes & Pricing is view-only on your account.</p>}
      </Card>

      {quote.activityHistory?.length > 0 && (
        <Card label="Activity History">
          <div className="space-y-2 text-xs">
            {quote.activityHistory.map((a, i) => (
              <div key={i} className="flex items-center justify-between border-b border-team-line-light pb-2 last:border-0">
                <span className="text-team-ink">{a.description || a.label}</span>
                <span className="text-team-muted">{a.at ? new Date(a.at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
