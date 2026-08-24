import { ACTIVITIES } from '../data.js';
import { SectionHeading, Accent } from '../components/SectionHeading.jsx';
import { TourCard } from '../components/TourCard.jsx';
import { PillButton } from '../components/PillButton.jsx';

export function ActivitiesSection() {
  return (
    <section id="activities" className="bg-[#F7F3EA] px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <SectionHeading>
          Activities We Can
          <br />
          Build Into Any <Accent>Itinerary</Accent>
        </SectionHeading>

        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#5B6472]">
          Modular experiences your clients can add to any base tour — priced and confirmed alongside your
          itinerary, no separate supplier to chase.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVITIES.map((activity) => (
            <TourCard key={activity.title} {...activity} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <PillButton to="/login" variant="outline">
            See More Activities & Day Tours
          </PillButton>
        </div>
      </div>
    </section>
  );
}
