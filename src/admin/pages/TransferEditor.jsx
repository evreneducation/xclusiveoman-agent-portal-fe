import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, Select, TextInput } from '../components/ui.jsx';
import { TransferImagesUpload } from '../components/TransferImagesUpload.jsx';
import { TRANSFER_TYPE_OPTIONS, validateTransferForm } from '../lib/transferForm.js';

// Mirrors HotelEditor.jsx / TourEditor.jsx — transfers previously only had
// an inline add form + delete in ProductCatalog.jsx (no edit at all), which
// couldn't host a photo picker tied to an existing row. This dedicated page
// adds Edit as a side effect of giving transfers the same image-upload flow.
export default function TransferEditor() {
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
      .get(`/transfers/${id}`)
      .then(({ transfer }) => {
        setForm({
          name: transfer.name || '',
          type: transfer.type || '',
          vehicleClass: transfer.vehicleClass || transfer.vehicle_class || '',
          city: transfer.city || '',
          price: transfer.price ?? '',
          description: transfer.description || '',
        });
        setImages(transfer.images || []);
      })
      .catch((err) => setError(err.message || 'Unable to load transfer'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    const validationError = validateTransferForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        vehicleClass: form.vehicleClass,
        city: form.city,
        description: form.description,
        images,
        ...(form.price !== '' && form.price !== undefined ? { price: Number(form.price) } : {}),
      };
      if (isNew) {
        await api.post('/admin/transfers', payload);
      } else {
        await api.patch(`/admin/transfers/${id}`, payload);
      }
      navigate('/admin/catalog');
    } catch (err) {
      setError(err.message || 'Unable to save transfer');
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
        <h2 className="text-3xl font-bold">{isNew ? 'Add Transfer' : `Edit — ${form.name || ''}`}</h2>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <>
            <Card label="Transfer details" className="border-white">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Name *</FieldLabel>
                  <TextInput required value={form.name || ''} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Type *</FieldLabel>
                  <Select value={form.type || ''} onChange={(e) => update('type', e.target.value)}>
                    <option value="">Select…</option>
                    {TRANSFER_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Vehicle class</FieldLabel>
                  <TextInput value={form.vehicleClass || ''} onChange={(e) => update('vehicleClass', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <TextInput value={form.city || ''} onChange={(e) => update('city', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Price (INR)</FieldLabel>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price ?? ''}
                    onChange={(e) => update('price', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <TextInput value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <TransferImagesUpload transferId={isNew ? null : id} images={images} onChange={setImages} />
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button disabled={submitting} onClick={handleSave} variant="accent">
                {submitting ? 'Saving…' : 'Save Transfer'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
