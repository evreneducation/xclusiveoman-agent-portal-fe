import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Select, Table, Tag, TextInput, Textarea } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

const STATUS_TONE = {
  submitted: 'amber',
  assigned: 'grey',
  costed: 'grey',
  published: 'green',
  accepted: 'green',
  revision_requested: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

function formatStatus(status) {
  return status.replace(/_/g, ' ');
}

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

function LeadManagerAssignment({ packageRequest, onUpdated }) {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(packageRequest.leadManager?.id || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/admin/package-requests/lead-manager-candidates')
      .then(({ staff }) => setCandidates(staff))
      .catch((err) => setError(err.message || 'Unable to load staff'));
  }, []);

  useEffect(() => {
    setSelected(packageRequest.leadManager?.id || '');
  }, [packageRequest.leadManager]);

  async function handleAssign() {
    setError('');
    setSubmitting(true);
    try {
      const { packageRequest: updated } = await api.patch(`/admin/package-requests/${packageRequest.id}/lead-manager`, {
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
      {packageRequest.leadManager && (
        <p className="mt-3 text-xs text-muted">
          Currently assigned to <span className="font-semibold text-ink">{packageRequest.leadManager.fullName}</span> (
          {packageRequest.leadManager.email})
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
// component, an editable override, and the effective total (override if
// set, otherwise auto) — matches item 2's "Auto: ₹60,000 / Editable: ₹58,500"
// example. An empty override input means "use the auto total".
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

// Landing Cost Breakdown, Editable Costing, Pricing & Markup, Quote Summary,
// Internal Notes, and Save Draft / Publish Quote (items 1-6) — one component
// since they all share the same live-recalculated figures and the same save.
function CostingAndPublishing({ packageRequest, onUpdated }) {
  const [hotelCost, setHotelCost] = useState(packageRequest.costing?.hotels?.override ?? '');
  const [tourCost, setTourCost] = useState(packageRequest.costing?.tours?.override ?? '');
  const [transferCost, setTransferCost] = useState(packageRequest.costing?.transfers?.override ?? '');
  const [extraCost, setExtraCost] = useState(packageRequest.costing?.extras?.override ?? '');
  const [markupType, setMarkupType] = useState(packageRequest.markupType || 'percentage');
  const [markupValue, setMarkupValue] = useState(packageRequest.markupValue ?? '');
  const [internalNotes, setInternalNotes] = useState(packageRequest.internalNotes || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  // Computed straight from the Product Catalog prices already on
  // packageRequest.hotels/tours/transfers/activities — recalculates on every
  // keystroke without a round trip, then persisted verbatim by the backend
  // (same formula) on save so the two never drift.
  const totalPax = (packageRequest.paxAdults || 0) + (packageRequest.paxChildren || 0);
  const hotelAuto = sumPrices(packageRequest.hotels, 'pricePerNight');
  const tourAuto = sumPrices(packageRequest.tours, 'price');
  const transferAuto = sumPrices(packageRequest.transfers, 'price');
  const extraAuto = sumPrices(packageRequest.activities, 'pricePerPax') * Math.max(totalPax, 1);

  const hotelTotal = hotelCost !== '' ? Number(hotelCost) : hotelAuto;
  const tourTotal = tourCost !== '' ? Number(tourCost) : tourAuto;
  const transferTotal = transferCost !== '' ? Number(transferCost) : transferAuto;
  const extraTotal = extraCost !== '' ? Number(extraCost) : extraAuto;
  const landingCost = hotelTotal + tourTotal + transferTotal + extraTotal;

  const markupNumber = Number(markupValue) || 0;
  const markupAmount = markupType === 'percentage' ? (landingCost * markupNumber) / 100 : markupNumber;
  const sellPrice = landingCost + markupAmount;

  const isPublished = ['published', 'accepted', 'declined', 'expired', 'converted'].includes(packageRequest.status);

  function buildPayload() {
    return {
      hotelCost: hotelCost === '' ? null : Number(hotelCost),
      tourCost: tourCost === '' ? null : Number(tourCost),
      transferCost: transferCost === '' ? null : Number(transferCost),
      extraCost: extraCost === '' ? null : Number(extraCost),
      markupType,
      markupValue: markupNumber,
      internalNotes,
    };
  }

  async function saveDraft() {
    setError('');
    setSubmitting('draft');
    try {
      const { packageRequest: updated } = await api.patch(`/admin/package-requests/${packageRequest.id}/costing`, buildPayload());
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to save costing');
    } finally {
      setSubmitting('');
    }
  }

  // Item 9: block obviously-invalid publishes before the round trip, but the
  // backend re-validates against what actually got saved either way.
  async function publishQuote() {
    setError('');
    if (!packageRequest.leadManager) {
      setError('Assign a Lead Manager before publishing.');
      return;
    }
    if (!(landingCost > 0)) {
      setError('Landing Cost must be greater than zero before publishing.');
      return;
    }
    setSubmitting('publish');
    try {
      // Save first so costing/markup/notes are persisted even if the publish
      // step below fails validation — nothing the admin just typed is lost.
      const { packageRequest: saved } = await api.patch(`/admin/package-requests/${packageRequest.id}/costing`, buildPayload());
      onUpdated(saved);
      const { packageRequest: published } = await api.post(`/admin/package-requests/${packageRequest.id}/publish`);
      onUpdated(published);
    } catch (err) {
      setError(err.message || 'Unable to publish quote');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <>
      <Card label="Landing Cost Breakdown" className="border-white">
        <p className="mb-3 text-xs text-muted">
          Auto-calculated from the selected items' Product Catalog prices. Override any component below — Landing
          Cost recalculates immediately.
        </p>
        <div className="space-y-3">
          <CostComponentField label="Hotels" auto={hotelAuto} value={hotelCost} onChange={setHotelCost} />
          <CostComponentField label="Tours" auto={tourAuto} value={tourCost} onChange={setTourCost} />
          <CostComponentField label="Transfers" auto={transferAuto} value={transferCost} onChange={setTransferCost} />
          <CostComponentField label="Extras" auto={extraAuto} value={extraCost} onChange={setExtraCost} />
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
            placeholder={markupType === 'percentage' ? 'e.g. 15' : 'e.g. 10000'}
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
          placeholder="Notes for the ops/finance team about this quote…"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
        />
      </Card>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!!submitting} onClick={saveDraft}>
          {submitting === 'draft' ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button variant="accent" disabled={!!submitting || isPublished} onClick={publishQuote}>
          {submitting === 'publish' ? 'Publishing…' : isPublished ? 'Published' : 'Publish Quote'}
        </Button>
        {packageRequest.publishedAt && (
          <span className="text-xs text-muted">
            Published {new Date(packageRequest.publishedAt).toLocaleString()}
            {packageRequest.publishedBy?.fullName ? ` by ${packageRequest.publishedBy.fullName}` : ''}
          </span>
        )}
      </div>
    </>
  );
}

function ActivityHistory({ history }) {
  return (
    <Card label="Activity history" className="border-white">
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

export default function QuoteInboxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [packageRequest, setPackageRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get(`/admin/package-requests/${id}`)
      .then(({ packageRequest: pr }) => setPackageRequest(pr))
      .catch((err) => setError(err.message || 'Unable to load request'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-5xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/quote-inbox')} className="text-xs text-muted hover:text-ink">
          ← Back to Quote Inbox
        </button>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        <ErrorText>{error}</ErrorText>

        {packageRequest && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Custom FIT Request</h2>
                <p className="font-mono text-xs text-muted">Quote ID: {packageRequest.id}</p>
              </div>
              <Badge tone={STATUS_TONE[packageRequest.status] || 'grey'}>{formatStatus(packageRequest.status)}</Badge>
            </div>

            <Card label="Trip information" className="border-white">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Agency</dt>
                  <dd>{packageRequest.agencyName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Agent</dt>
                  <dd>
                    {packageRequest.agentName}
                    <div className="text-xs text-muted">{packageRequest.agentEmail}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Submitted</dt>
                  <dd>{new Date(packageRequest.submittedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Destination</dt>
                  <dd>{packageRequest.destination}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Travel dates</dt>
                  <dd>
                    {new Date(packageRequest.dateFrom).toLocaleDateString()} – {new Date(packageRequest.dateTo).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Pax</dt>
                  <dd>
                    {packageRequest.paxAdults} adult{packageRequest.paxAdults === 1 ? '' : 's'}
                    {packageRequest.paxChildren ? `, ${packageRequest.paxChildren} child${packageRequest.paxChildren === 1 ? '' : 'ren'}` : ''}
                  </dd>
                </div>
              </dl>
            </Card>

            <LeadManagerAssignment packageRequest={packageRequest} onUpdated={setPackageRequest} />

            <Card label="Traveller details" className="border-white">
              {packageRequest.travelers.length === 0 ? (
                <p className="text-sm text-muted">No traveller details captured.</p>
              ) : (
                <Table
                  columns={['Name', 'Passport No.', 'DOB', 'Room share']}
                  rows={packageRequest.travelers}
                  renderRow={(t) => (
                    <tr key={t.id} className="border-b border-line-light last:border-0">
                      <td className="px-3 py-2 font-semibold">{t.name}</td>
                      <td className="px-3 py-2">{t.passportNo || '—'}</td>
                      <td className="px-3 py-2">{t.dob ? new Date(t.dob).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2">{t.roomShareGroup || '—'}</td>
                    </tr>
                  )}
                />
              )}
            </Card>

            <CatalogGrid
              label="Selected hotel(s)"
              items={packageRequest.hotels}
              empty="No hotel selected."
              renderMeta={(h) => `${h.city || '—'}${h.category ? ` · ${h.category}★` : ''}`}
            />
            <CatalogGrid
              label="Selected tour(s)"
              items={packageRequest.tours}
              empty="No tours selected."
              renderMeta={(t) => `${t.city || '—'}${t.category ? ` · ${t.category}` : ''}${t.duration ? ` · ${t.duration}` : ''}`}
            />
            <CatalogGrid
              label="Selected transfer(s)"
              items={packageRequest.transfers}
              empty="No transfers selected."
              renderMeta={(t) => `${t.type ? t.type.replace(/_/g, ' ') : '—'}${t.vehicleClass ? ` · ${t.vehicleClass}` : ''}${t.city ? ` · ${t.city}` : ''}`}
            />
            <CatalogGrid
              label="Selected extras"
              items={packageRequest.activities}
              empty="No extras selected."
              renderMeta={(a) => `${a.city || '—'}${a.duration ? ` · ${a.duration}` : ''}`}
            />

            <CostingAndPublishing packageRequest={packageRequest} onUpdated={setPackageRequest} />
            <ActivityHistory history={packageRequest.activityHistory} />
          </>
        )}
      </div>
    </div>
  );
}
