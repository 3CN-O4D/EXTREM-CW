import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, ChevronRight, Clock } from 'lucide-react';

function Slideshow({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 4000);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <div className="relative h-40 overflow-hidden">
      {images.map((img, i) => (
        <img key={img} src={img} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
    </div>
  );
}

export default function LandingPage() {
  const services = [
    { name: 'Bicycle Wash', price: '50 Ksh', desc: 'Standard bicycle detailing', img: ['/src/images/bicyclewash1.jpeg', '/src/images/bicyclewash2.jpeg'] },
    { name: 'Motorcycle Full Wash', price: '70 Ksh', desc: 'Comprehensive motorcycle cleaning', img: ['/src/images/motorcyclewash1.jpeg', '/src/images/motorcyclewash2.jpeg'] },
    { name: 'Taxi Wash', price: '150 Ksh', desc: 'Interior or Exterior options', img: '/src/images/exterior.jpeg' },
    { name: 'Normal Car Wash', price: '200 Ksh', desc: 'Professional car detailing', img: ['/src/images/soapycar1.jpeg', '/src/images/soapycar2.jpeg'] },
    { name: 'Midrange Wash', price: '300 Ksh', desc: 'Matatus, Canters, and Hiaces', img: '/src/images/soapycarwashing.jpeg' },
    { name: 'Vacuuming', price: '200 Ksh', desc: 'Deep interior vacuum service', img: ['/src/images/vacuuming1.jpeg', '/src/images/vacuuming2.jpeg'] },
    { name: 'Carpet Wash', price: 'From 300 Ksh', desc: 'Depends on size, texture & color of carpet', img: '/src/images/carpetwash.jpeg' },
    { name: 'Engine Wash', price: '200 Ksh', desc: 'High-pressure engine detailing', img: ['/src/images/enginewash2.jpeg', '/src/images/enginewash3.jpeg'] },
    { name: 'Full Package', price: '600 Ksh', desc: 'Wash + Vacuum + Engine Wash', img: ['/src/images/soapycar1.jpeg', '/src/images/soapycar2.jpeg', '/src/images/vacuuming1.jpeg', '/src/images/enginewash2.jpeg'] }
  ];

  const gallery = [
    { title: 'Exterior Foam Wash', img: '/src/images/exterior.jpeg', desc: 'Professional foam application and hand wash' },
    { title: 'Engine Steam Cleaning', img: '/src/images/enginewash2.jpeg', desc: 'High-pressure engine bay detailing' },
    { title: 'Deep Interior Vacuum', img: '/src/images/vacuuming1.jpeg', desc: 'Complete interior vacuum and upholstery care' },
    { title: 'Motorcycle Detailing', img: '/src/images/motorcyclewash1.jpeg', desc: 'Full motorcycle wash service' },
    { title: 'Bicycle Wash', img: '/src/images/bicyclewash1.jpeg', desc: 'Bicycle detailing and wash' },
    { title: 'Full Vehicle Detailing', img: '/src/images/soapycarwashing.jpeg', desc: 'Comprehensive wash package' }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 bg-slate-900 text-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/src/images/logo.jpeg" alt="Extreme" className="h-12 object-contain" />
          <div className="text-2xl font-bold tracking-tighter text-blue-400">EXTREME AUTO CARWASH</div>
        </div>
        <div className="space-x-6 hidden md:flex">
          <a href="#services" className="hover:text-blue-400">Services</a>
          <a href="#gallery" className="hover:text-blue-400">Gallery</a>
          <a href="#contact" className="hover:text-blue-400">Contact</a>
        </div>
        <Link to="/login" className="bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Portal Login</Link>
      </nav>

      {/* Hero */}
      <section className="relative h-[80vh] flex items-center justify-center text-center text-white">
        <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
        <img
          src="/src/images/soapycarwashing.jpeg"
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 space-y-6 max-w-3xl px-6">
          <div className="flex justify-center mb-6">
            <img src="/src/images/logo.jpeg" alt="EXTREME" className="h-28 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">PRISTINE CLEAN. <br/><span className="text-blue-500">EXTREME VALUE.</span></h1>
          <p className="text-xl text-gray-200">The most professional carwash service in Eldoret. We don't just wash; we detail.</p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <a href="#services" className="bg-blue-600 px-8 py-4 rounded-full text-lg font-bold hover:bg-blue-700 flex items-center justify-center">Our Services <ChevronRight className="ml-2"/></a>
            <a href="tel:+254728597862" className="bg-white text-slate-900 px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-100 flex items-center justify-center">Book Now</a>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Work</h2>
            <p className="text-gray-600">See the EXTREME difference.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map(item => (
              <div key={item.title} className="rounded-xl overflow-hidden shadow-lg group">
                <div className="relative overflow-hidden">
                  <img src={item.img} alt={item.title} className="w-full h-52 object-cover group-hover:scale-110 transition duration-500"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-60 transition"></div>
                </div>
                <div className="p-4 bg-slate-900 text-white">
                  <h4 className="font-bold">{item.title}</h4>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Professional Services</h2>
            <p className="text-gray-600">Tailored cleaning for every vehicle type.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map(s => (
              <div key={s.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition group overflow-hidden flex flex-col">
                {Array.isArray(s.img) ? (
                  <Slideshow images={s.img} />
                ) : (
                  <div className="relative h-40 overflow-hidden">
                    <img src={s.img} alt={s.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-bold mb-1">{s.name}</h3>
                  <p className="text-gray-500 text-sm mb-4 flex-1">{s.desc}</p>
                  <div className="border-t pt-3 text-2xl font-black text-blue-600">{s.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-6 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold">Get In Touch</h2>
            <p className="text-gray-400">Visit us or call us for the best auto care experience.</p>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <MapPin className="text-blue-500 mt-1 shrink-0"/>
                <span>Eldoret, Annex, Jamboni — Opposite Mayo Supermarket, Adjacent to Blackrock Restaurant & Lounge</span>
              </div>
              <div className="space-y-2">
                 <ContactItem icon={<Phone/>} label="Call/Text: +254 728 597 862" href="tel:+254728597862"/>
                 <ContactItem icon={<MessageCircle/>} label="WhatsApp: +254 728 597 862" href="https://wa.me/254728597862"/>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 p-8 rounded-2xl space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <Clock className="text-blue-500" /> Opening Hours
            </h3>
            <div className="flex justify-between font-bold text-blue-500 text-lg">
              <span>Daily</span>
              <span>6:45 AM — 6:45 PM</span>
            </div>
            <p className="text-gray-400 text-sm text-center">Open every day, including Sundays & public holidays</p>
          </div>
        </div>
      </section>

      <footer className="bg-black text-gray-600 py-10 text-center text-sm flex flex-col items-center gap-2">
        <img src="/src/images/logo.jpeg" alt="EXTREME" className="h-10 object-contain opacity-50" />
        &copy; 2026 EXTREME AUTO CARWASH. All rights reserved.
      </footer>
    </div>
  );
}

function ContactItem({ icon, label, href }: any) {
  return (
    <a href={href} className="flex items-center space-x-4 hover:text-blue-500 transition">
      <div className="text-blue-500">{icon}</div>
      <span>{label}</span>
    </a>
  );
}
