import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LuBell,
  LuBuilding2,
  LuChartColumn,
  LuChevronDown,
  LuClipboardCheck,
  LuContact,
  LuHeadset,
  LuInbox,
  LuLandmark,
  LuLayoutDashboard,
  LuLayoutGrid,
  LuLogOut,
  LuMegaphone,
  LuNewspaper,
  LuStar,
  LuPresentation,
  LuReceipt,
  LuTruck,
  LuUserCheck,
  LuWallet,
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { NotificationBell } from '../../shared/components/NotificationBell.jsx';
import { Button } from './ui.jsx';

// Maps a notification's referenceType to an in-portal route — mirrors
// AgentLayout.jsx's own resolveNotificationPath, just admin's own routes.
// 'agency' (New Agent Added — see auth.controller.js's
// notifyAdminsOfNewAgent) resolves to the Agent Approvals list: there's no
// per-agency detail route in the admin portal yet, so the list is as close
// as navigation can currently get.
// 'marketing_campaign' (Marketing campaign scheduled/sent/partially failed/
// failed/cancelled — backend's marketingActivity.service.js#recordCampaignEvent,
// Task 8) resolves to the Marketing Center; Campaign History (Task 7) is a
// tab there, not its own route, so this lands as close as the current
// routing supports — same "list, not per-record detail route" reasoning as
// 'agency' above.
const REFERENCE_ROUTES = {
  agency: () => '/admin/approvals',
  marketing_campaign: () => '/admin/marketing',
};

function resolveNotificationPath(referenceType) {
  if (!referenceType) return null;
  return REFERENCE_ROUTES[referenceType]?.() || null;
}

