import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import FdItineraryDocument from '../components/FdItineraryDocument.jsx';

// Always same-origin '/api', same as shared/api/createApiClient.js (not that
// module itself — this page authenticates with the short-lived pdfToken in
// the query string, not a login session's access token, and must never touch
// the session's own refresh-cookie flow (see AuthContext.jsx) which that
// client is wired into). Deliberately NOT built from VITE_API_PROXY_TARGET —
// that env var is set to the backend's absolute Render URL in
// .env.production, which made this fetch cross-origin from
// xclusiveoman-agent-portal-fe.vercel.app straight to
// xclusiveoman-agent-portal-be.onrender.com instead of through vercel.json's
// same-origin /api rewrite. That's the exact class of bug
// createApiClient.js's own BASE_URL comment documents (there it silently
// dropped the refresh cookie as third-party; here it 502'd the whole PDF
// download in production while working fine locally, since dev's
// VITE_API_PROXY_TARGET points at localhost where the origin mismatch never
// bites). Mirrors ItineraryPrint.jsx, which had/has the same bug.
const BASE_URL = '/api';

function settleImageSet() {
  const images = Array.from(document.images);
  return Promise.all(
    images.map(
      (img) =>
        img.complete ||
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true }); // a broken image shouldn't hang the PDF forever
        })
    )
  ).then(() => images.length);
}

// Settles once every <img> currently in the document has loaded or errored
// *and* that pass didn't itself change how many images are on the page — a
// broken image can trigger a re-render that swaps in a different <img> (see
// FdItineraryDocument.jsx's PhotoGallery onError fallback), and that new one
// still needs to be waited on. Bounded so a pathological render can't loop
// forever.
async function waitForImages() {
  let last = -1;
  for (let pass = 0; pass < 5; pass += 1) {
    const count = await settleImageSet();
    if (count === last) return;
    last = count;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

// Standalone print target for the FD departure itinerary's server-side PDF
// export (see the backend's itineraryPdf.service.js#generateFdItineraryPdf)
// — deliberately outside AgentLayout/ProtectedRoute (see agent/App.jsx): a
// headless Puppeteer browser navigates here with no login session,
// authenticated instead by the short-lived FD pdfToken in the query string
// (requireFdPdfToken, middleware/auth.js). Renders FdItineraryDocument.jsx
// unchanged, same "PDF matches the real design exactly" convention
// ItineraryPrint.jsx already established for Custom FIT.
export default function DepartureItineraryPrint() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const pdfToken = searchParams.get('pdfToken');

  const [departure, setDeparture] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pdfToken) {
      setError('Missing pdfToken');
      return;
    }
    fetch(`${BASE_URL}/fd-itinerary-pdf/${id}/data?pdfToken=${encodeURIComponent(pdfToken)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
        setDeparture(data.departure);
      })
      .catch((err) => setError(err.message || 'Unable to load itinerary'));
  }, [id, pdfToken]);

  // Signals readiness to the Puppeteer service (its page.waitForFunction)
  // once data has loaded (or failed) *and* every image in the document has
  // finished loading — networkidle0 alone (which the service also waits on)
  // only proves the network went quiet, not that React finished rendering or
  // images finished decoding. Same convention as ItineraryPrint.jsx.
  useEffect(() => {
    if (!departure && !error) return undefined;
    if (error) {
      window.__PDF_ERROR__ = error;
      window.__PDF_READY__ = true;
      return undefined;
    }
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      waitForImages().then(() => {
        if (!cancelled) window.__PDF_READY__ = true;
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [departure, error]);

  if (error) {
    return <div className="p-8 font-mono text-sm text-red-600">Unable to load itinerary: {error}</div>;
  }

  if (!departure) {
    return <div className="p-8 font-mono text-xs text-agent-muted">Loading…</div>;
  }

  // No padding wrapper — the server-side export passes real page.pdf() margins
  // now (itineraryPdf.service.js), so an extra p-6 here would just double the
  // page-one gap on top of them.
  return (
    <div className="bg-white">
      <FdItineraryDocument departure={departure} />
    </div>
  );
}
