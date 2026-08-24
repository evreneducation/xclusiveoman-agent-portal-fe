// Dark full-bleed photo divider (matches the reference's night shot of a lit
// building) followed by the "Ready to sell Oman with confidence?" strip.
// oman_pic.jpg stands in for a dedicated night photo — see data.js's note on
// placeholder imagery.
import { PillButton } from '../components/PillButton.jsx';

export function CtaSection() {
  return (
    <>
      <div className="relative h-56 w-full overflow-hidden sm:h-72">
        <img src="/oman_pic.jpg" alt="Oman by night" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0d1b2a]/70" />
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
          <PillButton to="/login" variant="solid" className="whitespace-nowrap">
            Sign Up For Trade Access / Log In
          </PillButton>
        </div>
      </section>
    </>
  );
}
