import { SIGNATURE_TOURS } from '../data.js';
import { SectionHeading, Accent } from '../components/SectionHeading.jsx';
import { TourCard } from '../components/TourCard.jsx';
import { PillButton } from '../components/PillButton.jsx';

export function SignatureToursSection() {
  return (
    <section id="tours" className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <SectionHeading>
          Signature Oman Tours,
          <br />
          Ready to <Accent>Quote</Accent>
        </SectionHeading>

        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#5B6472]">
          Six of our most-booked routes across Muscat, the interior, the desert and Dhofar. Each can be run as
          private FIT, small group or customised for MICE — full day-by-day itineraries available in the trade
          portal.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNATURE_TOURS.map((tour) => (
            <TourCard key={tour.title} {...tour} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <PillButton to="/login" variant="outline">
            See More Packages
          </PillButton>
        </div>
      </div>
    </section>
  );
}
