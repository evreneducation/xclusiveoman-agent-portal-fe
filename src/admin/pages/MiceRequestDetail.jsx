import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Card, ErrorText, FieldLabel, Select, Button, Tag, TextInput, Textarea } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

const STATUS_TONE = {
  submitted: 'amber',
  rfp_dispatched: 'grey',
  supplier_responses_pending: 'grey',
  supplier_responses_received: 'grey',
  costed: 'grey',
  published: 'green',
  accepted: 'green',
  negotiating: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

function formatStatus(status) {
  return status.replace(/_/g, ' ');
}

// Same shape as Quote Details' CatalogGrid (QuoteInboxDetail.jsx) — kept as
// its own copy rather than a shared import since neither page exports one.
function CatalogGrid({ label, items, empty, renderMeta }) {
  return (
    <Card label={label} className="border-white">
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-line-light p-3 shadow-sm">
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" className="h-24 w-full rounded-md border border-line-light object-cover" />
              ) : item.images !== undefined ? (
                <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[9px] text-muted">
                  No image
                </div>
              ) : null}
              <div className="mt-2 text-sm font-bold">{item.name}</div>
              <div className="text-xs text-muted">{renderMeta(item)}</div>
              {item.description && <p className="mt-1 text-xs text-muted">{item.description}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Same shape/behaviour as Quote Details' LeadManagerAssignment
// (QuoteInboxDetail.jsx) — the doc's mice_rfqs pipeline has no 'assigned'
// status (assignment happens alongside costing, MICE-10), so unlike Custom
// FIT this never changes `status`, only `leadManager`.
function LeadManagerAssignment({ miceRfq, onUpdated }) {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(miceRfq.leadManager?.id || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/admin/mice-rfqs/lead-manager-candidates')
      .then(({ staff }) => setCandidates(staff))
      .catch((err) => setError(err.message || 'Unable to load staff'));
  }, []);

  useEffect(() => {
    setSelected(miceRfq.leadManager?.id || '');
  }, [miceRfq.leadManager]);

  async function handleAssign() {
    setError('');
    setSubmitting(true);
    try {
      const { miceRfq: updated } = await api.patch(`/admin/mice-rfqs/${miceRfq.id}/lead-manager`, {
        leadManagerUserId: selected || null,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to assign Lead Manager');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Lead Manager" className="border-white">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <FieldLabel>Assign a Lead Manager</FieldLabel>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Unassigned</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.role.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="accent" disabled={submitting} onClick={handleAssign}>
          {submitting ? 'Saving…' : 'Save Assignment'}
        </Button>
      </div>
      {miceRfq.leadManager && (
        <p className="mt-3 text-xs text-muted">
          Currently assigned to <span className="font-semibold text-ink">{miceRfq.leadManager.fullName}</span> (
          {miceRfq.leadManager.email})
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function sumPrices(items, key) {
  return (items || []).reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

// One Landing Cost Breakdown row: the Product Catalog auto total for this
// component (0 for Venue/Miscellaneous — no catalog source), an editable
// override, and the effective total. Same shape as Quote Details'
// CostComponentField (QuoteInboxDetail.jsx). An empty override input means
// "use the auto total".
function CostComponentField({ label, auto, value, onChange }) {
  const total = value !== '' ? Number(value) : auto;
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-line-light p-3 sm:grid-cols-3 sm:items-center">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted">Auto (Product Catalog): {formatCurrency(auto)}</div>
      </div>
      <div>
        <FieldLabel>Override</FieldLabel>
        <TextInput
          type="number"
          min="0"
          placeholder={`Auto — ${formatCurrency(auto)}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="sm:text-right">
        <div className="text-[10px] font-semibold uppercase text-muted">{label} total</div>
        <div className="text-sm font-bold">{formatCurrency(total)}</div>
      </div>
    </div>
  );
}

const MARKUP_TYPES = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
];

// Landing Cost Breakdown, Editable Costing, Markup section, Quote Summary,
// Internal Notes, and Save Draft / Publish Proposal (items 1-7) — one
// component since they all share the same live-recalculated figures and the
// same save, mirroring Quote Details' CostingAndPublishing.
function CostingAndPublishing({ miceRfq, onUpdated }) {
  const [hotelCost, setHotelCost] = useState(miceRfq.costing?.hotels?.override ?? '');
  const [toursActivitiesCost, setToursActivitiesCost] = useState(miceRfq.costing?.toursActivities?.override ?? '');
  const [transferCost, setTransferCost] = useState(miceRfq.costing?.transfers?.override ?? '');
  const [venueCost, setVenueCost] = useState(miceRfq.costing?.venue?.override ?? '');
  const [miscellaneousCost, setMiscellaneousCost] = useState(miceRfq.costing?.miscellaneous?.override ?? '');
  const [markupType, setMarkupType] = useState(miceRfq.markupType || 'percentage');
  const [markupValue, setMarkupValue] = useState(miceRfq.markupValue ?? '');
  const [internalNotes, setInternalNotes] = useState(miceRfq.internalNotes || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  // Computed straight from the Product Catalog prices already on
  // miceRfq.hotels/tours/transfers/activities — recalculates on every
  // keystroke without a round trip, then persisted verbatim by the backend
  // (same formula) on save so the two never drift.
  const hotelAuto = sumPrices(miceRfq.hotels, 'pricePerNight');
  const toursActivitiesAuto = sumPrices(miceRfq.tours, 'price') + sumPrices(miceRfq.activities, 'pricePerPax') * Math.max(miceRfq.groupSize || 0, 1);
  const transferAuto = sumPrices(miceRfq.transfers, 'price');

  const hotelTotal = hotelCost !== '' ? Number(hotelCost) : hotelAuto;
  const toursActivitiesTotal = toursActivitiesCost !== '' ? Number(toursActivitiesCost) : toursActivitiesAuto;
  const transferTotal = transferCost !== '' ? Number(transferCost) : transferAuto;
  const venueTotal = venueCost !== '' ? Number(venueCost) : 0;
  const miscTotal = miscellaneousCost !== '' ? Number(miscellaneousCost) : 0;
  const landingCost = hotelTotal + toursActivitiesTotal + transferTotal + venueTotal + miscTotal;

  const markupNumber = Number(markupValue) || 0;
  const markupAmount = markupType === 'percentage' ? (landingCost * markupNumber) / 100 : markupNumber;
  const sellPrice = landingCost + markupAmount;

  const isPublished = ['published', 'accepted', 'negotiating', 'declined', 'expired', 'converted'].includes(miceRfq.status);

  function buildPayload() {
    return {
      hotelCost: hotelCost === '' ? null : Number(hotelCost),
      toursActivitiesCost: toursActivitiesCost === '' ? null : Number(toursActivitiesCost),
      transferCost: transferCost === '' ? null : Number(transferCost),
      venueCost: venueCost === '' ? null : Number(venueCost),
      miscellaneousCost: miscellaneousCost === '' ? null : Number(miscellaneousCost),
      markupType,
      markupValue: markupNumber,
      internalNotes,
    };
  }

  async function saveDraft() {
    setError('');
    setSubmitting('draft');
    try {
      const { miceRfq: updated } = await api.patch(`/admin/mice-rfqs/${miceRfq.id}/costing`, buildPayload());
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to save costing');
    } finally {
      setSubmitting('');
    }
  }

  // Item 9: block obviously-invalid publishes before the round trip, but the
  // backend re-validates against what actually got saved either way.
  async function publishProposal() {
    setError('');
    if (!miceRfq.leadManager) {
      setError('Assign a Lead Manager before publishing.');
      return;
    }
    if (!(sellPrice > 0)) {
      setError('Final Selling Price is invalid — check the costing and markup.');
      return;
    }
    setSubmitting('publish');
    try {
      // Save first so costing/markup/notes are persisted even if the publish
      // step below fails validation — nothing the admin just typed is lost.
      const { miceRfq: saved } = await api.patch(`/admin/mice-rfqs/${miceRfq.id}/costing`, buildPayload());
      onUpdated(saved);
      const { miceRfq: published } = await api.post(`/admin/mice-rfqs/${miceRfq.id}/publish`);
      onUpdated(published);
    } catch (err) {
      setError(err.message || 'Unable to publish proposal');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <>
      <Card label="Landing Cost Breakdown" className="border-white">
        <p className="mb-3 text-xs text-muted">
          Hotels, Tours/Activities and Transfers are auto-calculated from the selected items' Product Catalog
          prices where possible; Venue and Miscellaneous have no catalog source and are entered manually.
          Override any component below — Landing Cost recalculates immediately.
        </p>
        <div className="space-y-3">
          <CostComponentField label="Hotels" auto={hotelAuto} value={hotelCost} onChange={setHotelCost} />
          <CostComponentField
            label="Activities / Tours"
            auto={toursActivitiesAuto}
            value={toursActivitiesCost}
            onChange={setToursActivitiesCost}
          />
          <CostComponentField label="Transfers" auto={transferAuto} value={transferCost} onChange={setTransferCost} />
          <CostComponentField label="Conference / Venue" auto={0} value={venueCost} onChange={setVenueCost} />
          <CostComponentField label="Miscellaneous" auto={0} value={miscellaneousCost} onChange={setMiscellaneousCost} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-panel px-4 py-3">
          <span className="text-sm font-semibold">Landing Cost</span>
          <span className="text-lg font-bold">{formatCurrency(landingCost)}</span>
        </div>
      </Card>

      <Card label="Pricing & Markup" className="border-white">
        <FieldLabel>Markup type</FieldLabel>
        <div className="mb-3 flex flex-wrap gap-2">
          {MARKUP_TYPES.map((m) => (
            <button key={m.value} type="button" onClick={() => setMarkupType(m.value)}>
              <Tag active={markupType === m.value}>{m.label}</Tag>
            </button>
          ))}
        </div>
        <div className="max-w-xs">
          <FieldLabel>{markupType === 'percentage' ? 'Percentage (%)' : 'Fixed amount (INR)'}</FieldLabel>
          <TextInput
            type="number"
            min="0"
            step={markupType === 'percentage' ? '0.1' : '1'}
            placeholder={markupType === 'percentage' ? 'e.g. 18' : 'e.g. 50000'}
            value={markupValue}
            onChange={(e) => setMarkupValue(e.target.value)}
          />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-panel px-4 py-3">
          <span className="text-sm font-semibold">Final Selling Price</span>
          <span className="text-lg font-bold text-accent">{formatCurrency(sellPrice)}</span>
        </div>
      </Card>

      <Card label="Quote summary" className="border-white">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md bg-panel px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase text-muted">Landing Cost</dt>
            <dd className="text-base font-bold">{formatCurrency(landingCost)}</dd>
          </div>
          <div className="rounded-md bg-panel px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase text-muted">
              Markup {markupType === 'percentage' ? `(${markupNumber || 0}%)` : '(Fixed)'}
            </dt>
            <dd className="text-base font-bold">{formatCurrency(markupAmount)}</dd>
          </div>
          <div className="rounded-md bg-panel px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase text-muted">Final Selling Price</dt>
            <dd className="text-base font-bold text-accent">{formatCurrency(sellPrice)}</dd>
          </div>
        </dl>
      </Card>

      <Card label="Internal notes — admin only, never shown to the agent" className="border-white">
        <Textarea
          rows={4}
          placeholder="Notes for the ops/finance team about this proposal…"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
        />
      </Card>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!!submitting} onClick={saveDraft}>
          {submitting === 'draft' ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button variant="accent" disabled={!!submitting || isPublished} onClick={publishProposal}>
          {submitting === 'publish' ? 'Publishing…' : isPublished ? 'Published' : 'Publish Proposal'}
        </Button>
        {miceRfq.publishedAt && (
          <span className="text-xs text-muted">
            Published {new Date(miceRfq.publishedAt).toLocaleString()}
            {miceRfq.publishedBy?.fullName ? ` by ${miceRfq.publishedBy.fullName}` : ''}
          </span>
        )}
      </div>
    </>
  );
}

function ActivityHistory({ history }) {
  return (
    <Card label="Activity timeline" className="border-white">
      {!history || history.length === 0 ? (
        <p className="text-sm text-muted">No activity yet.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-line-light pl-4">
          {history.map((event, idx) => (
            <li key={idx} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink" />
              <div className="text-sm font-semibold">{event.label}</div>
              <div className="text-xs text-muted">
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

export default function MiceRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [miceRfq, setMiceRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get(`/admin/mice-rfqs/${id}`)
      .then(({ miceRfq: mr }) => setMiceRfq(mr))
      .catch((err) => setError(err.message || 'Unable to load request'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-5xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/mice-requests')} className="text-xs text-muted hover:text-ink">
          ← Back to MICE Requests
        </button>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        <ErrorText>{error}</ErrorText>

        {miceRfq && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">MICE Request</h2>
                <p className="font-mono text-xs text-muted">Quote ID: {miceRfq.id}</p>
              </div>
              <Badge tone={STATUS_TONE[miceRfq.status] || 'grey'}>{formatStatus(miceRfq.status)}</Badge>
            </div>

            <Card label="Company & event information" className="border-white">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Company / Client</dt>
                  <dd>{miceRfq.agencyName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Contact</dt>
                  <dd>
                    {miceRfq.agentName}
                    <div className="text-xs text-muted">{miceRfq.agentEmail}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Submitted</dt>
                  <dd>{new Date(miceRfq.submittedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Destination</dt>
                  <dd>{miceRfq.destination}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Event dates</dt>
                  <dd>
                    {new Date(miceRfq.eventDateFrom).toLocaleDateString()} – {new Date(miceRfq.eventDateTo).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Group size</dt>
                  <dd>{miceRfq.groupSize} pax</dd>
                </div>
                {miceRfq.hallCapacityNeeded != null && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase text-muted">Hall capacity needed</dt>
                    <dd>{miceRfq.hallCapacityNeeded}</dd>
                  </div>
                )}
                {miceRfq.seatingStyle && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase text-muted">Seating style</dt>
                    <dd>{miceRfq.seatingStyle}</dd>
                  </div>
                )}
              </dl>
              {miceRfq.avNeeds && (
                <div className="mt-3">
                  <dt className="text-[10px] font-semibold uppercase text-muted">AV / event needs</dt>
                  <dd className="text-sm">{miceRfq.avNeeds}</dd>
                </div>
              )}
              {miceRfq.otherRequirements && (
                <div className="mt-3">
                  <dt className="text-[10px] font-semibold uppercase text-muted">Other requirements</dt>
                  <dd className="text-sm">{miceRfq.otherRequirements}</dd>
                </div>
              )}
            </Card>

            <LeadManagerAssignment miceRfq={miceRfq} onUpdated={setMiceRfq} />

            <CatalogGrid
              label={`Selected hotel(s) — ${miceRfq.hotels.length} of 3`}
              items={miceRfq.hotels}
              empty="No hotels selected."
              renderMeta={(h) => `${h.city || '—'}${h.category ? ` · ${h.category}★` : ''}`}
            />
            <CatalogGrid
              label="Selected tour(s)"
              items={miceRfq.tours}
              empty="No tours selected."
              renderMeta={(t) => `${t.city || '—'}${t.category ? ` · ${t.category}` : ''}${t.duration ? ` · ${t.duration}` : ''}`}
            />
            <CatalogGrid
              label="Selected transfer(s)"
              items={miceRfq.transfers}
              empty="No transfers selected."
              renderMeta={(t) => `${t.type ? t.type.replace(/_/g, ' ') : '—'}${t.vehicleClass ? ` · ${t.vehicleClass}` : ''}${t.city ? ` · ${t.city}` : ''}`}
            />
            <CatalogGrid
              label="Selected activities"
              items={miceRfq.activities}
              empty="No activities selected."
              renderMeta={(a) => `${a.city || '—'}${a.duration ? ` · ${a.duration}` : ''}`}
            />

            <CostingAndPublishing miceRfq={miceRfq} onUpdated={setMiceRfq} />
            <ActivityHistory history={miceRfq.activityHistory} />
          </>
        )}
      </div>
    </div>
  );
}
