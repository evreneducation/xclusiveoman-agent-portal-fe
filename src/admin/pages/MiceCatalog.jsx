import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Select, Table, TextInput } from '../components/ui.jsx';
import { HotelImagesUpload } from '../components/HotelImagesUpload.jsx';
import { STAR_OPTIONS, validateHotelForm } from '../lib/hotelForm.js';
import { TourImagesUpload } from '../components/TourImagesUpload.jsx';
import { validateTourForm } from '../lib/tourForm.js';
import { ActivityImagesUpload } from '../components/ActivityImagesUpload.jsx';
import { validateActivityForm } from '../lib/activityForm.js';
import { TransferImagesUpload } from '../components/TransferImagesUpload.jsx';
import { TRANSFER_TYPE_OPTIONS, validateTransferForm } from '../lib/transferForm.js';

// Activities and transfers now get their own dedicated forms too
// (MiceActivityForm / MiceTransferForm, below — mirroring MiceHotelForm /
// MiceTourForm), so they can carry an image upload the same way hotels and
// tours already do; only Experiences (which the Agent MICE Builder never
// consumes) still goes through the generic AddEntityForm.
const ENTITY_FIELDS = {
  experiences: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'suitableGroupSizeMin', label: 'Min group size', type: 'number' },
    { key: 'suitableGroupSizeMax', label: 'Max group size', type: 'number' },
  ],
};

const TABS = [
  { key: 'hotels', label: 'MICE Hotels' },
  { key: 'tours', label: 'Tours' },
  { key: 'activities', label: 'Activities' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'experiences', label: 'Experiences' },
];

