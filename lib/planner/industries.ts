/**
 * Industry templates: the starting architecture for each kind of site.
 *
 * These are opinions, written down so they can be argued with in a pull
 * request. Each page lists its sections between the nav and the footer; the
 * planner adds those two. Priorities decide what survives at each site scale:
 * a "small" site keeps core pages, "medium" adds recommended, "large" adds all.
 */

import type {
  FeatureId,
  GoalId,
  IndustryId,
  IndustryTemplate,
  SectionKind,
  SiteScale,
} from "./types";

export const INDUSTRIES: IndustryTemplate[] = [
  {
    id: "restaurant",
    name: "Restaurant & café",
    nameZh: "餐飲",
    summary: "Get hungry people from a search result to a booked table or an order in under a minute.",
    audiences: ["Locals deciding where to eat tonight", "Visitors searching nearby", "People planning a group event"],
    goals: ["bookings", "awareness", "sales"],
    suggestedFeatures: ["booking", "multilingual"],
    styleTags: ["warm", "photographic", "editorial"],
    kpis: ["Reservations per week", "Clicks on directions and phone", "Menu page views on mobile"],
    tips: [
      "Opening hours, address and phone belong above the fold on mobile; most visits are on a phone, near the place.",
      "Publish the menu as HTML, not a PDF, so it is readable on a phone and indexable by search engines.",
      "Keep LocalBusiness/Restaurant structured data in sync with your map listing.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Appetite and the next step: book, order or visit.", priority: "core", sections: ["hero", "split", "gallery", "testimonials", "map", "cta"] },
      { slug: "menu", title: "Menu", purpose: "Readable, current menu with prices and dietary marks.", priority: "core", sections: ["hero", "menu", "cta"] },
      { slug: "reservations", title: "Reservations", purpose: "Book a table in as few taps as possible.", priority: "core", sections: ["booking", "faq"] },
      { slug: "about", title: "Our story", purpose: "The people and sourcing behind the food.", priority: "recommended", sections: ["hero", "split", "team", "gallery"] },
      { slug: "private-events", title: "Private events", purpose: "Capture group and catering enquiries.", priority: "recommended", sections: ["hero", "features", "gallery", "form"] },
      { slug: "visit", title: "Visit us", purpose: "Address, hours, parking and accessibility.", priority: "recommended", sections: ["map", "list", "faq"] },
      { slug: "gift-cards", title: "Gift cards", purpose: "Extra revenue outside opening hours.", priority: "optional", sections: ["hero", "product-grid", "faq"] },
    ],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    nameZh: "電商",
    summary: "Turn browsing into checkout with fast product discovery and a frictionless cart.",
    audiences: ["Returning customers", "First-time visitors from ads or social", "Gift buyers"],
    goals: ["sales", "signups", "awareness"],
    suggestedFeatures: ["shop", "search", "newsletter", "membership"],
    styleTags: ["clean", "photographic", "bold"],
    kpis: ["Conversion rate", "Average order value", "Cart abandonment rate", "Returning customer rate"],
    tips: [
      "Product photography is the design. Plan consistent crops and backgrounds before the layout.",
      "Show shipping cost and delivery time on the product page, not first at checkout.",
      "Collection pages need filters that match how customers think, not how stock is organised.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Route visitors into collections and best sellers.", priority: "core", sections: ["hero", "product-grid", "split", "testimonials", "newsletter"] },
      { slug: "shop", title: "Shop all", purpose: "Browse and filter the full catalogue.", priority: "core", sections: ["search", "product-grid"] },
      { slug: "product", title: "Product detail", purpose: "Answer every buying question and add to cart.", priority: "core", parent: "shop", sections: ["product-detail", "features", "testimonials", "product-grid"] },
      { slug: "cart", title: "Cart & checkout", purpose: "Finish the purchase without surprises.", priority: "core", sections: ["cart"] },
      { slug: "collections", title: "Collections", purpose: "Curated entry points by use, season or category.", priority: "recommended", sections: ["hero", "product-grid"] },
      { slug: "about", title: "About the brand", purpose: "Why buy from you rather than a marketplace.", priority: "recommended", sections: ["hero", "split", "stats", "team"] },
      { slug: "help", title: "Shipping & returns", purpose: "Remove risk from the purchase decision.", priority: "recommended", sections: ["faq", "form"] },
      { slug: "account", title: "Account", purpose: "Orders, addresses and reorders for returning customers.", priority: "optional", sections: ["form", "list"] },
    ],
  },
  {
    id: "saas",
    name: "SaaS & software",
    nameZh: "SaaS 軟體",
    summary: "Explain the product fast, prove it works, and get a trial or demo started.",
    audiences: ["Evaluators comparing tools", "Technical buyers", "Existing users looking for docs"],
    goals: ["signups", "leads", "awareness"],
    suggestedFeatures: ["blog", "newsletter", "live-chat"],
    styleTags: ["minimal", "technical", "gradient"],
    kpis: ["Trial or demo sign-ups", "Pricing page to sign-up rate", "Activation within 7 days"],
    tips: [
      "Lead with the outcome the product creates, then show the product itself. Real UI beats illustrations.",
      "Pricing is usually the second most visited page; make plans comparable at a glance.",
      "Put social proof next to the decision it supports: logos near the hero, case studies near pricing.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Value proposition, proof and a sign-up path.", priority: "core", sections: ["hero", "logos", "features", "split", "testimonials", "pricing", "cta"] },
      { slug: "features", title: "Product", purpose: "Show how the product works, feature by feature.", priority: "core", sections: ["hero", "split", "split", "features", "cta"] },
      { slug: "pricing", title: "Pricing", purpose: "Choose a plan with confidence.", priority: "core", sections: ["pricing", "faq", "cta"] },
      { slug: "customers", title: "Customers", purpose: "Case studies that match the buyer's situation.", priority: "recommended", sections: ["hero", "logos", "list", "testimonials"] },
      { slug: "integrations", title: "Integrations", purpose: "Answer 'does it work with what we already use?'.", priority: "recommended", sections: ["search", "gallery", "cta"] },
      { slug: "docs", title: "Docs", purpose: "Self-serve answers for users and evaluators.", priority: "recommended", sections: ["search", "list"] },
      { slug: "changelog", title: "Changelog", purpose: "Show the product is alive.", priority: "optional", sections: ["timeline"] },
      { slug: "security", title: "Security", purpose: "Unblock procurement reviews.", priority: "optional", sections: ["hero", "features", "faq"] },
    ],
  },
  {
    id: "corporate",
    name: "Corporate & B2B services",
    nameZh: "企業形象",
    summary: "Build credibility with decision makers and route them to the right contact.",
    audiences: ["Prospective clients", "Partners and investors", "Job seekers"],
    goals: ["leads", "awareness", "recruitment"],
    suggestedFeatures: ["blog", "multilingual"],
    styleTags: ["corporate", "clean", "editorial"],
    kpis: ["Qualified enquiries", "Case study views", "Time on service pages"],
    tips: [
      "Write service pages around client problems, not internal department names.",
      "Case studies with numbers do more for credibility than a mission statement.",
      "Make the contact path obvious from every page; B2B visitors rarely enter through the home page.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Who you serve, what you solve, and proof.", priority: "core", sections: ["hero", "logos", "features", "stats", "testimonials", "cta"] },
      { slug: "services", title: "Services", purpose: "One clear page per service line.", priority: "core", sections: ["hero", "features", "split", "cta"] },
      { slug: "case-studies", title: "Case studies", purpose: "Evidence of results.", priority: "core", sections: ["list", "testimonials"] },
      { slug: "about", title: "About", purpose: "History, leadership and values.", priority: "core", sections: ["hero", "split", "timeline", "team"] },
      { slug: "contact", title: "Contact", purpose: "Route enquiries to the right team.", priority: "core", sections: ["form", "map"] },
      { slug: "insights", title: "Insights", purpose: "Thought leadership that ranks and gets shared.", priority: "recommended", sections: ["list", "newsletter"] },
      { slug: "careers", title: "Careers", purpose: "Recruit people who fit.", priority: "optional", sections: ["hero", "features", "list", "cta"] },
      { slug: "investors", title: "Investors", purpose: "Reports and announcements for shareholders.", priority: "optional", sections: ["stats", "list"] },
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio & studio",
    nameZh: "作品集",
    summary: "Let the work speak, then make it easy to start a conversation.",
    audiences: ["Potential clients", "Recruiters and art directors", "Peers"],
    goals: ["leads", "awareness"],
    suggestedFeatures: ["blog"],
    styleTags: ["experimental", "minimal", "typographic", "dark"],
    kpis: ["Project page views", "Enquiries", "Average projects viewed per visit"],
    tips: [
      "Curate hard: six strong projects beat twenty average ones.",
      "Each case study should state the problem, your role and the result, not just show images.",
      "Bold motion is welcome here, but keep project images loading fast.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Selected work and a clear point of view.", priority: "core", sections: ["hero", "gallery", "logos", "cta"] },
      { slug: "work", title: "Work", purpose: "Browse all projects.", priority: "core", sections: ["gallery"] },
      { slug: "project", title: "Project detail", purpose: "Tell the story of one project.", priority: "core", parent: "work", sections: ["hero", "article", "gallery", "stats", "cta"] },
      { slug: "about", title: "About", purpose: "Who you are and how you work.", priority: "core", sections: ["split", "timeline", "logos"] },
      { slug: "contact", title: "Contact", purpose: "Start a project conversation.", priority: "core", sections: ["form"] },
      { slug: "journal", title: "Journal", purpose: "Process notes and experiments.", priority: "optional", sections: ["list"] },
    ],
  },
  {
    id: "healthcare",
    name: "Healthcare & clinic",
    nameZh: "醫療診所",
    summary: "Reassure patients and make booking an appointment simple and accessible.",
    audiences: ["New patients searching nearby", "Existing patients", "Caregivers booking for family"],
    goals: ["bookings", "leads", "awareness"],
    suggestedFeatures: ["booking", "multilingual", "search"],
    styleTags: ["calm", "clean", "trustworthy"],
    kpis: ["Online appointments", "Calls from the site", "Service page views"],
    tips: [
      "Accessibility is not optional here: large tap targets, strong contrast, plain language.",
      "Show practitioners' faces and credentials; trust is the conversion driver.",
      "Check what your local health-advertising regulations allow before writing claims.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Services, trust signals and booking.", priority: "core", sections: ["hero", "features", "team", "testimonials", "map", "cta"] },
      { slug: "services", title: "Services & treatments", purpose: "What is treated and how.", priority: "core", sections: ["hero", "list", "faq", "cta"] },
      { slug: "doctors", title: "Our doctors", purpose: "Credentials and specialities.", priority: "core", sections: ["team"] },
      { slug: "book", title: "Book an appointment", purpose: "Choose a service, practitioner and time.", priority: "core", sections: ["booking", "faq"] },
      { slug: "patient-info", title: "Patient information", purpose: "Fees, insurance, preparation and aftercare.", priority: "recommended", sections: ["faq", "list"] },
      { slug: "contact", title: "Contact & location", purpose: "Directions, hours and phone.", priority: "recommended", sections: ["map", "form"] },
      { slug: "health-articles", title: "Health articles", purpose: "Answer common questions; supports search visibility.", priority: "optional", sections: ["list", "newsletter"] },
    ],
  },
  {
    id: "education",
    name: "Education & courses",
    nameZh: "教育",
    summary: "Help learners pick the right programme and enrol with confidence.",
    audiences: ["Prospective students", "Parents", "Current students"],
    goals: ["signups", "leads", "awareness"],
    suggestedFeatures: ["search", "membership", "newsletter", "blog"],
    styleTags: ["friendly", "clean", "illustrative"],
    kpis: ["Enrolments or applications", "Course page to enrol rate", "Brochure downloads"],
    tips: [
      "Organise courses by the learner's goal or level, not by faculty structure.",
      "Outcomes (jobs, portfolios, grades) persuade more than syllabus detail.",
      "Fees, schedule and entry requirements are the top questions; never hide them.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Find a course and see outcomes.", priority: "core", sections: ["hero", "search", "product-grid", "stats", "testimonials", "cta"] },
      { slug: "courses", title: "Courses", purpose: "Browse and filter programmes.", priority: "core", sections: ["search", "product-grid"] },
      { slug: "course", title: "Course detail", purpose: "Curriculum, schedule, fees and enrol.", priority: "core", parent: "courses", sections: ["hero", "timeline", "team", "pricing", "faq", "cta"] },
      { slug: "admissions", title: "Admissions", purpose: "How to apply and what it costs.", priority: "core", sections: ["timeline", "faq", "form"] },
      { slug: "teachers", title: "Teachers", purpose: "Who teaches and their background.", priority: "recommended", sections: ["team"] },
      { slug: "outcomes", title: "Student stories", purpose: "Proof the programme works.", priority: "recommended", sections: ["stats", "testimonials", "gallery"] },
      { slug: "student-portal", title: "Student portal", purpose: "Sign-in for current students.", priority: "optional", sections: ["form"] },
    ],
  },
  {
    id: "real-estate",
    name: "Real estate",
    nameZh: "房地產",
    summary: "Make listings searchable and turn interest into viewings.",
    audiences: ["Buyers and renters", "Sellers and landlords", "Investors"],
    goals: ["leads", "bookings"],
    suggestedFeatures: ["search", "booking", "newsletter"],
    styleTags: ["photographic", "premium", "clean"],
    kpis: ["Viewing requests", "Saved searches", "Valuation requests"],
    tips: [
      "Search and filtering are the product. Price, area, rooms and location must be fast to set on a phone.",
      "Floor plans and a map on every listing reduce wasted viewings.",
      "A separate path for sellers (valuation) is often the most valuable lead.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "Start a search or request a valuation.", priority: "core", sections: ["hero", "search", "product-grid", "split", "testimonials", "cta"] },
      { slug: "listings", title: "Listings", purpose: "Search results with map and filters.", priority: "core", sections: ["search", "product-grid", "map"] },
      { slug: "listing", title: "Property detail", purpose: "Photos, plans, location and book a viewing.", priority: "core", parent: "listings", sections: ["gallery", "product-detail", "map", "booking"] },
      { slug: "sell", title: "Sell with us", purpose: "Valuation requests from owners.", priority: "recommended", sections: ["hero", "stats", "features", "form"] },
      { slug: "agents", title: "Our agents", purpose: "Local expertise and contact details.", priority: "recommended", sections: ["team"] },
      { slug: "area-guides", title: "Area guides", purpose: "Neighbourhood content for search and trust.", priority: "optional", sections: ["list", "map"] },
      { slug: "contact", title: "Contact", purpose: "General enquiries.", priority: "recommended", sections: ["form", "map"] },
    ],
  },
  {
    id: "nonprofit",
    name: "Non-profit & NGO",
    nameZh: "非營利組織",
    summary: "Make the cause tangible and turn empathy into donations or volunteering.",
    audiences: ["Potential donors", "Volunteers", "Partners and press"],
    goals: ["donations", "awareness", "signups"],
    suggestedFeatures: ["newsletter", "blog", "multilingual"],
    styleTags: ["human", "photographic", "bold"],
    kpis: ["Donations and recurring donors", "Volunteer sign-ups", "Newsletter sign-ups"],
    tips: [
      "Show where money goes, with concrete numbers per donation level.",
      "One donation button style, everywhere, never more than one click away.",
      "Real stories of individual people outperform statistics alone.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "The cause, the impact and the donate button.", priority: "core", sections: ["hero", "stats", "split", "testimonials", "cta", "newsletter"] },
      { slug: "our-work", title: "Our work", purpose: "Programmes and where they operate.", priority: "core", sections: ["hero", "features", "map", "gallery"] },
      { slug: "impact", title: "Impact", purpose: "Results, reports and transparency.", priority: "core", sections: ["stats", "timeline", "list"] },
      { slug: "get-involved", title: "Get involved", purpose: "Volunteer, fundraise, partner.", priority: "recommended", sections: ["features", "form"] },
      { slug: "stories", title: "Stories", purpose: "Human stories from the field.", priority: "recommended", sections: ["list"] },
      { slug: "about", title: "About", purpose: "Mission, team and governance.", priority: "recommended", sections: ["split", "team", "list"] },
    ],
  },
  {
    id: "events",
    name: "Events & conferences",
    nameZh: "活動展覽",
    summary: "Sell the experience, show the line-up and sell tickets before the date passes.",
    audiences: ["Prospective attendees", "Speakers and sponsors", "Press"],
    goals: ["sales", "signups", "awareness"],
    suggestedFeatures: ["newsletter", "multilingual"],
    styleTags: ["bold", "experimental", "colorful"],
    kpis: ["Tickets sold", "Ticket page conversion rate", "Sponsor enquiries"],
    tips: [
      "Date, location and the ticket button belong in the first screen, always.",
      "The site has phases (announce, line-up, sell, live, recap); plan content for each.",
      "Speaker pages are shared by the speakers themselves; give each one a good preview image.",
    ],
    pages: [
      { slug: "home", title: "Home", purpose: "What, when, where, who, and buy a ticket.", priority: "core", sections: ["hero", "stats", "team", "timeline", "pricing", "logos", "cta"] },
      { slug: "speakers", title: "Speakers", purpose: "The line-up that sells tickets.", priority: "core", sections: ["team"] },
      { slug: "schedule", title: "Schedule", purpose: "Plan the day.", priority: "core", sections: ["timeline"] },
      { slug: "tickets", title: "Tickets", purpose: "Choose a ticket and pay.", priority: "core", sections: ["pricing", "faq"] },
      { slug: "venue", title: "Venue & travel", purpose: "Getting there and staying nearby.", priority: "recommended", sections: ["map", "list", "faq"] },
      { slug: "sponsors", title: "Sponsors", purpose: "Thank sponsors and attract new ones.", priority: "recommended", sections: ["logos", "pricing", "form"] },
      { slug: "past-events", title: "Past editions", purpose: "Photos and talks from previous years.", priority: "optional", sections: ["gallery", "list"] },
    ],
  },
];

