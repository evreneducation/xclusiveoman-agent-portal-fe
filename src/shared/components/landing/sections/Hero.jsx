import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-cover bg-center px-6 pb-14 pt-8 sm:px-10 sm:pb-16 sm:pt-8"
      style={{ backgroundImage: "url('/HeroImage.png')" }}
    >
      {/* Left-to-right scrim — a tint, not a block: the photo stays faintly
          visible through it on the left (sky/mountain silhouette still
          readable behind the text), and is fully clear by the right side. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

      {/* No min-h/vertical-centering here on purpose — the section's height
          is just its content's natural flow (pt above, pb below), pixel-
          matched against the reference screenshot's own gaps rather than
          forced to fill a fixed box. */}
      <div className="relative w-full">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-white/80 sm:text-base">Licensed Inbound DMC · Sultanate of Oman</p>

          <h1 className="mt-24 leading-[0.95] sm:mt-36">
            <span className="block text-4xl font-semibold text-white sm:text-5xl">Your ground</span>
            <span className="block text-4xl font-semibold text-white sm:text-5xl">
              <span className="font-serif italic text-[#E8B84B]">Partner</span> for Selling
            </span>
            {/* "Oman" and the divider share one inline-block wrapper so the
                line's w-full tracks the word's actual rendered width at
                every breakpoint, instead of a fixed guess. */}
            <span className="mt-8 inline-block sm:mt-11">
              <span className="block font-serif text-8xl italic leading-none text-[#E8B84B] sm:text-9xl lg:text-[10rem]">
                Oman
              </span>
              <span className="mt-7 block h-px w-full bg-[#E8B84B]/70 sm:mt-9" />
            </span>
          </h1>

          <p className="mt-8 max-w-lg text-base leading-relaxed text-white/85 sm:mt-10 sm:text-lg">
            <span className="text-[#E8B84B]">Xclusive Oman</span> by Traveon builds and operates FIT, group and MICE
            itineraries across Muscat, the interior and Dhofar — so travel agents and tour operators can quote with
            confidence and deliver without surprises on the ground.
          </p>

          {/* Two independent full pills, overlapping — not one flat-seam
              shape: the gold pill keeps its own rounded caps on both ends
              and sits in front (z-10), the dark pill sits behind it with a
              negative left margin pulling it under the gold pill, and extra
              left padding so its own text clears the overlap. Below `sm`
              there isn't room for both side by side (the dark pill's text
              was clipping off the right edge of narrow viewports), so they
              stack instead and the overlap only kicks in at `sm:`. */}
          <div className="mt-10 flex flex-col items-start gap-3 text-sm font-semibold sm:mt-16 sm:flex-row sm:items-center sm:gap-0 sm:text-base">
            <Link
              to="/login"
              className="relative z-10 whitespace-nowrap rounded-full bg-[#E8B84B] px-6 py-4 text-[#1B2333] transition-colors hover:bg-[#d9a93a] sm:px-8 sm:py-6"
            >
              Apply for Trade Access
            </Link>
            <Link
              to="#tours"
              className="whitespace-nowrap rounded-full bg-black/45 px-6 py-4 text-[#E8B84B] backdrop-blur-sm transition-colors hover:bg-black/60 sm:-ml-7 sm:py-6 sm:pl-12 sm:pr-8"
            >
              View Sample Itineraries
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
