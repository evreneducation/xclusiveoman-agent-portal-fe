import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, ErrorText, TextInput } from '../components/ui.jsx';
import { formatShortDate } from '../../shared/fdPackage/index.js';

// Admin Content & CMS Management (Task 21 — Item 34, Screen 34). Follows the
// same "tabbed manager over one shared table" structure MiceCatalog.jsx
// established for its own four tabs — Screen 34's own wireframe specifies
// the same shape (tabs + search + New button + table with an Edit action),
// so no new UI pattern is invented here.
//
// Three of the four tabs (everything except Media Library) all read the
// same cms_pages table, distinguished only by the free-text `section`
// column (0058_cms.sql — no DB enum, per the doc's own CMS-1/CMS-2 never
// formalizing one). The wireframe's own example rows show DIFFERENT section
// labels ("MICE Content Hub", "Destination Guide") both clearly belonging
// under "Oman Overview Pages" — so each tab here maps to a small *list* of
// section labels it groups, not one single exact value. New pages default
// to the first (most generic) label in that list; the Section field itself
// stays free text in the editor, so an admin can still type any label the
// wireframe shows (or anything else) — a page whose section doesn't match
// any tab's list simply won't appear under a tab until edited to match one,
// an accepted limitation of a free-text categorization field.
const TABS = [
  { key: 'overview', label: 'Oman Overview Pages', sections: ['Oman Overview', 'Destination Guide', 'MICE Content Hub'] },
  { key: 'banners', label: 'Homepage Banners', sections: ['Homepage'] },
  { key: 'guides', label: 'Guides & Blog', sections: ['Guides & Blog', 'Blog'] },
  { key: 'media', label: 'Media Library', sections: [] },
];

const STATUS_TONE = { published: 'green', draft: 'grey' };
// Exact hex overrides per the CMS colour system — Badge's own shared `tones`
// (../components/ui.jsx) stay untouched so every other page reusing Badge
// (Product/MICE Catalog, Bookings, Reviews, …) keeps its existing colours;
// `!` forces these to win over Badge's own tone classes without editing it.
const STATUS_BADGE_CLASS = {
  published: '!border-[#A7F3D0] !bg-[#ECFDF5] !text-[#047857]',
  draft: '!border-[#FDBA74] !bg-[#FFF7ED] !text-[#C2410C]',
};

// Primary CTA styling shared by "+ New Page" and "Upload" — the two
// highest-priority actions on this page — mirrors CmsPageEditor.jsx's own
// "Save Page" gradient treatment for a consistent look across both CMS
// screens without touching the shared Button component.
const PRIMARY_BUTTON_CLASS =
  'border-transparent bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_16px_rgba(99,102,241,0.25)] hover:border-transparent hover:opacity-90';

const SEARCH_INPUT_CLASS =
  '!border-[#D7DDF0] !bg-[#FAFBFF] !shadow-none focus:!border-[#6366F1] focus:!shadow-[0_0_0_3px_rgba(99,102,241,0.12)] focus:!ring-0';

function buildPagesQuery(tab, search) {
  const params = new URLSearchParams();
  for (const section of tab.sections) params.append('section', section);
  if (search) params.set('search', search);
  const qs = params.toString();
  return `/admin/cms/pages${qs ? `?${qs}` : ''}`;
}

