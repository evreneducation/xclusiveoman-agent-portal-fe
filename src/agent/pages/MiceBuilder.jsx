import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput, Textarea } from '../components/ui.jsx';

// MICE-1..MICE-7: Oman overview/content hub browsing happens on the catalog
// screens already reachable elsewhere in the portal — this wizard is the
// curation + submit half (event details -> hotels -> tours -> transfers ->
// activities -> review), matching the FIT Package Builder's step-wizard
// shape (PackageBuilder.jsx) with no traveller step (not applicable to MICE).
const STEPS = [
  { n: 1, label: 'Event Details' },
  { n: 2, label: 'Hotels' },
  { n: 3, label: 'Tours' },
  { n: 4, label: 'Transfers' },
  { n: 5, label: 'Activities' },
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

// Step 1 — event details (group size, event dates, hall capacity, seating
// style, AV needs, other requirements — same fields Screen 08 captures).
function EventDetailsStep({ form, update }) {
  return (
    <Card label="Event details" className="border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel>Destination *</FieldLabel>
          <TextInput placeholder="e.g. Muscat, Oman" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Event start date *</FieldLabel>
          <TextInput type="date" value={form.eventDateFrom} onChange={(e) => update('eventDateFrom', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Event end date *</FieldLabel>
          <TextInput type="date" value={form.eventDateTo} onChange={(e) => update('eventDateTo', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Group size *</FieldLabel>
          <TextInput type="number" min="1" value={form.groupSize} onChange={(e) => update('groupSize', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Hall capacity needed</FieldLabel>
          <TextInput type="number" min="1" value={form.hallCapacityNeeded} onChange={(e) => update('hallCapacityNeeded', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Seating style</FieldLabel>
          <TextInput placeholder="e.g. Theatre, Banquet" value={form.seatingStyle} onChange={(e) => update('seatingStyle', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>AV / event needs</FieldLabel>
          <Textarea rows={2} value={form.avNeeds} onChange={(e) => update('avNeeds', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Other requirements (optional)</FieldLabel>
          <Textarea
            rows={2}
            placeholder="e.g. dietary restrictions, branding on-site, gala theme…"
            value={form.otherRequirements}
            onChange={(e) => update('otherRequirements', e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}

// Step 2 — hotels (MICE-2/MICE-7: up to 3, multi-select). No price is ever
// rendered here — costing/markup is admin-only (blind pricing).
function HotelsStep({ hotels, cityFilter, setCityFilter, selectedHotelIds, toggleHotel }) {
  const filtered = cityFilter ? hotels.filter((h) => (h.city || '').toLowerCase().includes(cityFilter.toLowerCase())) : hotels;
  const limitReached = selectedHotelIds.length >= 3;

  return (
    <Card label="Select hotels — up to 3" className="border-white">
      <TextInput className="mb-4 max-w-xs" placeholder="Filter by city…" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
      {filtered.length === 0 && <p className="text-sm text-agent-muted">No hotels available{cityFilter ? ' for that city' : ''}.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((h) => {
          const selected = selectedHotelIds.includes(h.id);
          const disabled = !selected && limitReached;
          return (
            <button
              type="button"
              key={h.id}
              disabled={disabled}
              onClick={() => toggleHotel(h.id)}
              className={`rounded-lg border p-3 text-left shadow-sm transition ${
                selected
                  ? 'border-agent-accent ring-2 ring-agent-accent/25'
                  : disabled
                    ? 'cursor-not-allowed border-agent-line-light opacity-50'
                    : 'border-agent-line-light hover:border-agent-ink'
              }`}
            >
              <CatalogImage url={h.images?.[0]} />
              <div className="mt-2 text-sm font-bold">{h.name}</div>
              <div className="text-xs text-agent-muted">
                {h.city || '—'} {h.category ? `· ${h.category}★` : ''}
              </div>
              {h.description && <p className="mt-1 line-clamp-2 text-xs text-agent-muted">{h.description}</p>}
              {selected && <div className="mt-2 text-[10px] font-semibold uppercase text-agent-accent">Selected</div>}
              {disabled && <div className="mt-2 text-[10px] font-semibold uppercase text-agent-muted">Limit reached</div>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Step 3 — tours (MICE-3: multi-select checkboxes, no price).
function ToursStep({ tours, cityFilter, setCityFilter, selectedTourIds, toggleTour }) {
  const filtered = cityFilter ? tours.filter((t) => (t.city || '').toLowerCase().includes(cityFilter.toLowerCase())) : tours;

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

// Step 4 — transfers (MICE-4: multi-select checkboxes, no price).
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

// Step 5 — activities (MICE-3/MICE-5-style extras — team-building, gala
// themes, etc. — multi-select, no price).
function ActivitiesStep({ activities, selectedActivityIds, toggleActivity }) {
  return (
    <Card label="Select activities (optional, multiple allowed)" className="border-white">
      {activities.length === 0 && <p className="text-sm text-agent-muted">No activities available.</p>}
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
              <Checkbox checked={selectedActivityIds.includes(a.id)} onChange={() => toggleActivity(a.id)} label="Include this activity" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Step 6 — review & submit. No price/cost/markup fields anywhere (blind pricing).
function ReviewStep({ form, selectedHotels, selectedTours, selectedTransfers, selectedActivities }) {
  return (
    <div className="space-y-4">
      <Card label="Event summary" className="border-white">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Destination</dt>
            <dd>{form.destination || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Event dates</dt>
            <dd>
              {form.eventDateFrom || '—'} → {form.eventDateTo || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Group size</dt>
            <dd>{form.groupSize || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-agent-muted">Hall capacity</dt>
            <dd>{form.hallCapacityNeeded || '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card label={`Selected hotels — ${selectedHotels.length} of 3`} className="border-white">
        {selectedHotels.length === 0 ? (
          <p className="text-sm text-agent-muted">No hotels selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedHotels.map((h) => (
              <li key={h.id}>
                {h.name} — {h.city}
              </li>
            ))}
          </ul>
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

      <Card label="Selected activities" className="border-white">
        {selectedActivities.length === 0 ? (
          <p className="text-sm text-agent-muted">No activities selected.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {selectedActivities.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function validateStep(step, { form, selectedHotelIds }) {
  if (step === 1) {
    if (!form.destination.trim()) return 'Destination is required.';
    if (!form.eventDateFrom || !form.eventDateTo) return 'Event start and end dates are required.';
    if (new Date(form.eventDateFrom) > new Date(form.eventDateTo)) return 'Event end date must be on or after the start date.';
    if (!form.groupSize || Number(form.groupSize) < 1) return 'Group size is required.';
    return '';
  }
  if (step === 2) {
    if (selectedHotelIds.length === 0) return 'Select at least one hotel to continue.';
    return '';
  }
  return '';
}

export default function MiceBuilder() {
  const navigate = useNavigate();
  const { id: draftIdParam } = useParams();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    destination: '', eventDateFrom: '', eventDateTo: '', groupSize: '',
    hallCapacityNeeded: '', seatingStyle: '', avNeeds: '', otherRequirements: '',
  });

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [hotelCityFilter, setHotelCityFilter] = useState('');
  const [tourCityFilter, setTourCityFilter] = useState('');

  const [selectedHotelIds, setSelectedHotelIds] = useState([]);
  const [selectedTourIds, setSelectedTourIds] = useState([]);
  const [selectedTransferIds, setSelectedTransferIds] = useState([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);

  // MICE Drafts (item 1) — "Continue Editing" opens /agent/mice-builder/:id;
  // draftId then tracks which row "Save Draft" and "Submit Request" write to.
  const [draftId, setDraftId] = useState(draftIdParam || '');
  const [draftLoading, setDraftLoading] = useState(!!draftIdParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    // Only items curated into the MICE Catalog by Admin (is_mice_enabled)
    // may appear here — never the full Product Catalog. Same `?mice=true`
    // filter the Admin MICE Catalog Manager itself uses (MiceCatalog.jsx).
    Promise.all([
      api.get('/hotels?mice=true'),
      api.get('/tours?mice=true'),
      api.get('/transfers?mice=true'),
      api.get('/activities?mice=true'),
    ])
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
      .get(`/mice/rfqs/${draftIdParam}`)
      .then(({ miceRfq: mr }) => {
        if (mr.status !== 'draft') {
          // Already submitted — this link is stale; the read-only proposal view is the right place for it now.
          navigate(`/agent/mice-requests/${mr.id}`, { replace: true });
          return;
        }
        setForm({
          destination: mr.destination || '',
          eventDateFrom: mr.eventDateFrom ? mr.eventDateFrom.slice(0, 10) : '',
          eventDateTo: mr.eventDateTo ? mr.eventDateTo.slice(0, 10) : '',
          groupSize: mr.groupSize || '',
          hallCapacityNeeded: mr.hallCapacityNeeded || '',
          seatingStyle: mr.seatingStyle || '',
          avNeeds: mr.avNeeds || '',
          otherRequirements: mr.otherRequirements || '',
        });
        setSelectedHotelIds(mr.hotels.map((h) => h.id));
        setSelectedTourIds(mr.tours.map((t) => t.id));
        setSelectedTransferIds(mr.transfers.map((t) => t.id));
        setSelectedActivityIds(mr.activities.map((a) => a.id));
      })
      .catch((err) => setError(err.message || 'Unable to load this draft'))
      .finally(() => setDraftLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleHotel(id) {
    setSelectedHotelIds((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      if (list.length >= 3) return list; // hard cap — MICE-2/MICE-7
      return [...list, id];
    });
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

  // Item 1 — "Save Draft"/"Continue Editing" autosave. Deliberately skips
  // validateStep(): a half-built RFQ (no destination yet, no hotel picked)
  // must still save without being blocked by the strict Submit rules.
  function buildDraftPayload() {
    return {
      destination: form.destination,
      eventDateFrom: form.eventDateFrom || null,
      eventDateTo: form.eventDateTo || null,
      groupSize: form.groupSize ? Number(form.groupSize) : null,
      hallCapacityNeeded: form.hallCapacityNeeded ? Number(form.hallCapacityNeeded) : null,
      seatingStyle: form.seatingStyle || undefined,
      avNeeds: form.avNeeds || undefined,
      otherRequirements: form.otherRequirements || undefined,
      hotelIds: selectedHotelIds,
      tourIds: selectedTourIds,
      transferIds: selectedTransferIds,
      activityIds: selectedActivityIds,
    };
  }

  async function saveDraft() {
    setError('');
    setSavingDraft(true);
    try {
      if (draftId) {
        await api.patch(`/mice/rfqs/${draftId}`, buildDraftPayload());
      } else {
        const { miceRfq } = await api.post('/mice/rfqs/draft', buildDraftPayload());
        setDraftId(miceRfq.id);
        navigate(`/agent/mice-builder/${miceRfq.id}`, { replace: true });
      }
      setDraftSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  function goNext() {
    const validationError = validateStep(step, { form, selectedHotelIds });
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
    const step1Error = validateStep(1, { form, selectedHotelIds });
    const step2Error = validateStep(2, { form, selectedHotelIds });
    const validationError = step1Error || step2Error;
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        destination: form.destination,
        eventDateFrom: form.eventDateFrom,
        eventDateTo: form.eventDateTo,
        groupSize: Number(form.groupSize),
        hallCapacityNeeded: form.hallCapacityNeeded ? Number(form.hallCapacityNeeded) : undefined,
        seatingStyle: form.seatingStyle || undefined,
        avNeeds: form.avNeeds || undefined,
        otherRequirements: form.otherRequirements || undefined,
        hotelIds: selectedHotelIds,
        tourIds: selectedTourIds,
        transferIds: selectedTransferIds,
        activityIds: selectedActivityIds,
      };
      // A draft opened via "Continue Editing" submits through its own row
      // (validated the same way — createMiceRfqSchema — just against an
      // existing 'draft' instead of creating a new 'submitted' one).
      const { miceRfq } = draftId
        ? await api.post(`/mice/rfqs/${draftId}/submit`, payload)
        : await api.post('/mice/rfqs', payload);
      setSubmittedId(miceRfq.id);
    } catch (err) {
      setError(err.message || 'Unable to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedHotels = hotels.filter((h) => selectedHotelIds.includes(h.id));
  const selectedTours = tours.filter((t) => selectedTourIds.includes(t.id));
  const selectedTransfers = transfers.filter((t) => selectedTransferIds.includes(t.id));
  const selectedActivities = activities.filter((a) => selectedActivityIds.includes(a.id));

  return (
    <div className="mx-auto max-w-5xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">MICE Curation</h2>
      <p className="mb-5 text-sm text-agent-muted">
        Curate a MICE proposal for your client. Pricing is handled by Xclusive Oman once you submit — no
        cost or price is shown anywhere in this builder.
      </p>

      {submittedId ? (
        <Card label="Request submitted" className="border-white">
          <p className="text-sm text-agent-ink">
            Your MICE request has been submitted and is now with our team for pricing. You'll be notified
            once a proposal is ready.
          </p>
          <p className="mt-2 font-mono text-xs text-agent-muted">Reference: {submittedId}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" onClick={() => navigate('/agent/mice-requests')}>
              View My MICE Requests
            </Button>
            <Button onClick={() => navigate('/agent/dashboard')}>Back to Dashboard</Button>
          </div>
        </Card>
      ) : catalogLoading || draftLoading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
      ) : (
        <>
          <StepIndicator step={step} />

          {step === 1 && <EventDetailsStep form={form} update={update} />}
          {step === 2 && (
            <HotelsStep
              hotels={hotels}
              cityFilter={hotelCityFilter}
              setCityFilter={setHotelCityFilter}
              selectedHotelIds={selectedHotelIds}
              toggleHotel={toggleHotel}
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
            <ActivitiesStep activities={activities} selectedActivityIds={selectedActivityIds} toggleActivity={toggleActivity} />
          )}
          {step === 6 && (
            <ReviewStep
              form={form}
              selectedHotels={selectedHotels}
              selectedTours={selectedTours}
              selectedTransfers={selectedTransfers}
              selectedActivities={selectedActivities}
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
