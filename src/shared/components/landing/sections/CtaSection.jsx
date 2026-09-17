// Dark full-bleed photo divider (Royal Opera House Muscat, at night) followed
// by the "Ready to sell Oman with confidence?" strip. Button style matches
// ArrowPillButton's other landing-page usages (SignatureToursSection,
// ActivitiesSection) — cream pill, gold border, arrow framed in its own arc.
import { ArrowPillButton } from '../components/ArrowPillButton.jsx';

export function CtaSection() {
  return (
    <>
      <div className="relative h-56 w-full overflow-hidden sm:h-72">
        <img src="/cta-section.png" alt="Oman by night" className="h-full w-full object-cover" />
      </div>

      <section className="bg-[#F7F3EA] px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 border-y border-[#E8E1D3] py-10 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-bold text-[#1B2333] sm:text-3xl">
              Ready to sell <span className="font-serif italic text-[#C9A24A]">Oman</span> with confidence?
            </h2>
            <p className="mt-2 text-sm text-[#5B6472]">
              Create a free trade account to access net rates, full itinerary PDFs and our booking portal.
            </p>
          </div>
          <ArrowPillButton href="/agent">Sign Up For Trade Access / Log In</ArrowPillButton>
        </div>
      </section>
    </>
  );
}
