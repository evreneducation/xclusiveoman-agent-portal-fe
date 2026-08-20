import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, Select, TextInput, Textarea } from '../components/ui.jsx';

// Admin Content & CMS Management (Task 21 — Item 34) — create/edit form for
// one cms_pages row. Follows HotelEditor.jsx's own routing/design precedent
// exactly: one page at /admin/cms/pages/:id, `:id === 'new'` for create,
// same load-on-mount/save/"back to list" shape — no new editor architecture
// invented for this entity.
//
// Visual styling pass (colorful admin-dashboard palette): TextInput/Select/
// Textarea/Card in ../components/ui.jsx merge a passed `className` via plain
// string concatenation, not tailwind-merge — so overriding one of their own
// default utilities (border/background/shadow color) needs the `!important`
// Tailwind prefix to reliably win regardless of the compiled stylesheet's
// class order. Button already goes through cn()/twMerge (see
// components/ui/button.jsx), so its overrides below are plain classNames.
// None of ui.jsx itself was touched, so every other admin page that reuses
// these same components (Product/MICE Catalog, Bookings, Reviews, …) is
// visually unaffected by this file.
const INPUT_CLASS =
  '!border-[#D7DDF0] !bg-[#FAFBFF] !shadow-none focus:!border-[#6366F1] focus:!shadow-[0_0_0_3px_rgba(99,102,241,0.12)] focus:!ring-0';

const BODY_HTML_CLASS =
  'font-mono !border-[#C7D2FE] !bg-[#F8FAFF] !shadow-none focus:!border-[#6366F1] focus:!shadow-[0_0_0_3px_rgba(99,102,241,0.15)] focus:!ring-0';

const STATUS_TONE_CLASS = {
  draft: '!border-[#FDBA74] !bg-[#FFF7ED] !text-[#C2410C]',
  published: '!border-[#A7F3D0] !bg-[#ECFDF5] !text-[#047857]',
};

// FieldLabel (../components/ui.jsx) has no className prop, so its color
// can't be overridden per-usage without editing the shared component (which
// every other admin editor also uses) — a small local label with the same
// shape is used here instead, scoped to this file only.
function FieldLabel({ children }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#4F46E5]">
      <span className="h-3 w-1 flex-none rounded-full bg-gradient-to-b from-[#4F46E5] to-[#7C3AED]" />
      {children}
    </div>
  );
}

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
    <div
      style={{ background: 'linear-gradient(135deg, #F4F7FF 0%, #FAF7FF 50%, #FFF8F3 100%)' }}
      className="min-h-screen"
    >
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-10">
        <button
          onClick={() => navigate('/admin/cms')}
          className="text-xs text-muted transition-colors hover:text-[#4F46E5]"
        >
          ← Back to Content & CMS
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h2
            style={{
              backgroundImage: 'linear-gradient(90deg, #172554, #4F46E5, #7C3AED)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
            className="text-3xl font-bold"
          >
            {isNew ? 'New Page' : `Edit — ${form.title || ''}`}
          </h2>
          {/* Only for a saved, published page — a draft's slug must never be
              linked out to the public route (drafts return 404 there by
              design; showing a "View Page" link for one would just be a
              broken/misleading affordance, not an actual leak). */}
          {!isNew && form.status === 'published' && form.slug && (
            <a
              href={`/cms/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4F46E5] transition-colors hover:bg-[#E0E7FF]"
            >
              View Page ↗
            </a>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <>
            <Card className="!border-[#E4E9FB] !border-t-4 !border-t-[#6366F1] !shadow-[0_10px_30px_rgba(79,70,229,0.10)]">
              <div className="mb-4 flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[#4F46E5]">
                <span className="h-4 w-1 flex-none rounded-full bg-gradient-to-b from-[#4F46E5] to-[#7C3AED]" />
                Page details
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Title *</FieldLabel>
                  <TextInput
                    required
                    className={INPUT_CLASS}
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Section *</FieldLabel>
                  <TextInput
                    required
                    className={INPUT_CLASS}
                    placeholder="e.g. Oman Overview, Homepage, Guides & Blog"
                    value={form.section}
                    onChange={(e) => update('section', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Slug *</FieldLabel>
                  <TextInput
                    required
                    className={INPUT_CLASS}
                    placeholder="e.g. why-oman-for-mice"
                    value={form.slug}
                    onChange={(e) => update('slug', e.target.value.toLowerCase())}
                  />
                </div>
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    className={`font-semibold ${STATUS_TONE_CLASS[form.status] || ''}`}
                    value={form.status}
                    onChange={(e) => update('status', e.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Body HTML</FieldLabel>
                  <Textarea
                    rows={14}
                    className={BODY_HTML_CLASS}
                    placeholder="<p>…</p>"
                    value={form.bodyHtml}
                    onChange={(e) => update('bodyHtml', e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button
                disabled={submitting}
                onClick={handleSave}
                className="border-transparent bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_16px_rgba(99,102,241,0.25)] hover:border-transparent hover:opacity-90"
              >
                {submitting ? 'Saving…' : 'Save Page'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
