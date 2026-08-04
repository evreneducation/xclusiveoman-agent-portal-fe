import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Departures from './pages/Departures.jsx';
import DepartureDetail from './pages/DepartureDetail.jsx';
import PackageBuilder from './pages/PackageBuilder.jsx';
import Payment from './pages/Payment.jsx';
import Transactions from './pages/Transactions.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="departures" element={<Departures />} />
          <Route path="departures/:id" element={<DepartureDetail />} />
          <Route path="package-builder" element={<PackageBuilder />} />
          <Route path="payments/:bookingId" element={<Payment />} />
          <Route path="transactions" element={<Transactions />} />
        </Route>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
