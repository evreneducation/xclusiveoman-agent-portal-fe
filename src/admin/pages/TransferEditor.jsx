import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAccessToken } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, Select, TextInput } from '../components/ui.jsx';
import { TransferImagesUpload } from '../components/TransferImagesUpload.jsx';
import { TRANSFER_TYPE_OPTIONS, validateTransferForm } from '../lib/transferForm.js';

// Mirrors HotelEditor.jsx / TourEditor.jsx — transfers previously only had
// an inline add form + delete in ProductCatalog.jsx (no edit at all), which
// couldn't host a photo picker tied to an existing row. This dedicated page
// adds Edit as a side effect of giving transfers the same image-upload flow.

// Draft autosave's payload — see HotelEditor.jsx's buildDraftPayload for the
// full reasoning. Unlike hotels/tours/activities, transfers have no
// always-boolean field to fall back on, so an edit that nets out to nothing
// (every field still blank) leaves this genuinely empty — saveDraft below
// checks for that before ever posting.
function buildDraftPayload(form, images) {
  const payload = {};
  if (form.name) payload.name = form.name;
  if (form.type) payload.type = form.type;
  if (form.vehicleClass) payload.vehicleClass = form.vehicleClass;
  if (form.city) payload.city = form.city;
  if (form.description) payload.description = form.description;
  if (form.price !== '' && form.price !== undefined) payload.price = Number(form.price);
  if (images.length > 0) payload.images = images;
  return payload;
}

export default function TransferEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState({});
  const [images, setImages] = useState([]);
  const [transferId, setTransferId] = useState(isNew ? null : id);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autosaving, setAutosaving] = useState(false);

  const transferIdRef = useRef(transferId);
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const creatingRef = useRef(null);
  const skipNextLoadRef = useRef(false);

  function setTransferIdBoth(newId) {
    transferIdRef.current = newId;
    setTransferId(newId);
  }

  useEffect(() => {
    if (isNew) return;
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
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
        setTransferIdBoth(transfer.id);
      })
      .catch((err) => setError(err.message || 'Unable to load transfer'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function update(key, value) {
    hasUserEditedRef.current = true;
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateImages(next) {
    hasUserEditedRef.current = true;
    setImages(next);
  }

  async function saveDraft(latestForm, latestImages) {
    const payload = buildDraftPayload(latestForm, latestImages);
    if (Object.keys(payload).length === 0) return;
    if (!transferIdRef.current) {
      if (!creatingRef.current) {
        creatingRef.current = api
          .post('/admin/transfers', { ...payload, status: 'draft' })
          .then(({ transfer }) => {
            setTransferIdBoth(transfer.id);
            skipNextLoadRef.current = true;
            navigate(`/admin/catalog/transfers/${transfer.id}`, { replace: true });
          })
          .finally(() => {
            creatingRef.current = null;
          });
      }
      await creatingRef.current;
      return;
    }
    await api.patch(`/admin/transfers/${transferIdRef.current}`, payload);
  }

  useEffect(() => {
    if (!hasUserEditedRef.current) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaving(true);
      try {
        await saveDraft(form, images);
      } catch {
        // Swallowed — see HotelEditor.jsx's own comment on this same pattern.
      } finally {
        setAutosaving(false);
      }
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, images]);

  async function flushDraft() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!hasUserEditedRef.current) return;
    try {
      await saveDraft(form, images);
    } catch (err) {
      setError(err.message || 'Unable to save transfer');
    }
  }

  useEffect(() => {
    function saveOnUnload() {
      if (!hasUserEditedRef.current) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const payload = buildDraftPayload(form, images);
      if (Object.keys(payload).length === 0) return;
      const token = getAccessToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      if (!transferIdRef.current) {
        fetch('/api/admin/transfers', {
          method: 'POST',
          headers,
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({ ...payload, status: 'draft' }),
        }).catch(() => {});
        return;
      }
      fetch(`/api/admin/transfers/${transferIdRef.current}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    window.addEventListener('pagehide', saveOnUnload);
    window.addEventListener('beforeunload', saveOnUnload);
    return () => {
      window.removeEventListener('pagehide', saveOnUnload);
      window.removeEventListener('beforeunload', saveOnUnload);
    };
  }, [form, images]);

  async function handleBackToCatalog() {
    await flushDraft();
    navigate('/admin/catalog');
  }

  async function handleSave() {
    const validationError = validateTransferForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
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
        status: 'published',
      };
      if (!transferIdRef.current) {
        const { transfer } = await api.post('/admin/transfers', payload);
        setTransferIdBoth(transfer.id);
      } else {
        await api.patch(`/admin/transfers/${transferIdRef.current}`, payload);
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
        <button onClick={handleBackToCatalog} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">{isNew ? 'Add Transfer' : `Edit — ${form.name || ''}`}</h2>
          {autosaving && <span className="text-xs font-semibold text-muted">Saving draft…</span>}
        </div>

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
                <TransferImagesUpload transferId={transferId} images={images} onChange={updateImages} />
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
