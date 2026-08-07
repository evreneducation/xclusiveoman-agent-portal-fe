import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';
import { ActivityImagesUpload } from '../components/ActivityImagesUpload.jsx';
import { validateActivityForm } from '../lib/activityForm.js';

// Mirrors HotelEditor.jsx / TourEditor.jsx — activities previously only had
// an inline add form + delete in ProductCatalog.jsx (no edit at all), which
// couldn't host a photo picker tied to an existing row. This dedicated page
// adds Edit as a side effect of giving activities the same image-upload flow.
export default function ActivityEditor() {
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
      .get(`/activities/${id}`)
      .then(({ activity }) => {
        setForm({
          name: activity.name || '',
          city: activity.city || '',
          duration: activity.duration || '',
          pricePerPax: activity.pricePerPax ?? activity.price_per_pax ?? '',
          description: activity.description || '',
          isBestseller: !!(activity.isBestseller ?? activity.is_bestseller),
        });
        setImages(activity.images || []);
      })
      .catch((err) => setError(err.message || 'Unable to load activity'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    const validationError = validateActivityForm(form);
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
        duration: form.duration,
        description: form.description,
        images,
        isBestseller: !!form.isBestseller,
        ...(form.pricePerPax !== '' && form.pricePerPax !== undefined
          ? { pricePerPax: Number(form.pricePerPax) }
          : {}),
      };
      if (isNew) {
        await api.post('/admin/activities', payload);
      } else {
        await api.patch(`/admin/activities/${id}`, payload);
      }
      navigate('/admin/catalog');
    } catch (err) {
      setError(err.message || 'Unable to save activity');
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
        <h2 className="text-3xl font-bold">{isNew ? 'Add Activity' : `Edit — ${form.name || ''}`}</h2>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <>
            <Card label="Activity details" className="border-white">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Name *</FieldLabel>
                  <TextInput required value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>City *</FieldLabel>
                  <TextInput required value={form.city || ''} onChange={(e) => update('city', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Duration</FieldLabel>
                  <TextInput placeholder="e.g. 3 hrs" value={form.duration || ''} onChange={(e) => update('duration', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Price per pax (INR)</FieldLabel>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricePerPax ?? ''}
                    onChange={(e) => update('pricePerPax', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <TextInput value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <ActivityImagesUpload activityId={isNew ? null : id} images={images} onChange={setImages} />
                <div className="sm:col-span-2">
                  <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Bestseller" />
                </div>
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button disabled={submitting} onClick={handleSave} variant="accent">
                {submitting ? 'Saving…' : 'Save Activity'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