export const GOALS: { id: GoalId; label: string; cta: string }[] = [
  { id: "leads", label: "Generate enquiries", cta: "Get in touch" },
  { id: "sales", label: "Sell online", cta: "Shop now" },
  { id: "bookings", label: "Take bookings", cta: "Book now" },
  { id: "awareness", label: "Build awareness", cta: "Learn more" },
  { id: "signups", label: "Get sign-ups", cta: "Get started" },
  { id: "recruitment", label: "Recruit people", cta: "See open roles" },
  { id: "donations", label: "Raise donations", cta: "Donate" },
];

export const FEATURES: { id: FeatureId; label: string }[] = [
  { id: "blog", label: "Blog / articles" },
  { id: "booking", label: "Online booking" },
  { id: "shop", label: "Online shop" },
  { id: "membership", label: "Member accounts" },
  { id: "search", label: "Site search" },
  { id: "multilingual", label: "Multiple languages" },
  { id: "newsletter", label: "Newsletter" },
  { id: "live-chat", label: "Live chat" },
];

export const SCALES: { id: SiteScale; label: string; hint: string }[] = [
  { id: "landing", label: "Landing page", hint: "One long page" },
  { id: "small", label: "Small", hint: "Core pages only" },
  { id: "medium", label: "Medium", hint: "Core + recommended" },
  { id: "large", label: "Large", hint: "Everything" },
];

