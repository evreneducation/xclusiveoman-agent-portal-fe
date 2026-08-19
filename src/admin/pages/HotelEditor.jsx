import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, Select, TextInput } from '../components/ui.jsx';
import { HotelImagesUpload } from '../components/HotelImagesUpload.jsx';
import { STAR_OPTIONS, validateHotelForm } from '../lib/hotelForm.js';

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
          pricePerNight: hotel.price_per_night ?? '',
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
        pricePerNight: Number(form.pricePerNight),
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
    <div className="min-h-screen bg-[#eef1f7]">
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
                <div>
                  <FieldLabel>Price (INR per night) *</FieldLabel>
                  <TextInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={form.pricePerNight ?? ''}
                    onChange={(e) => update('pricePerNight', e.target.value)}
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
