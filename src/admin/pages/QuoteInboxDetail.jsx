import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Select, Table } from '../components/ui.jsx';

const STATUS_TONE = {
  submitted: 'amber',
  assigned: 'grey',
  costed: 'grey',
  published: 'green',
  accepted: 'green',
  revision_requested: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

function formatStatus(status) {
  return status.replace(/_/g, ' ');
}

function CatalogGrid({ label, items, empty, renderMeta }) {
  return (
    <Card label={label} className="border-white">
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-line-light p-3 shadow-sm">
              {item.images?.[0] ? (
                <img src={item.images[0]} alt="" className="h-24 w-full rounded-md border border-line-light object-cover" />
              ) : item.images !== undefined ? (
                <div className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-line-light font-mono text-[9px] text-muted">
                  No image
                </div>
              ) : null}
              <div className="mt-2 text-sm font-bold">{item.name}</div>
              <div className="text-xs text-muted">{renderMeta(item)}</div>
              {item.description && <p className="mt-1 text-xs text-muted">{item.description}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LeadManagerAssignment({ packageRequest, onUpdated }) {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(packageRequest.leadManager?.id || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/admin/package-requests/lead-manager-candidates')
      .then(({ staff }) => setCandidates(staff))
      .catch((err) => setError(err.message || 'Unable to load staff'));
  }, []);

  useEffect(() => {
    setSelected(packageRequest.leadManager?.id || '');
  }, [packageRequest.leadManager]);

  async function handleAssign() {
    setError('');
    setSubmitting(true);
    try {
      const { packageRequest: updated } = await api.patch(`/admin/package-requests/${packageRequest.id}/lead-manager`, {
        leadManagerUserId: selected || null,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Unable to assign Lead Manager');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Lead Manager" className="border-white">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <FieldLabel>Assign a Lead Manager</FieldLabel>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Unassigned</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.role.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="accent" disabled={submitting} onClick={handleAssign}>
          {submitting ? 'Saving…' : 'Save Assignment'}
        </Button>
      </div>
      {packageRequest.leadManager && (
        <p className="mt-3 text-xs text-muted">
          Currently assigned to <span className="font-semibold text-ink">{packageRequest.leadManager.fullName}</span> (
          {packageRequest.leadManager.email})
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

export default function QuoteInboxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [packageRequest, setPackageRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get(`/admin/package-requests/${id}`)
      .then(({ packageRequest: pr }) => setPackageRequest(pr))
      .catch((err) => setError(err.message || 'Unable to load request'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="mx-auto max-w-5xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/quote-inbox')} className="text-xs text-muted hover:text-ink">
          ← Back to Quote Inbox
        </button>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        <ErrorText>{error}</ErrorText>

        {packageRequest && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Custom FIT Request</h2>
                <p className="font-mono text-xs text-muted">Quote ID: {packageRequest.id}</p>
              </div>
              <Badge tone={STATUS_TONE[packageRequest.status] || 'grey'}>{formatStatus(packageRequest.status)}</Badge>
            </div>

            <Card label="Trip information" className="border-white">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Agency</dt>
                  <dd>{packageRequest.agencyName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Agent</dt>
                  <dd>
                    {packageRequest.agentName}
                    <div className="text-xs text-muted">{packageRequest.agentEmail}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Submitted</dt>
                  <dd>{new Date(packageRequest.submittedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Destination</dt>
                  <dd>{packageRequest.destination}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Travel dates</dt>
                  <dd>
                    {new Date(packageRequest.dateFrom).toLocaleDateString()} – {new Date(packageRequest.dateTo).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase text-muted">Pax</dt>
                  <dd>
                    {packageRequest.paxAdults} adult{packageRequest.paxAdults === 1 ? '' : 's'}
                    {packageRequest.paxChildren ? `, ${packageRequest.paxChildren} child${packageRequest.paxChildren === 1 ? '' : 'ren'}` : ''}
                  </dd>
                </div>
              </dl>
            </Card>

            <LeadManagerAssignment packageRequest={packageRequest} onUpdated={setPackageRequest} />

            <Card label="Traveller details" className="border-white">
              {packageRequest.travelers.length === 0 ? (
                <p className="text-sm text-muted">No traveller details captured.</p>
              ) : (
                <Table
                  columns={['Name', 'Passport No.', 'DOB', 'Room share']}
                  rows={packageRequest.travelers}
                  renderRow={(t) => (
                    <tr key={t.id} className="border-b border-line-light last:border-0">
                      <td className="px-3 py-2 font-semibold">{t.name}</td>
                      <td className="px-3 py-2">{t.passportNo || '—'}</td>
                      <td className="px-3 py-2">{t.dob ? new Date(t.dob).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2">{t.roomShareGroup || '—'}</td>
                    </tr>
                  )}
                />
              )}
            </Card>

            <CatalogGrid
              label="Selected hotel(s)"
              items={packageRequest.hotels}
              empty="No hotel selected."
              renderMeta={(h) => `${h.city || '—'}${h.category ? ` · ${h.category}★` : ''}`}
            />
            <CatalogGrid
              label="Selected tour(s)"
              items={packageRequest.tours}
              empty="No tours selected."
              renderMeta={(t) => `${t.city || '—'}${t.category ? ` · ${t.category}` : ''}${t.duration ? ` · ${t.duration}` : ''}`}
            />
            <CatalogGrid
              label="Selected transfer(s)"
              items={packageRequest.transfers}
              empty="No transfers selected."
              renderMeta={(t) => `${t.type ? t.type.replace(/_/g, ' ') : '—'}${t.vehicleClass ? ` · ${t.vehicleClass}` : ''}${t.city ? ` · ${t.city}` : ''}`}
            />
            <CatalogGrid
              label="Selected extras"
              items={packageRequest.activities}
              empty="No extras selected."
              renderMeta={(a) => `${a.city || '—'}${a.duration ? ` · ${a.duration}` : ''}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
