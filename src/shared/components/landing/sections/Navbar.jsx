import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../data.js';
import { PillButton } from '../components/PillButton.jsx';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-t-[3px] border-[#1B1B1B] bg-[#F7F3EA] backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Link to="/" className="flex items-center gap-2">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman by Traveon" className="h-10 w-auto" />
        </Link>

        <nav className="hidden items-center gap-10 text-base text-[#1B1B1B] md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-[#E8B84B]">
              {link.label}
            </a>
          ))}
        </nav>

        <PillButton
          to="/agent"
          variant="solid"
          withArrow={false}
          className="bg-[#E8B84B] px-6 py-2.5 text-sm font-semibold text-[#1B1B1B] hover:bg-[#d9a93a]"
        >
          Sign Up/ Login
        </PillButton>
      </div>
    </header>
  );
}
