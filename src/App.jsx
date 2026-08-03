import { Route, Routes } from 'react-router-dom';
import AgentApp from './agent/App.jsx';
import AdminApp from './admin/App.jsx';
import Landing from './shared/pages/Landing.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/agent/*" element={<AgentApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
