import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui.jsx';
import {
  ApprovalsIcon,
  CatalogIcon,
  LogoutIcon,
  MiceCatalogIcon,
  NeftIcon,
  QuoteInboxIcon,
  RelationshipManagerIcon,
  SalesManagerIcon,
  TransactionsIcon,
} from './icons.jsx';

const NAV_ITEMS = [
  { to: '/admin/approvals', label: 'Agent Approvals', Icon: ApprovalsIcon },
  { to: '/admin/relationship-managers', label: 'Relationship Managers', Icon: RelationshipManagerIcon },
  { to: '/admin/sales-managers', label: 'Sales Managers', Icon: SalesManagerIcon },
  { to: '/admin/catalog', label: 'Product Catalog', Icon: CatalogIcon },
  { to: '/admin/quote-inbox', label: 'Quote Inbox', Icon: QuoteInboxIcon },
  { to: '/admin/mice-catalog', label: 'MICE Catalog', Icon: MiceCatalogIcon },
  { to: '/admin/neft-verification', label: 'NEFT Verification', Icon: NeftIcon },
  { to: '/admin/transactions', label: 'Transaction Ledger', Icon: TransactionsIcon },
];

export default function AdminLayout() {
  const { user, logout, socketConnected } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen bg-[#eef1ef]">
      <motion.aside
        initial={{ x: -28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 flex h-screen w-72 flex-none flex-col border-r border-line-light bg-white/95 backdrop-blur"
      >
        <div className="flex items-center gap-3 border-b border-line-light px-6 py-6">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-ink text-base font-bold text-white shadow-lg shadow-black/10">
            XO
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-ink">Xclusive Oman</div>
            <div className="text-xs text-muted">Admin Console</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
          {NAV_ITEMS.map(({ to, label, Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link key={to} to={to} className="relative block">
                {active && (
                  <motion.div
                    layoutId="admin-active-nav-pill"
                    className="absolute inset-0 rounded-xl bg-ink shadow-md shadow-black/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span
                  className={`relative z-10 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    active ? 'text-white' : 'text-ink hover:bg-panel'
                  }`}
                >
                  <Icon className="flex-none" />
                  {label}
                </span>
              </Link>
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
