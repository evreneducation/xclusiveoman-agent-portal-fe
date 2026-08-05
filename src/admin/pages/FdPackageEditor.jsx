import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, Checkbox, ErrorText, FieldLabel, Select, Tag, Table, TextInput } from '../components/ui.jsx';
import { FD_THEMES } from '../../shared/fdPackage/index.js';

// The backend's validateBody() middleware already returns a human-readable
// `message` (e.g. "Rate gold must be a valid number"). This is a fallback for
// endpoints/errors that only carry the raw zod { fieldErrors } shape, so the
// admin never just sees "Request failed (400)".
function describeApiError(err) {
  if (err.message) return err.message;
  const fieldErrors = err.data?.details?.fieldErrors;
  if (fieldErrors && Object.keys(fieldErrors).length) {
    return Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages[0]}`)
      .join('; ');
  }
  return 'Something went wrong. Please try again.';
}

function HeroImageUpload({ packageId, value, onUploaded }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { fdPackage } = await api.postForm(`/admin/fd-packages/${packageId}/hero-image`, formData);
      onUploaded(fdPackage.heroImageUrl);
    } catch (err) {
      setError(err.message || 'Unable to upload image');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <FieldLabel>Hero image</FieldLabel>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 flex-none rounded-md border border-line-light object-cover" />
        ) : (
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[9px] text-muted">
            No image
          </div>
        )}
        <div>
          <label
            className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold shadow-sm ${
              packageId ? 'border-line-light bg-white text-ink hover:border-ink hover:bg-panel' : 'cursor-not-allowed border-line-light bg-panel text-muted'
            }`}
          >
            {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={!packageId || uploading} onChange={handleFile} />
          </label>
          {!packageId && <p className="mt-1 text-[10px] text-muted">Setting up…</p>}
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </div>
  );
}

