import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Button, Textarea } from './ui.jsx';

// Agent Review & Rating Popup (Task 20 — Screen 32, REV-1..4). Mounted once
// inside AgentLayout.jsx (renders for every authenticated agent route, so
// it naturally fires "on next login" / "every portal opening" without a
// hardcoded frontend timeout — see AgentLayout.jsx's own comment). Fetches
// GET /reviews/pending-prompt exactly once per mount; server-side state
// (bookings.review_prompt_dismiss_count, the reviews table itself) is what
// actually decides whether/how-many-times this can show — nothing here is
// tracked in localStorage, matching this codebase's own total absence of
// client-only persisted UI state.

function StarSelector({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-3xl leading-none transition-transform hover:scale-110"
        >
          <span className={(hover || value) >= n ? 'text-agent-accent-dark' : 'text-agent-line-light'}>★</span>
        </button>
      ))}
    </div>
  );
}

function formatDateRange(departureDate, lastTravelDate) {
  const from = new Date(departureDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const to = new Date(lastTravelDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return from === to ? from : `${from} – ${to}`;
}

export default function ReviewPromptGate() {
  const [queue, setQueue] = useState(null); // null = not loaded yet
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/reviews/pending-prompt')
      .then(({ prompts }) => setQueue(prompts))
      .catch(() => setQueue([]));
  }, []);

  if (!queue || queue.length === 0) return null;

  const current = queue[0];
  const image = current.heroImageUrl || current.images?.[0];

  function advance() {
    setQueue((q) => q.slice(1));
    setRating(0);
    setReviewText('');
    setError('');
  }

  async function handleDismiss() {
    setDismissing(true);
    try {
      await api.post(`/bookings/${current.bookingId}/dismiss-review-prompt`, {});
    } catch {
      // Best-effort — even if the dismiss write fails, don't trap the agent
      // behind a popup they're actively trying to close; it'll just be
      // offered again next time (same as any other transient failure).
    } finally {
      setDismissing(false);
      advance();
    }
  }

  async function handleSubmit() {
    if (!rating) {
      setError('Please select a rating.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/bookings/${current.bookingId}/review`, {
        rating,
        reviewText: reviewText.trim() || undefined,
      });
      advance();
    } catch (err) {
      setError(err.message || 'Unable to submit your review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {image && <img src={image} alt="" className="h-40 w-full object-cover" />}
        <div className="p-6">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-agent-muted">How was the trip?</div>
          <h3 className="text-lg font-bold text-agent-ink">{current.packageTitle}</h3>
          <p className="mt-0.5 text-xs text-agent-muted">
            {formatDateRange(current.departureDate, current.lastTravelDate)}
            {current.location ? ` · Ex-${current.location}` : ''}
          </p>

          <div className="mt-4">
            <StarSelector value={rating} onChange={setRating} />
          </div>

          <Textarea
            className="mt-3"
            rows={3}
            placeholder="Share a few words about the trip (optional)…"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />

          {error && <p className="mt-2 text-xs text-[#a5162d]">{error}</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={dismissing || submitting}
              className="text-xs font-semibold text-agent-muted hover:text-agent-ink hover:underline"
            >
              {current.dismissCount === 1 ? "Don't ask again" : 'Remind me later'}
            </button>
            <Button variant="accent" onClick={handleSubmit} disabled={submitting || dismissing}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
