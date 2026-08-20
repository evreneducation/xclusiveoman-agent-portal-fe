import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from './publicApi.js';

// Public CMS Page Viewer (Task 21 — Item 34 continuation) — GET
// /cms/:slug renders one published cms_pages row via the public
// GET /api/cms/pages/:slug endpoint (cmsPublic.routes.js, no auth). Works
// for any slug dynamically; nothing here is specific to any one page.
//
// body_html is admin-authored HTML (CmsPageEditor.jsx's plain textarea —
// see that file's own comment on why there's no WYSIWYG dependency), but it
// still passes through an untrusted-input boundary before ever reaching
// dangerouslySetInnerHTML: DOMPurify strips <script>, event-handler
// attributes (onerror, onclick, …), javascript: URLs, etc. before render.
// No other sanitizer existed anywhere in this frontend (checked
// package.json) — DOMPurify was added because it's the small, dependency-
// free, actively-maintained standard for exactly this "sanitize HTML before
// dangerouslySetInnerHTML" case, not a general-purpose content library.
function sanitize(html) {
  return DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
}

function CenteredMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">{children}</div>
    </div>
  );
}

export default function CmsPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ status: 'loading', page: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', page: null, error: null });

    api
      .get(`/cms/pages/${encodeURIComponent(slug)}`)
      .then(({ page }) => {
        if (!cancelled) setState({ status: 'ready', page, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) {
          setState({ status: 'not_found', page: null, error: null });
        } else {
          setState({ status: 'error', page: null, error: err.message || 'Unable to load this page' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === 'loading') {
    return (
      <CenteredMessage>
        <p className="font-mono text-xs text-gray-400">Loading…</p>
      </CenteredMessage>
    );
  }

  if (state.status === 'not_found') {
    return (
      <CenteredMessage>
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This page doesn't exist, or isn't published yet.
        </p>
      </CenteredMessage>
    );
  }

  if (state.status === 'error') {
    return (
      <CenteredMessage>
        <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">{state.error}</p>
      </CenteredMessage>
    );
  }

  const { page } = state;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="mb-10 h-9 w-auto object-contain" />

        {page.section && (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#d1642f]">
            {page.section}
          </div>
        )}
        <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{page.title}</h1>

        {/* No @tailwindcss/typography plugin is installed (checked
            tailwind.config.js — plugins: []), so article typography is
            hand-styled here via child-element utility selectors rather than
            pulling in a second new dependency alongside DOMPurify. */}
        <article
          className="mt-8 space-y-4 text-[15px] leading-7 text-gray-700 [&_a]:text-[#d1642f] [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-gray-900 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: sanitize(page.body_html) }}
        />
      </div>
    </div>
  );
}