function AddEntityForm({ entity, fields, endpoint, onCreated, defaults = {} }) {
  const [form, setForm] = useState(defaults);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {};
      for (const f of fields) {
        if (form[f.key] === undefined) continue;
        payload[f.key] = f.type === 'number' ? Number(form[f.key]) : form[f.key];
      }
      const { [entity]: created } = await api.post(endpoint, payload);
      onCreated(created);
      setForm(defaults);
    } catch (err) {
      setError(err.message || 'Unable to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={`Add ${entity}`} className="mt-4 border-white">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <div className="mb-1 text-xs text-muted">{f.label}</div>
            {f.type === 'checkbox' ? (
              <Checkbox checked={!!form[f.key]} onChange={(v) => update(f.key, v)} label={f.label} />
            ) : f.type === 'select' ? (
              <Select value={form[f.key] || ''} onChange={(e) => update(f.key, e.target.value)}>
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                type={f.type === 'number' ? 'number' : 'text'}
                required={f.required}
                value={form[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
          <Button variant="accent" type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Saving…' : `Save ${entity}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Matches the backend's hotelSchema (validation/schemas.js) exactly — the
// MICE Catalog creates rows in the same `hotels` table the Product Catalog
// Hotel form (HotelEditor.jsx) does, so it needs every field that model
// requires, not just the MICE-specific ones. Reuses HotelEditor's image
// upload component + validation (lib/hotelForm.js) rather than duplicating
// them here.
const MICE_HOTEL_DEFAULTS = { isMiceEnabled: true };

function MiceHotelForm({ onCreated }) {
  const [form, setForm] = useState(MICE_HOTEL_DEFAULTS);
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        images,
        miceBallroomCapacity: form.miceBallroomCapacity ? Number(form.miceBallroomCapacity) : undefined,
        miceBreakoutRooms: form.miceBreakoutRooms ? Number(form.miceBreakoutRooms) : undefined,
        isMiceEnabled: !!form.isMiceEnabled,
      };
      const { hotel } = await api.post('/admin/hotels', payload);
      onCreated(hotel);
      setForm(MICE_HOTEL_DEFAULTS);
      setImages([]);
    } catch (err) {
      setError(err.message || 'Unable to create hotel');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <Card label="Basic Hotel Information" className="border-white">
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
            <TextInput type="email" required value={form.email || ''} onChange={(e) => update('email', e.target.value)} />
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
          <HotelImagesUpload hotelId={null} images={images} onChange={setImages} />
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
          <div className="sm:col-span-2">
            <Checkbox checked={!!form.isMiceEnabled} onChange={(v) => update('isMiceEnabled', v)} label="MICE-enabled" />
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button variant="accent" type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save hotel'}
      </Button>
    </form>
  );
}

function MiceHotelsTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      // Listing is a public-to-staff catalog read (`GET /hotels`, doc §12.3)
      // — `/admin/hotels` only has POST/PATCH/DELETE (catalog.routes.js) and
      // 404s, which had silently made this tab's list unusable.
      .get(`/hotels?mice=true${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(({ hotels }) => setItems(hotels))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/hotels/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder="Search MICE hotels…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Hotel', 'City', 'Ballroom capacity', 'Breakout rooms', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">{item.city || '—'}</td>
              <td className="px-3 py-2">{item.mice_ballroom_capacity ?? '—'}</td>
              <td className="px-3 py-2">{item.mice_breakout_rooms ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/hotels/${item.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No MICE-enabled hotels yet — add one below, or enable an existing hotel for MICE from Product Catalog.
        </p>
      )}
      <MiceHotelForm onCreated={(created) => setItems((list) => [created, ...list])} />
    </div>
  );
}

// Matches the backend's tourSchema (validation/schemas.js) exactly — the
// MICE Catalog creates rows in the same `tours` table the Product Catalog
// Tour form (TourEditor.jsx) does, including the required `images` upload,
// which the generic AddEntityForm below can't collect. Reuses TourEditor's
// image upload component + validation (lib/tourForm.js).
const MICE_TOUR_DEFAULTS = { isMiceEnabled: true };

function MiceTourForm({ onCreated }) {
  const [form, setForm] = useState(MICE_TOUR_DEFAULTS);
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        isMiceEnabled: !!form.isMiceEnabled,
      };
      const { tour } = await api.post('/admin/tours', payload);
      onCreated(tour);
      setForm(MICE_TOUR_DEFAULTS);
      setImages([]);
    } catch (err) {
      setError(err.message || 'Unable to create tour');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <Card label="Basic Tour Information" className="border-white">
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
          <div className="sm:col-span-2">
            <FieldLabel>Description *</FieldLabel>
            <TextInput required value={form.description || ''} onChange={(e) => update('description', e.target.value)} />
          </div>
          <TourImagesUpload tourId={null} images={images} onChange={setImages} />
        </div>
      </Card>

      <Card label="MICE Information" className="border-white">
        <Checkbox checked={!!form.isMiceEnabled} onChange={(v) => update('isMiceEnabled', v)} label="MICE-enabled" />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button variant="accent" type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save tour'}
      </Button>
    </form>
  );
}

function MiceToursTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/tours?mice=true${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(({ tours }) => setItems(tours))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/tours/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder="Search MICE tours…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Tour', 'City', 'Category', 'Duration', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">{item.city || '—'}</td>
              <td className="px-3 py-2">{item.category || '—'}</td>
              <td className="px-3 py-2">{item.duration || '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/tours/${item.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No MICE-enabled tours yet — add one below, or enable an existing tour for MICE from Product Catalog.
        </p>
      )}
      <MiceTourForm onCreated={(created) => setItems((list) => [created, ...list])} />
    </div>
  );
}

// Matches the backend's activitySchema (validation/schemas.js) exactly — the
// MICE Catalog creates rows in the same `activities` table the Product
// Catalog Activity form (ActivityEditor.jsx) does. Images are optional here
// (activitySchema doesn't require them, unlike hotels/tours), but the upload
// itself needs its own form to host the picker, same reasoning as
// MiceHotelForm / MiceTourForm above.
const MICE_ACTIVITY_DEFAULTS = { isMiceEnabled: true };

function MiceActivityForm({ onCreated }) {
  const [form, setForm] = useState(MICE_ACTIVITY_DEFAULTS);
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        isMiceEnabled: !!form.isMiceEnabled,
        ...(form.pricePerPax !== '' && form.pricePerPax !== undefined
          ? { pricePerPax: Number(form.pricePerPax) }
          : {}),
      };
      const { activity } = await api.post('/admin/activities', payload);
      onCreated(activity);
      setForm(MICE_ACTIVITY_DEFAULTS);
      setImages([]);
    } catch (err) {
      setError(err.message || 'Unable to create activity');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <Card label="Basic Activity Information" className="border-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Activity name *</FieldLabel>
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
          <ActivityImagesUpload activityId={null} images={images} onChange={setImages} />
        </div>
      </Card>

      <Card label="MICE Information" className="border-white">
        <Checkbox checked={!!form.isMiceEnabled} onChange={(v) => update('isMiceEnabled', v)} label="MICE-enabled" />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button variant="accent" type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save activity'}
      </Button>
    </form>
  );
}

function MiceActivitiesTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/activities?mice=true${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(({ activities }) => setItems(activities))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/activities/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder="Search MICE activities…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Activity', 'City', 'Duration', 'Price / pax', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">{item.city || '—'}</td>
              <td className="px-3 py-2">{item.duration || '—'}</td>
              <td className="px-3 py-2">{item.pricePerPax ?? item.price_per_pax ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/activities/${item.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No MICE-enabled activities yet — add one below, or enable an existing activity for MICE from Product Catalog.
        </p>
      )}
      <MiceActivityForm onCreated={(created) => setItems((list) => [created, ...list])} />
    </div>
  );
}

// Matches the backend's transferSchema (validation/schemas.js) exactly — the
// MICE Catalog creates rows in the same `transfers` table the Product
// Catalog Transfer form (TransferEditor.jsx) does. Images are optional here
// (transferSchema doesn't require them, unlike hotels/tours), but the upload
// itself needs its own form to host the picker, same reasoning as
// MiceHotelForm / MiceTourForm above.
const MICE_TRANSFER_DEFAULTS = { isMiceEnabled: true };

function MiceTransferForm({ onCreated }) {
  const [form, setForm] = useState(MICE_TRANSFER_DEFAULTS);
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        isMiceEnabled: !!form.isMiceEnabled,
        ...(form.price !== '' && form.price !== undefined ? { price: Number(form.price) } : {}),
      };
      const { transfer } = await api.post('/admin/transfers', payload);
      onCreated(transfer);
      setForm(MICE_TRANSFER_DEFAULTS);
      setImages([]);
    } catch (err) {
      setError(err.message || 'Unable to create transfer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <Card label="Basic Transfer Information" className="border-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Transfer name *</FieldLabel>
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
          <TransferImagesUpload transferId={null} images={images} onChange={setImages} />
        </div>
      </Card>

      <Card label="MICE Information" className="border-white">
        <Checkbox checked={!!form.isMiceEnabled} onChange={(v) => update('isMiceEnabled', v)} label="MICE-enabled" />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button variant="accent" type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save transfer'}
      </Button>
    </form>
  );
}

function MiceTransfersTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/transfers?mice=true${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(({ transfers }) => setItems(transfers))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/transfers/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder="Search MICE transfers…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Transfer', 'Type', 'City', 'Price', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">{(item.type || '—').replace(/_/g, ' ')}</td>
              <td className="px-3 py-2">{item.city || '—'}</td>
              <td className="px-3 py-2">{item.price ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <Link to={`/admin/catalog/transfers/${item.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}
      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No MICE-enabled transfers yet — add one below, or enable an existing transfer for MICE from Product Catalog.
        </p>
      )}
      <MiceTransferForm onCreated={(created) => setItems((list) => [created, ...list])} />
    </div>
  );
}

// Only ever called with entity="experiences" now that activities/transfers
// have their own dedicated tabs above — experiences has no is_mice_enabled
// column (doc §12.3 / catalog.model.js) and isn't consumed by the Agent MICE
// Builder at all, so unlike those two this list is never curated-filtered.
function SimpleEntityTab({ entity }) {
  const fields = ENTITY_FIELDS[entity];
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/${entity}${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((data) => setItems(data[entity]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [entity, search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/${entity}/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder={`Search ${entity}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Name', 'Group size', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">
                {item.suitable_group_size_min ?? '—'}–{item.suitable_group_size_max ?? '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
      )}
      <AddEntityForm
        entity={entity.slice(0, -1)}
        fields={fields}
        endpoint={`/admin/${entity}`}
        onCreated={(created) => setItems((list) => [created, ...list])}
      />
    </div>
  );
}

export default function MiceCatalog() {
  const [tab, setTab] = useState('hotels');

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-3xl font-bold">MICE Catalog Manager</h2>
          <Badge tone="grey">MICE-specific master data</Badge>
        </div>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Only items flagged MICE-enabled here (hotels with ballroom capacity &amp; breakout rooms, plus tours,
          activities and transfers) appear in the Agent MICE Curation builder — the Product Catalog is never shown
          there directly. Experiences aren't used by the MICE builder yet, but are managed here for completeness.
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                tab === t.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'hotels' ? (
          <MiceHotelsTab />
        ) : tab === 'tours' ? (
          <MiceToursTab />
        ) : tab === 'activities' ? (
          <MiceActivitiesTab />
        ) : tab === 'transfers' ? (
          <MiceTransfersTab />
        ) : (
          <SimpleEntityTab entity={tab} />
        )}
      </div>
    </div>
  );
}
