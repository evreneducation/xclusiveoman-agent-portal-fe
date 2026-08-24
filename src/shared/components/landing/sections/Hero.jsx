import { PillButton } from '../components/PillButton.jsx';

export function Hero() {
  return (
    <section
      className="relative flex min-h-[640px] items-center overflow-hidden bg-cover bg-center px-6 py-20 sm:min-h-[720px] sm:px-10"
      style={{ backgroundImage: "url('/HeroImage.png')" }}
    >
      {/* Left-to-right dark scrim — the photo stays fully visible on the
          right, fading to near-black behind the text block on the left. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/0" />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/80 sm:text-sm">
            Licensed Inbound DMC · Sultanate of Oman
          </p>

          <h1 className="mt-6 leading-[0.95]">
            <span className="block text-3xl font-semibold text-white sm:text-4xl">Your ground</span>
            <span className="block text-3xl font-semibold text-white sm:text-4xl">
              <span className="font-serif italic text-[#E8B84B]">Partner</span> for Selling
            </span>
            <span className="mt-2 block font-serif text-7xl italic leading-none text-[#E8B84B] sm:text-8xl lg:text-9xl">
              Oman
            </span>
          </h1>

          <div className="mt-6 h-px w-32 bg-[#E8B84B]/70 sm:w-40" />

          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
            <span className="text-[#E8B84B]">Xclusive Oman</span> by Traveon builds and operates FIT, group and MICE
            itineraries across Muscat, the interior and Dhofar — so travel agents and tour operators can quote with
            confidence and deliver without surprises on the ground.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PillButton to="/login" variant="solid" withArrow={false}>
              Apply for Trade Access
            </PillButton>
            <PillButton
              to="#tours"
              variant="outline"
              withArrow={false}
              className="border-[#E8B84B]/60 text-[#E8B84B] hover:border-[#E8B84B]"
            >
              View Sample Itineraries
            </PillButton>
          </div>
        </div>
      </div>
    </section>
  );
}
