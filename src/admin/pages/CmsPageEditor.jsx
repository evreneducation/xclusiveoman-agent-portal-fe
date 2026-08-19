import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, Select, TextInput, Textarea } from '../components/ui.jsx';

// Admin Content & CMS Management (Task 21 — Item 34) — create/edit form for
// one cms_pages row. Follows HotelEditor.jsx's own routing/design precedent
// exactly: one page at /admin/cms/pages/:id, `:id === 'new'` for create,
// same load-on-mount/save/"back to list" shape — no new editor architecture
// invented for this entity.
export default function CmsPageEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState({
    title: '',
    section: isNew ? searchParams.get('section') || '' : '',
    slug: '',
    bodyHtml: '',
    status: 'draft',
  });
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .get(`/admin/cms/pages/${id}`)
      .then(({ page }) => {
        setForm({
          title: page.title || '',
          section: page.section || '',
          slug: page.slug || '',
          bodyHtml: page.body_html || '',
          status: page.status || 'draft',
        });
      })
      .catch((err) => setError(err.message || 'Unable to load page'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.title || !form.section || !form.slug) {
      setError('Title, section, and slug are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        section: form.section,
        slug: form.slug,
        bodyHtml: form.bodyHtml || undefined,
        status: form.status,
      };
      if (isNew) {
        await api.post('/admin/cms/pages', payload);
      } else {
        await api.patch(`/admin/cms/pages/${id}`, payload);
      }
      navigate('/admin/cms');
    } catch (err) {
      setError(err.message || 'Unable to save page');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button onClick={() => navigate('/admin/cms')} className="text-xs text-muted hover:text-ink">
          ← Back to Content & CMS
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-bold">{isNew ? 'New Page' : `Edit — ${form.title || ''}`}</h2>
          {/* Only for a saved, published page — a draft's slug must never be
              linked out to the public route (drafts return 404 there by
              design; showing a "View Page" link for one would just be a
              broken/misleading affordance, not an actual leak). */}
          {!isNew && form.status === 'published' && form.slug && (
            <a
              href={`/cms/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-accent hover:underline"
            >
              View Page ↗
            </a>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <>
            <Card label="Page details" className="border-white">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Title *</FieldLabel>
                  <TextInput required value={form.title} onChange={(e) => update('title', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Section *</FieldLabel>
                  <TextInput
                    required
                    placeholder="e.g. Oman Overview, Homepage, Guides & Blog"
                    value={form.section}
                    onChange={(e) => update('section', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Slug *</FieldLabel>
                  <TextInput
                    required
                    placeholder="e.g. why-oman-for-mice"
                    value={form.slug}
                    onChange={(e) => update('slug', e.target.value.toLowerCase())}
                  />
                </div>
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={form.status} onChange={(e) => update('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Body HTML</FieldLabel>
                  <Textarea
                    rows={14}
                    className="font-mono"
                    placeholder="<p>…</p>"
                    value={form.bodyHtml}
                    onChange={(e) => update('bodyHtml', e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button disabled={submitting} onClick={handleSave} variant="accent">
                {submitting ? 'Saving…' : 'Save Page'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
