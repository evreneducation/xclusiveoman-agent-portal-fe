// Reusable card for the Signature Tours, Activities and Transfers grids —
// same shape everywhere in the reference design (image, duration pill,
// price badge, title, description). The media block is a gradient
// placeholder (see data.js) standing in for real per-tour photography.
import { FiClock } from 'react-icons/fi';

export function TourCard({ title, description, duration, price, gradient }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E1D3] bg-white shadow-sm transition-shadow duration-150 hover:shadow-md">
      <div className={`relative h-40 w-full bg-gradient-to-br ${gradient}`}>
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#1B2333]">
          <FiClock className="text-[#C9A24A]" />
          {duration}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-[#C9A24A] px-3 py-1 text-xs font-semibold text-[#1B2333]">
          {price}
        </span>
      </div>
      <div className="space-y-2 p-5">
        <h3 className="text-base font-semibold text-[#1B2333]">{title}</h3>
        <p className="text-sm leading-relaxed text-[#5B6472]">{description}</p>
      </div>
    </div>
  );
}
