import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Select, Tag, TextInput } from './ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Admin Manual Booking Flow (Task 13 — Screen 22). 7-step wizard, mirrors
// the agent PackageBuilder.jsx's own step-indicator pattern structurally
// (not literally shared — different app tree), backed entirely by existing
// admin endpoints (GET /admin/agencies, GET /admin/fd-packages[/:id]) plus
// the one new endpoint this task adds (POST /admin/bookings/manual). FD-only
// — see booking.service.js's own comment for why.

const STEPS = [
  { n: 1, label: 'Agency' },
  { n: 2, label: 'Package' },
  { n: 3, label: 'Departure' },
  { n: 4, label: 'Travelers' },
  { n: 5, label: 'Add-ons' },
  { n: 6, label: 'Review' },
  { n: 7, label: 'Confirm' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Not recorded yet' },
  { value: 'neft', label: 'NEFT / Bank transfer' },
  { value: 'cashfree', label: 'Cashfree (card)' },
  { value: 'credit_terms', label: 'Credit terms' },
];

function StepIndicator({ step }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {STEPS.map((s) => (
        <Tag key={s.n} active={s.n === step} className={s.n < step ? '!border-ink !bg-white !text-ink' : ''}>
          {s.n}. {s.label}
        </Tag>
      ))}
    </div>
  );
}

function emptyTraveler() {
  return { name: '', passportNo: '', dob: '', roomShareGroup: '' };
}

