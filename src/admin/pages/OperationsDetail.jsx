import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, Card, ErrorText, Select, Table, TextInput, Textarea } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Admin FD Operations Tracker (Task 12 — Screen 19). Mirrors
// QuoteInboxDetail.jsx's own "load once, refetch whole detail after any
// write" pattern — every action here (stage advance, supplier log, driver
// dispatch, tour update) just calls loadDetail() again on success rather
// than hand-patching local state, so this page can never drift from what
// the server actually has.

const BOOKING_STATUS_TONE = {
  pending_payment: 'amber',
  deposit_paid: 'amber',
  confirmed: 'green',
  balance_due: 'amber',
  fully_paid: 'green',
  amendment_requested: 'amber',
  cancellation_requested: 'red',
  cancelled: 'red',
  completed: 'green',
  waitlisted: 'grey',
};

// The 5 stages an admin can advance manually via POST .../stage — matches
// backend's MANUAL_STAGES (fdOperations.model.js) exactly. 'driver_sent'
// is deliberately absent — it only ever advances as a side effect of a real
// driver dispatch (see the Driver / Pickup Dispatch card below), per I2.
const MANUAL_STAGE_ACTIONS = [
  { key: 'docs_collected', label: 'Documents Collected', cta: 'Mark Documents Collected' },
  { key: 'supplier_coordination', label: 'Supplier Coordination', cta: 'Mark Supplier Coordination Complete' },
  { key: 'visa_processing', label: 'Visa Processing', cta: 'Mark Visa Processing Complete' },
  { key: 'trip_live', label: 'Trip Live', cta: 'Mark Trip Live' },
  { key: 'completed', label: 'Completed / Review', cta: 'Mark Completed' },
];

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StageHeader({ departure, onAdvance, advancing }) {
  return (
    <Card label="Operational Lifecycle" className="mb-5 border-white">
      <div className="flex flex-wrap items-stretch gap-2">
        {departure.stages.map((stage, i) => {
          const isCurrent = stage.key === departure.currentStage;
          const action = MANUAL_STAGE_ACTIONS.find((a) => a.key === stage.key);
          return (
            <div key={stage.key} className="flex flex-1 min-w-[140px] items-center gap-2">
              <div
                className={`flex-1 rounded-lg border p-3 text-center ${
                  stage.done
                    ? 'border-[#b9e2c9] bg-[#e9f7ef]'
                    : isCurrent
                      ? 'border-accent bg-accent-soft/60'
                      : 'border-line-light bg-white'
                }`}
              >
                <div className={`text-[11px] font-semibold ${stage.done ? 'text-[#227647]' : isCurrent ? 'text-accent' : 'text-muted'}`}>
                  {stage.label}
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {stage.done ? formatDateTime(stage.at) : stage.key === 'driver_sent' ? 'Auto — via dispatch' : isCurrent ? 'In progress' : 'Pending'}
                </div>
                {isCurrent && !stage.done && action && (
                  <Button
                    variant="accent"
                    className="mt-2 w-full !py-1.5 text-[11px]"
                    disabled={advancing}
                    onClick={() => onAdvance(action.key)}
                  >
                    {advancing ? 'Saving…' : action.cta}
                  </Button>
                )}
              </div>
              {i < departure.stages.length - 1 && <span className="flex-none text-muted">→</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PaxManifest({ manifest }) {
  return (
    <Card label="Pax Manifest & Payment Status" className="mb-5 border-white">
      {manifest.length === 0 ? (
        <p className="text-sm text-muted">No bookings on this departure yet.</p>
      ) : (
        <Table
          columns={['Agency', 'Booked by', 'Pax', 'Travelers', 'Booking status', 'Total', 'Deposit paid', 'Balance due']}
          rows={manifest}
          renderRow={(b) => (
            <tr key={b.bookingId} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{b.agencyName}</td>
              <td className="px-3 py-2">
                {b.createdByName}
                <div className="text-[10px] text-muted">{b.createdByEmail}</div>
              </td>
              <td className="px-3 py-2">{b.pax}</td>
              <td className="px-3 py-2">
                {b.travelers.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  b.travelers.map((t) => t.name + (t.roomShareGroup ? ` (${t.roomShareGroup})` : '')).join(', ')
                )}
              </td>
              <td className="px-3 py-2">
                <Badge tone={BOOKING_STATUS_TONE[b.status] || 'grey'}>{b.status.replace(/_/g, ' ')}</Badge>
              </td>
              <td className="px-3 py-2">{formatCurrency(b.totalPrice)}</td>
              <td className="px-3 py-2">{formatCurrency(b.depositPaid)}</td>
              <td className="px-3 py-2">{formatCurrency(b.balanceDue)}</td>
            </tr>
          )}
        />
      )}
    </Card>
  );
}

function SupplierLogCard({ departureDateId, supplierLogs, onAdded }) {
  const toast = useToast();
  const [supplierName, setSupplierName] = useState('');
  const [item, setItem] = useState('');
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    setError('');
    if (!supplierName.trim() || !item.trim()) {
      setError('Supplier name and item are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/supplier-log`, {
        supplierName: supplierName.trim(),
        item: item.trim(),
        status,
      });
      setSupplierName('');
      setItem('');
      setStatus('pending');
      toast.success('Supplier log entry added.');
      onAdded();
    } catch (err) {
      setError(err.message || 'Unable to add supplier log entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Supplier Coordination Log" className="mb-5 border-white">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput placeholder="Supplier name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
        <TextInput placeholder="Item" value={item} onChange={(e) => setItem(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
        </Select>
        <Button variant="accent" disabled={submitting} onClick={handleAdd}>
          {submitting ? 'Adding…' : 'Add Entry'}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>

      {supplierLogs.length === 0 ? (
        <p className="text-sm text-muted">No supplier log entries yet.</p>
      ) : (
        <Table
          columns={['Supplier', 'Item', 'Status', 'Added by', 'Added at']}
          rows={supplierLogs}
          renderRow={(l) => (
            <tr key={l.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{l.supplierName}</td>
              <td className="px-3 py-2">{l.item}</td>
              <td className="px-3 py-2">
                <Badge tone={l.status === 'confirmed' ? 'green' : 'amber'}>{l.status}</Badge>
              </td>
              <td className="px-3 py-2">{l.createdByName}</td>
              <td className="px-3 py-2">{formatDateTime(l.createdAt)}</td>
            </tr>
          )}
        />
      )}
      {/* Requirement I3: stage completion is manual — the admin can mark
          Supplier Coordination complete above even while pending items
          remain listed here. This log is informational, never a gate. */}
    </Card>
  );
}

function DriverDispatchCard({ departureDateId, driverDispatches, onSent }) {
  const toast = useToast();
  const [driverName, setDriverName] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [pickupDetails, setPickupDetails] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSend() {
    setError('');
    if (!driverName.trim() || !vehicle.trim() || !pickupDetails.trim()) {
      setError('Driver name, vehicle and pickup details are all required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/driver-details`, {
        driverName: driverName.trim(),
        vehicle: vehicle.trim(),
        pickupDetails: pickupDetails.trim(),
      });
      setDriverName('');
      setVehicle('');
      setPickupDetails('');
      toast.success('Driver & pickup details sent to every agency on this departure.');
      onSent();
    } catch (err) {
      setError(err.message || 'Unable to send driver & pickup details');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Driver / Pickup Dispatch" className="mb-5 border-white">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput placeholder="Driver name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
        <TextInput placeholder="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <TextInput
          className="lg:col-span-1"
          placeholder="Pickup time / point"
          value={pickupDetails}
          onChange={(e) => setPickupDetails(e.target.value)}
        />
        <Button variant="accent" disabled={submitting} onClick={handleSend}>
          {submitting ? 'Sending…' : 'Send to Agencies'}
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Sending publishes an in-app notification and email to every agency with a booking on this departure, and
        (the first time) advances the Driver / Pickup Sent stage.
      </p>
      <ErrorText>{error}</ErrorText>

      {driverDispatches.length === 0 ? (
        <p className="text-sm text-muted">No dispatches sent yet.</p>
      ) : (
        <Table
          columns={['Driver', 'Vehicle', 'Pickup details', 'Sent by', 'Sent at']}
          rows={driverDispatches}
          renderRow={(d) => (
            <tr key={d.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{d.driverName}</td>
              <td className="px-3 py-2">{d.vehicle}</td>
              <td className="px-3 py-2">{d.pickupDetails}</td>
              <td className="px-3 py-2">{d.sentByName}</td>
              <td className="px-3 py-2">{formatDateTime(d.sentAt)}</td>
            </tr>
          )}
        />
      )}
    </Card>
  );
}

const TOUR_UPDATE_TYPE_LABEL = {
  itinerary_change: 'Itinerary Change',
  delay: 'Delay',
  general_notice: 'General Notice',
};

function TourUpdateCard({ departureDateId, tourUpdates, onPublished }) {
  const toast = useToast();
  const [updateType, setUpdateType] = useState('general_notice');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handlePublish() {
    setError('');
    if (!message.trim()) {
      setError('Message is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/tour-update`, {
        updateType,
        message: message.trim(),
      });
      setMessage('');
      toast.success('Tour update published to every agency on this departure.');
      onPublished();
    } catch (err) {
      setError(err.message || 'Unable to publish tour update');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Tour Update Broadcast" className="mb-5 border-white">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Select value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
          <option value="itinerary_change">Itinerary Change</option>
          <option value="delay">Delay</option>
          <option value="general_notice">General Notice</option>
        </Select>
        <Textarea
          className="sm:col-span-2"
          placeholder="Update message…"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button variant="accent" disabled={submitting} onClick={handlePublish}>
          {submitting ? 'Publishing…' : 'Publish Update'}
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Publishing sends an in-app notification and email to every agency with a booking on this departure.
      </p>
      <ErrorText>{error}</ErrorText>

      {tourUpdates.length === 0 ? (
        <p className="text-sm text-muted">No tour updates published yet.</p>
      ) : (
        <div className="space-y-2">
          {tourUpdates.map((u) => (
            <div key={u.id} className="rounded-lg border border-line-light p-3">
              <div className="flex items-center justify-between">
                <Badge tone="grey">{TOUR_UPDATE_TYPE_LABEL[u.updateType] || u.updateType}</Badge>
                <span className="text-[10px] text-muted">{formatDateTime(u.publishedAt)}</span>
              </div>
              <p className="mt-2 text-sm text-ink">{u.message}</p>
              <p className="mt-1 text-[10px] text-muted">Published by {u.publishedByName}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ActivityHistory({ activity }) {
  return (
    <Card label="Activity History" className="border-white">
      {activity.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {activity.map((a, i) => (
            <div key={i} className="flex items-start justify-between border-b border-line-light py-2 text-xs last:border-0">
              <span className="text-ink">{a.description}</span>
              <span className="flex-none pl-3 text-right text-muted">
                {formatDateTime(a.at)}
                {a.by && <div>{a.by}</div>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function OperationsDetail() {
  const { departureDateId } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  function loadDetail() {
    setLoading(true);
    setError('');
    return api
      .get(`/admin/operations/departures/${departureDateId}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load this departure'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureDateId]);

  async function handleAdvanceStage(stage) {
    setAdvancing(true);
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/stage`, { stage });
      toast.success('Stage updated.');
      await loadDetail();
    } catch (err) {
      toast.error(err.message || 'Unable to advance stage');
    } finally {
      setAdvancing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <Link to="/admin/operations" className="text-sm text-accent hover:underline">
          ← Back to FD Operations Tracker
        </Link>
        <p className="mt-4 text-sm text-[#a5162d]">{error}</p>
      </div>
    );
  }

  const { departure, manifest, supplierLogs, driverDispatches, tourUpdates, activity } = data;

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <Link to="/admin/operations" className="text-sm text-accent hover:underline">
          ← Back to FD Operations Tracker
        </Link>

        <div className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{departure.packageTitle}</h2>
            <p className="mt-1 text-sm text-muted">
              {new Date(departure.date).toLocaleDateString()} · {departure.location} · {departure.paxTotal} pax ·{' '}
              {departure.agencyCount} {departure.agencyCount === 1 ? 'agency' : 'agencies'}
            </p>
          </div>
          {departure.heroImageUrl && (
            <img src={departure.heroImageUrl} alt="" className="h-16 w-24 flex-none rounded-md border border-line-light object-cover" />
          )}
        </div>

        <StageHeader departure={departure} onAdvance={handleAdvanceStage} advancing={advancing} />
        <PaxManifest manifest={manifest} />
        <SupplierLogCard departureDateId={departureDateId} supplierLogs={supplierLogs} onAdded={loadDetail} />
        <DriverDispatchCard departureDateId={departureDateId} driverDispatches={driverDispatches} onSent={loadDetail} />
        <TourUpdateCard departureDateId={departureDateId} tourUpdates={tourUpdates} onPublished={loadDetail} />
        <ActivityHistory activity={activity} />
      </div>
    </div>
  );
}
