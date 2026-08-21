import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LuLayoutDashboard,
  LuLayoutGrid,
  LuInbox,
  LuClipboardCheck,
  LuTruck,
  LuUserCheck,
  LuHeadset,
  LuLogOut,
  LuRefreshCw,
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui.jsx';

// Sidebar is entirely driven by Access Features (an admin's checkboxes on
// this account, Employees.jsx) — never a fixed list the way AdminLayout's/
// AgentLayout's NAV_ITEMS are. `feature` here must match the backend's own
// LM_FEATURE_KEYS/RM_FEATURE_KEYS (config/accessFeatures.js) exactly; a
// mismatch would just mean that item never shows, not a security hole (the
// backend's requireFeature is the real gate either way).
const LM_NAV = [
  { feature: 'catalog', to: '/team/catalog', label: 'Catalog', Icon: LuLayoutGrid },
  { feature: 'quotesPricing', to: '/team/quotes-pricing', label: 'Quotes & Pricing', Icon: LuInbox },
  { feature: 'bookingsDocs', to: '/team/bookings-docs', label: 'Bookings & Docs', Icon: LuClipboardCheck },
  { feature: 'fdOperations', to: '/team/fd-operations', label: 'FD Operation', Icon: LuTruck },
];

const RM_NAV = [
  { feature: 'approvedAgents', to: '/team/approved-agents', label: 'Approved Agents', Icon: LuUserCheck },
  { feature: 'quotesPricing', to: '/team/quotes-pricing', label: 'Quotes & Pricing', Icon: LuInbox },
  { feature: 'supportTickets', to: '/team/support-tickets', label: 'Support Tickets', Icon: LuHeadset },
  { feature: 'bookingsDocs', to: '/team/bookings-docs', label: 'Bookings & Docs', Icon: LuClipboardCheck },
];

const ROLE_LABEL = {
  sales_manager: 'Lead Manager',
  relationship_manager: 'Relationship Manager',
};

function isActive(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function TeamLayout() {
  const { user, logout, hasFeature, isLeadManager, socketConnected, refreshUser } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const navSource = isLeadManager ? LM_NAV : RM_NAV;
  const navItems = navSource.filter((item) => hasFeature(item.feature));

  // Manual re-sync — an admin telling you "I just updated your access" is
  // the one case the automatic window-focus refresh (AuthContext.jsx) can't
  // catch on its own (you're already focused on this tab). Re-fetches
  // /auth/me, which requireFeature's own 403 on the backend already proves
  // is always checked fresh regardless of what this tab previously cached.
  async function handleRefreshAccess() {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-team-bg">
      <motion.aside
        initial={{ x: -28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: 'linear-gradient(180deg, #12161F 0%, #1E2532 55%, #3F1424 100%)' }}
        className="sticky top-0 flex h-screen w-72 flex-none flex-col border-r border-white/10"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="h-12 w-auto flex-none object-contain" />
          <span className="flex-none rounded-full border border-transparent bg-gradient-to-r from-[#BE123C] to-[#E11D48] px-2.5 py-1 text-xs font-semibold uppercase text-white shadow-sm shadow-black/20">
            Team
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-3 py-5">
          <Link
            to="/team/dashboard"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              isActive(pathname, '/team/dashboard')
                ? 'bg-gradient-to-r from-[#BE123C] to-[#E11D48] text-white shadow-md shadow-black/20'
                : 'text-white/75 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LuLayoutDashboard className="flex-none" size={18} />
            Dashboard
          </Link>

          {navItems.map(({ to, label, Icon }) => {
            const active = isActive(pathname, to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-[#BE123C] to-[#E11D48] text-white shadow-md shadow-black/20'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="flex-none" size={18} />
                {label}
              </Link>
            );
          })}

          {navItems.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/60">
              <p>No Access Features are enabled on your account yet. Contact an admin to request access.</p>
              <button
                type="button"
                onClick={handleRefreshAccess}
                disabled={refreshing}
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-white/80 hover:text-white disabled:opacity-50"
              >
                <LuRefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Checking…' : "Already granted access? Check again"}
              </button>
            </div>
          )}
        </nav>

        <div className="space-y-3 border-t border-white/10 px-4 py-5">
          <button
            type="button"
            onClick={handleRefreshAccess}
            disabled={refreshing}
            title="Re-check your Access Features"
            className="flex w-full items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs text-white/70 transition hover:bg-white/15 hover:text-white disabled:opacity-60"
          >
            <LuRefreshCw size={13} className={`flex-none ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking for updates…' : 'Refresh access'}
          </button>
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs">
            <span
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                socketConnected ? 'bg-[#10B981] shadow-[0_0_0_4px_rgba(16,185,129,0.25)]' : 'bg-white/30'
              }`}
            />
            <span className="text-white/70">{socketConnected ? 'Live connection active' : 'Connecting…'}</span>
          </div>
          <div className="px-1 text-xs">
            <div className="font-semibold text-white">{user?.fullName}</div>
            <div className="text-white/60">{ROLE_LABEL[user?.role] || user?.role}</div>
          </div>
          <Button
            onClick={logout}
            className="w-full justify-center gap-2 border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/20"
          >
            <LuLogOut size={16} />
            Log out
          </Button>
        </div>
      </motion.aside>

      <div className="min-w-0 flex-1">
        <div
          style={{ background: 'linear-gradient(90deg, #FCE4E9, #F7F5F6, #E4E7EC)' }}
          className="sticky top-0 z-30 flex items-center justify-end border-b border-team-line-light px-4 py-2.5 backdrop-blur print:hidden lg:px-8"
        >
          <button
            type="button"
            onClick={() => navigate('/team/dashboard')}
            className="text-xs font-semibold text-team-accent-dark hover:underline"
          >
            Team Portal
          </button>
        </div>
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
