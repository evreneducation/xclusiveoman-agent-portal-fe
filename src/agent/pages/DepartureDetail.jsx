import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, Select, StarRating, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatShortDate, getFdBadges, getSeatsLeft } from '../../shared/fdPackage/index.js';

function HeroGallery({ heroImageUrl, images }) {
  const gallery = [heroImageUrl, ...(images || [])].filter(Boolean);
  const [active, setActive] = useState(0);

  if (gallery.length === 0) {
    return (
      <div className="mb-3 flex h-56 items-center justify-center rounded-lg bg-[repeating-linear-gradient(45deg,#eee,#eee_6px,#f7f7f7_6px,#f7f7f7_12px)] font-mono text-[10px] text-[#999]">
        No image
      </div>
    );
  }

  return (
    <div className="mb-3">
      <img src={gallery[active]} alt="" className="h-56 w-full rounded-lg border border-agent-line-light object-cover sm:h-72" />
      {gallery.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {gallery.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setActive(i)}
              className={`h-14 w-20 flex-none overflow-hidden rounded-md border-2 ${
                i === active ? 'border-agent-accent' : 'border-transparent'
              }`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HotelInformation({ hotel }) {
  if (!hotel) return null;
  return (
    <Card label="Hotel information" className="mt-4 border-white">
      <div className="flex gap-3">
        {hotel.images?.[0] && (
          <img src={hotel.images[0]} alt="" className="h-16 w-16 flex-none rounded-md border border-agent-line-light object-cover" />
        )}
        <div>
          <div className="text-sm font-bold text-agent-ink">{hotel.name}</div>
          <div className="text-xs text-agent-muted">
            {[hotel.city, hotel.state].filter(Boolean).join(', ') || '—'} {hotel.category ? `· ${hotel.category}★` : ''}
          </div>
          {hotel.boardBasisOptions?.length > 0 && (
            <div className="mt-1 text-xs text-agent-muted">Board basis: {hotel.boardBasisOptions.join(', ')}</div>
          )}
        </div>
      </div>
      {hotel.description && <p className="mt-2 text-sm text-agent-ink">{hotel.description}</p>}
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
      <button onClick={() => navigate('/agent/departures')} className="mb-4 text-xs text-agent-muted hover:text-agent-ink">
        ← Back to departures
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <HeroGallery heroImageUrl={departure.heroImageUrl} images={departure.images} />

          <div className="mb-2 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
          <h2 className="text-xl font-bold text-agent-ink">{departure.title}</h2>
          <div className="mt-1 text-xs text-agent-muted">
            {departure.destination || 'Destination TBA'} · {departure.duration} {departure.theme ? `· ${departure.theme}` : ''}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StarRating rating={Number(departure.rating) || 0} reviewCount={departure.reviewCount} />
            {departure.suitableAgeMin != null && (
              <span className="text-xs text-agent-muted">Suitable ages {departure.suitableAgeMin}+</span>
            )}
          </div>
          {departure.shortDescription && <p className="mt-3 text-sm text-agent-ink">{departure.shortDescription}</p>}

          {departure.departureDates?.length > 0 && (
            <Card label="Departure dates & availability" className="mt-4 border-white">
              <div className="flex flex-wrap gap-2">
                {departure.departureDates.map((d) => (
                  <span
                    key={d.id}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      d.seatsLeft > 0 ? 'border-agent-line-light bg-white text-agent-ink' : 'border-agent-line-light bg-agent-panel text-agent-muted'
                    }`}
                  >
                    {formatShortDate(d.date)}
                    {d.location && ` · Ex-${d.location}`} · {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'Sold out'}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {departure.itinerary?.length > 0 && (
            <Card label="Day-by-day itinerary" className="mt-4 border-white">
              <div className="space-y-1.5 text-sm">
                {departure.itinerary.map((day) => (
                  <div key={day.dayNumber}>
                    <b>Day {day.dayNumber}</b> — {day.description}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <HotelInformation hotel={departure.hotel} />

          {departure.addons?.length > 0 && (
            <Card label="Included tours, transfers & add-on activities" className="mt-4 border-white">
              {departure.addons.map((addon) => (
                <Checkbox
                  key={addon.id}
                  checked={selectedAddonIds.includes(addon.id)}
                  onChange={() => toggleAddon(addon.id)}
                  label={addon.name}
                  hint={`+ ${formatCurrency(addon.pricePerPax)} pp`}
                />
              ))}
            </Card>
          )}

          <Card label="Booking terms" className="mt-4 border-white">
            <ul className="space-y-1 text-sm text-agent-ink">
              {departure.depositAmount != null && (
                <li>
                  Deposit of {formatCurrency(departure.depositAmount)} due at booking; balance due{' '}
                  {departure.balanceDueDaysBefore ?? 30} days before travel.
                </li>
              )}
              <li>Full itinerary, hotel, and add-on details are as listed above.</li>
              <li>For amendment, cancellation, or visa terms specific to this departure, contact your Relationship Manager.</li>
            </ul>
          </Card>
        </div>

        <div>
          <Card label="Book this departure" className="border-white">
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
                <div className="mb-2 flex items-center justify-between text-xs text-agent-muted">
                  <span>Available seats</span>
                  <span className="font-semibold text-agent-accent-dark">{seatsLeft > 0 ? seatsLeft : 'Sold out'}</span>
                </div>
                <div className="mb-3">
                  <div className="mb-1 text-xs text-agent-muted">Departure date</div>
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
                  <div className="mb-1 text-xs text-agent-muted">Pax</div>
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

                <div className="my-3 border-t border-agent-line-light" />
                <div className="flex justify-between text-sm">
                  <span>Net rate</span>
                  <span>{formatCurrency(departure.ratePerPax)} pp</span>
                </div>
                {selectedAddonIds.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Add-ons ({selectedAddonIds.length} selected)</span>
                    <span>+ {formatCurrency(addonTotalPerPax)} pp</span>
                  </div>
                )}
                <div className="mb-3 flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                <ErrorText>{bookingError}</ErrorText>

                <Button
                  variant="accent"
                  className="mb-2 w-full"
                  disabled={submitting || !departureDateId}
                  onClick={handleBookInstantly}
                >
                  {submitting ? 'Booking…' : 'Book Now'}
                </Button>
                <Button className="mb-2 w-full" onClick={handleEnquireNow}>
                  💬 Enquire Now
                </Button>
                {departure.depositAmount != null && (
                  <p className="text-xs text-agent-muted">
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
