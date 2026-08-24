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

export const ACTIVITIES = [
  {
    title: 'Nizwa Heritage Trail',
    description: "The 17th-century fort, Friday goat souq and Oman's former capital, in one guided morning.",
    duration: 'Full Day Tour',
    price: 'AED 145',
    gradient: 'from-[#C98A24] to-[#8A5A20]',
  },
  {
    title: 'Muscat City & Grand Mosque',
    description: 'Grand Mosque, Al Alam Palace and Mutrah Souq — the capital in a single half-day loop.',
    duration: 'Half Day Tour',
    price: 'AED 95',
    gradient: 'from-[#2E5F63] to-[#16343A]',
  },
  {
    title: 'Jebel Akhdar Green Mountain',
    description: 'Rose gardens and terraced orchards 2,000m up, with a 4x4 transfer included.',
    duration: 'Full Day Tour',
    price: 'AED 180',
    gradient: 'from-[#3D6B3F] to-[#1F3B21]',
  },
  {
    title: 'Wadi Shab Adventure',
    description: 'A trek and swim through turquoise pools to the hidden cave waterfall.',
    duration: 'Full Day Tour',
    price: 'AED 165',
    gradient: 'from-[#1F6F8B] to-[#0F3C4C]',
  },
  {
    title: 'Bimmah Sinkhole Visit',
    description: "A short stop for photos and a swim in one of Oman's most photographed landmarks.",
    duration: 'Half Day Tour',
    price: 'AED 85',
    gradient: 'from-[#2E7D6B] to-[#154238]',
  },
  {
    title: 'Mutrah Souq Walking Tour',
    description: 'Frankincense, silver and spice stalls along the old harbour corniche at golden hour.',
    duration: 'Half Day Tour',
    price: 'AED 70',
    gradient: 'from-[#8A4A9C] to-[#4A2653]',
  },
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
