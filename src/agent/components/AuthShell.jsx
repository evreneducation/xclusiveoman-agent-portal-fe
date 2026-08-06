import { motion } from 'framer-motion';

// Shared two-column shell for the Sign In and Register pages — same brand
// panel structure, but each page supplies its own copy/footer so the two
// read as distinct experiences (Sign In = "welcome back", Register = "why
// join") rather than two forms stacked on one screen.
export default function AuthShell({ eyebrow, heading, tagline, panelFooter, children }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#faf0da_0,#f5f0e4_28%,#eaf2f0_58%,#f7f4ec_100%)] px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col justify-between rounded-2xl bg-agent-ink p-8 text-white shadow-xl shadow-black/15"
        >
          <div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-agent-ink shadow-lg shadow-black/10">
              XO
            </div>
            <h1 className="text-3xl font-bold">Xclusive Oman</h1>
            <div className="mt-2 text-sm text-white/70">B2B &amp; MICE Trade Portal</div>

            {eyebrow && (
              <div className="mt-10 text-[11px] font-semibold uppercase tracking-wide text-agent-accent">{eyebrow}</div>
            )}
            {heading && <h2 className="mt-2 text-xl font-bold leading-snug">{heading}</h2>}
            {tagline && <p className="mt-3 text-sm leading-relaxed text-white/75">{tagline}</p>}
          </div>

          {panelFooter && <div className="mt-12">{panelFooter}</div>}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className="flex flex-col justify-center"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
