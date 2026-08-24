// "We Operate Oman, You sell it." — heading with gold rules flanking the
// second line, then a full-width photo banner (We_Operate_Section.png) with
// a wavy cream-colored top edge cut into it, followed by a two-column strip:
// intro copy + stats on the left, a stacked photo collage on the right.
import { HERO_STATS } from '../data.js';

export function WeOperateSection() {
  return (
    <section className="bg-[#F7F3EA]">
      <div className="mx-auto max-w-4xl px-6 pt-16 text-center sm:px-10">
        <h2 className="text-3xl font-normal text-[#1B1B1B] sm:text-4xl">We Operate</h2>

        <div className="mt-4 flex items-center justify-center gap-5 sm:gap-8">
          <span className="h-px flex-1 bg-[#E8B84B]" />
          <p className="whitespace-nowrap text-3xl font-bold sm:text-4xl">
            <span className="text-[#E8B84B]">Oman,</span> <span className="text-[#1B1B1B]">You sell it.</span>
          </p>
          <span className="h-px flex-1 bg-[#E8B84B]" />
        </div>
      </div>

      {/* Wavy-topped banner photo — an SVG wave in the page's cream tone
          sits over the top edge of the image to fake the curved cut-in from
          the reference design. */}
      <div className="relative mt-10 h-72 w-full overflow-hidden sm:h-[420px]">
        <svg
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-0 z-10 h-20 w-full text-[#F7F3EA] sm:h-32"
        >
          <path
            fill="currentColor"
            d="M0,55 C120,20 260,150 460,140 C640,131 700,30 920,25 C1100,21 1280,95 1440,55 L1440,0 L0,0 Z"
          />
        </svg>
        <img
          src="/We_Operate_Section.png"
          alt="Sultan Qaboos Grand Mosque, Muscat"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:px-10 md:grid-cols-2 md:items-start md:gap-16">
        <div>
          <span className="block h-px w-52 bg-[#E8B84B]" />

          <p className="mt-6 text-base leading-relaxed text-[#1B1B1B]">
            From Muscat's coastline to the mountain forts of the interior, our operations team designs, prices and
            runs every itinerary locally — so what your client books is exactly what they get.
          </p>
          <p className="mt-5 text-base leading-relaxed text-[#1B1B1B]">
            Every itinerary on this page is built by our own destination specialists, using vetted local guides,
            drivers and camps. No sub-agents, no guesswork — just a single reliable partner for your Oman programme.
          </p>

          <span className="mt-6 block h-px w-52 bg-[#E8B84B]" />

          <ul className="mt-10 space-y-8">
            {HERO_STATS.map((stat) => (
              <li key={stat.label} className="flex items-start gap-4">
                <span className="mt-1 h-7 w-7 flex-shrink-0 rounded-full border-2 border-[#E8B84B]" />
                <span>
                  <span className="block text-3xl font-bold leading-none text-[#1B1B1B]">{stat.value}</span>
                  <span className="mt-2 block text-sm text-[#6B7280]">{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Photo collage — three real Oman shots (desert caravan, mountain
            fort at sunset, turquoise cove) stacked with hairline gaps inside
            one clipped container. The reference's left edge isn't a simple
            corner radius — it's one continuous organic wave that swings in
            and out along the *entire* height of the stack (a "waist" bulges
            back out around the 2nd image), which plain CSS border-radius
            can't do (it only bends at the box's actual corners). Traced as
            a single cubic-bezier clip-path instead, in objectBoundingBox
            units (0–1) so it scales with the container at any breakpoint. */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <clipPath id="operate-collage-blob" clipPathUnits="objectBoundingBox">
              <path
                d="M1,0 L1,1 L0.2,1
                   C0.17,0.9633 0.0133,0.8633 0.02,0.78
                   C0.0267,0.6967 0.24,0.5933 0.24,0.5
                   C0.24,0.4067 0.0317,0.3033 0.02,0.22
                   C0.0083,0.1367 0.145,0.0367 0.17,0
                   Z"
              />
            </clipPath>
          </defs>
        </svg>
        <div className="[clip-path:url(#operate-collage-blob)]">
          <div className="flex flex-col gap-1.5">
            <img src="/travel_1.png" alt="Camel caravan in the Sharqiya Sands" className="h-56 w-full object-cover sm:h-72" />
            <img src="/travel_2.png" alt="Mountain fort at sunset in the Hajar Mountains" className="h-56 w-full object-cover sm:h-72" />
            <img src="/travel_3.png" alt="Turquoise cove with boats on the Musandam coast" className="h-56 w-full object-cover sm:h-72" />
          </div>
        </div>
      </div>
    </section>
  );
}
