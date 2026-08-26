import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { Button, ErrorText } from '../components/ui.jsx';
import { RichTextEditor } from '../../shared/components/RichTextEditor.jsx';

// Admin "Terms & Conditions" tab (new top-level sidebar item) — a single
// rich-text policy document, singleton like ProductCatalog.jsx's own Visa
// tab (one flat rate, always just the one row, edited in place). Kept as
// its own page/route rather than a Product Catalog tab since it isn't a
// bookable product — see 0067_site_terms.sql / siteTerms.routes.js on the
// backend. The editor itself is shared/components/RichTextEditor.jsx
// (toolbar="full" — every control this document needs, including tables/
// images/font controls that a plain catalog description never would).

const PRIMARY_BUTTON_CLASS =
  'border-transparent bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_16px_rgba(99,102,241,0.25)] hover:border-transparent hover:opacity-90';

function TermsEditorForm({ initialHtml }) {
  const [html, setHtml] = useState(initialHtml || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedHtmlRef = useRef(initialHtml || '');
  const dirty = html !== savedHtmlRef.current;

  function handleChange(next) {
    setHtml(next);
    setJustSaved(false);
  }

  async function handleSave() {
    if (!html.trim()) {
      setError('Terms & Conditions content is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.patch('/admin/site-terms', { bodyHtml: html });
      savedHtmlRef.current = html;
      setJustSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save Terms & Conditions');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <RichTextEditor toolbar="full" size="lg" value={html} onChange={handleChange} />

      <ErrorText>{error}</ErrorText>

      <div className="mt-3 flex items-center gap-3">
        <Button variant="accent" disabled={submitting || !dirty} onClick={handleSave} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
        {justSaved && !dirty && <span className="text-xs font-semibold text-[#227647]">✓ Saved</span>}
      </div>
    </div>
  );
}

export default function TermsAndConditions() {
  // null while loading, '' (or the saved HTML) once loaded — the editor
  // itself (TermsEditorForm) only mounts once this resolves, so
  // RichTextEditor is always initialized with the real saved value instead
  // of needing an extra effect to sync it in after an async load.
  const [initialHtml, setInitialHtml] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api
      .get('/site-terms')
      .then(({ terms }) => setInitialHtml(terms?.body_html || ''))
      .catch((err) => setLoadError(err.message || 'Unable to load Terms & Conditions'));
  }, []);

  return (
    <div
      style={{ background: 'linear-gradient(135deg, #F4F7FF 0%, #FAF7FF 50%, #FFF8F3 100%)' }}
      className="min-h-screen"
    >
      <div className="mx-auto max-w-4xl p-6 lg:p-10">
        <h2
          style={{
            backgroundImage: 'linear-gradient(90deg, #172554, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
          className="mb-2 text-3xl font-bold"
        >
          Policies &amp; terms
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          The Terms &amp; Conditions shown to agents and travelers across the portal — edit and save below.
        </p>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#4F46E5]">
          Terms &amp; Conditions <span className="text-[#EF4444]">*</span>
        </div>

        {loadError ? (
          <ErrorText>{loadError}</ErrorText>
        ) : initialHtml === null ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : (
          <TermsEditorForm initialHtml={initialHtml} />
        )}
      </div>
    </div>
  );
}
