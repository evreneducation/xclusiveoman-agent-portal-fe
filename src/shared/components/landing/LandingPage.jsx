// Public marketing homepage — rendered at "/" (see src/App.jsx). Portal-
// agnostic like shared/components/LoginModal.jsx (no admin/agent/team
// Tailwind tokens), and purely a composition of the section components
// below: each section owns its own layout/content, this file just orders
// them top to bottom to match the reference design.
//
// Section-by-section breakdown lives in ./sections/*, small pieces reused
// across multiple sections (card, heading, button) live in ./components/*,
// and every placeholder image/copy value lives in ./data.js — swapping in
// real photography or final copy later is a data.js edit, not a rewrite of
// any component here.
import { Navbar } from './sections/Navbar.jsx';
import { Hero } from './sections/Hero.jsx';
import { WeOperateSection } from './sections/WeOperateSection.jsx';
import { SignatureToursSection } from './sections/SignatureToursSection.jsx';
import { ActivitiesSection } from './sections/ActivitiesSection.jsx';
import { TransfersSection } from './sections/TransfersSection.jsx';
import { CtaSection } from './sections/CtaSection.jsx';
import { Footer } from './sections/Footer.jsx';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F3EA]">
      <Navbar />
      <Hero />
      <WeOperateSection />
      <SignatureToursSection />
      <ActivitiesSection />
      <TransfersSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
