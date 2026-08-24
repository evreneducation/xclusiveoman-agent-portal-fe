import { TRANSFERS } from '../data.js';
import { SectionHeading, Accent } from '../components/SectionHeading.jsx';
import { TourCard } from '../components/TourCard.jsx';

export function TransfersSection() {
  return (
    <section id="transfers" className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <SectionHeading>
          Transfers
          <br />
          <Accent>Hassle</Accent> Free Transfers
        </SectionHeading>

        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#5B6472]">
          Modular experiences your clients can add to any base tour — priced and confirmed alongside your
          itinerary, no separate supplier to chase.
        </p>

        <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:grid-cols-2">
          {TRANSFERS.map((transfer) => (
            <TourCard key={transfer.title} {...transfer} />
          ))}
        </div>
      </div>
    </section>
  );
}
