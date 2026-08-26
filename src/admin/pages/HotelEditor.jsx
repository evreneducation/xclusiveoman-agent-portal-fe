import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAccessToken } from '../api/client.js';
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

// Draft autosave's payload — deliberately looser than handleSave's below:
// only fields with an actual value are included (Number('') / Number(undefined)
// would fail the backend's z.number() checks as NaN, and a half-typed field
// shouldn't block an in-progress save the way handleSave's full
// validateHotelForm gate should). isMiceEnabled is the one exception — always
// a real boolean, safe to always send.
function buildDraftPayload(form, images) {
  const payload = { isMiceEnabled: !!form.isMiceEnabled };
  if (form.name) payload.name = form.name;
  if (form.city) payload.city = form.city;
  if (form.state) payload.state = form.state;
  if (form.address) payload.address = form.address;
  if (form.email) payload.email = form.email;
  if (form.category) payload.category = Number(form.category);
  if (form.description) payload.description = form.description;
  if (form.singlePrice) payload.singlePrice = Number(form.singlePrice);
  if (form.doublePrice) payload.doublePrice = Number(form.doublePrice);
  if (form.triplePrice) payload.triplePrice = Number(form.triplePrice);
  if (form.miceBallroomCapacity) payload.miceBallroomCapacity = Number(form.miceBallroomCapacity);
  if (form.miceBreakoutRooms) payload.miceBreakoutRooms = Number(form.miceBreakoutRooms);
  if (images.length > 0) payload.images = images;
  return payload;
}

export default function HotelEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState({});
  const [images, setImages] = useState([]);
  // Mirrors FdPackageEditor.jsx's `packageId` — null until a row actually
  // exists. Unlike FD packages, that row is *not* created the instant this
  // page opens (see hasUserEditedRef below) — only once the admin actually
  // types/uploads something, so an abandoned "Add Hotel" click never leaves
  // a blank junk row behind.
  const [hotelId, setHotelId] = useState(isNew ? null : id);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autosaving, setAutosaving] = useState(false);

  // Ref twin of hotelId, read synchronously inside the async autosave/unload
  // paths below — `hotelId` state can lag an in-flight create by a render or
  // two, which is exactly the window a fast second edit could otherwise slip
  // through and double-POST a second draft row.
  const hotelIdRef = useRef(hotelId);
  // Set only by update()/updateImages() below (a real, user-driven change) —
  // never by the initial load's own setForm/setImages, so opening an
  // existing hotel doesn't immediately re-PATCH back the exact data it just
  // loaded.
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  // Shares one in-flight "create the draft row" request across overlapping
  // autosave attempts instead of letting each fire its own POST.
  const creatingRef = useRef(null);
  // Consumed once by the load effect below — see its own comment.
  const skipNextLoadRef = useRef(false);

  function setHotelIdBoth(newId) {
    hotelIdRef.current = newId;
    setHotelId(newId);
  }

  useEffect(() => {
    if (isNew) return;
    // Draft-create's own replace-navigate (below) flips `isNew` to false and
    // lands right back here with the id it just created — skip that one
    // refetch (we already have the just-saved data in state) so it doesn't
    // flash the whole form to "Loading…" out from under the admin mid-edit.
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
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
        setHotelIdBoth(hotel.id);
      })
      .catch((err) => setError(err.message || 'Unable to load hotel'))
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

  // Creates the row on the first edit if it doesn't exist yet (status:
  // 'draft'), otherwise PATCHes it — never sending `status` on that PATCH,
  // so an autosaved edit can't flip an already-published hotel back to draft
  // mid-edit (only handleSave's explicit publish does that). Shared by the
  // debounce below, the "Back to catalog" flush, and (best-effort) the
  // beforeunload/pagehide handler.
  async function saveDraft(latestForm, latestImages) {
    const payload = buildDraftPayload(latestForm, latestImages);
    if (!hotelIdRef.current) {
      if (!creatingRef.current) {
        creatingRef.current = api
          .post('/admin/hotels', { ...payload, status: 'draft' })
          .then(({ hotel }) => {
            setHotelIdBoth(hotel.id);
            skipNextLoadRef.current = true;
            navigate(`/admin/catalog/hotels/${hotel.id}`, { replace: true });
          })
          .finally(() => {
            creatingRef.current = null;
          });
      }
      await creatingRef.current;
      return;
    }
    if (Object.keys(payload).length === 0) return;
    await api.patch(`/admin/hotels/${hotelIdRef.current}`, payload);
  }

  // Debounced ~1s after the admin stops changing anything, same shape as
  // FdPackageEditor.jsx's autosave. Failures are swallowed on purpose — a
  // still-incomplete field (an email typed so far, say) is expected while
  // drafting and shouldn't interrupt typing with an error; handleSave's full
  // validateHotelForm is the one gate the admin actually has to satisfy.
  useEffect(() => {
    if (!hasUserEditedRef.current) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaving(true);
      try {
        await saveDraft(form, images);
      } catch {
        // Swallowed — see comment above.
      } finally {
        setAutosaving(false);
      }
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, images]);

  // Belt-and-braces on top of the debounce above — flushed + awaited before
  // "Back to catalog" navigates away, and a best-effort `keepalive` fetch on
  // an actual page refresh/tab close (mirrors FdPackageEditor.jsx's own pair
  // of triggers). The unload path can't wait for a create's response to
  // learn the new id (the page is already gone), so a refresh that lands
  // mid-create — before the debounce above ever got a chance to run — can
  // leave an orphan draft row with no way back to it from this same "new"
  // URL; accepted as rare and low-cost (a stray draft, findable later in
  // ProductCatalog.jsx's Hotels tab) rather than adding more machinery to
  // close that one edge case.
  async function flushDraft() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!hasUserEditedRef.current) return;
    try {
      await saveDraft(form, images);
    } catch (err) {
      setError(err.message || 'Unable to save hotel');
    }
  }

  useEffect(() => {
    function saveOnUnload() {
      if (!hasUserEditedRef.current) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const payload = buildDraftPayload(form, images);
      const token = getAccessToken();
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      if (!hotelIdRef.current) {
        fetch('/api/admin/hotels', {
          method: 'POST',
          headers,
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({ ...payload, status: 'draft' }),
        }).catch(() => {});
        return;
      }
      if (Object.keys(payload).length === 0) return;
      fetch(`/api/admin/hotels/${hotelIdRef.current}`, {
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
    const validationError = validateHotelForm(form, images);
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
        // 0070_hotels_status.sql — this form already fully validates above
        // before ever submitting, so "saved here" and "ready to appear in an
        // itinerary picker" are the same moment; no separate publish step.
        status: 'published',
      };
      if (!hotelIdRef.current) {
        const { hotel } = await api.post('/admin/hotels', payload);
        setHotelIdBoth(hotel.id);
      } else {
        await api.patch(`/admin/hotels/${hotelIdRef.current}`, payload);
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
        <button onClick={handleBackToCatalog} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">{isNew ? 'Add Hotel' : `Edit — ${form.name || ''}`}</h2>
          {autosaving && <span className="text-xs font-semibold text-muted">Saving draft…</span>}
        </div>

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
                <HotelImagesUpload hotelId={hotelId} images={images} onChange={updateImages} />
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
