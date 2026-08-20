import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, Select, TextInput, Textarea } from '../components/ui.jsx';

// Same 5 manually-advanceable stages the backend's advanceFdOperationsStageSchema
// accepts — 'driver_sent' is set only via the Dispatch Driver action below,
// never advanced directly (mirrors admin's own OperationsDetail.jsx).
const MANUAL_STAGES = ['docs_collected', 'supplier_coordination', 'visa_processing', 'trip_live', 'completed'];

function SupplierLogForm({ departureDateId, onLogged }) {
  const [supplierName, setSupplierName] = useState('');
  const [item, setItem] = useState('');
  const [status, setStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/supplier-log`, { supplierName, item, status });
      setSupplierName('');
      setItem('');
      setStatus('pending');
      onLogged();
    } catch (err) {
      setError(err.message || 'Unable to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
      <TextInput placeholder="Supplier name" required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
      <TextInput placeholder="Item" required value={item} onChange={(e) => setItem(e.target.value)} />
      <Select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
      </Select>
      <Button variant="accent" type="submit" disabled={submitting}>
        {submitting ? 'Logging…' : 'Log Supplier'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function DriverDispatchForm({ departureDateId, onDispatched }) {
  const [driverName, setDriverName] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [pickupDetails, setPickupDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/driver-details`, { driverName, vehicle, pickupDetails });
      setDriverName('');
      setVehicle('');
      setPickupDetails('');
      onDispatched();
    } catch (err) {
      setError(err.message || 'Unable to dispatch');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <TextInput placeholder="Driver name" required value={driverName} onChange={(e) => setDriverName(e.target.value)} />
      <TextInput placeholder="Vehicle" required value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
      <Textarea className="sm:col-span-2" placeholder="Pickup time / point" required value={pickupDetails} onChange={(e) => setPickupDetails(e.target.value)} />
      <Button variant="accent" type="submit" disabled={submitting} className="sm:col-span-2">
        {submitting ? 'Dispatching…' : 'Dispatch Driver'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function TourUpdateForm({ departureDateId, onPublished }) {
  const [updateType, setUpdateType] = useState('general_notice');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/tour-update`, { updateType, message });
      setMessage('');
      onPublished();
    } catch (err) {
      setError(err.message || 'Unable to publish');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Select value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
        <option value="itinerary_change">Itinerary change</option>
        <option value="delay">Delay</option>
        <option value="general_notice">General notice</option>
      </Select>
      <Textarea placeholder="Message to travelers/agencies…" required value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button variant="accent" type="submit" disabled={submitting}>
        {submitting ? 'Publishing…' : 'Publish Update'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export default function FdOperationDetail() {
  const { departureDateId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  function load() {
    api
      .get(`/admin/operations/departures/${departureDateId}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load departure'));
  }

  useEffect(load, [departureDateId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function advance(stage) {
    setAdvancing(true);
    setError('');
    try {
      await api.post(`/admin/operations/departures/${departureDateId}/stage`, { stage });
      load();
    } catch (err) {
      setError(err.message || 'Unable to advance stage');
    } finally {
      setAdvancing(false);
    }
  }

  if (!data) return <p className="p-10 text-xs text-team-muted">{error || 'Loading…'}</p>;
  const { departure, supplierLogs = [], driverDispatches = [], tourUpdates = [] } = data;

  const currentIndex = departure.stages.findIndex((s) => s.key === departure.currentStage);
  const nextManualStage = MANUAL_STAGES.find((key) => {
    const stage = departure.stages.find((s) => s.key === key);
    return stage && !stage.done;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 lg:p-10">
      <Link to="/team/fd-operations" className="text-xs font-semibold text-team-accent-dark hover:underline">
        ← Back to FD Operation
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-team-ink">{departure.packageTitle}</h2>
          <p className="mt-1 text-sm text-team-muted">{departure.date} · {departure.location}</p>
        </div>
        <Badge tone={departure.currentStage === 'completed' ? 'green' : 'amber'}>{departure.paxTotal} pax</Badge>
      </div>

      <ErrorText>{error}</ErrorText>

      <Card label="Stage Progress">
        <div className="flex flex-wrap gap-2">
          {departure.stages.map((s, i) => (
            <span
              key={s.key}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                s.done ? 'border-transparent bg-team-accent text-white' : i === currentIndex ? 'border-team-accent text-team-accent-dark' : 'border-team-line-light text-team-muted'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>

        {nextManualStage && (
          <div className="mt-4">
            <Button variant="accent" disabled={advancing} onClick={() => advance(nextManualStage)}>
              {advancing ? 'Advancing…' : `Advance to "${departure.stages.find((s) => s.key === nextManualStage)?.label}"`}
            </Button>
          </div>
        )}
      </Card>

      <Card label="Supplier Logs">
        <div className="mb-3 space-y-2">
          {supplierLogs.map((l) => (
            <div key={l.id} className="rounded-md border border-team-line-light bg-team-panel px-3 py-2 text-xs">
              <span className="font-semibold text-team-ink">{l.supplierName}</span> — {l.item} ({l.status})
            </div>
          ))}
          {supplierLogs.length === 0 && <p className="text-xs text-team-muted">No supplier logs yet.</p>}
        </div>
        <SupplierLogForm departureDateId={departureDateId} onLogged={load} />
      </Card>

      <Card label="Driver & Pickup">
        <div className="mb-3 space-y-2">
          {driverDispatches.map((d) => (
            <div key={d.id} className="rounded-md border border-team-line-light bg-team-panel px-3 py-2 text-xs">
              <span className="font-semibold text-team-ink">{d.driverName}</span> — {d.vehicle} · {d.pickupDetails}
            </div>
          ))}
          {driverDispatches.length === 0 && <p className="text-xs text-team-muted">Not dispatched yet.</p>}
        </div>
        <DriverDispatchForm departureDateId={departureDateId} onDispatched={load} />
      </Card>

      <Card label="Tour Updates">
        <div className="mb-3 space-y-2">
          {tourUpdates.map((t) => (
            <div key={t.id} className="rounded-md border border-team-line-light bg-team-panel px-3 py-2 text-xs">
              <span className="font-semibold text-team-ink">{t.updateType.replace(/_/g, ' ')}</span> — {t.message}
            </div>
          ))}
          {tourUpdates.length === 0 && <p className="text-xs text-team-muted">No updates published yet.</p>}
        </div>
        <TourUpdateForm departureDateId={departureDateId} onPublished={load} />
      </Card>
    </div>
  );
}