/** Style words offered in the UI. Free text is accepted too. */
export const STYLE_TAGS = [
  "minimal",
  "bold",
  "editorial",
  "photographic",
  "typographic",
  "experimental",
  "dark",
  "warm",
  "calm",
  "playful",
  "premium",
  "corporate",
  "technical",
  "colorful",
] as const;

export const SECTION_LABELS: Record<SectionKind, string> = {
  nav: "Navigation",
  hero: "Hero",
  logos: "Logo strip",
  features: "Feature grid",
  split: "Image + text",
  stats: "Key numbers",
  gallery: "Gallery",
  "product-grid": "Card grid",
  "product-detail": "Detail + buy box",
  menu: "Menu list",
  pricing: "Pricing / plans",
  testimonials: "Testimonials",
  team: "People",
  timeline: "Timeline / schedule",
  list: "List / index",
  article: "Long-form text",
  faq: "FAQ",
  cta: "Call to action",
  form: "Form",
  booking: "Booking widget",
  map: "Map + address",
  search: "Search + filters",
  cart: "Cart / checkout",
  newsletter: "Newsletter sign-up",
  footer: "Footer",
};

export function getIndustry(id: string): IndustryTemplate | undefined {
  return INDUSTRIES.find((industry) => industry.id === id);
}

/**
 * Resolve a free-text industry label (as typed into a Notion select, say) to
 * an IndustryId. Accepts the id, the English name or the Chinese name, case
 * and whitespace insensitive, and a few common synonyms.
 */
