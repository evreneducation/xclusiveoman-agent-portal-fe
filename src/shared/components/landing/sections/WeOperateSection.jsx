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

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm leading-relaxed text-[#5B6472] sm:text-base">
            From Muscat's coastline to the mountain forts of the interior, our operations team designs, prices and
            runs every itinerary locally — so what your client books is exactly what they get on the ground. Every
            itinerary on this page is built by our own destination specialists, using vetted local guides, drivers
            and camps. No sub-agents, no guesswork — just a single reliable partner for your Oman programme.
          </p>

          <ul className="mt-8 space-y-5">
            {HERO_STATS.map((stat) => (
              <li key={stat.label} className="flex items-center gap-4">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#C9A24A]" />
                <span>
                  <span className="block text-lg font-bold text-[#1B2333]">{stat.value}</span>
                  <span className="block text-sm text-[#5B6472]">{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Photo collage — three offset crops of the same source photo,
            standing in for the reference's desert/mountain/wadi trio until
            real photography is dropped in. */}
        <div className="grid grid-cols-3 gap-3">
          <img
            src="/oman_pic.jpg"
            alt="Oman desert"
            className="col-span-2 h-40 w-full rounded-2xl object-cover object-left sm:h-48"
          />
          <img
            src="/oman_pic.jpg"
            alt="Oman mountains"
            className="h-40 w-full rounded-2xl object-cover object-right sm:h-48"
          />
          <img
            src="/oman_pic.jpg"
            alt="Oman wadi"
            className="col-span-3 h-32 w-full rounded-2xl object-cover object-bottom sm:h-40"
          />
        </div>
      </div>
    </section>
  );
}
