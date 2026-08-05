import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

const REQUIRED_FIELDS = ['name', 'city', 'description', 'duration', 'category', 'price'];

function TourImagesUpload({ tourId, images, onChange }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      if (tourId) formData.append('tourId', tourId);
      const { images: uploaded } = await api.postForm('/admin/tours/images', formData);
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(err.message || 'Unable to upload images');
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(url) {
    onChange(images.filter((u) => u !== url));
  }

  return (
    <div className="sm:col-span-2">
      <FieldLabel>Images *</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <div key={url} className="group relative h-20 w-20 flex-none">
            <img src={url} alt="" className="h-20 w-20 rounded-md border border-line-light object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-ink bg-white text-[10px] font-bold text-ink shadow-sm hover:bg-panel"
              title="Remove image"
            >
              ×
            </button>
            {url === images[0] && (
              <span className="absolute bottom-0 left-0 right-0 rounded-b-md bg-ink/80 py-0.5 text-center text-[8px] font-semibold uppercase text-white">
                Primary
              </span>
            )}
          </div>
        ))}
        <label className="flex h-20 w-20 flex-none cursor-pointer items-center justify-center rounded-md border border-dashed border-line-light text-center font-mono text-[9px] leading-tight text-muted hover:border-ink hover:text-ink">
          {uploading ? 'Uploading…' : '+ Add images'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={handleFiles}
          />
        </label>
      </div>
      {images.length === 0 && <p className="mt-1 text-[10px] text-muted">Upload at least one image. The first image is used as the primary listing photo.</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

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

  function validate() {
    for (const key of REQUIRED_FIELDS) {
      if (form[key] === undefined || form[key] === null || form[key] === '') {
        return 'Please fill in all required fields.';
      }
    }
    if (images.length === 0) return 'Upload at least one image.';
    if (!(Number(form.price) > 0)) return 'Price (INR) must be a positive number.';
    return '';
  }

  async function handleSave() {
    const validationError = validate();
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
