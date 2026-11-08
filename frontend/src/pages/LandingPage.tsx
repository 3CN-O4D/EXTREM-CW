import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Car,
  Check,
  Clock,
  Droplets,
  MapPin,
  Maximize2,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  Wind,
  X,
  Zap,
} from 'lucide-react';

const NAV = [
  { label: 'Services', href: '#services' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Why us', href: '#why-us' },
  { label: 'Visit', href: '#contact' },
];

type Service = {
  name: string;
  price: string;
  unit: string;
  desc: string;
  img: string;
  icon: typeof Bike;
  tag?: string;
};

// Public-facing service menu: exactly 7 items (no standalone engine wash).
const SERVICES: Service[] = [
  {
    name: 'Car Wash',
    price: '200',
    unit: 'Ksh',
    desc: 'Foam wash, hand dry and a spotless finish — inside and out.',
    img: '/images/soapycar1.jpeg',
    icon: Car,
    tag: 'Most booked',
  },
  {
    name: 'Motorcycle Wash',
    price: '70',
    unit: 'Ksh',
    desc: 'Full motorcycle clean, from fairings to chain guard.',
    img: '/images/motorcyclewash1.jpeg',
    icon: Bike,
  },
  {
    name: 'Bicycle Wash',
    price: '50',
    unit: 'Ksh',
    desc: 'A careful hand wash and detail for every bicycle.',
    img: '/images/bicyclewash1.jpeg',
    icon: Bike,
  },
  {
    name: 'Pressurised Machine Wash',
    price: '300',
    unit: 'Ksh',
    desc: 'High-pressure machine wash for a deep, thorough clean.',
    img: '/images/enginewash3.jpeg',
    icon: Droplets,
  },
  {
    name: 'Interior Vacuum',
    price: '300',
    unit: 'Ksh',
    desc: 'Deep vacuum for seats, carpets and every crevice.',
    img: '/images/vacuuming1.jpeg',
    icon: Wind,
  },
  {
    name: 'Midrange & Lorry',
    price: '300+',
    unit: 'Ksh',
    desc: 'Matatus, canters, hiaces and lorries welcome.',
    img: '/images/soapycarwashing.jpeg',
    icon: Truck,
  },
  {
    name: 'Carpet Wash',
    price: '300+',
    unit: 'Ksh',
    desc: 'Size, texture and colour determine the final price.',
    img: '/images/carpetwash.jpeg',
    icon: Sparkles,
  },
];

const GALLERY = [
  { title: 'Exterior foam wash', img: '/images/exterior.jpeg', span: 'md:col-span-2 md:row-span-2' },
  { title: 'Engine detailing', img: '/images/enginewash2.jpeg', span: '' },
  { title: 'Interior vacuum', img: '/images/vacuuming1.jpeg', span: '' },
  { title: 'Motorcycle care', img: '/images/motorcyclewash1.jpeg', span: '' },
  { title: 'Bicycle wash', img: '/images/bicyclewash1.jpeg', span: '' },
  { title: 'Full package shine', img: '/images/soapycarwashing.jpeg', span: 'md:col-span-2' },
];

const STEPS = [
  {
    n: '01',
    title: 'Arrive',
    text: 'Pull in at Jamboni, Annex. We log your vehicle and get straight to work.',
    icon: MapPin,
  },
  {
    n: '02',
    title: 'We detail',
    text: 'Foam, hand wash, vacuum and engine care — tuned to your package.',
    icon: Droplets,
  },
  {
    n: '03',
    title: 'Drive out',
    text: 'Pay by cash or M-Pesa and get a receipt on the spot.',
    icon: Zap,
  },
];

const FEATURES = [
  { icon: Droplets, title: 'Foam & hand wash', text: 'Gentle on paint, tough on dirt.' },
  { icon: Wind, title: 'Deep interior care', text: 'Seats, carpets and hard-to-reach corners.' },
  { icon: ShieldCheck, title: 'Safe products', text: 'No harsh shortcuts on your finish.' },
  { icon: Clock, title: 'Open every day', text: '6:45 AM – 6:45 PM, including holidays.' },
];

const INCLUDES = ['Hand wash & foam', 'Interior vacuum', 'Engine detail', 'Cash & M-Pesa'];

const TICKER = [
  'Foam wash',
  'Interior vacuum',
  'Engine detail',
  'Carpet care',
  'Motorcycles',
  'Bicycles',
  'Lorries',
  'M-Pesa accepted',
];

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already in (or above) the viewport: show immediately so a fast scroll or a
    // restored scroll position can never leave a section permanently invisible.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown
          ? 'translate-y-0 opacity-100'
          : 'translate-y-8 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState<(typeof GALLERY)[number] | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 18);
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setIsOpen(mins >= 6 * 60 + 45 && mins <= 18 * 60 + 45);
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightbox]);

  return (
    <div id="top" className="min-h-screen overflow-x-hidden bg-[#05070c] text-slate-100 antialiased">
      {/* Reading progress */}
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-brand-400 via-cyan-300 to-emerald-300 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Navigation */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/[0.07] bg-[#05070c]/80 backdrop-blur-xl'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <a href="#top" className="group flex items-center gap-3">
            <span className="relative">
              <span className="absolute inset-0 rounded-2xl bg-brand-400/30 blur-md transition group-hover:bg-brand-400/50" />
              <img
                src="/images/logo.jpeg"
                alt="Extreme Auto Carwash"
                className="relative h-10 w-10 rounded-2xl object-cover ring-1 ring-white/20"
              />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-extrabold tracking-[0.18em] text-white">
                EXTREME
              </span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-brand-300">
                Auto Carwash
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 xl:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none ${
                    isOpen ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    isOpen ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </span>
              {isOpen ? 'Open now' : 'Opens 6:45 AM'}
            </span>
            <a
              href="tel:+254728597862"
              className="hidden items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.06] sm:inline-flex"
            >
              <Phone size={15} /> Call us
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-400 to-cyan-300 px-4 py-2 text-sm font-extrabold text-slate-950 shadow-lg shadow-brand-500/20 transition hover:brightness-110"
            >
              Portal <ArrowRight size={15} />
            </Link>
            <button
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-xl border border-white/10 p-2 text-slate-200 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#05070c]/95 px-4 py-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a
                  href="tel:+254728597862"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white"
                >
                  <Phone size={16} /> Call
                </a>
                <a
                  href="https://wa.me/254728597862"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 sm:pt-32 lg:pt-36">
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -left-48 top-0 h-[38rem] w-[38rem] rounded-full bg-brand-500/20 blur-[130px]" />
        <div className="pointer-events-none absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-cyan-400/10 blur-[130px]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10 lg:pb-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-300/25 bg-brand-400/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-200 backdrop-blur">
              <Sparkles size={13} /> Eldoret&apos;s trusted carwash
            </span>

            <h1 className="mt-7 text-balance font-display text-[clamp(2.8rem,7.2vw,5.6rem)] font-extrabold leading-[0.93] tracking-[-0.055em] text-white">
              Showroom shine.
              <span className="mt-1 block bg-gradient-to-r from-brand-300 via-cyan-200 to-white bg-clip-text text-transparent">
                Every single time.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Professional hand washing, pressurised machine wash, interior vacuum, engine care
              and carpet cleaning — all under one roof in Eldoret.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://wa.me/254728597862"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-400 to-cyan-300 px-7 py-4 text-sm font-extrabold text-slate-950 shadow-xl shadow-brand-500/25 transition hover:brightness-110"
              >
                <MessageCircle size={18} /> Book on WhatsApp
              </a>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                See services &amp; prices <ArrowRight size={17} />
              </a>
            </div>

            <div className="mt-11 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                { value: '7', label: 'Services' },
                { value: '6:45', label: 'Open daily' },
                { value: '100%', label: 'Hand finished' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-2xl font-bold text-white sm:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Image collage */}
          <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
            <div className="pointer-events-none absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-brand-500/20 via-cyan-400/5 to-transparent blur-2xl" />
            <div className="relative grid h-[430px] grid-cols-5 grid-rows-6 gap-3 sm:h-[520px] lg:h-[600px]">
              <figure className="group relative col-span-3 row-span-6 overflow-hidden rounded-[2rem] border border-white/10">
                <img
                  src="/images/soapycar1.jpeg"
                  alt="Car being washed at Extreme Auto Carwash"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/15 to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-brand-300">
                    Signature wash
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-white">Foam. Hand dry. Finish.</p>
                </figcaption>
                <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                  From Ksh 50
                </span>
              </figure>

              <figure className="group relative col-span-2 row-span-3 overflow-hidden rounded-[1.5rem] border border-white/10">
                <img
                  src="/images/vacuuming1.jpeg"
                  alt="Interior vacuum detailing"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070c]/90 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-3.5 text-xs font-bold text-white">
                  Interior care
                </figcaption>
              </figure>

              <figure className="group relative col-span-2 row-span-3 overflow-hidden rounded-[1.5rem] border border-white/10">
                <img
                  src="/images/motorcyclewash1.jpeg"
                  alt="Motorcycle wash"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070c]/90 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-3.5 text-xs font-bold text-white">
                  Two wheels welcome
                </figcaption>
              </figure>
            </div>

            <div className="landing-float absolute -bottom-5 right-4 w-[190px] rounded-2xl border border-white/15 bg-[#0a0e17]/90 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:right-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-300">
                Full package
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-white">
                Ksh 800
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                Wash + vacuum + engine detail
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="relative border-y border-white/[0.06] bg-white/[0.02] py-4">
        <div className="landing-fade-x overflow-hidden">
          <div className="landing-marquee flex w-max">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-8 pr-8"
                aria-hidden={copy === 1}
              >
                {TICKER.map((item) => (
                  <span key={item} className="flex items-center gap-8">
                    <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">
                      {item}
                    </span>
                    <Sparkles size={13} className="text-brand-400/60" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services */}
      <section id="services" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-300">
                  Services &amp; pricing
                </p>
                <h2 className="mt-3 text-balance font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                  Everything your ride needs.{' '}
                  <span className="text-slate-500">One standard.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                Seven services, transparent prices, and a finish that speaks for itself. Combine
                services into the full package and save.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:auto-rows-[220px] lg:grid-cols-4">
            {SERVICES.map((service, index) => {
              const Icon = service.icon;
              const big = index === 0;
              const wide = index === 1 || index === 2;
              return (
                <Reveal
                  key={service.name}
                  delay={index * 55}
                  className={`h-full ${
                    big
                      ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2'
                      : wide
                        ? 'lg:col-span-2'
                        : ''
                  }`}
                >
                  <article className="group relative h-full min-h-[260px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900 transition duration-500 hover:-translate-y-1 hover:border-brand-300/40 hover:shadow-glow">
                    <img
                      src={service.img}
                      alt={service.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/45 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/0 via-transparent to-cyan-400/0 opacity-0 transition duration-500 group-hover:from-brand-500/15 group-hover:to-cyan-400/10 group-hover:opacity-100" />

                    <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-brand-200 backdrop-blur">
                          <Icon size={18} />
                        </span>
                        <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                          {service.unit} {service.price}
                        </span>
                      </div>

                      <div>
                        {service.tag && (
                          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand-400/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-200 ring-1 ring-brand-300/25">
                            {service.tag}
                          </span>
                        )}
                        <h3
                          className={`font-display font-bold tracking-[-0.02em] text-white ${
                            big ? 'text-2xl sm:text-3xl' : 'text-lg'
                          }`}
                        >
                          {service.name}
                        </h3>
                        <p
                          className={`mt-1.5 leading-relaxed text-slate-300 ${
                            big ? 'max-w-sm text-sm sm:text-base' : 'text-sm'
                          }`}
                        >
                          {service.desc}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-200 opacity-0 transition group-hover:opacity-100">
                          Book this <ArrowUpRight size={14} />
                        </span>
                      </div>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={80}>
            <div className="mt-4 overflow-hidden rounded-[2rem] border border-brand-300/20 bg-gradient-to-r from-brand-500/15 via-cyan-500/10 to-transparent p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-200">
                    Best value · negotiable
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
                    The Full Package — Ksh 800
                  </h3>
                  <p className="mt-2 max-w-xl text-sm text-slate-300">
                    Wash + interior vacuum + engine detail. One visit, complete refresh.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {INCLUDES.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200"
                      >
                        <Check size={12} className="text-brand-300" /> {item}
                      </span>
                    ))}
                  </div>
                </div>
                <a
                  href="https://wa.me/254728597862"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-brand-100"
                >
                  Book the package <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Process */}
      <section className="border-y border-white/[0.06] bg-white/[0.02] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <Reveal>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-300">
                How it works
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                In. Detailed. Out.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                No appointment needed for a standard wash. Drive in any day between 6:45 AM and
                6:45 PM.
              </p>
            </Reveal>

            <div className="relative grid gap-4 sm:grid-cols-3">
              <div className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent sm:block" />
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Reveal key={step.n} delay={index * 90} className="relative h-full">
                    <div className="h-full rounded-3xl border border-white/10 bg-[#080b12]/85 p-6 backdrop-blur">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-300/20">
                          <Icon size={20} />
                        </span>
                        <span className="font-display text-3xl font-bold text-white/10">{step.n}</span>
                      </div>
                      <h3 className="mt-5 font-display text-lg font-bold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-300">
                The work
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                Results you can see.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Every vehicle gets the same obsessive attention — from a bicycle to a full-size
                lorry. Tap any photo to take a closer look.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[190px] md:grid-cols-4">
            {GALLERY.map((item, index) => (
              <Reveal key={item.title} delay={index * 45} className={`h-full ${item.span}`}>
                <button
                  type="button"
                  onClick={() => setLightbox(item)}
                  className="group relative block h-full w-full overflow-hidden rounded-3xl border border-white/10 text-left transition duration-500 hover:border-brand-300/40"
                >
                  <img
                    src={item.img}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070c]/90 via-[#05070c]/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      <Maximize2 size={14} />
                    </span>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section
        id="why-us"
        className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-20 sm:py-28"
      >
        <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal className="relative">
              <div className="overflow-hidden rounded-[2rem] border border-white/10">
                <img
                  src="/images/vacuuming2.jpeg"
                  alt="Interior detailing"
                  className="h-[380px] w-full object-cover sm:h-[460px]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070c]/70 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-5 left-4 right-4 flex flex-col gap-2 sm:left-8 sm:right-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0a0e17]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-200">
                    <Clock size={18} />
                  </span>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Open daily
                    </p>
                    <p className="text-sm font-bold text-white">6:45 AM — 6:45 PM</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0a0e17]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Care first
                    </p>
                    <p className="text-sm font-bold text-white">Trained hands</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-300">
                Why Extreme
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                Not a quick rinse.
                <span className="block text-slate-500">A proper detail.</span>
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-400">
                We treat every vehicle like it belongs to us. That means the right pressure, the
                right products and enough time to do the job properly.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-white/10 bg-[#080b12]/70 p-5 transition hover:border-brand-300/30 hover:bg-white/[0.04]"
                    >
                      <Icon size={20} className="text-brand-300" />
                      <h3 className="mt-3 text-sm font-bold text-white">{feature.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{feature.text}</p>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
              <div className="grid lg:grid-cols-2">
                <div className="p-7 sm:p-10 lg:p-12">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-300">
                    Visit us
                  </p>
                  <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                    Pull in today.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                    Find us in Eldoret, Annex, Jamboni — opposite Mayo Supermarket, next to
                    Blackrock Restaurant &amp; Lounge.
                  </p>

                  <div className="mt-8 space-y-3">
                    <a
                      href="https://maps.google.com/?q=Extreme+Auto+Carwash+Eldoret+Annex+Jamboni"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-300/30 hover:bg-white/[0.06]"
                    >
                      <span className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300">
                        <MapPin size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">
                          Eldoret, Annex, Jamboni
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          Opposite Mayo Supermarket · Adjacent to Blackrock
                        </span>
                      </span>
                      <ArrowUpRight size={16} className="mt-1 shrink-0 text-slate-500" />
                    </a>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <a
                        href="tel:+254728597862"
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-300/30 hover:bg-white/[0.06]"
                      >
                        <span className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300">
                          <Phone size={18} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-white">Call / text</span>
                          <span className="text-xs text-slate-400">+254 728 597 862</span>
                        </span>
                      </a>
                      <a
                        href="https://wa.me/254728597862"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-400/30 hover:bg-white/[0.06]"
                      >
                        <span className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-300">
                          <MessageCircle size={18} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-white">WhatsApp</span>
                          <span className="text-xs text-slate-400">Chat with us</span>
                        </span>
                      </a>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} className="text-brand-300" /> Open daily 6:45 AM – 6:45 PM
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Check size={13} className="text-emerald-400" /> Cash &amp; M-Pesa accepted
                    </span>
                  </div>
                </div>

                <div className="relative min-h-[340px] overflow-hidden lg:min-h-0">
                  <img
                    src="/images/soapycar2.jpeg"
                    alt="Car wash in progress"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-[#05070c]/30 to-transparent lg:bg-gradient-to-r lg:from-[#080b12]/80 lg:via-[#05070c]/20" />
                  <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-[#0a0e17]/85 p-5 backdrop-blur-xl sm:inset-x-7 sm:bottom-7">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-brand-500/20 p-2.5 text-brand-200">
                          <Clock size={19} />
                        </span>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Opening hours
                          </p>
                          <p className="font-display text-xl font-bold text-white">
                            6:45 AM — 6:45 PM
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                          isOpen
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isOpen ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        {isOpen ? 'Open now' : 'Closed'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-brand-300/20 bg-gradient-to-br from-brand-500/20 via-cyan-500/10 to-emerald-500/10 px-6 py-12 text-center sm:px-12 sm:py-16">
              <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-200">
                  Ready when you are
                </p>
                <h2 className="mx-auto mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                  Bring the shine back.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
                  No appointment needed. Drive in, choose your wash, and leave with a finish that
                  turns heads.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <a
                    href="https://wa.me/254728597862"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-400 to-cyan-300 px-7 py-4 text-sm font-extrabold text-slate-950 shadow-xl shadow-brand-500/25 transition hover:brightness-110"
                  >
                    <MessageCircle size={18} /> Book on WhatsApp
                  </a>
                  <a
                    href="tel:+254728597862"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/[0.12]"
                  >
                    <Phone size={17} /> Call 0728 597 862
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-[#03050a] py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-3">
                <img
                  src="/images/logo.jpeg"
                  alt="Extreme Auto Carwash"
                  className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/15"
                />
                <div>
                  <p className="font-display text-sm font-extrabold tracking-[0.16em] text-white">
                    EXTREME AUTO CARWASH
                  </p>
                  <p className="text-xs text-slate-500">Eldoret · Annex · Jamboni</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Hand washing, interior detailing, engine care and carpet cleaning — done properly,
                every single time.
              </p>
            </div>

            <div className="flex flex-wrap gap-12">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Explore
                </p>
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-400">
                  {NAV.map((item) => (
                    <a key={item.href} href={item.href} className="transition hover:text-white">
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Contact
                </p>
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-400">
                  <a href="tel:+254728597862" className="transition hover:text-white">
                    +254 728 597 862
                  </a>
                  <a
                    href="https://wa.me/254728597862"
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-white"
                  >
                    WhatsApp
                  </a>
                  <span>Open daily · 6:45 AM – 6:45 PM</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Staff
                </p>
                <div className="mt-3 flex flex-col gap-2 text-xs text-slate-400">
                  <Link to="/login" className="transition hover:text-white">
                    Staff portal
                  </Link>
                  <a
                    href="https://maps.google.com/?q=Extreme+Auto+Carwash+Eldoret+Annex+Jamboni"
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-white"
                  >
                    Get directions
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Extreme Auto Carwash. All rights reserved.</p>
            <p>Eldoret · Annex · Jamboni</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/254728597862"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="group fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-2xl shadow-emerald-500/30 transition hover:scale-105 hover:bg-emerald-400"
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-500/40 motion-reduce:animate-none" />
        <MessageCircle size={24} />
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-full border border-white/10 bg-[#0a0e17]/90 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl backdrop-blur transition group-hover:opacity-100 sm:block">
          Chat with us
        </span>
      </a>

      {/* Gallery lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#02040a]/90 p-4 backdrop-blur-md"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.title}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.12]"
            aria-label="Close image"
          >
            <X size={20} />
          </button>
          <figure
            className="w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={lightbox.img}
              alt={lightbox.title}
              className="max-h-[80vh] w-full rounded-2xl object-contain"
            />
            <figcaption className="mt-3 text-center text-sm font-semibold text-slate-300">
              {lightbox.title}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
