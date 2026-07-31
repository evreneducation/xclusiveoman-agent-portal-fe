import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import AgentApprovals from './pages/AgentApprovals.jsx';
import ProductCatalog from './pages/ProductCatalog.jsx';
import FdPackageEditor from './pages/FdPackageEditor.jsx';
import NeftVerification from './pages/NeftVerification.jsx';
import TransactionLedger from './pages/TransactionLedger.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/approvals" element={<AgentApprovals />} />
          <Route path="/catalog" element={<ProductCatalog />} />
          <Route path="/catalog/fd-packages/:id" element={<FdPackageEditor />} />
          <Route path="/neft-verification" element={<NeftVerification />} />
          <Route path="/transactions" element={<TransactionLedger />} />
        </Route>
        <Route path="/" element={<Navigate to="/approvals" replace />} />
        <Route path="*" element={<Navigate to="/approvals" replace />} />
      </Routes>
    </AuthProvider>
  );
}
