// Presentational status block for a Cashfree payment attempt (spec K). Maps
// payments.status -> a title + explanation; the caller passes whatever action
// buttons belong with that state as `actions`. Renders nothing for an unknown
// / absent status so callers can just drop it in.
const STATUS_VIEW = {
  pending: {
    tone: 'text-agent-ink',
    title: 'Awaiting payment',
    body: 'Your checkout is open. Resume it, or cancel and start over.',
  },
  awaiting_payment: {
    tone: 'text-agent-ink',
    title: 'Awaiting payment',
    body: 'Your checkout is open. Resume it, or cancel and start over.',
  },
  awaiting_confirmation: {
    tone: 'text-agent-ink',
    title: 'Payment received — awaiting confirmation',
    body: 'We’re confirming this with the payment gateway. This usually takes a few seconds.',
    spinner: true,
  },
  confirmed: {
    tone: 'text-[#227647]',
    title: 'Payment confirmed',
    body: 'Your payment has been received.',
  },
  failed: {
    tone: 'text-[#a5162d]',
    title: 'Payment didn’t complete',
    body: 'The last attempt didn’t go through. You can try again.',
  },
  cancelled: {
    tone: 'text-[#a5162d]',
    title: 'Payment didn’t complete',
    body: 'The last attempt was cancelled. You can try again.',
  },
};

export function PaymentAttemptStatus({ status, actions = null }) {
  const view = STATUS_VIEW[status];
  if (!view) return null;

  return (
    <div className="rounded-lg border border-agent-line-light bg-white p-4">
      <div className="flex items-center gap-2">
        {view.spinner && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-agent-accent border-t-transparent"
          />
        )}
        <span className={`text-sm font-bold ${view.tone}`}>{view.title}</span>
      </div>
      <p className="mt-1 text-xs text-agent-muted">{view.body}</p>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
