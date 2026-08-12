import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.07, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const blobRefs = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      blobRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.to(el, {
          x: i % 2 === 0 ? 30 : -30,
          y: i % 2 === 0 ? -24 : 24,
          duration: 7 + i,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    });
    return () => ctx.revert();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/admin/approvals', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#f7d8c6_0,#f6eee9_28%,#edf1f0_58%,#e7e5e0_100%)] px-4 py-10">
      <div
        ref={(el) => (blobRefs.current[0] = el)}
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        ref={(el) => (blobRefs.current[1] = el)}
        className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-ink/10 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[480px]"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
          className="mb-8 text-center"
        >
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="mx-auto mb-5 h-16 w-auto object-contain" />
          <div className="mt-1.5 text-sm text-muted">Staff &amp; Admin Console</div>
        </motion.div>

        <Card label="Sign in" className="border-white/70 shadow-xl shadow-black/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
              <FieldLabel>Work email</FieldLabel>
              <TextInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@xclusiveoman.com"
              />
            </motion.div>
            <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
              <FieldLabel>Password</FieldLabel>
              <TextInput
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </motion.div>
            <ErrorText>{error}</ErrorText>
            <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
              <Button variant="solid" type="submit" className="w-full py-3 text-center text-sm" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </Button>
            </motion.div>
          </form>
        </Card>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-5 text-center text-xs text-muted"
        >
          Access is provisioned by a Super Admin — no self-registration here.
        </motion.div>
      </motion.div>
    </div>
  );
}
