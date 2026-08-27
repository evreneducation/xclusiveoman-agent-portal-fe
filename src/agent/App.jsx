import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AgentLayout from './components/AgentLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ItineraryPrint from './pages/ItineraryPrint.jsx';
import DepartureItineraryPrint from './pages/DepartureItineraryPrint.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Departures from './pages/Departures.jsx';
import DepartureDetail from './pages/DepartureDetail.jsx';
import PackageBuilder from './pages/PackageBuilder.jsx';
import FitRequests from './pages/FitRequests.jsx';
import QuoteDetail from './pages/QuoteDetail.jsx';
import MiceBuilder from './pages/MiceBuilder.jsx';
import MyMiceRequests from './pages/MyMiceRequests.jsx';
import MiceProposalDetail from './pages/MiceProposalDetail.jsx';
import Bookings from './pages/Bookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import Payment from './pages/Payment.jsx';
import Transactions from './pages/Transactions.jsx';
import Notifications from './pages/Notifications.jsx';
import Support from './pages/Support.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  return (
    <AuthProvider>
      {/* Portal-wide brand type + ink: Europa Nuova body/headings on #222222,
          scoped to the agent tree so admin/team keep the default stack. Every
          agent page inherits from here — no per-page font class. */}
      <div className="font-agent text-agent-ink">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        {/* No forgot/reset-password routes — there's no password anywhere
            to forget or reset (email OTP is the sole sign-in mechanism). */}
        {/* Not wrapped in ProtectedRoute/AgentLayout — this is the target the
            backend's Puppeteer PDF service navigates to (see
            itineraryPdf.service.js). Authenticates itself via the short-lived
            pdfToken query param, not a login session, so it can't sit behind
            the normal auth gate. */}
        <Route path="itinerary/:id/print" element={<ItineraryPrint />} />
        {/* Same reasoning as above, for FD departure itineraries — see the
            backend's itineraryPdf.service.js#generateFdItineraryPdf. */}
        <Route path="departures/:id/print" element={<DepartureItineraryPrint />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AgentLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="departures" element={<Departures />} />
            <Route path="departures/:id" element={<DepartureDetail />} />
            <Route path="package-builder" element={<PackageBuilder />} />
            <Route path="package-builder/:id" element={<PackageBuilder />} />
            <Route path="fit-requests" element={<FitRequests />} />
            <Route path="fit-requests/:id" element={<QuoteDetail />} />
            <Route path="mice-builder" element={<MiceBuilder />} />
            <Route path="mice-builder/:id" element={<MiceBuilder />} />
            <Route path="mice-requests" element={<MyMiceRequests />} />
            <Route path="mice-requests/:id" element={<MiceProposalDetail />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:bookingId" element={<BookingDetail />} />
            <Route path="payments/:bookingId" element={<Payment />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
        <Route index element={<Navigate to="/agent/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/agent/dashboard" replace />} />
      </Routes>
      </div>
    </AuthProvider>
  );
}
