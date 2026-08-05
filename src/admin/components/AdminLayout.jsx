import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui.jsx';
import {
  AnalyticsIcon,
  ApprovalsIcon,
  BookingsDocsIcon,
  CatalogIcon,
  ChevronDownIcon,
  DashboardIcon,
  FinanceIcon,
  LogoutIcon,
  MarketingIcon,
  MiceCatalogIcon,
  NeftIcon,
  QuoteInboxIcon,
  RelationshipManagerIcon,
  SalesManagerIcon,
  SupportIcon,
  TeamIcon,
  TransactionsIcon,
} from './icons.jsx';

// Grouped, task-oriented sidebar — 9 top-level entries. Items that used to
// be separate top-level links (Agent Approvals, Relationship Managers,
// Sales Managers, Product Catalog, MICE Catalog, NEFT Verification,
// Transaction Ledger) now live as sub-items under a parent group; none of
// those routes or their page components changed.
const NAV_ITEMS = [
  { key: 'dashboard', to: '/admin/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  {
    key: 'agencies-team',
    label: 'Agencies & Team',
    Icon: TeamIcon,
    children: [
      { to: '/admin/approvals', label: 'Agent Approvals', Icon: ApprovalsIcon },
      { to: '/admin/relationship-managers', label: 'Relationship Managers', Icon: RelationshipManagerIcon },
      { to: '/admin/sales-managers', label: 'Sales Managers', Icon: SalesManagerIcon },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    Icon: CatalogIcon,
    children: [
      { to: '/admin/catalog', label: 'Product Catalog', Icon: CatalogIcon },
      { to: '/admin/mice-catalog', label: 'MICE Catalog', Icon: MiceCatalogIcon },
    ],
  },
  { key: 'quotes-pricing', to: '/admin/quote-inbox', label: 'Quotes & Pricing', Icon: QuoteInboxIcon },
  { key: 'bookings-documents', to: '/admin/bookings-documents', label: 'Bookings & Documents', Icon: BookingsDocsIcon },
  {
    key: 'finance',
    label: 'Finance',
    Icon: FinanceIcon,
    children: [
      { to: '/admin/neft-verification', label: 'NEFT Verification', Icon: NeftIcon },
      { to: '/admin/transactions', label: 'Transaction Ledger', Icon: TransactionsIcon },
    ],
  },
  { key: 'marketing', to: '/admin/marketing', label: 'Marketing', Icon: MarketingIcon },
  { key: 'analytics', to: '/admin/analytics', label: 'Analytics', Icon: AnalyticsIcon },
  { key: 'support', to: '/admin/support', label: 'Support', Icon: SupportIcon },
];

function isActive(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function groupHasActiveChild(pathname, item) {
  return item.children?.some((c) => isActive(pathname, c.to)) ?? false;
}

export default function AdminLayout() {
  const { user, logout, socketConnected } = useAuth();
  const { pathname } = useLocation();
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

  return (
    <div className="flex min-h-screen bg-[#eef1f7]">
      <motion.aside
        initial={{ x: -28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 flex h-screen w-72 flex-none flex-col border-r border-line-light bg-white/95 backdrop-blur"
      >
        <div className="flex items-center gap-3 border-b border-line-light px-6 py-6">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-ink text-base font-bold text-white shadow-lg shadow-ink/20">
            XO
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold leading-tight text-ink">
              Xclusive Oman
              <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[9px] font-semibold uppercase text-accent">
                Admin
              </span>
            </div>
            <div className="text-xs text-muted">Admin Console</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
          {NAV_ITEMS.map((item) => {
            if (!item.children) {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-accent bg-accent-soft/60 text-ink'
                      : 'border-transparent text-muted hover:bg-panel hover:text-ink'
                  }`}
                >
                  <item.Icon className="flex-none" width={18} height={18} />
                  {item.label}
                </Link>
              );
            }

            const open = openGroups.includes(item.key);
            const hasActiveChild = groupHasActiveChild(pathname, item);

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-[3px] px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                    hasActiveChild
                      ? 'border-accent text-ink'
                      : 'border-transparent text-muted hover:bg-panel hover:text-ink'
                  }`}
                >
                  <item.Icon className="flex-none" width={18} height={18} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDownIcon
                    width={14}
                    height={14}
                    className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}
                  />
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
                              <child.Icon className="flex-none" width={15} height={15} />
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

        <div className="space-y-3 border-t border-line-light px-4 py-5">
          <div className="flex items-center gap-2.5 rounded-xl bg-panel px-3.5 py-2.5 text-xs">
            <span
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                socketConnected ? 'bg-[#2f7d32] shadow-[0_0_0_4px_rgba(47,125,50,0.15)]' : 'bg-[#ccc]'
              }`}
            />
            <span className="text-muted">{socketConnected ? 'Live connection active' : 'Connecting…'}</span>
          </div>
          <div className="px-1 text-xs">
            <div className="font-semibold text-ink">{user?.fullName}</div>
            <div className="text-muted">{user?.role}</div>
          </div>
          <Button onClick={logout} className="w-full justify-center gap-2">
            <LogoutIcon width={16} height={16} />
            Log out
          </Button>
        </div>
      </motion.aside>

      <div className="min-w-0 flex-1">
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
