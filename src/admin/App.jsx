import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../shared/components/ToastProvider.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import SuperAdminRoute from './routes/SuperAdminRoute.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AgentApprovals from './pages/AgentApprovals.jsx';
import ProductCatalog from './pages/ProductCatalog.jsx';
import FdPackageEditor from './pages/FdPackageEditor.jsx';
import HotelEditor from './pages/HotelEditor.jsx';
import TourEditor from './pages/TourEditor.jsx';
import ActivityEditor from './pages/ActivityEditor.jsx';
import TransferEditor from './pages/TransferEditor.jsx';
import MiceCatalog from './pages/MiceCatalog.jsx';
import NeftVerification from './pages/NeftVerification.jsx';
import QuoteInbox from './pages/QuoteInbox.jsx';
import QuoteInboxDetail from './pages/QuoteInboxDetail.jsx';
import MiceRequests from './pages/MiceRequests.jsx';
import MiceRequestDetail from './pages/MiceRequestDetail.jsx';
import Employees from './pages/Employees.jsx';
import TransactionLedger from './pages/TransactionLedger.jsx';
import BookingsDocuments from './pages/BookingsDocuments.jsx';
import BookingDetailAdmin from './pages/BookingDetailAdmin.jsx';
import Marketing from './pages/Marketing.jsx';
import OperationsList from './pages/OperationsList.jsx';
import OperationsDetail from './pages/OperationsDetail.jsx';
import Analytics from './pages/Analytics.jsx';
import Support from './pages/Support.jsx';
import SupportTicketDetail from './pages/SupportTicketDetail.jsx';
import ContentManagement from './pages/ContentManagement.jsx';
import CmsPageEditor from './pages/CmsPageEditor.jsx';
import ReviewsManagement from './pages/ReviewsManagement.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="approvals" element={<AgentApprovals />} />
              <Route path="employees" element={<Employees />} />
              {/* Replaced by the single Employees page's tabs — kept as
                  redirects so any old bookmarks/links still land somewhere
                  useful instead of 404ing. */}
              <Route path="relationship-managers" element={<Navigate to="/admin/employees?tab=rm" replace />} />
              <Route path="sales-managers" element={<Navigate to="/admin/employees?tab=salesManager" replace />} />
              <Route path="catalog" element={<ProductCatalog />} />
              <Route path="catalog/fd-packages/:id" element={<FdPackageEditor />} />
              <Route path="catalog/hotels/:id" element={<HotelEditor />} />
              <Route path="catalog/tours/:id" element={<TourEditor />} />
              <Route path="catalog/activities/:id" element={<ActivityEditor />} />
              <Route path="catalog/transfers/:id" element={<TransferEditor />} />
              <Route path="mice-catalog" element={<MiceCatalog />} />
              <Route path="quote-inbox" element={<QuoteInbox />} />
              <Route path="quote-inbox/:id" element={<QuoteInboxDetail />} />
              <Route path="mice-requests" element={<MiceRequests />} />
              <Route path="mice-requests/:id" element={<MiceRequestDetail />} />
              <Route path="neft-verification" element={<NeftVerification />} />
              <Route path="transactions" element={<TransactionLedger />} />
              <Route path="bookings-documents" element={<BookingsDocuments />} />
              <Route path="bookings/:bookingId" element={<BookingDetailAdmin />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="operations" element={<OperationsList />} />
              <Route path="operations/:departureDateId" element={<OperationsDetail />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="support" element={<Support />} />
              <Route path="support/:ticketId" element={<SupportTicketDetail />} />
              {/* Admin Reviews Management (Task 21 — Item 33) — ops_admin/
                  super_admin gated on the backend (reviewsAdmin.routes.js);
                  no extra frontend route guard here, same as FD Operations
                  and Bookings & Documents (also ops_admin+-only on the
                  backend) — the backend 403 is the real enforcement, this
                  page's own error state handles an unauthorized fetch. */}
              <Route path="reviews" element={<ReviewsManagement />} />
              {/* Content & CMS Management (Task 21 — Item 34) — super_admin
                  only; SuperAdminRoute redirects any other authenticated
                  staff role to the dashboard before these ever render. */}
              <Route element={<SuperAdminRoute />}>
                <Route path="cms" element={<ContentManagement />} />
                <Route path="cms/pages/:id" element={<CmsPageEditor />} />
              </Route>
            </Route>
          </Route>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
