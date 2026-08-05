// Small inline stroke icons for the sidebar nav — kept dependency-free.

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function ApprovalsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function CatalogIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function NeftIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 21h18" />
      <path d="M4 21V10" />
      <path d="M20 21V10" />
      <path d="M8 21V10" />
      <path d="M16 21V10" />
      <path d="M12 21V10" />
      <path d="M2 10l10-6 10 6" />
    </svg>
  );
}

export function TransactionsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

export function MiceCatalogIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 11h.01" />
      <path d="M15 11h.01" />
    </svg>
  );
}

export function RelationshipManagerIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M6 16c0-1.66 1.34-3 3-3s3 1.34 3 3" />
      <path d="M14 9h5" />
      <path d="M14 13h5" />
    </svg>
  );
}

export function SalesManagerIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8 17c0-1.93 1.79-3.5 4-3.5s4 1.57 4 3.5" />
      <path d="M9 3v2" />
      <path d="M15 3v2" />
    </svg>
  );
}

export function QuoteInboxIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function DashboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="12" width="8" height="9" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
    </svg>
  );
}

export function TeamIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M17 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function BookingsDocsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

export function FinanceIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
      <circle cx="17" cy="14.5" r="1.5" />
    </svg>
  );
}

export function MarketingIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
      <path d="M19 5a8 8 0 0 1 0 14" />
    </svg>
  );
}

export function AnalyticsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4" />
      <path d="M12 16V8" />
      <path d="M17 16v-7" />
    </svg>
  );
}

export function SupportIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5.5 5.5 3.6 3.6" />
      <path d="m14.9 14.9 3.6 3.6" />
      <path d="m18.5 5.5-3.6 3.6" />
      <path d="m9.1 14.9-3.6 3.6" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
