import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuArrowLeft } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { NotificationBell } from '../../shared/components/NotificationBell.jsx';
import { resolveNotificationPath } from '../lib/notificationRoutes.js';
import ReviewPromptGate from './ReviewPromptGate.jsx';
import { Button } from './ui.jsx';
import {
  BookingsIcon,
  BuilderIcon,
  CloseIcon,
  ContentHubIcon,
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

// Order and wording follow the master wireframe (Xclusive-Oman-Wireframes.html
// / Xclusive-Oman-Master-Documentation.pdf §7): Agent Dashboard (02) -> FGD
// Listing/Detail (03-04) -> Custom FIT Package Builder Wizard (05) -> Priced
// Quote — Agent View (06) -> MICE Content Hub / Curation Screen (07-08) ->
// Agent — Notification Center (20) -> Payment & Transaction History (26) ->
// Agent — Contact & Support (27). Labels drop the redundant "Agent —" prefix
// the doc uses only to disambiguate admin vs. agent screens in one shared
// document. My Bookings / Profile have no dedicated wireframe screen — kept
// in their existing, logically-adjacent slots. "My MICE Requests" used to be
// its own nav item/page (MyMiceRequests.jsx) — merged into "My Requests /
// Quotes" (FitRequests.jsx), which now lists both kinds with a kind filter
// and a MICE pill per card, rather than keeping two near-identical list
// pages side by side. "MICE Content Hub / Curation Screen (07-08)" above
// was documented here for a long time but never actually built — that's now
// ContentHub.jsx, slotted right after Corporate Enquiry since it's the same
// MICE-curation content, just read-only browsing rather than an itinerary
// picker.
const NAV_ITEMS = [
  { to: '/agent/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/agent/departures', label: 'Fixed Group Departures', Icon: DeparturesIcon },
  { to: '/agent/package-builder', label: 'Package Builder', Icon: BuilderIcon },
  // matchPrefixes — /agent/mice-requests/:id (the MICE proposal detail
  // route, still its own page — see FitRequests.jsx's own top comment) has
  // no nav item of its own since the MICE Requests list merged into this
  // one; without this it would highlight nothing in the sidebar/top bar.
  { to: '/agent/fit-requests', label: 'My Requests / Quotes', Icon: QuotesIcon, matchPrefixes: ['/agent/mice-requests'] },
  { to: '/agent/mice-builder', label: 'Corporate Enquiry', Icon: BuilderIcon },
  { to: '/agent/content-hub', label: 'Content Hub', Icon: ContentHubIcon },
  { to: '/agent/bookings', label: 'Bookings', Icon: BookingsIcon },
  { to: '/agent/transactions', label: 'Payment & Transaction History', Icon: PaymentsIcon },
  { to: '/agent/notifications', label: 'Notification Center', Icon: NotificationsIcon },
  { to: '/agent/support', label: 'Contact & Support', Icon: SupportIcon },
  { to: '/agent/profile', label: 'Profile', Icon: ProfileIcon },
];

// A path matches a nav item either on its own `to` (exact or as a prefix)
// or on any of its `matchPrefixes` — see the merged "My Requests / Quotes"
// item's own comment above for why that second part exists.
function isNavItemActive(item, pathname) {
  if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return true;
  return (item.matchPrefixes || []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
      {/* Fixed row height (h-12, matching the taller of the two logo marks)
          regardless of collapsed state — the previous h-10/h-12 swap made
          the whole header (and everything below it, nav included) shift
          vertically by a few px on hover. The two logo images crossfade in
          place instead of instantly swapping src, so growing into the wide
          wordmark reads as a reveal, not a pop. */}
      <div className="flex items-center justify-between border-b border-black/10 bg-agent-panel px-3 py-5">
        <div className="relative h-12 flex-1 overflow-hidden">
          <img
            src="/logo_scroll_closed.png"
            alt="Xclusive Oman"
            className={`absolute left-0 top-1/2 h-10 w-auto -translate-y-1/2 object-contain transition-opacity duration-300 ease-out ${
              collapsed ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <img
            src="/Xclusive_Oman_Logo_2.png"
            alt="Xclusive Oman"
            className={`absolute left-0 top-1/2 h-12 w-auto -translate-y-1/2 object-contain transition-opacity duration-300 ease-out ${
              collapsed ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </div>
        <span
          className={`flex-none overflow-hidden whitespace-nowrap rounded-full border border-black/10 bg-[#1C1C1C] px-2.5 py-1 text-xs font-semibold uppercase text-agent-accent shadow-sm shadow-black/20 transition-[max-width,opacity] duration-300 ease-out ${
            collapsed ? 'max-w-0 !border-0 !px-0 opacity-0' : 'max-w-[80px] opacity-100'
          }`}
        >
          Agent
        </span>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-3 py-5">
        {NAV_ITEMS.map((item) => {
          const { to, label, Icon } = item;
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={to}
              to={to}
              className="relative block"
              onClick={onNavigate}
              title={collapsed ? label : undefined}
            >
              {active && (
                // Crisp white pill on the solid #FFC15A rail — the cleanest
                // read for the active item against the flat yellow. A
                // hairline dark ring keeps its edge defined.
                <motion.div
                  layoutId="agent-active-nav-pill"
                  className="absolute inset-0 rounded-xl bg-white shadow-md shadow-black/15 ring-1 ring-black/5"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {/* Fixed left inset in both states (Instagram-style rail) — the
                  icon never recenters/relocates as the rail expands; only the
                  label's own box grows into the extra room beside it. */}
              <span
                className={`relative z-10 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                  active ? 'text-agent-ink-dark' : 'text-[#1C1C1C]/75 hover:bg-black/5 hover:text-agent-ink-dark'
                }`}
              >
                <Icon className="flex-none" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
                    collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
                  }`}
                >
                  {label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-black/10 px-2 py-5">
        <div className="flex items-center gap-2.5 rounded-xl bg-black/10 px-3.5 py-2.5 text-xs">
          <span
            className={`h-2.5 w-2.5 flex-none rounded-full ${
              socketConnected ? 'bg-[#227647] shadow-[0_0_0_4px_rgba(34,118,71,0.25)]' : 'bg-black/20'
            }`}
          />
          <span
            className={`overflow-hidden whitespace-nowrap text-[#1C1C1C]/70 transition-[max-width,opacity] duration-300 ease-out ${
              collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
            }`}
          >
            {socketConnected ? 'Live connection active' : 'Connecting…'}
          </span>
        </div>
        <div
          className={`overflow-hidden px-1 text-xs transition-[max-height,opacity] duration-300 ease-out ${
            collapsed ? 'max-h-0 opacity-0' : 'max-h-12 opacity-100'
          }`}
        >
          <div className="whitespace-nowrap font-semibold text-[#1C1C1C]">{user?.fullName}</div>
          <div className="whitespace-nowrap text-[#1C1C1C]/60">{user?.role}</div>
        </div>
        <Button
          onClick={logout}
          title={collapsed ? 'Log out' : undefined}
          className="w-full !justify-start gap-2 px-4"
        >
          <LogoutIcon width={16} height={16} className="flex-none" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
              collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
            }`}
          >
            Log out
          </span>
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
  const activeItem = NAV_ITEMS.find((item) => isNavItemActive(item, pathname));

  return (
    <div className="flex min-h-screen bg-agent-bg">
      {/* Desktop sidebar — always visible at lg+, collapsible to an icon rail */}
      <motion.aside
        initial={{ x: -28, opacity: 0, width: COLLAPSED_WIDTH }}
        animate={{ x: 0, opacity: 1, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className="sticky top-0 hidden h-screen flex-none flex-col bg-agent-accent shadow-xl shadow-black/10 lg:flex"
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
              className="fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-none flex-col bg-agent-accent shadow-2xl lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-black/20 text-[#1C1C1C]"
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
        {/* Top bar — back nav + current section label, sticky across pages.
            Plain white with a solid #FFC15A underline, per the brand
            guideline's "lines = yellow" rule. */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-agent-accent bg-white px-4 py-3 shadow-sm lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-agent-panel text-agent-ink lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon width={18} height={18} />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-agent-line-light text-agent-ink-dark transition-colors hover:border-agent-accent hover:text-agent-accent-dark"
            aria-label="Go back"
          >
            <LuArrowLeft size={17} />
          </button>
          <div className="text-sm font-bold text-agent-ink-dark">{activeItem?.label || 'Agent Portal'}</div>
          <div className="ml-auto">
            <NotificationBell
              api={api}
              getSocket={getSocket}
              socketConnected={socketConnected}
              resolvePath={resolveNotificationPath}
              onNavigate={navigate}
              icon={NotificationsIcon}
              buttonClassName="h-9 w-9 rounded-full border-2 border-agent-accent/50 bg-agent-accent-soft text-agent-accent-dark hover:bg-agent-accent hover:text-white"
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

      {/* Agent Review & Rating Popup (Task 20 — Screen 32). Mounted once
          here rather than per-page — AgentLayout only ever renders once the
          agent is actually authenticated (it sits inside ProtectedRoute),
          so this fires exactly "on next portal opening" per the doc's own
          language, without a hardcoded frontend timeout. */}
      <ReviewPromptGate />
    </div>
  );
}
