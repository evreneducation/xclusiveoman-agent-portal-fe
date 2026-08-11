import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, Select, StarRating, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatShortDate, getFdBadges, getSeatsLeft } from '../../shared/fdPackage/index.js';
import { ITINERARY_ITEM_TYPE_META } from '../../shared/itinerary/index.js';

// Airbnb/Booking.com-style photo grid — one large hero image on the left,
// up to 4 more actual images on the right (no empty placeholder tiles for
// slots the package doesn't have — the grid adapts to however many exist).
// The back button overlays the top-left corner of the hero image instead of
// sitting as a separate line above the gallery.
const GRID_LAYOUT_BY_COUNT = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-1 grid-rows-2',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

function HeroGallery({ heroImageUrl, images, onBack }) {
  const gallery = [heroImageUrl, ...(images || [])].filter(Boolean);
  const main = gallery[0];
  const gridImages = gallery.slice(1, 5); // only real images, capped at 4
  const extraCount = Math.max(gallery.length - 5, 0);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to departures"
      className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-agent-ink shadow-lg transition hover:scale-105 hover:bg-agent-panel"
    >
      ←
    </button>
  );

  if (!main) {
    return (
      <div className="relative mb-6 flex h-72 items-center justify-center rounded-2xl bg-[repeating-linear-gradient(45deg,#eee,#eee_6px,#f7f7f7_6px,#f7f7f7_12px)] font-mono text-[10px] text-[#999] sm:h-96">
        {backButton}
        No image
      </div>
    );
  }

  return (
    <div
      className={`relative mb-6 grid h-72 gap-1.5 overflow-hidden rounded-2xl shadow-lg shadow-black/10 sm:h-96 ${
        gridImages.length > 0 ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      <div className="group relative h-full overflow-hidden">
        <img
          src={main}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {backButton}
      </div>
      {gridImages.length > 0 && (
        <div className={`grid h-full gap-1.5 ${GRID_LAYOUT_BY_COUNT[gridImages.length]}`}>
          {gridImages.map((url, i) => (
            <div
              key={url + i}
              className={`group relative h-full w-full overflow-hidden bg-agent-panel ${
                // 3 real images: first spans the full width on its own row,
                // the other two split the row below it.
                gridImages.length === 3 && i === 0 ? 'col-span-2' : ''
              }`}
            >
              <img src={url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              {i === gridImages.length - 1 && extraCount > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white backdrop-blur-[1px]">
                  +{extraCount} photos
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Consistent section header — small accent icon chip + bold title — used
// across every content card below so the page reads as one designed system
// instead of a stack of generic boxes.
function SectionHeading({ icon, children }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-agent-accent-soft text-base">
        {icon}
      </span>
      <h3 className="text-sm font-bold uppercase tracking-wide text-agent-ink">{children}</h3>
    </div>
  );
}

function HotelInformation({ hotel }) {
  if (!hotel) return null;
  return (
    <Card className="border-white">
      <SectionHeading icon="🏨">Hotel information</SectionHeading>
      <div className="flex gap-4">
        {hotel.images?.[0] && (
          <img
            src={hotel.images[0]}
            alt=""
            className="h-20 w-20 flex-none rounded-xl border border-agent-line-light object-cover shadow-sm"
          />
        )}
        <div>
          <div className="text-sm font-bold text-agent-ink">{hotel.name}</div>
          <div className="mt-0.5 text-xs text-agent-muted">
            {[hotel.city, hotel.state].filter(Boolean).join(', ') || '—'} {hotel.category ? `· ${hotel.category}★` : ''}
          </div>
          {hotel.boardBasisOptions?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {hotel.boardBasisOptions.map((b) => (
                <span key={b} className="rounded-full bg-agent-panel px-2.5 py-0.5 text-[11px] font-medium text-agent-ink">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {hotel.description && <p className="mt-3 text-sm leading-relaxed text-agent-ink">{hotel.description}</p>}
    </Card>
  );
}

// Vertical timeline instead of a plain stacked list — each day gets a
// numbered node connected by a line, which reads far more like a premium
// travel itinerary than plain "Day 1 — ..." text rows. `itinerary` is the
// wire shape composed server-side (fdPackages.model.js's composeItinerary):
// [{ dayNumber, notes, items: [{ type, id, name, city, note }] }] — the same
// shape the admin's Day-by-day itinerary builder now saves (see
// admin/pages/FdPackageEditor.jsx), not the old single free-text
// `description` per day.
function ItineraryTimeline({ itinerary }) {
  return (
    <Card className="border-white">
      <SectionHeading icon="🗺️">Day-by-day itinerary</SectionHeading>
      <div className="space-y-0">
        {itinerary.map((day, idx) => (
          <div key={day.dayNumber} className="relative flex gap-4 pb-5 last:pb-0">
            {idx < itinerary.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-agent-line-light" />
            )}
            <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-agent-ink text-xs font-bold text-white shadow-sm">
              {day.dayNumber}
            </span>
            <div className="flex-1 pt-1 text-sm text-agent-ink">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-agent-accent-dark">Day {day.dayNumber}</div>
              {day.items?.length > 0 && (
                <div className="mb-2 space-y-1">
                  {day.items.map((item, itemIdx) => {
                    const meta = ITINERARY_ITEM_TYPE_META[item.type];
                    return (
                      <div
                        key={`${item.type}:${item.id}:${itemIdx}`}
                        className="rounded-md border border-agent-line-light bg-agent-panel px-2.5 py-1.5"
                      >
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-agent-ink">
                          <span>{meta?.icon}</span>
                          {item.name || meta?.label || 'Item'}
                          {item.city ? ` · ${item.city}` : ''}
                        </span>
                        {item.note && <p className="mt-0.5 pl-[1.375rem] text-[11px] text-agent-muted">{item.note}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {day.notes && <p>{day.notes}</p>}
              {!day.items?.length && !day.notes && <p className="text-agent-muted">Nothing planned yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DepartureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [departure, setDeparture] = useState(null);
  const [error, setError] = useState('');

  const [departureDateId, setDepartureDateId] = useState('');
  const [pax, setPax] = useState(2);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [travelerNames, setTravelerNames] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    api
      .get(`/departures/${id}`)
      .then(({ departure: d }) => {
        setDeparture(d);
        setDepartureDateId(d.departureDates?.[0]?.id || '');
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    setTravelerNames((names) => {
      const next = names.slice(0, pax);
      while (next.length < pax) next.push('');
      return next;
    });
  }, [pax]);

  const selectedDate = departure?.departureDates?.find((d) => d.id === departureDateId);
  const addonTotalPerPax = useMemo(
    () =>
      (departure?.addons || [])
        .filter((a) => selectedAddonIds.includes(a.id))
        .reduce((sum, a) => sum + a.pricePerPax, 0),
    [departure, selectedAddonIds]
  );
  const total = departure ? (departure.ratePerPax + addonTotalPerPax) * pax : 0;
  const seatsLeft = getSeatsLeft(departure?.departureDates);

  function toggleAddon(addonId) {
    setSelectedAddonIds((ids) => (ids.includes(addonId) ? ids.filter((i) => i !== addonId) : [...ids, addonId]));
  }

  async function handleBookInstantly() {
    setBookingError('');
    setSubmitting(true);
    try {
      const { booking } = await api.post(`/departures/${id}/bookings`, {
        departureDateId,
        pax,
        addonIds: selectedAddonIds,
        travelers: travelerNames.filter(Boolean).map((name) => ({ name })),
      });
      setBookingResult(booking);
    } catch (err) {
      setBookingError(err.message || 'Unable to complete booking');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnquireNow() {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate.date);
      params.set('pax', String(pax));
      const { whatsappLink } = await api.get(`/departures/${id}/enquire?${params.toString()}`);
      window.open(whatsappLink, '_blank', 'noopener');
    } catch (err) {
      setBookingError(err.message || 'Unable to build WhatsApp link');
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }
  if (!departure) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
  }

  const badges = getFdBadges(departure);

  return (
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      <HeroGallery
        heroImageUrl={departure.heroImageUrl}
        images={departure.images}
        onBack={() => navigate('/agent/departures')}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {/* Title block */}
          <div className="rounded-2xl border border-white bg-white p-5 shadow-sm sm:p-6">
            {badges.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Badge key={b.label} tone={b.tone}>
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}
            <h1 className="text-2xl font-bold leading-tight text-agent-ink sm:text-3xl">{departure.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-agent-muted">
              <span className="inline-flex items-center gap-1">📍 {departure.destination || 'Destination TBA'}</span>
              <span className="text-agent-line">•</span>
              <span className="inline-flex items-center gap-1">🗓️ {departure.duration}</span>
              {departure.theme && (
                <>
                  <span className="text-agent-line">•</span>
                  <span className="inline-flex items-center gap-1">✨ {departure.theme}</span>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-agent-panel px-3 py-1">
                <StarRating rating={Number(departure.rating) || 0} reviewCount={departure.reviewCount} />
              </span>
              {departure.suitableAgeMin != null && (
                <span className="text-xs text-agent-muted">👥 Suitable ages {departure.suitableAgeMin}+</span>
              )}
            </div>
            {departure.shortDescription && (
              <p className="mt-4 border-t border-agent-line-light pt-4 text-sm leading-relaxed text-agent-ink">
                {departure.shortDescription}
              </p>
            )}
          </div>

          {departure.departureDates?.length > 0 && (
            <Card className="border-white">
              <SectionHeading icon="📅">Departure dates &amp; availability</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {departure.departureDates.map((d) => (
                  <span
                    key={d.id}
                    className={`rounded-full border px-3.5 py-2 text-xs font-semibold ${
                      d.seatsLeft > 0
                        ? 'border-agent-accent/30 bg-agent-accent-soft text-agent-ink'
                        : 'border-agent-line-light bg-agent-panel text-agent-muted'
                    }`}
                  >
                    {formatShortDate(d.date)}
                    {d.location && ` · Ex-${d.location}`} ·{' '}
                    {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'Sold out'}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {departure.itinerary?.length > 0 && <ItineraryTimeline itinerary={departure.itinerary} />}

          <HotelInformation hotel={departure.hotel} />

          {departure.addons?.length > 0 && (
            <Card className="border-white">
              <SectionHeading icon="🎟️">Included tours, transfers &amp; add-on activities</SectionHeading>
              <div className="space-y-2">
                {departure.addons.map((addon) => (
                  <div
                    key={addon.id}
                    className={`rounded-xl border px-3.5 py-2.5 transition-colors ${
                      selectedAddonIds.includes(addon.id)
                        ? 'border-agent-accent bg-agent-accent-soft/50'
                        : 'border-agent-line-light hover:bg-agent-panel'
                    }`}
                  >
                    <Checkbox
                      checked={selectedAddonIds.includes(addon.id)}
                      onChange={() => toggleAddon(addon.id)}
                      label={addon.name}
                      hint={`+ ${formatCurrency(addon.pricePerPax)} pp`}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="border-white">
            <SectionHeading icon="📋">Booking terms</SectionHeading>
            <ul className="space-y-2 text-sm leading-relaxed text-agent-ink">
              {departure.depositAmount != null && (
                <li className="flex gap-2">
                  <span className="text-agent-accent-dark">•</span>
                  Deposit of {formatCurrency(departure.depositAmount)} due at booking; balance due{' '}
                  {departure.balanceDueDaysBefore ?? 30} days before travel.
                </li>
              )}
              <li className="flex gap-2">
                <span className="text-agent-accent-dark">•</span>
                Full itinerary, hotel, and add-on details are as listed above.
              </li>
              <li className="flex gap-2">
                <span className="text-agent-accent-dark">•</span>
                For amendment, cancellation, or visa terms specific to this departure, contact your Relationship Manager.
              </li>
            </ul>
          </Card>
        </div>

        {/* Booking panel — sticky so it stays in view while the left column scrolls */}
        <div className="lg:sticky lg:top-6">
          <Card className="border-white shadow-lg shadow-black/5">
            {bookingResult ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-[#227647]">
                  Booking {bookingResult.status === 'waitlisted' ? 'waitlisted' : 'created'}!
                </p>
                <p>Status: {bookingResult.status}</p>
                <p>Total: {formatCurrency(bookingResult.totalPrice)}</p>
                {bookingResult.balanceDueDate && (
                  <p className="text-xs text-agent-muted">
                    Balance due {new Date(bookingResult.balanceDueDate).toLocaleDateString()}
                  </p>
                )}
                {bookingResult.status === 'waitlisted' ? (
                  <Button variant="accent" className="w-full" onClick={() => navigate('/agent/dashboard')}>
                    Back to dashboard
                  </Button>
                ) : (
                  <Button variant="accent" className="w-full" onClick={() => navigate(`/agent/payments/${bookingResult.id}`)}>
                    Continue to Payment
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-end justify-between border-b border-agent-line-light pb-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-agent-muted">Starting at</div>
                    <div className="text-2xl font-bold text-agent-ink">
                      {formatCurrency(departure.ratePerPax)}
                      <span className="text-sm font-normal text-agent-muted"> / pax</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      seatsLeft > 0 ? 'bg-agent-accent-soft text-agent-accent-dark' : 'bg-agent-panel text-agent-muted'
                    }`}
                  >
                    {seatsLeft > 0 ? `${seatsLeft} seats left` : 'Sold out'}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="mb-1 text-xs font-semibold text-agent-muted">Departure date</div>
                  <Select value={departureDateId} onChange={(e) => setDepartureDateId(e.target.value)}>
                    {(departure.departureDates || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {new Date(d.date).toLocaleDateString()}
                        {d.location && ` · Ex-${d.location}`} · {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'sold out — waitlist'}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="mb-3">
                  <div className="mb-1 text-xs font-semibold text-agent-muted">Pax</div>
                  <TextInput
                    type="number"
                    min={1}
                    max={20}
                    value={pax}
                    onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div className="mb-3 space-y-1">
                  {travelerNames.map((name, idx) => (
                    <TextInput
                      key={idx}
                      placeholder={`Traveler ${idx + 1} full name`}
                      value={name}
                      onChange={(e) => setTravelerNames((names) => names.map((n, i) => (i === idx ? e.target.value : n)))}
                    />
                  ))}
                </div>

                <div className="my-3 space-y-1.5 rounded-xl bg-agent-panel px-3.5 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-agent-muted">Net rate</span>
                    <span className="font-medium text-agent-ink">{formatCurrency(departure.ratePerPax)} pp</span>
                  </div>
                  {selectedAddonIds.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-agent-muted">Add-ons ({selectedAddonIds.length} selected)</span>
                      <span className="font-medium text-agent-ink">+ {formatCurrency(addonTotalPerPax)} pp</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-agent-line-light pt-1.5 text-base font-bold text-agent-ink">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <ErrorText>{bookingError}</ErrorText>

                <Button
                  variant="accent"
                  className="mb-2 w-full py-3 text-sm"
                  disabled={submitting || !departureDateId}
                  onClick={handleBookInstantly}
                >
                  {submitting ? 'Booking…' : 'Book Now'}
                </Button>
                <Button className="mb-3 w-full" onClick={handleEnquireNow}>
                  💬 Enquire Now
                </Button>
                {departure.depositAmount != null && (
                  <p className="text-center text-xs text-agent-muted">
                    Deposit {formatCurrency(departure.depositAmount)} now · balance due {departure.balanceDueDaysBefore} days
                    before travel
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
