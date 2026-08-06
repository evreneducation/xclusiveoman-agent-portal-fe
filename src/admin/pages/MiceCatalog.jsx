import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Select, Table, TextInput } from '../components/ui.jsx';
import { HotelImagesUpload } from '../components/HotelImagesUpload.jsx';
import { STAR_OPTIONS, validateHotelForm } from '../lib/hotelForm.js';
import { TourImagesUpload } from '../components/TourImagesUpload.jsx';
import { validateTourForm } from '../lib/tourForm.js';

// Tours get their own dedicated MiceTourForm (below, mirroring MiceHotelForm)
// rather than the generic AddEntityForm — tourSchema requires `images`
// (min 1), which the generic text/number/checkbox field renderer can't do.
const ENTITY_FIELDS = {
  activities: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'pricePerPax', label: 'Price per pax (INR)', type: 'number' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'isMiceEnabled', label: 'MICE-enabled', type: 'checkbox' },
  ],
  transfers: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: ['airport', 'intercity', 'point_to_point', 'group_coach'],
      required: true,
    },
    { key: 'vehicleClass', label: 'Vehicle class', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    // Matches the Product Catalog transfers form (ProductCatalog.jsx) — feeds
    // Quote Details' Landing Cost Breakdown auto-calculation, same as hotels'
    // price_per_night / tours' price / activities' pricePerPax.
    { key: 'price', label: 'Price (INR)', type: 'number' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'isMiceEnabled', label: 'MICE-enabled', type: 'checkbox' },
  ],
  experiences: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'suitableGroupSizeMin', label: 'Min group size', type: 'number' },
    { key: 'suitableGroupSizeMax', label: 'Max group size', type: 'number' },
  ],
};

// Entities that SimpleEntityTab (below) renders via the generic AddEntityForm
// and that have an is_mice_enabled column (doc §12.3 / catalog.model.js), so
// they can be filtered to curated-only via `?mice=true`. Hotels and tours
// have dedicated forms (MiceHotelForm / MiceTourForm, above) since their
// schemas require an image upload the generic form can't collect; experiences
// aren't consumed by the Agent MICE Builder at all.
const MICE_FILTERED_ENTITIES = new Set(['activities', 'transfers']);

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
                <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                  Delete
                </button>
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
                <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                  Delete
                </button>
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

function SimpleEntityTab({ entity }) {
  const fields = ENTITY_FIELDS[entity];
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    // MICE Catalog Manager must only ever show curated (is_mice_enabled)
    // rows here — this is the fix for Task "Fix MICE Curation Data Source":
    // this tab previously listed the entire Product Catalog unfiltered.
    const params = new URLSearchParams();
    if (MICE_FILTERED_ENTITIES.has(entity)) params.set('mice', 'true');
    if (search) params.set('search', search);
    const qs = params.toString();
    api
      .get(`/${entity}${qs ? `?${qs}` : ''}`)
      .then((data) => setItems(data[entity]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [entity, search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/${entity}/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  const hasCity = entity !== 'experiences';

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder={`Search ${entity}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={hasCity ? ['Name', 'City', ''] : ['Name', 'Group size', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">
                {hasCity
                  ? item.city || '—'
                  : `${item.suitable_group_size_min ?? '—'}–${item.suitable_group_size_max ?? '—'}`}
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
        defaults={MICE_FILTERED_ENTITIES.has(entity) ? { isMiceEnabled: true } : {}}
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

        {tab === 'hotels' ? <MiceHotelsTab /> : tab === 'tours' ? <MiceToursTab /> : <SimpleEntityTab entity={tab} />}
      </div>
    </div>
  );
}
