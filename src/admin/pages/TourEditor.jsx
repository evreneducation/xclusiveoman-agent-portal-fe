import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAccessToken } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';
import { TourImagesUpload } from '../components/TourImagesUpload.jsx';
import { validateTourForm } from '../lib/tourForm.js';
import { RichTextEditor, isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';

// Draft autosave's payload — deliberately looser than handleSave's below:
// only fields with an actual value are included (Number('') / Number(undefined)
// would fail the backend's z.number() checks as NaN, and a half-typed field
// shouldn't block an in-progress save the way handleSave's full
// validateTourForm gate should). isBestseller is the one exception — always
// a real boolean, safe to always send. Mirrors HotelEditor.jsx's
// buildDraftPayload exactly — see its own comments for the reasoning behind
// every other choice here (why-only-after-first-edit, the id-race guard, etc).
function buildDraftPayload(form, images) {
  const payload = { isBestseller: !!form.isBestseller };
  if (form.name) payload.name = form.name;
  if (form.city) payload.city = form.city;
  if (!isEmptyHtml(form.description)) payload.description = form.description;
  if (form.duration) payload.duration = form.duration;
  if (form.category) payload.category = form.category;
  if (form.price) payload.price = Number(form.price);
  if (form.suitableAgeMin) payload.suitableAgeMin = Number(form.suitableAgeMin);
  if (form.pickupTime) payload.pickupTime = form.pickupTime;
  if (images.length > 0) payload.images = images;
  return payload;
}

export default function TourEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === 'new';

  const [form, setForm] = useState({});
  const [images, setImages] = useState([]);
  const [tourId, setTourId] = useState(isNew ? null : id);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [autosaving, setAutosaving] = useState(false);

  const tourIdRef = useRef(tourId);
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const creatingRef = useRef(null);
  const skipNextLoadRef = useRef(false);

  function setTourIdBoth(newId) {
    tourIdRef.current = newId;
    setTourId(newId);
  }

  useEffect(() => {
    if (isNew) return;
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
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
          pickupTime: tour.pickupTime ? tour.pickupTime.slice(0, 5) : tour.pickup_time ? tour.pickup_time.slice(0, 5) : '',
          isBestseller: !!tour.is_bestseller,
        });
        setImages(tour.images || []);
        setTourIdBoth(tour.id);
      })
      .catch((err) => setError(err.message || 'Unable to load tour'))
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
    if (!tourIdRef.current) {
      if (!creatingRef.current) {
        creatingRef.current = api
          .post('/admin/tours', { ...payload, status: 'draft' })
          .then(({ tour }) => {
            setTourIdBoth(tour.id);
            skipNextLoadRef.current = true;
            navigate(`/admin/catalog/tours/${tour.id}`, { replace: true });
          })
          .finally(() => {
            creatingRef.current = null;
          });
      }
      await creatingRef.current;
      return;
    }
    if (Object.keys(payload).length === 0) return;
    await api.patch(`/admin/tours/${tourIdRef.current}`, payload);
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
      setError(err.message || 'Unable to save tour');
    }
  }

  useEffect(() => {
    function saveOnUnload() {
      if (!hasUserEditedRef.current) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const payload = buildDraftPayload(form, images);
      const token = getAccessToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      if (!tourIdRef.current) {
        fetch('/api/admin/tours', {
          method: 'POST',
          headers,
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({ ...payload, status: 'draft' }),
        }).catch(() => {});
        return;
      }
      if (Object.keys(payload).length === 0) return;
      fetch(`/api/admin/tours/${tourIdRef.current}`, {
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

  // Explicit "Save as Draft" — persists whatever's on the form right now
  // through the same draft path the autosave already uses (no full-form
  // validation gate, never promotes an existing row to published), then
  // confirms with a toast rather than any inline status text. Stays on the
  // editor so the admin can keep working.
  async function handleSaveDraft() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setError('');
    setSavingDraft(true);
    try {
      await saveDraft(form, images);
      toast.success('Saved to draft');
    } catch (err) {
      toast.error(err.message || 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSave() {
    const validationError = validateTourForm(form, images);
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
        city: form.city,
        description: form.description,
        duration: form.duration,
        category: form.category,
        price: Number(form.price),
        pickupTime: form.pickupTime,
        images,
        ...(form.suitableAgeMin !== '' && form.suitableAgeMin !== undefined
          ? { suitableAgeMin: Number(form.suitableAgeMin) }
          : {}),
        isBestseller: !!form.isBestseller,
        status: 'published',
      };
      if (!tourIdRef.current) {
        const { tour } = await api.post('/admin/tours', payload);
        setTourIdBoth(tour.id);
      } else {
        await api.patch(`/admin/tours/${tourIdRef.current}`, payload);
      }
      navigate('/admin/catalog');
    } catch (err) {
      setError(err.message || 'Unable to save tour');
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
          <h2 className="text-3xl font-bold">{isNew ? 'Add Tour' : `Edit — ${form.name || ''}`}</h2>
          {autosaving && <span className="text-xs font-semibold text-muted">Saving draft…</span>}
        </div>

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
                <div>
                  <FieldLabel>Pickup time *</FieldLabel>
                  <TextInput type="time" required value={form.pickupTime || ''} onChange={(e) => update('pickupTime', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Description *</FieldLabel>
                  <RichTextEditor size="md" value={form.description || ''} onChange={(html) => update('description', html)} />
                </div>
                <TourImagesUpload tourId={tourId} images={images} onChange={updateImages} />
                <div className="sm:col-span-2">
                  <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Bestseller" />
                </div>
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button disabled={submitting || savingDraft} onClick={handleSaveDraft}>
                {savingDraft ? 'Saving…' : 'Save as Draft'}
              </Button>
              <Button disabled={submitting || savingDraft} onClick={handleSave} variant="accent">
                {submitting ? 'Saving…' : 'Save Tour'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
