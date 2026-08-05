import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../shared/components/ToastProvider.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import AgentApprovals from './pages/AgentApprovals.jsx';
import ProductCatalog from './pages/ProductCatalog.jsx';
import FdPackageEditor from './pages/FdPackageEditor.jsx';
import HotelEditor from './pages/HotelEditor.jsx';
import TourEditor from './pages/TourEditor.jsx';
import MiceCatalog from './pages/MiceCatalog.jsx';
import NeftVerification from './pages/NeftVerification.jsx';
import QuoteInbox from './pages/QuoteInbox.jsx';
import QuoteInboxDetail from './pages/QuoteInboxDetail.jsx';
import RelationshipManagers from './pages/RelationshipManagers.jsx';
import SalesManagers from './pages/SalesManagers.jsx';
import TransactionLedger from './pages/TransactionLedger.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="approvals" element={<AgentApprovals />} />
              <Route path="relationship-managers" element={<RelationshipManagers />} />
              <Route path="sales-managers" element={<SalesManagers />} />
              <Route path="catalog" element={<ProductCatalog />} />
              <Route path="catalog/fd-packages/:id" element={<FdPackageEditor />} />
              <Route path="catalog/hotels/:id" element={<HotelEditor />} />
              <Route path="catalog/tours/:id" element={<TourEditor />} />
              <Route path="mice-catalog" element={<MiceCatalog />} />
              <Route path="quote-inbox" element={<QuoteInbox />} />
              <Route path="quote-inbox/:id" element={<QuoteInboxDetail />} />
              <Route path="neft-verification" element={<NeftVerification />} />
              <Route path="transactions" element={<TransactionLedger />} />
            </Route>
          </Route>
          <Route index element={<Navigate to="approvals" replace />} />
          <Route path="*" element={<Navigate to="approvals" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
