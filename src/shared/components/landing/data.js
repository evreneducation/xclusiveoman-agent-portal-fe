// Placeholder content for the public marketing LandingPage (src/App.jsx "/").
// Every image reference below is the one photo the repo already ships
// (public/oman_pic.jpg — a Muscat coastline shot, used as-is for the hero and
// the "We Operate" banner) or a gradient placeholder (cardGradient, per
// TourCard) standing in for real per-tour photography. Swap both once actual
// marketing assets exist; nothing about the component structure needs to
// change to do that — every image lives in this one file.

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Activities', href: '#activities' },
  { label: 'Tours', href: '#tours' },
  { label: 'Transfers', href: '#transfers' },
];

export const HERO_STATS = [
  { value: '12+ yrs', label: 'Ground Operations in Oman' },
  { value: '40+', label: 'Trade Partners Served Monthly' },
  { value: '24/7', label: 'On-Ground Op Support' },
];

// Signature Tours cards use real photos (reusing what's already in
// /public — see the reference-matching pass on SignatureToursSection.jsx):
// We_Operate_Section.png for the Grand Mosque card, oman_pic.jpg for the two
// Nizwa cards. The reference screenshot itself repeats "Nizwa Heritage
// Trail" for both the 1st and 3rd card (same photo, same copy, same
// badge) — reproduced as-is rather than diversified, since the brief was
// to match the reference exactly, not improve on it.
export const SIGNATURE_TOURS = [
  {
    title: 'Nizwa Heritage Trail',
    description:
      "The 17th-century Nizwa Fort, the Friday goat souq, and the terraced date plantations of Oman's former capital.",
    duration: 'Full Day Tour',
    nights: '4N | 5D',
    image: '/oman_pic.jpg',
  },
  {
    title: 'Muscat City & Grand Mosque',
    description:
      'Sultan Qaboos Grand Mosque, Al Alam Palace, Mutrah Souq and the corniche — the essential half-day introduction to the capital.',
    duration: 'Full Day Tour',
    nights: '4N | 5D',
    image: '/We_Operate_Section.png',
  },
  {
    title: 'Nizwa Heritage Trail',
    description:
      "The 17th-century Nizwa Fort, the Friday goat souq, and the terraced date plantations of Oman's former capital.",
    duration: 'Full Day Tour',
    nights: '4N | 5D',
    image: '/oman_pic.jpg',
  },
];

// Same reference-matching approach as SIGNATURE_TOURS above: the reference
// screenshot for ActivitiesSection repeats the same Nizwa/Muscat/Nizwa
// pattern across both its rows (6 cards from 2 distinct tours, not 6
// distinct ones) — reproduced as-is rather than diversified.
const NIZWA_ACTIVITY = {
  title: 'Nizwa Heritage Trail',
  description:
    "The 17th-century Nizwa Fort, the Friday goat souq, and the terraced date plantations of Oman's former capital.",
  duration: 'Full Day Tour',
  nights: '4N | 5D',
  image: '/oman_pic.jpg',
};
const MUSCAT_ACTIVITY = {
  title: 'Muscat City & Grand Mosque',
  description:
    'Sultan Qaboos Grand Mosque, Al Alam Palace, Mutrah Souq and the corniche — the essential half-day introduction to the capital.',
  duration: 'Full Day Tour',
  nights: '4N | 5D',
  image: '/We_Operate_Section.png',
};
export const ACTIVITIES = [
  NIZWA_ACTIVITY,
  MUSCAT_ACTIVITY,
  NIZWA_ACTIVITY,
  NIZWA_ACTIVITY,
  MUSCAT_ACTIVITY,
  NIZWA_ACTIVITY,
];

export const TRANSFERS = [
  {
    title: 'Airport Transfers',
    description: 'Meet-and-greet at Muscat International, private vehicle direct to any city hotel.',
    duration: 'Point to Point',
    price: 'From AED 45',
    gradient: 'from-[#2E5F63] to-[#16343A]',
  },
  {
    title: 'Intercity Transfers',
    description: 'Private, air-conditioned transfers between Muscat, Nizwa, Salalah and the interior.',
    duration: 'Point to Point',
    price: 'From AED 180',
    gradient: 'from-[#B4552C] to-[#6E3319]',
  },
];

export const FOOTER_LINKS = {
  itineraries: ['Nizwa Heritage Trail', 'Muscat City & Grand Mosque', 'Wahiba Sands Desert Safari', 'Wadi Shab Adventure'],
  partners: ['Sign Up For Trade Access', 'Log In', 'Trade Portal', 'Become a Partner'],
};

export const CONTACT = {
  address: 'CBD, Muscat, Sultanate of Oman',
  phone: '+968 2456 7890',
  email: 'trade@xclusiveoman.com',
};
