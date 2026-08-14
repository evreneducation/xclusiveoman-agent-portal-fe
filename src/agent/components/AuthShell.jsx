import { motion } from 'framer-motion';

// Split-screen auth shell (Sign In / Register / Forgot / Reset Password) —
// a brand visual panel on the left, the page's own form content on the
// right. Deliberately minimal: each page owns its logo/heading/copy and its
// own inner max-width (a short form like Login and a long one like Register
// both read naturally) rather than AuthShell dictating one fixed size.
export default function AuthShell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f1ec] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-black/10 lg:grid-cols-[1fr_1.15fr]"
      >
        <div className="relative hidden min-h-[600px] lg:block">
          <AuthVisualPanel />
        </div>
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">{children}</div>
      </motion.div>
    </div>
  );
}

// Full-bleed photo panel, same treatment as the reference: a real photo
// (Muscat's Mutrah Corniche — public/oman_pic.jpg) with a brand-color duotone
// wash over it (grayscale photo + a translucent teal gradient on top, same
// idea as the reference's purple-tinted photo), edge-to-edge with no inner
// border/frame. No text/copy on this panel — all copy lives in the form
// panel on the right.
function AuthVisualPanel() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img src="/oman_pic.jpg" alt="" className="h-full w-full object-cover grayscale" />
      <div className="absolute inset-0 bg-gradient-to-br from-agent-ink/80 via-agent-ink/65 to-agent-ink-dark/85" />
    </div>
  );
}
