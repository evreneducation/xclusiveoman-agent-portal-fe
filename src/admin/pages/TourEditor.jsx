import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';
import { TourImagesUpload } from '../components/TourImagesUpload.jsx';
import { validateTourForm } from '../lib/tourForm.js';

export default function TourEditor() {
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
      .get(`/tours/${id}`)
      .then(({ tour }) => {
        setForm({
          name: tour.name || '',
          city: tour.city || '',
          description: tour.description || '',
          duration: tour.duration || '',
          category: tour.category || '',
          price: tour.price ?? '',
          suitableAgeMin: tour.suitable_age_min ?? '',
          isBestseller: !!tour.is_bestseller,
        });
        setImages(tour.images || []);
      })
      .catch((err) => setError(err.message || 'Unable to load tour'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    const validationError = validateTourForm(form, images);
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
        description: form.description,
        duration: form.duration,
        category: form.category,
        price: Number(form.price),
        images,
        ...(form.suitableAgeMin !== '' && form.suitableAgeMin !== undefined
          ? { suitableAgeMin: Number(form.suitableAgeMin) }
          : {}),
        isBestseller: !!form.isBestseller,
      };
      if (isNew) {
        await api.post('/admin/tours', payload);
      } else {
        await api.patch(`/admin/tours/${id}`, payload);
      }
      navigate('/admin/catalog');
    } catch (err) {
      setError(err.message || 'Unable to save tour');
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
        <h2 className="text-3xl font-bold">{isNew ? 'Add Tour' : `Edit — ${form.name || ''}`}</h2>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <>
            <Card label="Tour details" className="border-white">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Tour name *</FieldLabel>
                  <TextInput required value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>City *</FieldLabel>
                  <TextInput required value={form.city || ''} onChange={(e) => update('city', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Duration *</FieldLabel>
                  <TextInput placeholder="e.g. 4 hrs" required value={form.duration || ''} onChange={(e) => update('duration', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Tour category *</FieldLabel>
                  <TextInput placeholder="e.g. Adventure" required value={form.category || ''} onChange={(e) => update('category', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Price (INR) *</FieldLabel>
                  <TextInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={form.price ?? ''}
                    onChange={(e) => update('price', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Suitable age (min)</FieldLabel>
                  <TextInput type="number" value={form.suitableAgeMin ?? ''} onChange={(e) => update('suitableAgeMin', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Description *</FieldLabel>
                  <TextInput required value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <TourImagesUpload tourId={isNew ? null : id} images={images} onChange={setImages} />
                <div className="sm:col-span-2">
                  <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Bestseller" />
                </div>
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button disabled={submitting} onClick={handleSave} variant="accent">
                {submitting ? 'Saving…' : 'Save Tour'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
