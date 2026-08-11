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
  LuPresentation,
  LuReceipt,
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
const REFERENCE_ROUTES = {
  agency: () => '/admin/approvals',
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
  const { user, logout, socketConnected } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Starts collapsed (icon rail) — hovering over the sidebar expands it,
  // moving the mouse away collapses it back to give the page its width back.
  const [collapsed, setCollapsed] = useState(true);
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
    <div className="flex min-h-screen bg-[#eef1f7]">
      <motion.aside
        initial={{ x: -28, opacity: 0, width: COLLAPSED_WIDTH }}
        animate={{ x: 0, opacity: 1, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className="sticky top-0 flex h-screen flex-none flex-col border-r border-line-light bg-white/95 backdrop-blur"
      >
        <div className={`flex items-center gap-3 border-b border-line-light px-6 py-6 ${collapsed ? 'justify-center px-3' : ''}`}>
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-ink text-base font-bold text-white shadow-lg shadow-ink/20">
            XO
          </div>
          {!collapsed && (
            <div>
              <div className="flex items-center gap-2 text-sm font-bold leading-tight text-ink">
                Xclusive Oman
                <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[9px] font-semibold uppercase text-accent">
                  Admin
                </span>
              </div>
              <div className="text-xs text-muted">Admin Console</div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-5">
          {NAV_ITEMS.map((item) => {
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
                      ? 'border-accent bg-accent-soft/60 text-ink'
                      : 'border-transparent text-muted hover:bg-panel hover:text-ink'
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
                    hasActiveChild ? 'border-accent text-ink' : 'border-transparent text-muted hover:bg-panel hover:text-ink'
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
                      <div className="ml-3 mt-1 space-y-0.5 border-l border-line-light pl-4">
                        {item.children.map((child) => {
                          const active = isActive(pathname, child.to);
                          return (
                            <Link
                              key={child.to}
                              to={child.to}
                              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                active ? 'bg-ink text-white shadow-sm' : 'text-muted hover:bg-panel hover:text-ink'
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

        <div className={`space-y-3 border-t border-line-light py-5 ${collapsed ? 'px-2' : 'px-4'}`}>
          <div
            className={`flex items-center gap-2.5 rounded-xl bg-panel py-2.5 text-xs ${
              collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                socketConnected ? 'bg-[#2f7d32] shadow-[0_0_0_4px_rgba(47,125,50,0.15)]' : 'bg-[#ccc]'
              }`}
            />
            {!collapsed && (
              <span className="text-muted">{socketConnected ? 'Live connection active' : 'Connecting…'}</span>
            )}
          </div>
          {!collapsed && (
            <div className="px-1 text-xs">
              <div className="font-semibold text-ink">{user?.fullName}</div>
              <div className="text-muted">{user?.role}</div>
            </div>
          )}
          <Button
            onClick={logout}
            title={collapsed ? 'Log out' : undefined}
            className={`w-full justify-center gap-2 ${collapsed ? 'px-0' : ''}`}
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
        <div className="sticky top-0 z-30 flex items-center justify-end border-b border-line-light bg-white/95 px-4 py-2.5 backdrop-blur print:hidden lg:px-8">
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
