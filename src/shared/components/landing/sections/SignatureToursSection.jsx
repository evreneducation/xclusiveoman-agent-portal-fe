// Built to pixel-match its reference screenshot: a bold black title line,
// then a lighter "Ready to Quote" line flanked edge-to-edge by gold rules
// (same technique as WeOperateSection's "We Operate" heading — not the
// shared SectionHeading component, which doesn't have flanking rules), a
// 3-card photo grid (SignatureTourCard), and an outline pill button whose
// arrow sits in its own circle overlapping the pill's right edge
// (ArrowPillButton — also used by ActivitiesSection, same reference style).
import { SIGNATURE_TOURS } from '../data.js';
import { SignatureTourCard } from '../components/SignatureTourCard.jsx';
import { ArrowPillButton } from '../components/ArrowPillButton.jsx';

export function SignatureToursSection() {
  return (
    <section id="tours" className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-4xl font-extrabold leading-tight text-[#1B1B1B] sm:text-5xl">
          Signature Oman Tours,
        </h2>

        <div className="mx-auto mt-3 flex max-w-4xl items-center gap-6 sm:gap-10">
          <span className="h-px flex-1 bg-[#E8B84B]" />
          <p className="whitespace-nowrap text-2xl text-[#1B1B1B] sm:text-3xl">
            Ready to <span className="font-serif italic text-[#E8B84B]">Quote</span>
          </p>
          <span className="h-px flex-1 bg-[#E8B84B]" />
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-[#5B6472]">
          Six of our most-booked routes across Muscat, the interior, the desert and Dhofar. Each can be run as
          private FIT, small group or customised for MICE — full day-by-day itineraries available in the trade
          portal.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNATURE_TOURS.map((tour, i) => (
            <SignatureTourCard key={`${tour.title}-${i}`} {...tour} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <ArrowPillButton>See More Packages</ArrowPillButton>
        </div>
      </div>
    </section>
  );
}
