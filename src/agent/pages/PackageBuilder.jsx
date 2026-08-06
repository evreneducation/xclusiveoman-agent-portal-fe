import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
              ? 'border-agent-accent bg-agent-accent text-white'
              : s.n < step
                ? 'border-agent-ink bg-agent-ink text-white'
                : 'border-agent-line-light bg-white text-[#666]'
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
    <img src={url} alt="" className="h-28 w-full rounded-md border border-agent-line-light object-cover" />
  ) : (
    <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-agent-line-light font-mono text-[9px] text-agent-muted">
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
      {filtered.length === 0 && <p className="text-sm text-agent-muted">No hotels available{cityFilter ? ' for that city' : ''}.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((h) => {
          const selected = h.id === selectedHotelId;
          return (
            <button
              type="button"
              key={h.id}
              onClick={() => setSelectedHotelId(selected ? '' : h.id)}
              className={`rounded-lg border p-3 text-left shadow-sm transition ${
                selected ? 'border-agent-accent ring-2 ring-agent-accent/25' : 'border-agent-line-light hover:border-agent-ink'
              }`}
            >
              <CatalogImage url={h.images?.[0]} />
              <div className="mt-2 text-sm font-bold">{h.name}</div>
              <div className="text-xs text-agent-muted">
                {h.city || '—'} {h.category ? `· ${h.category}★` : ''}
              </div>
              {h.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{h.description}</p>}
              {selected && <div className="mt-2 text-[10px] font-semibold uppercase text-agent-accent">Selected</div>}
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
      {filtered.length === 0 && <p className="text-sm text-agent-muted">No tours available{cityFilter ? ' for that city' : ''}.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div key={t.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
            <CatalogImage url={t.images?.[0]} />
            <div className="mt-2 text-sm font-bold">{t.name}</div>
            <div className="text-xs text-agent-muted">
              {t.city || '—'} {t.category ? `· ${t.category}` : ''} {t.duration ? `· ${t.duration}` : ''}
            </div>
            {t.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{t.description}</p>}
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
      {transfers.length === 0 && <p className="text-sm text-agent-muted">No transfers available.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {transfers.map((tr) => (
          <div key={tr.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
            <div className="text-sm font-bold">{tr.name}</div>
            <div className="text-xs text-agent-muted">
              {tr.type ? tr.type.replace(/_/g, ' ') : '—'} {tr.vehicleClass ? `· ${tr.vehicleClass}` : ''} {tr.city ? `· ${tr.city}` : ''}
            </div>
            {tr.description && <p className="mt-1 text-xs text-agent-muted">{tr.description}</p>}
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
      {activities.length === 0 && <p className="text-sm text-agent-muted">No extras available.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((a) => (
          <div key={a.id} className="rounded-lg border border-agent-line-light p-3 shadow-sm">
            <CatalogImage url={a.images?.[0]} />
            <div className="mt-2 text-sm font-bold">{a.name}</div>
            <div className="text-xs text-agent-muted">
              {a.city || '—'} {a.duration ? `· ${a.duration}` : ''}
            </div>
            {a.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{a.description}</p>}
            <div className="mt-2">
              <Checkbox checked={selectedActivityIds.includes(a.id)} onChange={() => toggleActivity(a.id)} label="Include this extra" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Traveller Details rows are entirely derived from Trip Details' adult/child
// counts (no manual add/remove) — passport only ever applies to adults, so
// each row carries a `type` rather than relying on array position.
function TravelersEditor({ travelers, updateTraveler }) {
  const indexed = travelers.map((t, idx) => ({ ...t, idx }));
  const adults = indexed.filter((t) => t.type === 'adult');
  const children = indexed.filter((t) => t.type === 'child');

  function renderRow(t) {
    return (
      <div key={t.idx} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <FieldLabel>Name *</FieldLabel>
          <TextInput value={t.name} onChange={(e) => updateTraveler(t.idx, 'name', e.target.value)} />
        </div>
        {t.type === 'adult' ? (
          <div className="flex-1 min-w-[160px]">
            <FieldLabel>Passport no. *</FieldLabel>
            <TextInput value={t.passportNo || ''} onChange={(e) => updateTraveler(t.idx, 'passportNo', e.target.value)} />
          </div>
        ) : (
          <span className="mb-2.5 text-[11px] text-agent-muted">Passport not required for children</span>
        )}
      </div>
    );
  }

  return (
    <Card label="Traveller details" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        One row per traveller, matching the adult/child count from Trip details. Name is required for everyone —
        passport number is required for adults only.
      </p>
      {adults.length === 0 && children.length === 0 ? (
        <p className="text-sm text-agent-muted">Set the number of adults/children in Trip details to add traveller rows.</p>
      ) : (
        <div className="space-y-4">
          {adults.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase text-agent-muted">Adults ({adults.length})</div>
              <div className="space-y-2">{adults.map(renderRow)}</div>
            </div>
          )}
          {children.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase text-agent-muted">Children ({children.length})</div>
              <div className="space-y-2">{children.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Step 6 — review & submit. No price/cost/markup fields anywhere (FIT-6).
function ReviewStep({ form, selectedHotel, selectedTours, selectedTransfers, selectedActivities, travelers, updateTraveler }) {
  return (
    <div className="space-y-4">
      <Card label="Trip summary" className="border-white">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Destination</dt>
            <dd>{form.destination || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Travel dates</dt>
            <dd>
              {form.dateFrom || '—'} → {form.dateTo || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Adults</dt>
            <dd>{form.paxAdults || 0}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Children</dt>
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
          <p className="text-sm text-agent-muted">No hotel selected.</p>
        )}
      </Card>

      <Card label="Selected tours" className="border-white">
        {selectedTours.length === 0 ? (
          <p className="text-sm text-agent-muted">No tours selected.</p>
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
          <p className="text-sm text-agent-muted">No transfers selected.</p>
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
          <p className="text-sm text-agent-muted">No extras selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedActivities.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <TravelersEditor travelers={travelers} updateTraveler={updateTraveler} />
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
    if (travelers.some((t) => !t.name.trim())) return 'Enter a name for every traveller.';
    if (travelers.some((t) => t.type === 'adult' && !(t.passportNo || '').trim())) {
      return 'Enter a passport number for every adult traveller.';
    }
    return '';
  }
  return '';
}

// Traveller Details rows are derived from Trip Details' adult/child counts,
// not manually added/removed — this resizes one type's group to match,
// keeping already-entered rows (by position within that type) and only
// adding/dropping from the end when the count changes.
function resizeTravelerGroup(list, count, type) {
  if (list.length === count) return list;
  if (list.length > count) return list.slice(0, count);
  const additions = Array.from({ length: count - list.length }, () => ({ name: '', passportNo: '', type }));
  return [...list, ...additions];
}

export default function PackageBuilder() {
  const navigate = useNavigate();
  const { id: draftIdParam } = useParams();

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
  // Rows are derived from form.paxAdults/paxChildren (see the sync effect
  // below) rather than started with a hardcoded default row.
  const [travelers, setTravelers] = useState([]);

  // Draft Quotes (item 1) — "Continue Editing" opens /agent/package-builder/:id;
  // draftId then tracks which row "Save Draft" and "Submit Request" write to.
  const [draftId, setDraftId] = useState(draftIdParam || '');
  const [draftLoading, setDraftLoading] = useState(!!draftIdParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

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

  // Loads a previously-saved draft's state into the wizard so "Continue
  // Editing" resumes exactly where the agent left off.
  useEffect(() => {
    if (!draftIdParam) return;
    api
      .get(`/package-requests/${draftIdParam}`)
      .then(({ packageRequest: pr }) => {
        if (pr.status !== 'draft') {
          // Already submitted — this link is stale; the read-only quote view is the right place for it now.
          navigate(`/agent/fit-requests/${pr.id}`, { replace: true });
          return;
        }
        setForm({
          destination: pr.destination || '',
          dateFrom: pr.dateFrom ? pr.dateFrom.slice(0, 10) : '',
          dateTo: pr.dateTo ? pr.dateTo.slice(0, 10) : '',
          paxAdults: pr.paxAdults || 1,
          paxChildren: pr.paxChildren || 0,
        });
        setSelectedHotelId(pr.hotels[0]?.id || '');
        setSelectedTourIds(pr.tours.map((t) => t.id));
        setSelectedTransferIds(pr.transfers.map((t) => t.id));
        setSelectedActivityIds(pr.activities.map((a) => a.id));
        // Bucket by isChild rather than array position — DB order isn't
        // guaranteed to match adults-then-children (see migration 0023).
        const loadedAdults = pr.travelers
          .filter((t) => !t.isChild)
          .map((t) => ({ name: t.name, passportNo: t.passportNo || '', type: 'adult' }));
        const loadedChildren = pr.travelers
          .filter((t) => t.isChild)
          .map((t) => ({ name: t.name, passportNo: t.passportNo || '', type: 'child' }));
        setTravelers([
          ...resizeTravelerGroup(loadedAdults, pr.paxAdults || 0, 'adult'),
          ...resizeTravelerGroup(loadedChildren, pr.paxChildren || 0, 'child'),
        ]);
      })
      .catch((err) => setError(err.message || 'Unable to load this draft'))
      .finally(() => setDraftLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam]);

  // Traveller Details rows always match Trip Details' adult/child counts —
  // grows/shrinks each group independently as those fields change, keeping
  // whatever the agent already typed in the rows that remain.
  useEffect(() => {
    const adultsCount = Math.max(0, Number(form.paxAdults) || 0);
    const childrenCount = Math.max(0, Number(form.paxChildren) || 0);
    setTravelers((current) => [
      ...resizeTravelerGroup(current.filter((t) => t.type === 'adult'), adultsCount, 'adult'),
      ...resizeTravelerGroup(current.filter((t) => t.type === 'child'), childrenCount, 'child'),
    ]);
  }, [form.paxAdults, form.paxChildren]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTraveler(idx, field, value) {
    setTravelers((list) => list.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  // Item 1 — "Save Draft"/"Continue Editing" autosave. Deliberately skips
  // validateStep(): a half-built package (no destination yet, no hotel
  // picked) must still save without being blocked by the strict Submit rules.
  function buildDraftPayload() {
    return {
      destination: form.destination,
      dateFrom: form.dateFrom || null,
      dateTo: form.dateTo || null,
      paxAdults: Number(form.paxAdults) || 1,
      paxChildren: Number(form.paxChildren) || 0,
      hotelIds: selectedHotelId ? [selectedHotelId] : [],
      tourIds: selectedTourIds,
      transferIds: selectedTransferIds,
      activityIds: selectedActivityIds,
      travelers: travelers.map((t) => ({ name: t.name, passportNo: t.passportNo || undefined, isChild: t.type === 'child' })),
    };
  }

  async function saveDraft() {
    setError('');
    setSavingDraft(true);
    try {
      if (draftId) {
        await api.patch(`/package-requests/${draftId}`, buildDraftPayload());
      } else {
        const { packageRequest } = await api.post('/package-requests/draft', buildDraftPayload());
        setDraftId(packageRequest.id);
        navigate(`/agent/package-builder/${packageRequest.id}`, { replace: true });
      }
      setDraftSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
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
        // Unfiltered — validateStep(6) above already guarantees every row
        // has a name (and adults have a passport), so all rows are real.
        travelers: travelers.map((t) => ({ name: t.name, passportNo: t.passportNo || undefined, isChild: t.type === 'child' })),
      };
      // A draft opened via "Continue Editing" submits through its own row
      // (validated the same way — createPackageRequestSchema — just against
      // an existing 'draft' instead of creating a new 'submitted' one).
      const { packageRequest } = draftId
        ? await api.post(`/package-requests/${draftId}/submit`, payload)
        : await api.post('/package-requests', payload);
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
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">Custom FIT Package Builder</h2>
      <p className="mb-5 text-sm text-agent-muted">
        Build a personalised package for your client. Pricing is handled by Xclusive Oman once you submit
        — no cost or price is shown anywhere in this builder.
      </p>

      {submittedId ? (
        <Card label="Request submitted" className="border-white">
          <p className="text-sm text-agent-ink">
            Your Custom FIT request has been submitted and is now with our team for pricing. You'll be
            notified once a quote is ready.
          </p>
          <p className="mt-2 font-mono text-xs text-agent-muted">Reference: {submittedId}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" onClick={() => navigate('/agent/fit-requests')}>
              View My FIT Requests
            </Button>
            <Button onClick={() => navigate('/agent/dashboard')}>Back to Dashboard</Button>
          </div>
        </Card>
      ) : catalogLoading || draftLoading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
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
              updateTraveler={updateTraveler}
            />
          )}

          <ErrorText>{error}</ErrorText>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={goBack} disabled={step === 1}>
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {draftSavedAt && (
                <span className="text-[11px] text-agent-muted">Draft saved {draftSavedAt.toLocaleTimeString()}</span>
              )}
              <Button disabled={savingDraft} onClick={saveDraft}>
                {savingDraft ? 'Saving…' : 'Save Draft'}
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
          </div>
        </>
      )}
    </div>
  );
}
