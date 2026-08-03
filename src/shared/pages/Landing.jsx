import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#f7d8c6_0,#f6eee9_28%,#edf1f0_58%,#e7e5e0_100%)] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink text-xl font-bold text-white shadow-lg shadow-black/10">
          XO
        </div>
        <h1 className="text-2xl font-bold text-ink">Xclusive Oman</h1>
        <p className="mt-2 text-sm text-muted">B2B &amp; MICE Trade Portal</p>

        <div className="mt-8 space-y-3">
          <Link
            to="/agent/login"
            className="block rounded-md border border-ink bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#171717]"
          >
            Agent Portal
          </Link>
          <Link
            to="/admin/login"
            className="block rounded-md border border-line-light bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition duration-150 hover:border-ink hover:bg-panel"
          >
            Admin Console
          </Link>
        </div>
      </div>
    </div>
  );
}
