import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../shared/components/ToastProvider.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import RequireFeature from './routes/RequireFeature.jsx';
import TeamLayout from './components/TeamLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Catalog from './pages/Catalog.jsx';
import QuotesPricing from './pages/QuotesPricing.jsx';
import QuoteDetail from './pages/QuoteDetail.jsx';
import BookingsDocs from './pages/BookingsDocs.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import FdOperations from './pages/FdOperations.jsx';
import FdOperationDetail from './pages/FdOperationDetail.jsx';
import ApprovedAgents from './pages/ApprovedAgents.jsx';
import SupportTickets from './pages/SupportTickets.jsx';
import SupportTicketDetail from './pages/SupportTicketDetail.jsx';

// /team — Lead Managers (sales_manager) and Relationship Managers
// (relationship_manager) only. Each content route sits behind its own
// RequireFeature(...) matching exactly one Access Feature key
// (config/accessFeatures.js on the backend) — an LM/RM without that
// checkbox is bounced to the dashboard rather than shown a broken page; the
// real gate is still the backend's own requireFeature on the underlying
// admin.* API route (see each page's own comment).
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<TeamLayout />}>
              <Route path="dashboard" element={<Dashboard />} />

              <Route element={<RequireFeature feature="catalog" />}>
                <Route path="catalog" element={<Catalog />} />
              </Route>

              <Route element={<RequireFeature feature="quotesPricing" />}>
                <Route path="quotes-pricing" element={<QuotesPricing />} />
                <Route path="quotes-pricing/:kind/:id" element={<QuoteDetail />} />
              </Route>

              <Route element={<RequireFeature feature="bookingsDocs" />}>
                <Route path="bookings-docs" element={<BookingsDocs />} />
                <Route path="bookings-docs/:id" element={<BookingDetail />} />
              </Route>

              <Route element={<RequireFeature feature="fdOperations" />}>
                <Route path="fd-operations" element={<FdOperations />} />
                <Route path="fd-operations/:departureDateId" element={<FdOperationDetail />} />
              </Route>

              <Route element={<RequireFeature feature="approvedAgents" />}>
                <Route path="approved-agents" element={<ApprovedAgents />} />
              </Route>

              <Route element={<RequireFeature feature="supportTickets" />}>
                <Route path="support-tickets" element={<SupportTickets />} />
                <Route path="support-tickets/:id" element={<SupportTicketDetail />} />
              </Route>
            </Route>
          </Route>
          <Route index element={<Navigate to="/team/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/team/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
