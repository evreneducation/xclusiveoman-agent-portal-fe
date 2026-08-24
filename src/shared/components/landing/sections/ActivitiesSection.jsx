// Built to pixel-match its reference screenshot — same treatment as
// SignatureToursSection: a bold black title line, then a lighter accent
// line flanked edge-to-edge by gold rules (not the shared SectionHeading,
// which has no flanking rules), the same photo card (SignatureTourCard) in
// a 2-row/3-col grid, and the shared ArrowPillButton.
import { ACTIVITIES } from '../data.js';
import { SignatureTourCard } from '../components/SignatureTourCard.jsx';
import { ArrowPillButton } from '../components/ArrowPillButton.jsx';

export function ActivitiesSection() {
  return (
    <section id="activities" className="border-y-[3px] border-[#E8B84B] bg-[#F7F3EA] px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-4xl font-extrabold leading-tight text-[#1B1B1B] sm:text-5xl">
          Activities We Can
        </h2>

        <div className="mx-auto mt-3 flex max-w-4xl items-center gap-6 sm:gap-10">
          <span className="h-px flex-1 bg-[#E8B84B]" />
          <p className="whitespace-nowrap text-2xl text-[#1B1B1B] sm:text-3xl">
            Build Into Any <span className="font-serif italic text-[#E8B84B]">Itinerary</span>
          </p>
          <span className="h-px flex-1 bg-[#E8B84B]" />
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-[#5B6472]">
          Modular experiences your clients can add to any base tour — priced and confirmed alongside your
          itinerary, no separate supplier to chase.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVITIES.map((activity, i) => (
            <SignatureTourCard key={`${activity.title}-${i}`} {...activity} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <ArrowPillButton>See More Activities &amp; Day Tours</ArrowPillButton>
        </div>
      </div>
    </section>
  );
}
