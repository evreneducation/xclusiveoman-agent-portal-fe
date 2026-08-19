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
          className="max-w-xs"
          placeholder="Search pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Link to={`/admin/cms/pages/new?section=${encodeURIComponent(tab.sections[0] || '')}`}>
          <Button variant="accent">+ New Page</Button>
        </Link>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line-light">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-panel">
                <th className="border-b border-line-light px-3 py-2 font-semibold uppercase text-muted">Page</th>
                <th className="border-b border-line-light px-3 py-2 font-semibold uppercase text-muted">Section</th>
                <th className="border-b border-line-light px-3 py-2 font-semibold uppercase text-muted">Last updated</th>
                <th className="border-b border-line-light px-3 py-2 font-semibold uppercase text-muted">Status</th>
                <th className="border-b border-line-light px-3 py-2 font-semibold uppercase text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-line-light last:border-0">
                  <td className="px-3 py-2 font-semibold">{page.title}</td>
                  <td className="px-3 py-2">{page.section}</td>
                  <td className="px-3 py-2">{formatShortDate(page.updated_at)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[page.status] || 'grey'}>{page.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/admin/cms/pages/${page.id}`} className="text-accent hover:underline">
                        Edit
                      </Link>
                      <button onClick={() => handleDelete(page.id)} className="text-[#a5162d] hover:underline">
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
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
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
      <form onSubmit={handleUpload} className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line-light bg-panel/40 p-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted">File</div>
          <input
            id="cms-media-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs"
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted">Alt text</div>
          <TextInput
            placeholder="Describe this asset…"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
          />
        </div>
        <Button type="submit" variant="accent" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>

      {media === null ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : media.length === 0 ? (
        <p className="rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No media uploaded yet — upload an image or PDF above.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-lg border border-line-light bg-white shadow-sm">
              {isPdfUrl(asset.url) ? (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-32 w-full flex-col items-center justify-center gap-1 bg-panel text-muted hover:text-ink"
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
    <div className="min-h-screen bg-[#eef1f7]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-3xl font-bold">Content & CMS Management</h2>
          <Badge tone="grey">Super Admin only</Badge>
        </div>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Everything editorial that isn't a bookable product — the Oman overview pages, homepage banners, guides,
          and the shared media library used across FD, FIT, and MICE content.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTabKey(t.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                tabKey === t.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab.key === 'media' ? <MediaLibraryTab /> : <PagesTable tab={tab} />}
      </div>
    </div>
  );
}
