import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AgentLayout from './components/AgentLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Departures from './pages/Departures.jsx';
import DepartureDetail from './pages/DepartureDetail.jsx';
import PackageBuilder from './pages/PackageBuilder.jsx';
import FitRequests from './pages/FitRequests.jsx';
import QuoteDetail from './pages/QuoteDetail.jsx';
import Bookings from './pages/Bookings.jsx';
import Payment from './pages/Payment.jsx';
import Transactions from './pages/Transactions.jsx';
import Notifications from './pages/Notifications.jsx';
import Support from './pages/Support.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AgentLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="departures" element={<Departures />} />
            <Route path="departures/:id" element={<DepartureDetail />} />
            <Route path="package-builder" element={<PackageBuilder />} />
            <Route path="package-builder/:id" element={<PackageBuilder />} />
            <Route path="fit-requests" element={<FitRequests />} />
            <Route path="fit-requests/:id" element={<QuoteDetail />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="payments/:bookingId" element={<Payment />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