function CarouselImagesUpload({ packageId, images, onChange }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState('');

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));
      const { fdPackage } = await api.postForm(`/admin/fd-packages/${packageId}/images`, formData);
      onChange(fdPackage.images);
    } catch (err) {
      setError(err.message || 'Unable to upload images');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(url) {
    setError('');
    setRemovingUrl(url);
    try {
      const { fdPackage } = await api.del(`/admin/fd-packages/${packageId}/images/${encodeURIComponent(url)}`);
      onChange(fdPackage.images);
    } catch (err) {
      setError(err.message || 'Unable to remove image');
    } finally {
      setRemovingUrl('');
    }
  }

  return (
    <div className="sm:col-span-2">
      <FieldLabel>Carousel images</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <div key={url} className="group relative h-16 w-16 flex-none">
            <img src={url} alt="" className="h-16 w-16 rounded-md border border-line-light object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              disabled={removingUrl === url}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-ink bg-white text-[10px] font-bold text-ink shadow-sm hover:bg-panel disabled:opacity-50"
              title="Remove image"
            >
              {removingUrl === url ? '…' : '×'}
            </button>
          </div>
        ))}
        <label
          className={`flex h-16 w-16 flex-none cursor-pointer items-center justify-center rounded-md border border-dashed text-center font-mono text-[9px] leading-tight ${
            packageId ? 'border-line-light text-muted hover:border-ink hover:text-ink' : 'cursor-not-allowed border-line-light text-muted'
          }`}
        >
          {uploading ? 'Uploading…' : '+ Add images'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={!packageId || uploading}
            onChange={handleFiles}
          />
        </label>
      </div>
      {!packageId && <p className="mt-1 text-[10px] text-muted">Setting up…</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function HotelPicker({ hotelId, onChange }) {
  const [hotels, setHotels] = useState([]);

  useEffect(() => {
    api.get('/hotels').then((d) => setHotels(d.hotels));
  }, []);

  return (
    <div>
      <FieldLabel>Hotel</FieldLabel>
      <Select value={hotelId || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">None</option>
        {hotels.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} {h.city ? `— ${h.city}` : ''}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-[10px] text-muted">From the general Hotel Catalog (Product Catalog → Hotels).</p>
    </div>
  );
}

function BasicsForm({ form, update, packageId }) {
  return (
    <Card label="Basics" className="border-white">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Title</FieldLabel>
          <TextInput value={form.title || ''} onChange={(e) => update('title', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Duration</FieldLabel>
          <TextInput placeholder="7N/8D" value={form.duration || ''} onChange={(e) => update('duration', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Theme</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {FD_THEMES.map((t) => (
              <button key={t} type="button" onClick={() => update('theme', t)}>
                <Tag active={form.theme === t}>{t}</Tag>
              </button>
            ))}
          </div>
        </div>
        <HotelPicker hotelId={form.hotelId} onChange={(id) => update('hotelId', id)} />
        <HeroImageUpload packageId={packageId} value={form.heroImageUrl} onUploaded={(url) => update('heroImageUrl', url)} />
        {/* images (carousel) now lives in `form` like every other field —
            previously it had its own parallel `images` state that never
            synced back into `form`, so clicking Save/Publish afterward sent
            a stale `form.images` in the PATCH body and silently overwrote
            the images the upload endpoint had already saved to the DB. */}
        <CarouselImagesUpload packageId={packageId} images={form.images || []} onChange={(imgs) => update('images', imgs)} />
        <div className="sm:col-span-2">
          <FieldLabel>Short description</FieldLabel>
          <TextInput value={form.shortDescription || ''} onChange={(e) => update('shortDescription', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Suitable age (min)</FieldLabel>
          <TextInput type="number" value={form.suitableAgeMin || ''} onChange={(e) => update('suitableAgeMin', Number(e.target.value))} />
        </div>
      </div>
    </Card>
  );
}

function PricingForm({ form, update }) {
  return (
    <Card label="Tiered net rate (per pax)" className="border-white">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <FieldLabel>Gold</FieldLabel>
          <TextInput type="number" value={form.rateGold || ''} onChange={(e) => update('rateGold', Number(e.target.value))} />
        </div>
        <div>
          <FieldLabel>Silver</FieldLabel>
          <TextInput type="number" value={form.rateSilver || ''} onChange={(e) => update('rateSilver', Number(e.target.value))} />
        </div>
        <div>
          <FieldLabel>Bronze</FieldLabel>
          <TextInput type="number" value={form.rateBronze || ''} onChange={(e) => update('rateBronze', Number(e.target.value))} />
        </div>
        <div>
          <FieldLabel>Deposit (INR)</FieldLabel>
          <TextInput type="number" value={form.depositAmount || ''} onChange={(e) => update('depositAmount', Number(e.target.value))} />
        </div>
        <div>
          <FieldLabel>Balance due (days before)</FieldLabel>
          <TextInput
            type="number"
            value={form.balanceDueDaysBefore ?? 30}
            onChange={(e) => update('balanceDueDaysBefore', Number(e.target.value))}
          />
        </div>
      </div>
    </Card>
  );
}

function MerchandisingForm({ form, update, addonsEnabled, onToggleAddons }) {
  return (
    <Card label="Merchandising & discovery attributes" className="border-white">
      <Checkbox checked={!!form.isFeatured} onChange={(v) => update('isFeatured', v)} label="Mark as Featured / Highly Recommended" />
      <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Mark as Bestseller" />
      <Checkbox
        checked={addonsEnabled}
        onChange={onToggleAddons}
        label="Add-ons"
        hint="Attach priced add-on activities/tours to this package"
      />
    </Card>
  );
}

function DepartureDatesManager({ fdPackageId, dates, onChange }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [seatsTotal, setSeatsTotal] = useState(20);
  const [location, setLocation] = useState('');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    api.get('/departure-locations').then((d) => setLocations(d.locations || []));
  }, []);

  async function add() {
    if (!date) return;
    if (!location) {
      toast.error('Select a location for this departure date.');
      return;
    }
    try {
      const { departureDate } = await api.post(`/admin/fd-packages/${fdPackageId}/departure-dates`, {
        date,
        seatsTotal,
        location,
      });
      onChange([...dates, departureDate]);
      setDate('');
      setLocation('');
    } catch (err) {
      toast.error(err.message || 'Unable to add departure date');
    }
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/departure-dates/${id}`);
    onChange(dates.filter((d) => d.id !== id));
  }

  return (
    <Card label="Departure dates & inventory" className="border-white">
      <Table
        columns={['Date', 'Location', 'Seats', '']}
        rows={dates}
        renderRow={(d) => (
          <tr key={d.id} className="border-b border-line-light last:border-0">
            <td className="px-3 py-2">{new Date(d.date).toLocaleDateString()}</td>
            <td className="px-3 py-2">{d.location || '—'}</td>
            <td className="px-3 py-2">
              {d.seats_booked ?? d.seatsBooked ?? 0} / {d.seats_total ?? d.seatsTotal}
            </td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => remove(d.id)} className="text-[#a5162d] hover:underline">
                Remove
              </button>
            </td>
          </tr>
        )}
      />
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Location *</FieldLabel>
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Select location…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Seats</FieldLabel>
          <TextInput type="number" value={seatsTotal} onChange={(e) => setSeatsTotal(Number(e.target.value))} />
        </div>
        <Button onClick={add} disabled={!date || !location}>
          + Add departure date
        </Button>
      </div>
    </Card>
  );
}

function ItineraryManager({ fdPackageId, itinerary, onChange }) {
  const [days, setDays] = useState(itinerary.length ? itinerary : [{ dayNumber: 1, description: '' }]);

  function updateDay(idx, description) {
    setDays((d) => d.map((day, i) => (i === idx ? { ...day, description } : day)));
  }

  function addDay() {
    setDays((d) => [...d, { dayNumber: d.length + 1, description: '' }]);
  }

  async function save() {
    const { itinerary: saved } = await api.put(`/admin/fd-packages/${fdPackageId}/itinerary`, { days });
    onChange(saved);
  }

  return (
    <Card label="Day-by-day itinerary builder" className="border-white">
      <div className="space-y-2">
        {days.map((day, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-14 flex-none text-xs text-muted">Day {day.dayNumber}</span>
            <TextInput value={day.description} onChange={(e) => updateDay(idx, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={addDay}>+ Add Day</Button>
        <Button variant="accent" onClick={save}>
          Save Itinerary
        </Button>
      </div>
    </Card>
  );
}

function AddonsManager({ fdPackageId, addons, onChange }) {
  const [activities, setActivities] = useState([]);
  const [tours, setTours] = useState([]);
  const [selection, setSelection] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    api.get('/activities').then((d) => setActivities(d.activities));
    api.get('/tours').then((d) => setTours(d.tours));
  }, []);

  async function add() {
    if (!selection || !location || !price) return;
    const [kind, id] = selection.split(':');
    const payload =
      kind === 'activity'
        ? { activityId: id, location, pricePerPax: Number(price) }
        : { tourId: id, location, pricePerPax: Number(price) };
    const { addon } = await api.post(`/admin/fd-packages/${fdPackageId}/addons`, payload);
    const name = (kind === 'activity' ? activities : tours).find((x) => x.id === id)?.name;
    onChange([...addons, { ...addon, name }]);
    setSelection('');
    setLocation('');
    setPrice('');
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/addons/${id}`);
    onChange(addons.filter((a) => a.id !== id));
  }

  return (
    <Card label="Add-on activities & tours" className="border-white">
      <p className="mb-3 text-xs text-muted">
        The same activity/tour can be added more than once with a different departure location and price —
        e.g. a tour priced differently ex-Muscat vs ex-Salalah.
      </p>
      <Table
        columns={['Name', 'Location', 'Price / pax', '']}
        rows={addons}
        renderRow={(a) => (
          <tr key={a.id} className="border-b border-line-light last:border-0">
            <td className="px-3 py-2">{a.name}</td>
            <td className="px-3 py-2">{a.location || '—'}</td>
            <td className="px-3 py-2">₹{a.pricePerPax}</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => remove(a.id)} className="text-[#a5162d] hover:underline">
                Remove
              </button>
            </td>
          </tr>
        )}
      />
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <FieldLabel>Activity / tour</FieldLabel>
          <Select value={selection} onChange={(e) => setSelection(e.target.value)}>
            <option value="">Select…</option>
            {activities.map((a) => (
              <option key={a.id} value={`activity:${a.id}`}>
                {a.name}
              </option>
            ))}
            {tours.map((t) => (
              <option key={t.id} value={`tour:${t.id}`}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Departure location</FieldLabel>
          <TextInput placeholder="e.g. Muscat" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Price per pax</FieldLabel>
          <TextInput type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button onClick={add}>+ Add add-on</Button>
      </div>
    </Card>
  );
}

export default function FdPackageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === 'new';

  const [form, setForm] = useState({ balanceDueDaysBefore: 30 });
  const [packageId, setPackageId] = useState(isNew ? null : id);
  const [dates, setDates] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [addons, setAddons] = useState([]);
  const [addonsEnabled, setAddonsEnabled] = useState(false);
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    if (isNew) {
      // Create the draft immediately on open rather than waiting for an
      // explicit "Save as Draft" click, so hero image / carousel images /
      // departure dates / itinerary / add-ons are usable right away instead
      // of being gated behind a manual save first.
      api
        .post('/admin/fd-packages', { title: 'New FD Package', status: 'draft' })
        .then(({ fdPackage }) => {
          setForm(fdPackage);
          setPackageId(fdPackage.id);
          navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, { replace: true });
        })
        .catch((err) => toast.error(err.message || 'Unable to start a new FD package'));
      return;
    }
    api.get(`/admin/fd-packages/${id}`).then(({ fdPackage }) => {
      setForm(fdPackage);
      setPackageId(fdPackage.id);
      setDates(fdPackage.departureDates || []);
      setItinerary(fdPackage.itinerary || []);
      setAddons(fdPackage.addons || []);
      setAddonsEnabled((fdPackage.addons || []).length > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(status) {
    setSubmitting(status);
    try {
      const payload = { ...form, status };
      if (!packageId) {
        const { fdPackage } = await api.post('/admin/fd-packages', payload);
        setPackageId(fdPackage.id);
        navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, { replace: true });
      } else {
        const { fdPackage } = await api.patch(`/admin/fd-packages/${packageId}`, payload);
        setForm(fdPackage);
      }
      toast.success(status === 'published' ? 'FD package published' : 'Draft saved');
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setSubmitting('');
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/catalog')} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <h2 className="text-3xl font-bold">{isNew ? 'Add FD Package' : `Edit — ${form.title || ''}`}</h2>

        <BasicsForm form={form} update={update} packageId={packageId} />
        <PricingForm form={form} update={update} />
        <MerchandisingForm form={form} update={update} addonsEnabled={addonsEnabled} onToggleAddons={setAddonsEnabled} />

        {packageId && (
          <>
            <DepartureDatesManager fdPackageId={packageId} dates={dates} onChange={setDates} />
            <ItineraryManager fdPackageId={packageId} itinerary={itinerary} onChange={setItinerary} />
            {addonsEnabled && <AddonsManager fdPackageId={packageId} addons={addons} onChange={setAddons} />}
          </>
        )}
        {!packageId && <p className="text-xs text-muted">Setting up…</p>}

        <div className="flex justify-end gap-2">
          <Button disabled={!!submitting} onClick={() => handleSave('draft')}>
            {submitting === 'draft' ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button variant="accent" disabled={!!submitting} onClick={() => handleSave('published')}>
            {submitting === 'published' ? 'Publishing…' : 'Publish Package'}
          </Button>
        </div>
      </div>
    </div>
  );
}
