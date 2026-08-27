import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAccessToken } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';
import { ActivityImagesUpload } from '../components/ActivityImagesUpload.jsx';
import { validateActivityForm } from '../lib/activityForm.js';
import { RichTextEditor, isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';

// Mirrors HotelEditor.jsx / TourEditor.jsx — activities previously only had
// an inline add form + delete in ProductCatalog.jsx (no edit at all), which
// couldn't host a photo picker tied to an existing row. This dedicated page
// adds Edit as a side effect of giving activities the same image-upload flow.

// Draft autosave's payload — see HotelEditor.jsx's buildDraftPayload for the
// full reasoning (only fields with an actual value, isBestseller the one
// always-safe-to-send exception).
function buildDraftPayload(form, images) {
  const payload = { isBestseller: !!form.isBestseller };
  if (form.name) payload.name = form.name;
  if (form.city) payload.city = form.city;
  if (form.duration) payload.duration = form.duration;
  if (!isEmptyHtml(form.description)) payload.description = form.description;
  if (form.pricePerPax !== '' && form.pricePerPax !== undefined) payload.pricePerPax = Number(form.pricePerPax);
  if (images.length > 0) payload.images = images;
  return payload;
}

export default function ActivityEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === 'new';

  const [form, setForm] = useState({});
  const [images, setImages] = useState([]);
  const [activityId, setActivityId] = useState(isNew ? null : id);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [autosaving, setAutosaving] = useState(false);

  const activityIdRef = useRef(activityId);
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const creatingRef = useRef(null);
  const skipNextLoadRef = useRef(false);

  function setActivityIdBoth(newId) {
    activityIdRef.current = newId;
    setActivityId(newId);
  }

  useEffect(() => {
    if (isNew) return;
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
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
        setActivityIdBoth(activity.id);
      })
      .catch((err) => setError(err.message || 'Unable to load activity'))
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
    if (!activityIdRef.current) {
      if (!creatingRef.current) {
        creatingRef.current = api
          .post('/admin/activities', { ...payload, status: 'draft' })
          .then(({ activity }) => {
            setActivityIdBoth(activity.id);
            skipNextLoadRef.current = true;
            navigate(`/admin/catalog/activities/${activity.id}`, { replace: true });
          })
          .finally(() => {
            creatingRef.current = null;
          });
      }
      await creatingRef.current;
      return;
    }
    if (Object.keys(payload).length === 0) return;
    await api.patch(`/admin/activities/${activityIdRef.current}`, payload);
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
      setError(err.message || 'Unable to save activity');
    }
  }

  useEffect(() => {
    function saveOnUnload() {
      if (!hasUserEditedRef.current) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const payload = buildDraftPayload(form, images);
      const token = getAccessToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      if (!activityIdRef.current) {
        fetch('/api/admin/activities', {
          method: 'POST',
          headers,
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({ ...payload, status: 'draft' }),
        }).catch(() => {});
        return;
      }
      if (Object.keys(payload).length === 0) return;
      fetch(`/api/admin/activities/${activityIdRef.current}`, {
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
    const validationError = validateActivityForm(form);
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
        duration: form.duration,
        description: form.description,
        images,
        isBestseller: !!form.isBestseller,
        ...(form.pricePerPax !== '' && form.pricePerPax !== undefined
          ? { pricePerPax: Number(form.pricePerPax) }
          : {}),
        status: 'published',
      };
      if (!activityIdRef.current) {
        const { activity } = await api.post('/admin/activities', payload);
        setActivityIdBoth(activity.id);
      } else {
        await api.patch(`/admin/activities/${activityIdRef.current}`, payload);
      }
      navigate('/admin/catalog');
    } catch (err) {
      setError(err.message || 'Unable to save activity');
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
          <h2 className="text-3xl font-bold">{isNew ? 'Add Activity' : `Edit — ${form.name || ''}`}</h2>
          {autosaving && <span className="text-xs font-semibold text-muted">Saving draft…</span>}
        </div>

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
                  <RichTextEditor size="sm" value={form.description || ''} onChange={(html) => update('description', html)} />
                </div>
                <ActivityImagesUpload activityId={activityId} images={images} onChange={updateImages} />
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
                {submitting ? 'Saving…' : 'Save Activity'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
