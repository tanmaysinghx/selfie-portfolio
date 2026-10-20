export interface ProfileConfig {
  name: string;
  title: string;
  jobTitle: string;
  location: string;
  status: string;
  email: string;
  avatar: {
    src: string;
    alt: string;
  };
  heroPortrait: {
    src: string;
    alt: string;
  };
  socials: Array<{
    name: string;
    url: string;
  }>;
}

export interface NavLink {
  label: string;
  href: string;
  exact?: boolean;
}

export interface NavigationConfig {
  brand: {
    name: string;
    role: string;
    avatar: string;
    href: string;
  };
  navLinks: NavLink[];
  searchShortcut: string;
  primaryCta: {
    label: string;
    href: string;
  };
}

export interface IdentityItem {
  id: number;
  label: string;
  figure: string;
}

export interface HeroStat {
  value: string;
  label: string;
  context: string;
  href: string;
}

export interface HeroConfig {
  identities: IdentityItem[];
  introduction: string;
  cta: {
    label: string;
    href: string;
  };
  availability: string;
  portrait: {
    src: string;
    alt: string;
  };
  stats: HeroStat[];
}

export interface Company {
  name: string;
  metric: string;
  metricLabel: string;
  description: string;
  linkLabel: string;
  href: string;
}

export interface CaseStudy {
  slug: string;
  title: string;
  metric: string;
  metricLabel: string;
  href: string;
  cover?: string;
  description: string;
}

export interface WorkConfig {
  heading: string;
  highlight: string;
  yearsExperience: string;
  experienceDomain: string;
  companies: Company[];
  caseStudies: CaseStudy[];
}

export interface CoffeeDay {
  dayLetter: string;
  dayName: string;
  blend: string;
  roaster: string;
  brews: string;
}

export interface FermentationStage {
  day: number;
  title: string;
  description: string;
  teaColor: string;
  scobyOpacity: number;
  bubbleCount: number;
}

export interface InRotationConfig {
  heading: string;
  highlight: string;
  intro: string;
  socialLink: {
    label: string;
    href: string;
  };
  coffeeWidget: {
    context: string;
    title: string;
    body: string;
    schedule: CoffeeDay[];
    link: {
      label: string;
      href: string;
    };
  };
  kombuchaWidget: {
    context: string;
    title: string;
    body: string;
    caption: string;
    stages: FermentationStage[];
    footerNote: string;
    link: {
      label: string;
      href: string;
    };
  };
  bookWidget: {
    context: string;
    title: string;
    author: string;
    readingNote: string;
    link: {
      label: string;
      href: string;
    };
  };
  updated: string;
}

export interface LabItem {
  status: string;
  title: string;
  description: string;
  linkLabel: string;
  href: string;
}

export interface ExperimentsConfig {
  heading: string;
  highlight: string;
  headingFull: string;
  featured: {
    award: string;
    title: string;
    description: string;
    linkLabel: string;
    href: string;
    visual: string;
  };
  items: LabItem[];
  footerNote: string;
}

export interface ArticleItem {
  title: string;
  readTime: string;
  date: string;
  description: string;
  image: string;
  imageAlt: string;
  actionLabel: string;
  href: string;
}

export interface WritingConfig {
  heading: string;
  highlight: string;
  allWriting: {
    label: string;
    href: string;
  };
  articles: ArticleItem[];
}

export interface LifeConfig {
  heading: string;
  highlight: string;
  subheading: string;
  intro: string;
  allLifeStories: {
    label: string;
    href: string;
  };
  featuredStory: {
    image: {
      src: string;
      alt: string;
    };
    caption: string;
    quote: string;
    actionLabel: string;
    href: string;
  };
}

export interface FooterColumnLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterColumnLink[];
}

export interface FooterConfig {
  heading: string;
  highlight: string;
  intro: string;
  cta: {
    label: string;
    href: string;
  };
  socials: Array<{
    name: string;
    url: string;
  }>;
  copyright: string;
  tagline: string;
  columns: FooterColumn[];
}

export interface SearchItem {
  category: string;
  title: string;
  description: string;
  href: string;
  keywords: string;
}