// Grouped, task-oriented sidebar — 9 top-level entries. Items that used to
// be separate top-level links (Agent Approvals, Relationship Managers,
// Sales Managers, Product Catalog, MICE Catalog, NEFT Verification,
// Transaction Ledger) now live as sub-items under a parent group; none of
// those routes or their page components changed. Icons are react-icons
// (Lucide set) rather than hand-rolled SVGs.
//
// Relationship Managers and Sales Managers used to be two separate sub-items
// (each its own page) — now one "Employees" entry, whose page has a tab per
// staff type (Employees.jsx).
const NAV_ITEMS = [
  { key: 'dashboard', to: '/admin/dashboard', label: 'Dashboard', Icon: LuLayoutDashboard },
  {
    key: 'agencies-team',
    label: 'Agencies & Team',
    Icon: LuBuilding2,
    children: [
      { to: '/admin/approvals', label: 'Agent Approvals', Icon: LuUserCheck },
      { to: '/admin/employees', label: 'Employees', Icon: LuContact },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    Icon: LuLayoutGrid,
    children: [
      { to: '/admin/catalog', label: 'Product Catalog', Icon: LuLayoutGrid },
      { to: '/admin/mice-catalog', label: 'MICE Catalog', Icon: LuPresentation },
    ],
  },
  {
    key: 'quotes-pricing',
    label: 'Quotes & Pricing',
    Icon: LuInbox,
    children: [
      { to: '/admin/quote-inbox', label: 'Custom FIT Quotes', Icon: LuInbox },
      { to: '/admin/mice-requests', label: 'MICE Requests', Icon: LuPresentation },
    ],
  },
  { key: 'bookings-documents', to: '/admin/bookings-documents', label: 'Bookings & Documents', Icon: LuClipboardCheck },
  { key: 'operations', to: '/admin/operations', label: 'FD Operations', Icon: LuTruck },
  {
    key: 'finance',
    label: 'Finance',
    Icon: LuWallet,
    children: [
      { to: '/admin/neft-verification', label: 'NEFT Verification', Icon: LuLandmark },
      { to: '/admin/transactions', label: 'Transaction Ledger', Icon: LuReceipt },
    ],
  },
  { key: 'marketing', to: '/admin/marketing', label: 'Marketing', Icon: LuMegaphone },
  { key: 'analytics', to: '/admin/analytics', label: 'Analytics', Icon: LuChartColumn },
  { key: 'support', to: '/admin/support', label: 'Support', Icon: LuHeadset },
  // Admin Reviews Management (Task 21 — Item 33) — ops_admin/super_admin
  // gated on the backend only; not filtered out of NAV_ITEMS for other
  // roles, matching the existing convention for other ops_admin+-only pages
  // (FD Operations, Bookings & Documents above) rather than CMS's own
  // explicit super_admin-only override just below.
  { key: 'reviews', to: '/admin/reviews', label: 'Reviews', Icon: LuStar },
  // Content & CMS Management (Task 21 — Item 34) — super_admin only per this
  // task's explicit access-control override; filtered out of NAV_ITEMS below
  // for every other role. Hiding the nav item is a UX convenience only, not
  // the real gate — SuperAdminRoute.jsx (frontend) and requireRole('super_admin')
  // (backend, cms.routes.js) are what actually enforce it.
  { key: 'cms', to: '/admin/cms', label: 'Content & CMS', Icon: LuNewspaper, superAdminOnly: true },
];

const EXPANDED_WIDTH = 288; // w-72
const COLLAPSED_WIDTH = 76;

function isActive(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function groupHasActiveChild(pathname, item) {
  return item.children?.some((c) => isActive(pathname, c.to)) ?? false;
}

export default function AdminLayout() {
  const { user, logout, socketConnected, isSuperAdmin } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Starts collapsed (icon rail) — hovering over the sidebar expands it,
  // moving the mouse away collapses it back to give the page its width back.
  const [collapsed, setCollapsed] = useState(true);
  // Content & CMS (Task 21 — Item 34) is the only superAdminOnly entry today
  // — filtered here rather than in NAV_ITEMS itself so the module-level
  // array stays a plain static list every other reader (openGroups init,
  // the active-group effect) can keep using unfiltered; neither of those
  // ever touches this flat, childless item anyway.
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const [openGroups, setOpenGroups] = useState(() =>
    NAV_ITEMS.filter((item) => item.children && groupHasActiveChild(pathname, item)).map((item) => item.key)
  );

  // Keep whichever group holds the current route expanded as navigation happens.
  useEffect(() => {
    const activeGroup = NAV_ITEMS.find((item) => item.children && groupHasActiveChild(pathname, item));
    if (activeGroup) {
      setOpenGroups((groups) => (groups.includes(activeGroup.key) ? groups : [...groups, activeGroup.key]));
    }
  }, [pathname]);

  function toggleGroup(key) {
    setOpenGroups((groups) => (groups.includes(key) ? groups.filter((g) => g !== key) : [...groups, key]));
  }

  // Clicking a group's icon while the rail is collapsed expands straight
  // into that group, rather than needing a separate flyout submenu for the
  // collapsed state.
  function handleGroupClick(key) {
    if (collapsed) {
      setOpenGroups((groups) => (groups.includes(key) ? groups : [...groups, key]));
    } else {
      toggleGroup(key);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F4F7FF]">
      <motion.aside
        initial={{ x: -28, opacity: 0, width: COLLAPSED_WIDTH }}
        animate={{ x: 0, opacity: 1, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        style={{ background: 'linear-gradient(180deg, #0F1B4D 0%, #172B68 55%, #24145F 100%)' }}
        className="sticky top-0 flex h-screen flex-none flex-col border-r border-white/10"
      >
        <div
          className={`flex items-center border-b border-white/10 ${collapsed ? 'justify-center px-2 py-4' : 'justify-between px-6 py-6'}`}
        >
          <img
            src={collapsed ? '/logo_scroll_closed.png' : '/Xclusive_Oman_Logo_2.png'}
            alt="Xclusive Oman"
            className={`w-auto flex-none object-contain ${collapsed ? 'h-10' : 'h-12'}`}
          />
          {!collapsed && (
            <span className="flex-none rounded-full border border-transparent bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-2.5 py-1 text-xs font-semibold uppercase text-white shadow-sm shadow-black/20">
              Admin
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-5">
          {visibleNavItems.map((item) => {
            if (!item.children) {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-lg border-l-[3px] py-2.5 text-sm font-semibold transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-3.5'
                  } ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white shadow-md shadow-black/20'
                      : 'border-transparent text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.Icon className="flex-none" size={18} />
                  {!collapsed && item.label}
                </Link>
              );
            }

            const open = !collapsed && openGroups.includes(item.key);
            const hasActiveChild = groupHasActiveChild(pathname, item);

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => handleGroupClick(item.key)}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-[3px] py-2.5 text-left text-sm font-semibold transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-3.5'
                  } ${
                    hasActiveChild
                      ? 'border-transparent bg-white/10 text-white'
                      : 'border-transparent text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.Icon className="flex-none" size={18} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <LuChevronDown
                        size={14}
                        className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-1 space-y-0.5 border-l border-white/10 pl-4">
                        {item.children.map((child) => {
                          const active = isActive(pathname, child.to);
                          return (
                            <Link
                              key={child.to}
                              to={child.to}
                              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                active
                                  ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white shadow-md shadow-black/20'
                                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <child.Icon className="flex-none" size={15} />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                socketConnected ? 'bg-[#10B981] shadow-[0_0_0_4px_rgba(16,185,129,0.25)]' : 'bg-white/30'
              }`}
            />
            {!collapsed && (
              <span className="text-white/70">{socketConnected ? 'Live connection active' : 'Connecting…'}</span>
            )}
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
            className={`w-full justify-center gap-2 border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/20 ${collapsed ? 'px-0' : ''}`}
          >
            <LuLogOut size={16} />
            {!collapsed && 'Log out'}
          </Button>
        </div>
      </motion.aside>

      <div className="min-w-0 flex-1">
        {/* Slim top bar — just the notification bell for now. print:hidden so
            pages with a printable document (e.g. the agent portal's Review &
            Submit) that ever get reused/rendered under this layout don't pick
            up chrome around the document; harmless here today either way. */}
        <div
          style={{ background: 'linear-gradient(90deg, #EEF4FF, #F5EEFF, #FFF4EC)' }}
          className="sticky top-0 z-30 flex items-center justify-end border-b border-[#E4E9FB] px-4 py-2.5 backdrop-blur print:hidden lg:px-8"
        >
          <NotificationBell
            api={api}
            getSocket={getSocket}
            socketConnected={socketConnected}
            resolvePath={resolveNotificationPath}
            onNavigate={navigate}
            icon={LuBell}
            buttonClassName="h-9 w-9 rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white"
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="min-h-screen"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
