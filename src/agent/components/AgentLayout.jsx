import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { NotificationBell } from '../../shared/components/NotificationBell.jsx';
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
  { to: '/agent/mice-builder', label: 'MICE Curation', Icon: BuilderIcon },
  { to: '/agent/mice-requests', label: 'My MICE Requests', Icon: QuotesIcon },
  { to: '/agent/bookings', label: 'My Bookings', Icon: BookingsIcon },
  { to: '/agent/transactions', label: 'Payment & Transactions', Icon: PaymentsIcon },
  { to: '/agent/notifications', label: 'Notifications', Icon: NotificationsIcon },
  { to: '/agent/support', label: 'Support', Icon: SupportIcon },
  { to: '/agent/profile', label: 'Profile', Icon: ProfileIcon },
];

// Agent Notification UI (Task 2) — maps a notification's referenceType to an
// in-portal detail route (doc §11.8's related_entity_type, using the same
// entity strings already written into audit_logs by miceRfqs.controller.js
// / packageRequests.controller.js). No business module creates notifications
// yet, but the routing needs to be ready for when they do. Only entities
// with an existing detail route are listed — e.g. bookings has no
// /agent/bookings/:id route yet, so it's deliberately left out for now.
const REFERENCE_ROUTES = {
  mice_rfq: (id) => `/agent/mice-requests/${id}`,
  package_request: (id) => `/agent/fit-requests/${id}`,
};

function resolveNotificationPath(referenceType, referenceId) {
  if (!referenceType || !referenceId) return null;
  return REFERENCE_ROUTES[referenceType]?.(referenceId) || null;
}

const EXPANDED_WIDTH = 288; // w-72
const COLLAPSED_WIDTH = 76;

// Shared between the desktop rail and the mobile off-canvas drawer — the
// mobile drawer always passes collapsed=false (it's already an overlay, so
// there's no space to reclaim by going icon-only there).
function SidebarContent({ onNavigate, collapsed = false }) {
  const { user, logout, socketConnected } = useAuth();
  const { pathname } = useLocation();

  return (
    <>
      <div
        className={`flex items-center border-b border-white/10 ${collapsed ? 'justify-center px-2 py-4' : 'justify-between px-6 py-6'}`}
      >
        <img
          src={collapsed ? '/logo_scroll_closed.png' : '/Xclusive_Oman_Logo_2.png'}
          alt="Xclusive Oman"
          className={`w-auto flex-none object-contain ${collapsed ? 'h-10' : 'h-12'}`}
        />
        {!collapsed && (
          <span className="flex-none rounded-full border border-agent-accent/40 bg-agent-accent-soft px-2.5 py-1 text-xs font-semibold uppercase text-agent-accent-dark">
            Agent
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-3 py-5">
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className="relative block"
              onClick={onNavigate}
              title={collapsed ? label : undefined}
            >
              {active && (
                <motion.div
                  layoutId="agent-active-nav-pill"
                  className="absolute inset-0 rounded-xl bg-agent-accent shadow-md shadow-black/20"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-3 rounded-xl py-3 text-sm font-semibold transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-4'
                } ${active ? 'text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="flex-none" />
                {!collapsed && label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className={`space-y-3 border-t border-white/10 py-5 ${collapsed ? 'px-2' : 'px-4'}`}>
        <div
          className={`flex items-center gap-2.5 rounded-xl bg-white/10 py-2.5 text-xs ${
            collapsed ? 'justify-center px-0' : 'px-3.5'
          }`}
        >
          <span
            className={`h-2.5 w-2.5 flex-none rounded-full ${
              socketConnected ? 'bg-[#4fd97a] shadow-[0_0_0_4px_rgba(79,217,122,0.25)]' : 'bg-white/30'
            }`}
          />
          {!collapsed && <span className="text-white/70">{socketConnected ? 'Live connection active' : 'Connecting…'}</span>}
        </div>
        {!collapsed && (
          <div className="px-1 text-xs">
            <div className="font-semibold text-white">{user?.fullName}</div>
            <div className="text-white/60">{user?.role}</div>
          </div>
        )}
        <Button
          onClick={logout}
          title={collapsed ? 'Log out' : undefined}
          className={`w-full justify-center gap-2 ${collapsed ? 'px-0' : ''}`}
        >
          <LogoutIcon width={16} height={16} />
          {!collapsed && 'Log out'}
        </Button>
      </div>
    </>
  );
}

export default function AgentLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { socketConnected } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop rail starts collapsed (icon-only) to leave more room for page
  // content — hovering over it expands it, moving the mouse away collapses
  // it back.
  const [collapsed, setCollapsed] = useState(true);
  const activeItem = NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

  return (
    <div className="flex min-h-screen bg-agent-bg">
      {/* Desktop sidebar — always visible at lg+, collapsible to an icon rail */}
      <motion.aside
        initial={{ x: -28, opacity: 0, width: COLLAPSED_WIDTH }}
        animate={{ x: 0, opacity: 1, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className="sticky top-0 hidden h-screen flex-none flex-col bg-[linear-gradient(180deg,#0b4f4a_0%,#083a36_100%)] shadow-xl shadow-black/10 lg:flex"
      >
        <SidebarContent collapsed={collapsed} />
      </motion.aside>

      {/* Mobile off-canvas sidebar — always fully expanded, it's an overlay */}
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
          <div className="ml-auto">
            <NotificationBell
              api={api}
              getSocket={getSocket}
              socketConnected={socketConnected}
              resolvePath={resolveNotificationPath}
              onNavigate={navigate}
              icon={NotificationsIcon}
              buttonClassName="h-9 w-9 rounded-full bg-agent-accent-soft text-agent-accent-dark hover:bg-agent-accent hover:text-white"
            />
          </div>
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
