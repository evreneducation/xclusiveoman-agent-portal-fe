import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, Checkbox, ErrorText, FieldLabel, Select, Tag, Table, TextInput } from '../components/ui.jsx';

const THEMES = ['Culture', 'Adventure', 'Nature'];

function BasicsForm({ form, update }) {
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
            {THEMES.map((t) => (
              <button key={t} type="button" onClick={() => update('theme', t)}>
                <Tag active={form.theme === t}>{t}</Tag>
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Hero image URL</FieldLabel>
          <TextInput
            placeholder="https://…"
            value={form.heroImageUrl || ''}
            onChange={(e) => update('heroImageUrl', e.target.value)}
          />
        </div>
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
          <FieldLabel>Deposit (OMR)</FieldLabel>
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

function MerchandisingForm({ form, update }) {
  return (
    <Card label="Merchandising & discovery attributes" className="border-white">
      <Checkbox checked={!!form.isFeatured} onChange={(v) => update('isFeatured', v)} label="Mark as Featured / Highly Recommended" />
      <Checkbox checked={!!form.isBestseller} onChange={(v) => update('isBestseller', v)} label="Mark as Bestseller" />
    </Card>
  );
}

function DepartureDatesManager({ fdPackageId, dates, onChange }) {
  const [date, setDate] = useState('');
  const [seatsTotal, setSeatsTotal] = useState(20);

  async function add() {
    if (!date) return;
    const { departureDate } = await api.post(`/admin/fd-packages/${fdPackageId}/departure-dates`, { date, seatsTotal });
    onChange([...dates, departureDate]);
    setDate('');
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/departure-dates/${id}`);
    onChange(dates.filter((d) => d.id !== id));
  }

  return (
    <Card label="Departure dates & inventory" className="border-white">
      <Table
        columns={['Date', 'Seats', '']}
        rows={dates}
        renderRow={(d) => (
          <tr key={d.id} className="border-b border-line-light last:border-0">
            <td className="px-3 py-2">{new Date(d.date).toLocaleDateString()}</td>
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
      <div className="mt-3 flex items-end gap-2">
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Seats</FieldLabel>
          <TextInput type="number" value={seatsTotal} onChange={(e) => setSeatsTotal(Number(e.target.value))} />
        </div>
        <Button onClick={add}>+ Add departure date</Button>
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
  const [price, setPrice] = useState('');

  useEffect(() => {
    api.get('/activities').then((d) => setActivities(d.activities));
    api.get('/tours').then((d) => setTours(d.tours));
  }, []);

  async function add() {
    if (!selection || !price) return;
    const [kind, id] = selection.split(':');
    const payload = kind === 'activity' ? { activityId: id, pricePerPax: Number(price) } : { tourId: id, pricePerPax: Number(price) };
    const { addon } = await api.post(`/admin/fd-packages/${fdPackageId}/addons`, payload);
    const name = (kind === 'activity' ? activities : tours).find((x) => x.id === id)?.name;
    onChange([...addons, { ...addon, name }]);
    setSelection('');
    setPrice('');
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/addons/${id}`);
    onChange(addons.filter((a) => a.id !== id));
  }

  return (
    <Card label="Add-on activities & tours" className="border-white">
      <Table
        columns={['Name', 'Price / pax', '']}
        rows={addons}
        renderRow={(a) => (
          <tr key={a.id} className="border-b border-line-light last:border-0">
            <td className="px-3 py-2">{a.name}</td>
            <td className="px-3 py-2">OMR {a.pricePerPax}</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => remove(a.id)} className="text-[#a5162d] hover:underline">
                Remove
              </button>
            </td>
          </tr>
        )}
      />
      <div className="mt-3 flex items-end gap-2">
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
  const isNew = id === 'new';

  const [form, setForm] = useState({ balanceDueDaysBefore: 30 });
  const [packageId, setPackageId] = useState(isNew ? null : id);
  const [dates, setDates] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [addons, setAddons] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    if (isNew) return;
    api.get(`/admin/fd-packages/${id}`).then(({ fdPackage }) => {
      setForm(fdPackage);
      setPackageId(fdPackage.id);
      setDates(fdPackage.departureDates || []);
      setItinerary(fdPackage.itinerary || []);
      setAddons(fdPackage.addons || []);
    });
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(status) {
    setError('');
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
    } catch (err) {
      setError(err.message || 'Unable to save');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/catalog')} className="text-xs text-muted hover:text-ink">
          ← Back to catalog
        </button>
        <h2 className="text-3xl font-bold">{isNew ? 'Add FD Package' : `Edit — ${form.title || ''}`}</h2>

        <BasicsForm form={form} update={update} />
        <PricingForm form={form} update={update} />
        <MerchandisingForm form={form} update={update} />

        {packageId && (
          <>
            <DepartureDatesManager fdPackageId={packageId} dates={dates} onChange={setDates} />
            <ItineraryManager fdPackageId={packageId} itinerary={itinerary} onChange={setItinerary} />
            <AddonsManager fdPackageId={packageId} addons={addons} onChange={setAddons} />
          </>
        )}
        {!packageId && (
          <p className="text-xs text-muted">
            Save as draft first to unlock departure dates, itinerary, and add-ons.
          </p>
        )}

        <ErrorText>{error}</ErrorText>
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
