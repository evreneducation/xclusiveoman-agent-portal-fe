import { Link } from 'react-router-dom';
import ComingSoon from '../components/ComingSoon.jsx';
import { Button } from '../components/ui.jsx';

// No GET /package-requests (list) endpoint exists yet on the backend — only
// POST / and GET /:id (single) — so a real history list isn't possible
// without adding a new API, which is out of scope here.
export default function FitRequests() {
  return (
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">My FIT Requests / Quotes</h2>
      <p className="mb-5 text-sm text-agent-muted">
        A history of your submitted Custom FIT requests and priced quotes will appear here.
      </p>
      <ComingSoon />
      <div className="mt-4 text-center">
        <Link to="/agent/package-builder">
          <Button variant="accent">Start a new FIT request</Button>
        </Link>
      </div>
    </div>
  );
}
