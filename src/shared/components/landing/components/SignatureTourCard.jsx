// Card used only by SignatureToursSection — built to pixel-match its
// reference screenshot exactly, which is a materially different shape from
// the shared TourCard (real photo instead of a gradient placeholder, a
// single duration pill on the photo instead of two overlaid badges, and a
// divider + duration/nights footer row below the description). Kept as its
// own component rather than reworking TourCard so Activities/Transfers
// (which still use TourCard) are untouched.
import { FiClock } from 'react-icons/fi';

export function SignatureTourCard({ title, description, duration, nights, image, imageAlt }) {
  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_rgba(27,35,51,0.08)]">
      <div className="relative h-56 w-full">
        <img src={image} alt={imageAlt || title} className="h-full w-full object-cover" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1B2333] shadow-sm">
          <FiClock className="text-[#C9A24A]" />
          {duration}
        </span>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-[#1B2333]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5B6472]">{description}</p>

        <div className="mt-5 flex items-center justify-between border-t border-[#EAE4D6] pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5B6472]">
            <FiClock className="text-[#C9A24A]" />
            {duration}
          </span>
          <span className="rounded-full bg-[#E8B84B] px-3 py-1 text-xs font-semibold text-[#1B2333]">{nights}</span>
        </div>
      </div>
    </div>
  );
}
