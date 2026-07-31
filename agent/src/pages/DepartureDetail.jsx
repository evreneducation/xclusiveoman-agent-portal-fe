import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, Select, StarRating, TextInput } from '../components/ui.jsx';

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

  function toggleAddon(addonId) {
    setSelectedAddonIds((ids) =>
      ids.includes(addonId) ? ids.filter((i) => i !== addonId) : [...ids, addonId]
    );
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
    return <div className="p-8 text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="mx-auto max-w-6xl p-5 lg:p-8">
        <button onClick={() => navigate('/departures')} className="mb-4 text-xs text-muted hover:text-ink">
          ← Back to departures
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-3 flex h-40 items-center justify-center rounded-lg bg-[repeating-linear-gradient(45deg,#eee,#eee_6px,#f7f7f7_6px,#f7f7f7_12px)] font-mono text-[10px] text-[#999]">
              HERO IMAGE
            </div>
            <div className="mb-2 flex gap-1.5">
              {departure.isFeatured && <Badge tone="amber">★ Featured</Badge>}
              {departure.isBestseller && <Badge tone="green">Bestseller</Badge>}
            </div>
            <h2 className="text-xl font-bold">{departure.title}</h2>
            <div className="mt-1 text-xs text-muted">{departure.duration}</div>
            <div className="mt-2">
              <StarRating rating={Number(departure.rating) || 0} reviewCount={departure.reviewCount} />
              {departure.suitableAgeMin != null && (
                <span className="ml-2 text-xs text-muted">Suitable ages {departure.suitableAgeMin}+</span>
              )}
            </div>

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

            {departure.addons?.length > 0 && (
              <Card label="Add-on activities & experiences" className="mt-4 border-white">
                {departure.addons.map((addon) => (
                  <Checkbox
                    key={addon.id}
                    checked={selectedAddonIds.includes(addon.id)}
                    onChange={() => toggleAddon(addon.id)}
                    label={addon.name}
                    hint={`+ OMR ${addon.pricePerPax} pp`}
                  />
                ))}
              </Card>
            )}
          </div>

          <div>
            <Card label="Book this departure" className="border-white">
              {bookingResult ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-[#227647]">
                    Booking {bookingResult.status === 'waitlisted' ? 'waitlisted' : 'created'}!
                  </p>
                  <p>Status: {bookingResult.status}</p>
                  <p>Total: OMR {bookingResult.totalPrice}</p>
                  {bookingResult.balanceDueDate && (
                    <p className="text-xs text-muted">
                      Balance due {new Date(bookingResult.balanceDueDate).toLocaleDateString()}
                    </p>
                  )}
                  {bookingResult.status === 'waitlisted' ? (
                    <Button variant="accent" className="w-full" onClick={() => navigate('/dashboard')}>
                      Back to dashboard
                    </Button>
                  ) : (
                    <Button variant="accent" className="w-full" onClick={() => navigate(`/payments/${bookingResult.id}`)}>
                      Continue to Payment
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="mb-1 text-xs text-muted">Departure date</div>
                    <Select value={departureDateId} onChange={(e) => setDepartureDateId(e.target.value)}>
                      {(departure.departureDates || []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {new Date(d.date).toLocaleDateString()} · {d.seatsLeft > 0 ? `${d.seatsLeft} seats left` : 'sold out — waitlist'}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="mb-3">
                    <div className="mb-1 text-xs text-muted">Pax</div>
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
                        onChange={(e) =>
                          setTravelerNames((names) => names.map((n, i) => (i === idx ? e.target.value : n)))
                        }
                      />
                    ))}
                  </div>

                  <div className="my-3 border-t border-line-light" />
                  <div className="flex justify-between text-sm">
                    <span>Net rate</span>
                    <span>OMR {departure.ratePerPax} pp</span>
                  </div>
                  {selectedAddonIds.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Add-ons ({selectedAddonIds.length} selected)</span>
                      <span>+ OMR {addonTotalPerPax} pp</span>
                    </div>
                  )}
                  <div className="mb-3 flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>OMR {total}</span>
                  </div>

                  <ErrorText>{bookingError}</ErrorText>

                  <Button
                    variant="accent"
                    className="mb-2 w-full"
                    disabled={submitting || !departureDateId}
                    onClick={handleBookInstantly}
                  >
                    {submitting ? 'Booking…' : 'Book Instantly'}
                  </Button>
                  <Button className="mb-2 w-full" onClick={handleEnquireNow}>
                    💬 Enquire Now
                  </Button>
                  {departure.depositAmount != null && (
                    <p className="text-xs text-muted">
                      Deposit OMR {departure.depositAmount} now · balance due{' '}
                      {departure.balanceDueDaysBefore} days before travel
                    </p>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