export default function ManualBookingWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);

  // Step 1 — agency
  const [agencies, setAgencies] = useState([]);
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [loadingAgencies, setLoadingAgencies] = useState(true);

  // Step 2 — package (only 'published' — reuses GET /admin/fd-packages,
  // filtered client-side rather than adding a status query param the
  // existing endpoint doesn't support).
  const [packages, setPackages] = useState([]);
  const [packageSearch, setPackageSearch] = useState('');
  const [fdPackageId, setFdPackageId] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(true);

  // Step 3 — departure (needs the package's full detail — departureDates/
  // addons only come back from GET /admin/fd-packages/:id, not the list).
  const [packageDetail, setPackageDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [departureDateId, setDepartureDateId] = useState('');

  // Step 4 — pax/travelers
  const [pax, setPax] = useState(1);
  const [travelers, setTravelers] = useState([emptyTraveler()]);

  // Step 5 — addons
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);

  // Step 6 — review / payment
  const [agreedTotalPrice, setAgreedTotalPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [depositPaid, setDepositPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .get('/admin/agencies?status=approved')
      .then(({ agencies: list }) => setAgencies(list))
      .catch(() => {})
      .finally(() => setLoadingAgencies(false));
  }, []);

  useEffect(() => {
    api
      .get('/admin/fd-packages')
      .then(({ fdPackages }) => setPackages(fdPackages.filter((p) => p.status === 'published')))
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }, []);

  useEffect(() => {
    if (!fdPackageId) return;
    setLoadingDetail(true);
    setDepartureDateId('');
    api
      .get(`/admin/fd-packages/${fdPackageId}`)
      .then(({ fdPackage }) => setPackageDetail(fdPackage))
      .catch(() => setPackageDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [fdPackageId]);

  // Keep the traveler-form count in sync with pax, preserving already-typed
  // entries — same "resize, don't rebuild" pattern DepartureDetail.jsx uses.
  useEffect(() => {
    setTravelers((list) => {
      const next = list.slice(0, pax);
      while (next.length < pax) next.push(emptyTraveler());
      return next;
    });
  }, [pax]);

  const selectedAgency = agencies.find((a) => a.id === agencyId) || null;
  const selectedPackage = packages.find((p) => p.id === fdPackageId) || null;
  const selectedDeparture = packageDetail?.departureDates?.find((d) => d.id === departureDateId) || null;
  const seatsLeft = selectedDeparture ? selectedDeparture.seatsTotal - selectedDeparture.seatsBooked : null;
  const willWaitlist = selectedDeparture != null && pax > seatsLeft;

  const addonsPerPax = useMemo(
    () => (packageDetail?.addons || []).filter((a) => selectedAddonIds.includes(a.id)).reduce((sum, a) => sum + a.pricePerPax, 0),
    [packageDetail, selectedAddonIds]
  );
  const calculatedPrice = selectedPackage ? (selectedPackage.ratePerPax + addonsPerPax) * pax : 0;

  // Prefill the agreed price with the calculated one the first time Review
  // is reached (or whenever pax/package/addons change before the admin has
  // manually touched the field) — still fully editable per MAN-3, this is
  // just a sensible starting point, not a locked value.
  useEffect(() => {
    if (!priceTouched) setAgreedTotalPrice(calculatedPrice ? String(calculatedPrice) : '');
  }, [calculatedPrice, priceTouched]);

  const depositNum = Number(depositPaid) || 0;
  const priceNum = Number(agreedTotalPrice) || 0;
  const balanceDue = Math.max(0, priceNum - depositNum);
  const projectedStatus = willWaitlist ? 'waitlisted' : depositNum <= 0 ? 'pending_payment' : depositNum >= priceNum ? 'fully_paid' : 'confirmed';

  function canAdvance() {
    if (step === 1) return Boolean(agencyId);
    if (step === 2) return Boolean(fdPackageId);
    if (step === 3) return Boolean(departureDateId);
    if (step === 4) return pax >= 1 && travelers.every((t, i) => (i === 0 ? t.name.trim() : true)) && travelers[0]?.name.trim();
    if (step === 6) return priceNum > 0;
    return true;
  }

  async function handleSubmit() {
    setSubmitError('');
    setSubmitting(true);
    try {
      const { booking } = await api.post('/admin/bookings/manual', {
        agencyId,
        fdPackageId,
        departureDateId,
        pax,
        travelers: travelers
          .filter((t) => t.name.trim())
          .map((t) => ({
            name: t.name.trim(),
            passportNo: t.passportNo.trim() || undefined,
            dob: t.dob || undefined,
            roomShareGroup: t.roomShareGroup.trim() || undefined,
          })),
        addonIds: selectedAddonIds,
        agreedTotalPrice: priceNum,
        depositPaid: depositNum,
        paymentMethod: paymentMethod || undefined,
      });
      setResult(booking);
      setStep(7);
      onCreated?.();
    } catch (err) {
      setSubmitError(err.message || 'Unable to create booking');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-white">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold">New Manual Booking</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
          ×
        </button>
      </div>

      <StepIndicator step={step} />

      {step === 1 && (
        <div>
          <FieldLabel>Select an approved agency</FieldLabel>
          <TextInput
            className="mb-3"
            placeholder="Search agencies…"
            value={agencySearch}
            onChange={(e) => setAgencySearch(e.target.value)}
          />
          {loadingAgencies ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {agencies
                .filter((a) => a.name.toLowerCase().includes(agencySearch.trim().toLowerCase()))
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAgencyId(a.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
                      agencyId === a.id ? 'border-ink bg-ink text-white' : 'border-line-light bg-white hover:border-line'
                    }`}
                  >
                    <span>
                      <span className="font-semibold">{a.name}</span>
                      {a.ownerName && <span className={agencyId === a.id ? 'text-white/70' : 'text-muted'}> · {a.ownerName}</span>}
                    </span>
                    {a.tier && <Badge tone="grey">{a.tier}</Badge>}
                  </button>
                ))}
              {agencies.length === 0 && <p className="text-sm text-muted">No approved agencies found.</p>}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <FieldLabel>Select a published FD package</FieldLabel>
          <TextInput
            className="mb-3"
            placeholder="Search packages…"
            value={packageSearch}
            onChange={(e) => setPackageSearch(e.target.value)}
          />
          {loadingPackages ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {packages
                .filter((p) => p.title.toLowerCase().includes(packageSearch.trim().toLowerCase()))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFdPackageId(p.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      fdPackageId === p.id ? 'border-ink bg-ink text-white' : 'border-line-light bg-white hover:border-line'
                    }`}
                  >
                    <div className="font-semibold">{p.title}</div>
                    <div className={fdPackageId === p.id ? 'text-white/70' : 'text-muted'}>
                      {formatCurrency(p.ratePerPax)} / pax {p.duration ? `· ${p.duration}` : ''}
                    </div>
                  </button>
                ))}
              {packages.length === 0 && <p className="text-sm text-muted">No published FD packages found.</p>}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <FieldLabel>Select a departure date</FieldLabel>
          {loadingDetail ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <div className="space-y-2">
              {(packageDetail?.departureDates || []).map((d) => {
                const left = d.seatsTotal - d.seatsBooked;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDepartureDateId(d.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
                      departureDateId === d.id ? 'border-ink bg-ink text-white' : 'border-line-light bg-white hover:border-line'
                    }`}
                  >
                    <span>
                      <span className="font-semibold">{new Date(d.date).toLocaleDateString()}</span>
                      {d.location && <span className={departureDateId === d.id ? 'text-white/70' : 'text-muted'}> · Ex-{d.location}</span>}
                    </span>
                    <Badge tone={left > 0 ? 'green' : 'red'}>
                      {d.seatsBooked}/{d.seatsTotal} booked · {left > 0 ? `${left} left` : 'sold out'}
                    </Badge>
                  </button>
                );
              })}
              {(!packageDetail || packageDetail.departureDates.length === 0) && (
                <p className="text-sm text-muted">This package has no departure dates.</p>
              )}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="mb-4 max-w-[160px]">
            <FieldLabel>Pax</FieldLabel>
            <TextInput type="number" min={1} max={50} value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <FieldLabel>Travelers</FieldLabel>
          <div className="space-y-3">
            {travelers.map((t, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-line-light p-3 sm:grid-cols-4">
                <TextInput
                  placeholder={`Traveler ${idx + 1} full name${idx === 0 ? ' *' : ''}`}
                  value={t.name}
                  onChange={(e) => setTravelers((list) => list.map((tt, i) => (i === idx ? { ...tt, name: e.target.value } : tt)))}
                />
                <TextInput
                  placeholder="Passport no. (optional)"
                  value={t.passportNo}
                  onChange={(e) => setTravelers((list) => list.map((tt, i) => (i === idx ? { ...tt, passportNo: e.target.value } : tt)))}
                />
                <TextInput
                  type="date"
                  placeholder="DOB (optional)"
                  value={t.dob}
                  onChange={(e) => setTravelers((list) => list.map((tt, i) => (i === idx ? { ...tt, dob: e.target.value } : tt)))}
                />
                <TextInput
                  placeholder="Room-share group (optional)"
                  value={t.roomShareGroup}
                  onChange={(e) => setTravelers((list) => list.map((tt, i) => (i === idx ? { ...tt, roomShareGroup: e.target.value } : tt)))}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">Only the first traveler's name is required to proceed; the rest can be added later.</p>
        </div>
      )}

      {step === 5 && (
        <div>
          <FieldLabel>Add-ons (optional)</FieldLabel>
          {(packageDetail?.addons || []).length === 0 ? (
            <p className="text-sm text-muted">This package has no add-ons.</p>
          ) : (
            <div className="space-y-2">
              {packageDetail.addons.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-line-light px-3.5 py-2.5">
                  <Checkbox
                    checked={selectedAddonIds.includes(a.id)}
                    onChange={() =>
                      setSelectedAddonIds((ids) => (ids.includes(a.id) ? ids.filter((i) => i !== a.id) : [...ids, a.id]))
                    }
                    label={a.name}
                  />
                  <span className="text-sm font-semibold">{formatCurrency(a.pricePerPax)} / pax</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card label="Agency" className="border-white bg-panel/60">
              <div className="text-sm font-semibold">{selectedAgency?.name}</div>
            </Card>
            <Card label="Package & departure" className="border-white bg-panel/60">
              <div className="text-sm font-semibold">{selectedPackage?.title}</div>
              <div className="text-xs text-muted">
                {selectedDeparture && new Date(selectedDeparture.date).toLocaleDateString()}
                {selectedDeparture?.location && ` · Ex-${selectedDeparture.location}`}
              </div>
            </Card>
          </div>

          <Card label={`Travelers (${travelers.filter((t) => t.name.trim()).length} of ${pax} pax named)`} className="border-white bg-panel/60">
            {travelers.filter((t) => t.name.trim()).length === 0 ? (
              <p className="text-sm text-muted">No traveler names entered.</p>
            ) : (
              <ul className="text-sm">
                {travelers
                  .filter((t) => t.name.trim())
                  .map((t, i) => (
                    <li key={i}>
                      {t.name}
                      {t.roomShareGroup && <span className="text-muted"> ({t.roomShareGroup})</span>}
                    </li>
                  ))}
              </ul>
            )}
            {selectedAddonIds.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Add-ons: {packageDetail.addons.filter((a) => selectedAddonIds.includes(a.id)).map((a) => a.name).join(', ')}
              </p>
            )}
          </Card>

          {willWaitlist && (
            <div className="rounded-lg border border-[#f1c67f] bg-[#fff2dc] px-3.5 py-3 text-sm text-[#9a5a16]">
              <strong>Insufficient seats</strong> — only {seatsLeft} left for {pax} pax requested. This booking will be created as{' '}
              <strong>waitlisted</strong> instead of confirmed, exactly like a self-service sold-out booking.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Calculated (catalog) price</FieldLabel>
              <div className="rounded-md border border-line-light bg-panel px-3.5 py-3 text-sm text-muted">
                {formatCurrency(calculatedPrice)}
              </div>
            </div>
            <div>
              <FieldLabel>Agreed sell price *</FieldLabel>
              <TextInput
                type="number"
                min={0}
                value={agreedTotalPrice}
                onChange={(e) => {
                  setPriceTouched(true);
                  setAgreedTotalPrice(e.target.value);
                }}
              />
            </div>
            <div>
              <FieldLabel>Deposit collected offline (optional)</FieldLabel>
              <TextInput type="number" min={0} value={depositPaid} onChange={(e) => setDepositPaid(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Payment method</FieldLabel>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl bg-panel px-3.5 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Balance due</span>
              <span className="font-semibold">{formatCurrency(balanceDue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Resulting status</span>
              <Badge tone={projectedStatus === 'waitlisted' ? 'amber' : projectedStatus === 'fully_paid' || projectedStatus === 'confirmed' ? 'green' : 'grey'}>
                {projectedStatus.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>

          <ErrorText>{submitError}</ErrorText>
        </div>
      )}

      {step === 7 && result && (
        <div className="space-y-3 text-center">
          <div className="text-4xl">{result.waitlisted ? '⏳' : '✅'}</div>
          <h4 className="text-lg font-bold">{result.waitlisted ? 'Booking waitlisted' : 'Booking created'}</h4>
          <p className="text-sm text-muted">
            Booking ID <span className="font-mono">{result.id}</span>
          </p>
          <Badge tone={result.waitlisted ? 'amber' : 'green'}>{result.status.replace(/_/g, ' ')}</Badge>
          <p className="text-sm text-muted">
            {formatCurrency(result.totalPrice)} total · {formatCurrency(result.depositPaid)} deposit · {formatCurrency(result.balanceDue)} balance
          </p>
          <p className="text-xs text-muted">The agency owner has been notified in-app and by email.</p>
        </div>
      )}

      <div className="mt-6 flex justify-between border-t border-line-light pt-4">
        {step > 1 && step < 7 ? (
          <Button onClick={() => setStep((s) => s - 1)}>Back</Button>
        ) : (
          <span />
        )}
        {step < 6 && (
          <Button variant="accent" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        )}
        {step === 6 && (
          <Button variant="accent" disabled={!canAdvance() || submitting} onClick={handleSubmit}>
            {submitting ? 'Creating…' : 'Create Booking'}
          </Button>
        )}
        {step === 7 && (
          <Button variant="accent" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </Card>
  );
}
