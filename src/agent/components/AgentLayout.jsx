import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui.jsx';
import {
  BookingsIcon,
  BuilderIcon,
  CloseIcon,
  DashboardIcon,
  DeparturesIcon,
  LogoutIcon,
  MenuIcon,
  NotificationsIcon,
  PaymentsIcon,
  ProfileIcon,
  QuotesIcon,
  SupportIcon,
} from './icons.jsx';

// Task 1 sidebar spec, in the requested order.
const NAV_ITEMS = [
  { to: '/agent/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/agent/departures', label: 'Fixed Group Departures', Icon: DeparturesIcon },
  { to: '/agent/package-builder', label: 'Custom FIT Package Builder', Icon: BuilderIcon },
  { to: '/agent/fit-requests', label: 'My FIT Requests / Quotes', Icon: QuotesIcon },
  { to: '/agent/bookings', label: 'My Bookings', Icon: BookingsIcon },
  { to: '/agent/transactions', label: 'Payment & Transactions', Icon: PaymentsIcon },
  { to: '/agent/notifications', label: 'Notifications', Icon: NotificationsIcon },
  { to: '/agent/support', label: 'Support', Icon: SupportIcon },
  { to: '/agent/profile', label: 'Profile', Icon: ProfileIcon },
];

// The sidebar itself is the colored surface (deep teal, matching the
// Login page's brand panel) rather than white-with-color-accents, so the
// Agent Portal reads as its own themed app rather than a recolored copy of
// the Admin Console's white sidebar.
function SidebarContent({ onNavigate }) {
  const { user, logout, socketConnected } = useAuth();
  const { pathname } = useLocation();

  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white text-base font-bold text-agent-ink shadow-lg shadow-black/20">
          XO
        </div>
        <div>
          <div className="text-sm font-bold leading-tight text-white">Xclusive Oman</div>
          <div className="text-xs text-white/60">Agent Portal</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link key={to} to={to} className="relative block" onClick={onNavigate}>
              {active && (
                <motion.div
                  layoutId="agent-active-nav-pill"
                  className="absolute inset-0 rounded-xl bg-agent-accent shadow-md shadow-black/20"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active ? 'text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="flex-none" />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/10 px-4 py-5">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs">
          <span
            className={`h-2.5 w-2.5 flex-none rounded-full ${
              socketConnected ? 'bg-[#4fd97a] shadow-[0_0_0_4px_rgba(79,217,122,0.25)]' : 'bg-white/30'
            }`}
          />
          <span className="text-white/70">{socketConnected ? 'Live connection active' : 'Connecting…'}</span>
        </div>
        <div className="px-1 text-xs">
          <div className="font-semibold text-white">{user?.fullName}</div>
          <div className="text-white/60">{user?.role}</div>
        </div>
        <Button onClick={logout} className="w-full justify-center gap-2">
          <LogoutIcon width={16} height={16} />
          Log out
        </Button>
      </div>
    </>
  );
}

export default function AgentLayout() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

  return (
    <div className="flex min-h-screen bg-agent-bg">
      {/* Desktop sidebar — always visible at lg+ */}
      <motion.aside
        initial={{ x: -28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 hidden h-screen w-72 flex-none flex-col bg-[linear-gradient(180deg,#0b4f4a_0%,#083a36_100%)] shadow-xl shadow-black/10 lg:flex"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile off-canvas sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            />
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-none flex-col bg-[linear-gradient(180deg,#0b4f4a_0%,#083a36_100%)] shadow-2xl lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white"
                aria-label="Close menu"
              >
                <CloseIcon width={16} height={16} />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1">
        {/* Top bar — mobile menu toggle + current section label, sticky across pages */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-agent-accent/30 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-agent-panel text-agent-ink lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon width={18} height={18} />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-agent-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-agent-accent" />
            {activeItem?.label || 'Agent Portal'}
          </div>
          <Link
            to="/agent/notifications"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-agent-accent-soft text-agent-accent-dark hover:bg-agent-accent hover:text-white"
          >
            <NotificationsIcon width={16} height={16} />
          </Link>
        </div>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
