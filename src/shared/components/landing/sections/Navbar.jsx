import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../data.js';
import { PillButton } from '../components/PillButton.jsx';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E1D3] bg-[#F7F3EA]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman by Traveon" className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[#1B2333] md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-[#C9A24A]">
              {link.label}
            </a>
          ))}
        </nav>

        <PillButton to="/login" variant="solid" withArrow={false} className="px-5 py-2 text-xs">
          Sign Up / Login
        </PillButton>
      </div>
    </header>
  );
}
