import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

// FIT-1: destination/dates/pax -> hotels -> tours -> transfers -> extras -> review,
// matching the wireframe's step tags on Screen 05.
const STEPS = [
  { n: 1, label: 'Trip Details' },
  { n: 2, label: 'Hotels' },
  { n: 3, label: 'Tours' },
  { n: 4, label: 'Transfers' },
  { n: 5, label: 'Extras' },
  { n: 6, label: 'Review & Submit' },
];

function StepIndicator({ step }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {STEPS.map((s) => (
        <span
          key={s.n}
          className={`rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold ${
            s.n === step
              ? 'border-accent bg-accent text-white'
              : s.n < step
                ? 'border-ink bg-ink text-white'
                : 'border-line-light bg-white text-[#666]'
          }`}
        >
          {s.n} {s.label}
        </span>
      ))}
    </div>
  );
}

function CatalogImage({ url }) {
  return url ? (
    <img src={url} alt="" className="h-28 w-full rounded-md border border-line-light object-cover" />
  ) : (
    <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[9px] text-muted">
      No image
    </div>
  );
}

// Step 1 — trip details (FIT-1: destination, dates, pax).
function TripDetailsStep({ form, update }) {
  return (
    <Card label="Trip details" className="border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel>Destination *</FieldLabel>
          <TextInput placeholder="e.g. Muscat, Oman" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Travel start date *</FieldLabel>
          <TextInput type="date" value={form.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Travel end date *</FieldLabel>
          <TextInput type="date" value={form.dateTo} onChange={(e) => update('dateTo', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Adults *</FieldLabel>
          <TextInput type="number" min="1" value={form.paxAdults} onChange={(e) => update('paxAdults', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Children</FieldLabel>
          <TextInput type="number" min="0" value={form.paxChildren} onChange={(e) => update('paxChildren', e.target.value)} />
        </div>
      </div>
    </Card>
  );
}

// Step 2 — hotel selection (FIT-2). Single-select, matching the wireframe's
// one "Selected" card and the priced-quote summary later showing one hotel
// line item. No price is ever rendered here (FIT-6 blind pricing).
function HotelsStep({ hotels, cityFilter, setCityFilter, selectedHotelId, setSelectedHotelId }) {
  const filtered = cityFilter
    ? hotels.filter((h) => (h.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    : hotels;

  return (
    <Card label="Select a hotel" className="border-white">
      <TextInput className="mb-4 max-w-xs" placeholder="Filter by city…" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
      {filtered.length === 0 && <p className="text-sm text-muted">No hotels available{cityFilter ? ' for that city' : ''}.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((h) => {
          const selected = h.id === selectedHotelId;
          return (
            <button
              type="button"
              key={h.id}
              onClick={() => setSelectedHotelId(selected ? '' : h.id)}
              className={`rounded-lg border p-3 text-left shadow-sm transition ${
                selected ? 'border-accent ring-2 ring-accent/25' : 'border-line-light hover:border-ink'
              }`}
            >
              <CatalogImage url={h.images?.[0]} />
              <div className="mt-2 text-sm font-bold">{h.name}</div>
              <div className="text-xs text-muted">
                {h.city || '—'} {h.category ? `· ${h.category}★` : ''}
              </div>
              {h.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{h.description}</p>}
              {selected && <div className="mt-2 text-[10px] font-semibold uppercase text-accent">Selected</div>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Step 3 — tours (FIT-3: multi-select checkboxes, no price).
function ToursStep({ tours, cityFilter, setCityFilter, selectedTourIds, toggleTour }) {
  const filtered = cityFilter
    ? tours.filter((t) => (t.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    : tours;

  return (
    <Card label="Select tours (optional, multiple allowed)" className="border-white">
      <TextInput className="mb-4 max-w-xs" placeholder="Filter by city…" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
      {filtered.length === 0 && <p className="text-sm text-muted">No tours available{cityFilter ? ' for that city' : ''}.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div key={t.id} className="rounded-lg border border-line-light p-3 shadow-sm">
            <CatalogImage url={t.images?.[0]} />
            <div className="mt-2 text-sm font-bold">{t.name}</div>
            <div className="text-xs text-muted">
              {t.city || '—'} {t.category ? `· ${t.category}` : ''} {t.duration ? `· ${t.duration}` : ''}
            </div>
            {t.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{t.description}</p>}
            <div className="mt-2">
              <Checkbox checked={selectedTourIds.includes(t.id)} onChange={() => toggleTour(t.id)} label="Include this tour" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Step 4 — transfers (FIT-4: multi-select checkboxes, no price).
function TransfersStep({ transfers, selectedTransferIds, toggleTransfer }) {
  return (
    <Card label="Select transfers (optional, multiple allowed)" className="border-white">
      {transfers.length === 0 && <p className="text-sm text-muted">No transfers available.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {transfers.map((tr) => (
          <div key={tr.id} className="rounded-lg border border-line-light p-3 shadow-sm">
            <div className="text-sm font-bold">{tr.name}</div>
            <div className="text-xs text-muted">
              {tr.type ? tr.type.replace(/_/g, ' ') : '—'} {tr.vehicleClass ? `· ${tr.vehicleClass}` : ''} {tr.city ? `· ${tr.city}` : ''}
            </div>
            {tr.description && <p className="mt-1 text-xs text-muted">{tr.description}</p>}
            <div className="mt-2">
              <Checkbox checked={selectedTransferIds.includes(tr.id)} onChange={() => toggleTransfer(tr.id)} label="Include this transfer" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Step 5 — extras. The admin's Activities catalog is the pool of short
// add-on experiences (mirrors how FGD add-ons draw from activities/tours).
function ExtrasStep({ activities, selectedActivityIds, toggleActivity }) {
  return (
    <Card label="Select extras / add-ons (optional, multiple allowed)" className="border-white">
      {activities.length === 0 && <p className="text-sm text-muted">No extras available.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((a) => (
          <div key={a.id} className="rounded-lg border border-line-light p-3 shadow-sm">
            <CatalogImage url={a.images?.[0]} />
            <div className="mt-2 text-sm font-bold">{a.name}</div>
            <div className="text-xs text-muted">
              {a.city || '—'} {a.duration ? `· ${a.duration}` : ''}
            </div>
            {a.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{a.description}</p>}
            <div className="mt-2">
              <Checkbox checked={selectedActivityIds.includes(a.id)} onChange={() => toggleActivity(a.id)} label="Include this extra" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TravelersEditor({ travelers, setTravelers }) {
  function updateTraveler(idx, field, value) {
    setTravelers((list) => list.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }
  function addTraveler() {
    setTravelers((list) => [...list, { name: '', passportNo: '' }]);
  }
  function removeTraveler(idx) {
    setTravelers((list) => list.filter((_, i) => i !== idx));
  }

  return (
    <Card label="Traveller details" className="border-white">
      <div className="space-y-2">
        {travelers.map((t, idx) => (
          <div key={idx} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <FieldLabel>Name *</FieldLabel>
              <TextInput value={t.name} onChange={(e) => updateTraveler(idx, 'name', e.target.value)} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <FieldLabel>Passport no.</FieldLabel>
              <TextInput value={t.passportNo || ''} onChange={(e) => updateTraveler(idx, 'passportNo', e.target.value)} />
            </div>
            {travelers.length > 1 && (
              <button type="button" onClick={() => removeTraveler(idx)} className="mb-0.5 text-xs text-[#a5162d] hover:underline">
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={addTraveler}>
        + Add traveller
      </Button>
    </Card>
  );
}

// Step 6 — review & submit. No price/cost/markup fields anywhere (FIT-6).
function ReviewStep({ form, selectedHotel, selectedTours, selectedTransfers, selectedActivities, travelers, setTravelers }) {
  return (
    <div className="space-y-4">
      <Card label="Trip summary" className="border-white">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted">Destination</dt>
            <dd>{form.destination || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted">Travel dates</dt>
            <dd>
              {form.dateFrom || '—'} → {form.dateTo || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted">Adults</dt>
            <dd>{form.paxAdults || 0}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-muted">Children</dt>
            <dd>{form.paxChildren || 0}</dd>
          </div>
        </dl>
      </Card>

      <Card label="Selected hotel" className="border-white">
        {selectedHotel ? (
          <div className="text-sm">
            <span className="font-semibold">{selectedHotel.name}</span> — {selectedHotel.city}
            {selectedHotel.category ? ` · ${selectedHotel.category}★` : ''}
          </div>
        ) : (
          <p className="text-sm text-muted">No hotel selected.</p>
        )}
      </Card>

      <Card label="Selected tours" className="border-white">
        {selectedTours.length === 0 ? (
          <p className="text-sm text-muted">No tours selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedTours.map((t) => (
              <li key={t.id}>
                {t.name} — {t.city}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card label="Selected transfers" className="border-white">
        {selectedTransfers.length === 0 ? (
          <p className="text-sm text-muted">No transfers selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedTransfers.map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card label="Selected extras" className="border-white">
        {selectedActivities.length === 0 ? (
          <p className="text-sm text-muted">No extras selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedActivities.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <TravelersEditor travelers={travelers} setTravelers={setTravelers} />
    </div>
  );
}

function validateStep(step, { form, selectedHotelId, travelers }) {
  if (step === 1) {
    if (!form.destination.trim()) return 'Destination is required.';
    if (!form.dateFrom || !form.dateTo) return 'Travel start and end dates are required.';
    if (new Date(form.dateFrom) > new Date(form.dateTo)) return 'Travel end date must be on or after the start date.';
    if (!form.paxAdults || Number(form.paxAdults) < 1) return 'At least one adult is required.';
    return '';
  }
  if (step === 2) {
    if (!selectedHotelId) return 'Select a hotel to continue.';
    return '';
  }
  if (step === 6) {
    if (travelers.filter((t) => t.name.trim()).length === 0) return 'Add at least one traveller.';
    return '';
  }
  return '';
}

export default function PackageBuilder() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ destination: '', dateFrom: '', dateTo: '', paxAdults: 2, paxChildren: 0 });

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [hotelCityFilter, setHotelCityFilter] = useState('');
  const [tourCityFilter, setTourCityFilter] = useState('');

  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [selectedTourIds, setSelectedTourIds] = useState([]);
  const [selectedTransferIds, setSelectedTransferIds] = useState([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [travelers, setTravelers] = useState([{ name: '', passportNo: '' }]);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    Promise.all([api.get('/hotels'), api.get('/tours'), api.get('/transfers'), api.get('/activities')])
      .then(([h, t, tr, a]) => {
        setHotels(h.hotels || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setActivities(a.activities || []);
      })
      .catch((err) => setError(err.message || 'Unable to load catalog'))
      .finally(() => setCatalogLoading(false));
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTour(id) {
    setSelectedTourIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }
  function toggleTransfer(id) {
    setSelectedTransferIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }
  function toggleActivity(id) {
    setSelectedActivityIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  function goNext() {
    const validationError = validateStep(step, { form, selectedHotelId, travelers });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function goBack() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    const validationError = validateStep(6, { form, selectedHotelId, travelers });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        destination: form.destination,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        paxAdults: Number(form.paxAdults),
        paxChildren: Number(form.paxChildren) || 0,
        hotelIds: [selectedHotelId],
        tourIds: selectedTourIds,
        transferIds: selectedTransferIds,
        activityIds: selectedActivityIds,
        travelers: travelers
          .filter((t) => t.name.trim())
          .map((t) => ({ name: t.name, passportNo: t.passportNo || undefined })),
      };
      const { packageRequest } = await api.post('/package-requests', payload);
      setSubmittedId(packageRequest.id);
    } catch (err) {
      setError(err.message || 'Unable to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedHotel = hotels.find((h) => h.id === selectedHotelId) || null;
  const selectedTours = tours.filter((t) => selectedTourIds.includes(t.id));
  const selectedTransfers = transfers.filter((t) => selectedTransferIds.includes(t.id));
  const selectedActivities = activities.filter((a) => selectedActivityIds.includes(a.id));

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-light bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <Link to="/agent/dashboard" className="text-sm font-bold text-ink">
          ← Xclusive Oman
        </Link>
        <Link to="/agent/dashboard">
          <Button>Dashboard</Button>
        </Link>
      </div>

      <div className="mx-auto max-w-5xl p-5 lg:p-8">
        <h2 className="mb-1 text-2xl font-bold">Custom FIT Package Builder</h2>
        <p className="mb-5 text-sm text-muted">
          Build a personalised package for your client. Pricing is handled by Xclusive Oman once you submit
          — no cost or price is shown anywhere in this builder.
        </p>

        {submittedId ? (
          <Card label="Request submitted" className="border-white">
            <p className="text-sm">
              Your Custom FIT request has been submitted and is now with our team for pricing. You'll be
              notified once a quote is ready.
            </p>
            <p className="mt-2 font-mono text-xs text-muted">Reference: {submittedId}</p>
            <Button className="mt-4" variant="accent" onClick={() => navigate('/agent/dashboard')}>
              Back to Dashboard
            </Button>
          </Card>
        ) : catalogLoading ? (
          <p className="text-sm text-muted">Loading catalog…</p>
        ) : (
          <>
            <StepIndicator step={step} />

            {step === 1 && <TripDetailsStep form={form} update={update} />}
            {step === 2 && (
              <HotelsStep
                hotels={hotels}
                cityFilter={hotelCityFilter}
                setCityFilter={setHotelCityFilter}
                selectedHotelId={selectedHotelId}
                setSelectedHotelId={setSelectedHotelId}
              />
            )}
            {step === 3 && (
              <ToursStep
                tours={tours}
                cityFilter={tourCityFilter}
                setCityFilter={setTourCityFilter}
                selectedTourIds={selectedTourIds}
                toggleTour={toggleTour}
              />
            )}
            {step === 4 && (
              <TransfersStep transfers={transfers} selectedTransferIds={selectedTransferIds} toggleTransfer={toggleTransfer} />
            )}
            {step === 5 && (
              <ExtrasStep activities={activities} selectedActivityIds={selectedActivityIds} toggleActivity={toggleActivity} />
            )}
            {step === 6 && (
              <ReviewStep
                form={form}
                selectedHotel={selectedHotel}
                selectedTours={selectedTours}
                selectedTransfers={selectedTransfers}
                selectedActivities={selectedActivities}
                travelers={travelers}
                setTravelers={setTravelers}
              />
            )}

            <ErrorText>{error}</ErrorText>

            <div className="mt-4 flex justify-between">
              <Button onClick={goBack} disabled={step === 1}>
                Back
              </Button>
              {step < STEPS.length ? (
                <Button variant="accent" onClick={goNext}>
                  Next
                </Button>
              ) : (
                <Button variant="accent" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