export function resolveIndustry(label: string): IndustryId | undefined {
  const key = label.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!key) return undefined;

  for (const industry of INDUSTRIES) {
    if (
      key === industry.id ||
      key === industry.name.toLowerCase().replace(/[\s_]+/g, "-") ||
      label.trim() === industry.nameZh
    ) {
      return industry.id;
    }
  }

  return INDUSTRY_SYNONYMS[key];
}

const INDUSTRY_SYNONYMS: Record<string, IndustryId> = {
  restaurant: "restaurant",
  cafe: "restaurant",
  "café": "restaurant",
  food: "restaurant",
  "f&b": "restaurant",
  餐廳: "restaurant",
  咖啡廳: "restaurant",
  shop: "ecommerce",
  store: "ecommerce",
  retail: "ecommerce",
  "e-commerce": "ecommerce",
  購物: "ecommerce",
  software: "saas",
  tech: "saas",
  app: "saas",
  軟體: "saas",
  saas: "saas",
  b2b: "corporate",
  business: "corporate",
  company: "corporate",
  agency: "corporate",
  企業: "corporate",
  studio: "portfolio",
  designer: "portfolio",
  personal: "portfolio",
  作品: "portfolio",
  medical: "healthcare",
  clinic: "healthcare",
  health: "healthcare",
  醫療: "healthcare",
  診所: "healthcare",
  school: "education",
  course: "education",
  courses: "education",
  "e-learning": "education",
  學校: "education",
  課程: "education",
  property: "real-estate",
  realestate: "real-estate",
  房產: "real-estate",
  不動產: "real-estate",
  ngo: "nonprofit",
  charity: "nonprofit",
  "non-profit": "nonprofit",
  公益: "nonprofit",
  event: "events",
  conference: "events",
  festival: "events",
  活動: "events",
  展覽: "events",
};
