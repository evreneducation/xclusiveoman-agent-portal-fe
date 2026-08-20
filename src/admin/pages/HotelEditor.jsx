import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, Select, TextInput } from '../components/ui.jsx';
import { HotelImagesUpload } from '../components/HotelImagesUpload.jsx';
import { STAR_OPTIONS, validateHotelForm } from '../lib/hotelForm.js';

// Occupancy-tiered pricing (0061_hotel_occupancy_pricing.sql) — admin checks
// which of these a hotel offers and prices each independently, replacing
// the old single flat "Price per night" field.
const OCCUPANCY_PRICE_FIELDS = [
  { key: 'singlePrice', label: 'Single occupancy' },
  { key: 'doublePrice', label: 'Double occupancy' },
  { key: 'triplePrice', label: 'Triple occupancy' },
];

export default function HotelEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState({});
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .get(`/hotels/${id}`)
      .then(({ hotel }) => {
        setForm({
          name: hotel.name || '',
          city: hotel.city || '',
          state: hotel.state || '',
          address: hotel.address || '',
          email: hotel.email || '',
          category: hotel.category || '',
          description: hotel.description || '',
          // null (not '') for an unset tier — distinguishes "not offered"
          // (checkbox unchecked) from "offered, price not typed yet" ('').
          singlePrice: hotel.single_price ?? null,
          doublePrice: hotel.double_price ?? null,
          triplePrice: hotel.triple_price ?? null,
          isMiceEnabled: !!hotel.is_mice_enabled,
          miceBallroomCapacity: hotel.mice_ballroom_capacity ?? '',
          miceBreakoutRooms: hotel.mice_breakout_rooms ?? '',
        });
        setImages(hotel.images || []);
      })
      .catch((err) => setError(err.message || 'Unable to load hotel'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    const validationError = validateHotelForm(form, images);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        city: form.city,
        state: form.state,
        address: form.address,
        email: form.email,
        category: Number(form.category),
        description: form.description,
        // Occupancy-tiered pricing (0061_hotel_occupancy_pricing.sql) —
        // only the occupancy types the admin actually checked are sent;
        // an unchecked type's price input is cleared to '' by the checkbox
        // toggle below, so this naturally omits it rather than sending 0.
        singlePrice: form.singlePrice ? Number(form.singlePrice) : undefined,
        doublePrice: form.doublePrice ? Number(form.doublePrice) : undefined,
        triplePrice: form.triplePrice ? Number(form.triplePrice) : undefined,
        isMiceEnabled: !!form.isMiceEnabled,
        // Only sent when set — mirrors MiceCatalog.jsx's MiceHotelForm, which
        // creates these same fields on the same `hotels` row; previously this
        // editor never loaded or saved them, so ballroom capacity / breakout
        // rooms set at creation could never be changed afterwards.
        miceBallroomCapacity: form.miceBallroomCapacity ? Number(form.miceBallroomCapacity) : undefined,
        miceBreakoutRooms: form.miceBreakoutRooms ? Number(form.miceBreakoutRooms) : undefined,
        images,
      };
      if (isNew) {
        await api.post('/admin/hotels', payload);
      } else {
        await api.patch(`/admin/hotels/${id}`, payload);
      }
      navigate('/admin/catalog');
    } catch (err) {
      setError(err.message || 'Unable to save hotel');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/catalog')} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <h2 className="text-3xl font-bold">{isNew ? 'Add Hotel' : `Edit — ${form.name || ''}`}</h2>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <>
            <Card label="Hotel details" className="border-white">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Hotel name *</FieldLabel>
                  <TextInput required value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Star category *</FieldLabel>
                  <Select value={form.category || ''} onChange={(e) => update('category', e.target.value)}>
                    <option value="">Select…</option>
                    {STAR_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s} Star
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>City *</FieldLabel>
                  <TextInput required value={form.city || ''} onChange={(e) => update('city', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>State *</FieldLabel>
                  <TextInput required value={form.state || ''} onChange={(e) => update('state', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Address *</FieldLabel>
                  <TextInput required value={form.address || ''} onChange={(e) => update('address', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Email *</FieldLabel>
                  <TextInput
                    type="email"
                    required
                    value={form.email || ''}
                    onChange={(e) => update('email', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Description *</FieldLabel>
                  <TextInput required value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <HotelImagesUpload hotelId={isNew ? null : id} images={images} onChange={setImages} />
                <div className="sm:col-span-2">
                  <Checkbox checked={!!form.isMiceEnabled} onChange={(v) => update('isMiceEnabled', v)} label="MICE-enabled" />
                </div>
              </div>
            </Card>

            <Card label="Occupancy pricing" className="border-white">
              <p className="mb-3 text-xs text-muted">
                Check which room occupancy types this hotel offers, and price each one — a rate for 1 night at that
                occupancy. At least one is required.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {OCCUPANCY_PRICE_FIELDS.map(({ key, label }) => {
                  // Unchecked = null/undefined ("not offered"); checked = ''
                  // or a real value ("offered", price typed or not yet).
                  const checked = form[key] != null;
                  return (
                    <div key={key} className="rounded-md border border-line-light p-3">
                      <Checkbox
                        checked={checked}
                        onChange={(v) => update(key, v ? '' : null)}
                        label={label}
                      />
                      {checked && (
                        <TextInput
                          className="mt-2"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Price per night"
                          value={form[key] ?? ''}
                          onChange={(e) => update(key, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card label="MICE Information" className="border-white">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Ballroom capacity</FieldLabel>
                  <TextInput
                    type="number"
                    min="0"
                    value={form.miceBallroomCapacity ?? ''}
                    onChange={(e) => update('miceBallroomCapacity', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Breakout rooms</FieldLabel>
                  <TextInput
                    type="number"
                    min="0"
                    value={form.miceBreakoutRooms ?? ''}
                    onChange={(e) => update('miceBreakoutRooms', e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button disabled={submitting} onClick={handleSave} variant="accent">
                {submitting ? 'Saving…' : 'Save Hotel'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