function PagesTable({ tab }) {
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api
      .get(buildPagesQuery(tab, search))
      .then(({ pages: rows }) => setPages(rows))
      .catch((err) => setError(err.message || 'Unable to load pages'))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [tab.key, search]);

  async function handleDelete(id) {
    await api.del(`/admin/cms/pages/${id}`);
    setPages((list) => list.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TextInput
          className={`max-w-xs ${SEARCH_INPUT_CLASS}`}
          placeholder="Search pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Link to={`/admin/cms/pages/new?section=${encodeURIComponent(tab.sections[0] || '')}`}>
          <Button className={PRIMARY_BUTTON_CLASS}>+ New Page</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E4E9FB] shadow-[0_10px_30px_rgba(79,70,229,0.06)]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F3F4FF]">
                <th className="border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]">Page</th>
                <th className="border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]">Section</th>
                <th className="border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]">
                  Last updated
                </th>
                <th className="border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]">Status</th>
                <th className="border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]"></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-[#E4E9FB] transition-colors last:border-0 hover:bg-[#F8FAFF]">
                  <td className="px-3 py-2 font-semibold text-[#172554]">{page.title}</td>
                  <td className="px-3 py-2">{page.section}</td>
                  <td className="px-3 py-2">{formatShortDate(page.updated_at)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[page.status] || 'grey'} className={STATUS_BADGE_CLASS[page.status] || ''}>
                      {page.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/admin/cms/pages/${page.id}`} className="font-semibold text-[#4F46E5] hover:underline">
                        Edit
                      </Link>
                      <button onClick={() => handleDelete(page.id)} className="font-semibold text-[#EF4444] hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && pages.length === 0 && (
        <p className="mt-3 rounded-lg border border-[#E4E9FB] bg-[#F8FAFF] px-3 py-3 text-xs text-muted">
          No pages in this section yet — create one above.
        </p>
      )}
    </div>
  );
}

function isPdfUrl(url) {
  return /\.pdf(\?|$)/i.test(url || '');
}

function MediaLibraryTab() {
  const [media, setMedia] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState('');
  const [file, setFile] = useState(null);

  function load() {
    api
      .get('/admin/cms/media')
      .then(({ media: rows }) => setMedia(rows))
      .catch((err) => setError(err.message || 'Unable to load media library'));
  }

  useEffect(load, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (altText) formData.append('altText', altText);
      const { media: created } = await api.postForm('/admin/cms/media', formData);
      setMedia((list) => [created, ...(list || [])]);
      setFile(null);
      setAltText('');
      const input = document.getElementById('cms-media-file-input');
      if (input) input.value = '';
    } catch (err) {
      setError(err.message || 'Unable to upload asset');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={handleUpload}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-[#E9DDFB] bg-[#FAF7FF] p-4"
      >
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">File</div>
          <input
            id="cms-media-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs"
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">Alt text</div>
          <TextInput
            className={SEARCH_INPUT_CLASS}
            placeholder="Describe this asset…"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={uploading}
          className="border-transparent bg-gradient-to-r from-[#7C3AED] to-[#2563EB] text-white shadow-[0_6px_16px_rgba(124,58,237,0.25)] hover:border-transparent hover:opacity-90"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>

      {media === null ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : media.length === 0 ? (
        <p className="rounded-lg border border-[#E9DDFB] bg-[#FAF7FF] px-3 py-3 text-xs text-muted">
          No media uploaded yet — upload an image or PDF above.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((asset) => (
            <div
              key={asset.id}
              className="overflow-hidden rounded-lg border border-[#E4E9FB] bg-white shadow-[0_6px_16px_rgba(79,70,229,0.08)] transition-shadow hover:shadow-[0_10px_24px_rgba(79,70,229,0.14)]"
            >
              {isPdfUrl(asset.url) ? (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-32 w-full flex-col items-center justify-center gap-1 bg-[#F3F4FF] text-[#4F46E5] hover:text-[#7C3AED]"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-[10px] font-semibold uppercase">PDF document</span>
                </a>
              ) : (
                <img src={asset.url} alt={asset.alt_text || ''} className="h-32 w-full object-cover" />
              )}
              <div className="p-2">
                <p className="truncate text-[11px] text-muted" title={asset.alt_text || ''}>
                  {asset.alt_text || '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContentManagement() {
  const [tabKey, setTabKey] = useState('overview');
  const tab = TABS.find((t) => t.key === tabKey);

  return (
    <div
      style={{ background: 'linear-gradient(135deg, #F4F7FF 0%, #FAF7FF 50%, #FFF8F3 100%)' }}
      className="min-h-screen"
    >
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-2 flex items-center gap-3">
          <h2
            style={{
              backgroundImage: 'linear-gradient(90deg, #172554, #4F46E5, #7C3AED)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
            className="text-3xl font-bold"
          >
            Content & CMS Management
          </h2>
          <Badge tone="grey">Super Admin only</Badge>
        </div>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Everything editorial that isn't a bookable product — the Oman overview pages, homepage banners, guides,
          and the shared media library used across FD, FIT, and MICE content.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tabKey === t.key;
            // Content tabs (overview/banners/guides) use the blue→indigo
            // gradient; Media Library gets a distinct purple treatment —
            // "Media: purple" from the colour system, styling the existing
            // tab rather than inventing new summary-metric cards.
            const activeClass =
              t.key === 'media'
                ? 'border-transparent bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white shadow-sm shadow-[#7C3AED]/25'
                : 'border-transparent bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-sm shadow-[#2563EB]/25';
            return (
              <button
                key={t.key}
                onClick={() => setTabKey(t.key)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  active ? activeClass : 'border-[#D7DDF0] bg-white text-[#475569] hover:border-[#6366F1] hover:text-[#4F46E5]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab.key === 'media' ? <MediaLibraryTab /> : <PagesTable tab={tab} />}
      </div>
    </div>
  );
}
