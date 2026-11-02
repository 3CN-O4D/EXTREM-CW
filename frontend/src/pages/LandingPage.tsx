import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bike,
  Car,
  ChevronRight,
  Clock,
  Droplets,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  Wind,
  X,
} from 'lucide-react';

const NAV = [
  { label: 'Services', href: '#services' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Why us', href: '#why-us' },
  { label: 'Visit', href: '#contact' },
];

const SERVICES = [
  {
    name: 'Bicycle Wash',
    price: '50',
    unit: 'Ksh',
    desc: 'A careful hand wash and detail for every bicycle.',
    img: '/images/bicyclewash1.jpeg',
    icon: Bike,
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
    name: 'Car Wash',
    price: '200',
    unit: 'Ksh',
    desc: 'Foam wash, hand dry and a spotless finish.',
    img: '/images/soapycar1.jpeg',
    icon: Car,
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
    name: 'Midrange & Lorry',
    price: '300+',
    unit: 'Ksh',
    desc: 'Matatus, canters, hiaces and lorries welcome.',
    img: '/images/soapycarwashing.jpeg',
    icon: Truck,
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
    name: 'Engine Wash',
    price: '300',
    unit: 'Ksh',
    desc: 'High-pressure engine bay detailing, done safely.',
    img: '/images/enginewash2.jpeg',
    icon: Droplets,
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
  { n: '01', title: 'Arrive', text: 'Pull in at Jamboni, Annex. We log your vehicle and get straight to work.' },
  { n: '02', title: 'We detail', text: 'Foam, hand wash, vacuum and engine care — tuned to your package.' },
  { n: '03', title: 'Drive out', text: 'Pay by cash or M-Pesa and get a printed receipt on the spot.' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b border-white/10 bg-slate-950/85 backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-3">
            <img src="/images/logo.jpeg" alt="Extreme Auto Carwash" className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/20" />
            <div className="leading-tight">
              <p className="text-sm font-black tracking-[0.16em] text-white">EXTREME</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-brand-300">Auto Carwash</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="tel:+254728597862"
              className="hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5 sm:inline-flex"
            >
              <Phone size={15} /> Call us
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110"
            >
              Portal <ArrowRight size={15} />
            </Link>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-xl border border-white/10 p-2 text-slate-200 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/5"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="tel:+254728597862"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white"
              >
                <Phone size={16} /> +254 728 597 862
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pt-20">
        <img
          src="/images/soapycarwashing.jpeg"
          alt="Car being washed at Extreme Auto Carwash"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-200 backdrop-blur">
              <Sparkles size={14} /> Eldoret's detail studio
            </span>

            <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-7xl">
              EXTREME
              <span className="block bg-gradient-to-r from-brand-300 via-cyan-300 to-white bg-clip-text text-transparent">
                SHINE.
              </span>
              <span className="block text-white">EVERY TIME.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Professional hand washing, pressurised machine wash, carpets awash, interior detailing and engine care in Eldoret.
              We don't just wash — we make your vehicle feel new again.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-cyan-500 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-brand-500/25 transition hover:brightness-110"
              >
                See services & prices <ChevronRight size={18} />
              </a>
              <a
                href="https://wa.me/254728597862"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                <MessageCircle size={18} /> Book on WhatsApp
              </a>
            </div>

            <div className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                { value: '6:45', label: 'Open daily' },
                { value: '9+', label: 'Services' },
                { value: '100%', label: 'Hand washed' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-black text-white sm:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">Services & pricing</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Pick a wash. <span className="text-slate-500">We handle the rest.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              Transparent prices, no surprises. Combine services into the full package and save.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.name}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.07]"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={service.img}
                      alt={service.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <span className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-brand-300 backdrop-blur">
                      <Icon size={17} />
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-white">{service.name}</h3>
                      <p className="whitespace-nowrap text-lg font-black text-brand-300">
                        {service.price}
                        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{service.unit}</span>
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{service.desc}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-3xl border border-brand-400/20 bg-gradient-to-r from-brand-500/15 to-cyan-500/10 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-200">Best value</p>
              <h3 className="mt-1 text-2xl font-black text-white">Full Package — 600 Ksh</h3>
              <p className="mt-1 text-sm text-slate-300">Wash + vacuum + engine detail. One visit, complete refresh.</p>
            </div>
            <a
              href="https://wa.me/254728597862"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-brand-100"
            >
              Book the package <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="border-y border-white/5 bg-white/[0.02] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">How it works</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                In. Detailed. Out.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                No appointments needed for a standard wash. Drive in any day between 6:45 AM and 6:45 PM.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                  <p className="text-3xl font-black text-brand-400/50">{step.n}</p>
                  <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">The work</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Results you can see.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Every vehicle gets the same obsessive attention — from a bicycle to a full-size lorry.
            </p>
          </div>

          <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-4 md:grid-cols-4">
            {GALLERY.map((item) => (
              <figure
                key={item.title}
                className={`group relative overflow-hidden rounded-3xl border border-white/10 ${item.span}`}
              >
                <img
                  src={item.img}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section id="why-us" className="relative overflow-hidden border-y border-white/5 bg-white/[0.02] py-24">
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div className="overflow-hidden rounded-[2rem] border border-white/10">
                <img src="/images/vacuuming2.jpeg" alt="Interior detailing" className="h-[420px] w-full object-cover" />
              </div>
              <div className="absolute -bottom-6 -right-4 hidden w-56 rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur sm:block">
                <div className="flex items-center gap-2 text-brand-300">
                  <ShieldCheck size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Care first</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">Trained hands, safe products, no shortcuts.</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">Why Extreme</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Not a quick rinse.
                <span className="block text-slate-500">A proper detail.</span>
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-400">
                We treat every vehicle like it belongs to us. That means the right pressure,
                the right products and enough time to do the job properly.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Droplets, title: 'Foam & hand wash', text: 'Gentle on paint, tough on dirt.' },
                  { icon: Wind, title: 'Deep interior care', text: 'Seats, carpets and hard-to-reach corners.' },
                  { icon: ShieldCheck, title: 'Safe products', text: 'No harsh shortcuts on your finish.' },
                  { icon: Clock, title: 'Open every day', text: '6:45 AM – 6:45 PM, including holidays.' },
                ].map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                      <Icon size={20} className="text-brand-300" />
                      <h3 className="mt-3 text-sm font-bold text-white">{feature.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{feature.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/60">
            <div className="grid lg:grid-cols-2">
              <div className="p-8 sm:p-12">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">Visit us</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Pull in today.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                  Find us in Eldoret, Annex, Jamboni — opposite Mayo Supermarket, next to Blackrock Restaurant & Lounge.
                </p>

                <div className="mt-8 space-y-4">
                  <a
                    href="https://maps.google.com/?q=Extreme+Auto+Carwash+Eldoret+Annex+Jamboni"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-400/30 hover:bg-white/[0.06]"
                  >
                    <span className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300"><MapPin size={19} /></span>
                    <span>
                      <span className="block text-sm font-semibold text-white">Eldoret, Annex, Jamboni</span>
                      <span className="mt-0.5 block text-xs text-slate-400">Opposite Mayo Supermarket · Adjacent to Blackrock</span>
                    </span>
                  </a>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href="tel:+254728597862"
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-400/30 hover:bg-white/[0.06]"
                    >
                      <span className="rounded-xl bg-brand-500/15 p-2.5 text-brand-300"><Phone size={18} /></span>
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
                      <span className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-300"><MessageCircle size={18} /></span>
                      <span>
                        <span className="block text-sm font-semibold text-white">WhatsApp</span>
                        <span className="text-xs text-slate-400">Chat with us</span>
                      </span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[320px] overflow-hidden">
                <img
                  src="/images/soapycar2.jpeg"
                  alt="Car wash in progress"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent lg:bg-gradient-to-r lg:from-slate-900/80 lg:via-slate-950/20" />
                <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/15 bg-slate-950/80 p-5 backdrop-blur-xl sm:inset-x-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-brand-500/20 p-2.5 text-brand-200"><Clock size={19} /></span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Opening hours</p>
                        <p className="text-lg font-black text-white">6:45 AM — 6:45 PM</p>
                      </div>
                    </div>
                    <span className="hidden rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 sm:inline">Open daily</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 bg-slate-950 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:px-8 md:flex-row">
          <div className="flex items-center gap-3">
            <img src="/images/logo.jpeg" alt="Extreme Auto Carwash" className="h-10 w-10 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-black tracking-[0.16em] text-white">EXTREME AUTO CARWASH</p>
              <p className="text-xs text-slate-500">Eldoret · Annex · Jamboni</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-white">{item.label}</a>
            ))}
            <Link to="/login" className="transition hover:text-white">Staff portal</Link>
          </div>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Extreme Auto Carwash</p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/254728597862"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30 transition hover:scale-105 hover:bg-emerald-400"
      >
        <MessageCircle size={24} />
      </a>
    </div>
  );
}
