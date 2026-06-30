import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, CheckCircle2, ChevronRight, Star } from 'lucide-react';

export default function LandingPage() {
  const services = [
    { name: 'Bicycle Wash', price: '50 Ksh', desc: 'Standard bicycle detailing' },
    { name: 'Motorcycle Full Wash', price: '70 Ksh', desc: 'Comprehensive motorcycle cleaning' },
    { name: 'Taxi Wash', price: '100 - 150 Ksh', desc: 'Interior or Exterior options' },
    { name: 'Normal Car Wash', price: '200 Ksh', desc: 'Professional car detailing' },
    { name: 'Midrange Wash', price: '300 Ksh', desc: 'Matatus, Canters, and Hiaces' },
    { name: 'Vacuuming', price: '200 - 300 Ksh', desc: 'Deep interior vacuum service' },
    { name: 'Engine Wash', price: '200 - 300 Ksh', desc: 'High-pressure engine detailing' },
    { name: 'Full Package', price: '600 - 800 Ksh', desc: 'Wash + Vacuum + Engine Wash' }
  ];

  const gallery = [
    { title: 'Premium Car Detailing', img: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=400', desc: 'Exterior foam wash' },
    { title: 'Engine Perfection', img: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=400', desc: 'Engine steam cleaning' },
    { title: 'Interior Vacuum', img: 'https://images.unsplash.com/photo-1599256621730-535171e28e50?auto=format&fit=crop&q=80&w=400', desc: 'Deep interior cleaning' },
    { title: 'Lorry & Bus Detailing', img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=400', desc: 'Heavy vehicle specialized wash' }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 bg-slate-900 text-white sticky top-0 z-50">
        <div className="text-2xl font-bold tracking-tighter text-blue-400">EXTREME AUTO CARWASH</div>
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
          src="https://images.unsplash.com/photo-1552933529-e359b2477262?auto=format&fit=crop&q=80&w=1200"
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 space-y-6 max-w-3xl px-6">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">PRISTINE CLEAN. <br/><span className="text-blue-500">EXTREME VALUE.</span></h1>
          <p className="text-xl text-gray-200">The most professional carwash service in the city. We don't just wash; we detail.</p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <a href="#services" className="bg-blue-600 px-8 py-4 rounded-full text-lg font-bold hover:bg-blue-700 flex items-center justify-center">Our Services <ChevronRight className="ml-2"/></a>
            <a href="tel:+254700000000" className="bg-white text-slate-900 px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-100 flex items-center justify-center">Book Now</a>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {services.map(s => (
              <div key={s.name} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition group">
                <CheckCircle2 className="text-blue-600 mb-4 group-hover:scale-110 transition"/>
                <h3 className="text-xl font-bold mb-2">{s.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{s.desc}</p>
                <div className="text-2xl font-black text-blue-600">{s.price}</div>
              </div>
            ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {gallery.map(item => (
              <div key={item.title} className="rounded-xl overflow-hidden shadow-lg group">
                <div className="relative overflow-hidden">
                  <img src={item.img} alt={item.title} className="w-full h-48 object-cover group-hover:scale-110 transition duration-500"/>
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

      {/* Contact */}
      <section id="contact" className="py-20 px-6 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold">Get In Touch</h2>
            <p className="text-gray-400">Visit us or call us for the best auto care experience.</p>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <MapPin className="text-blue-500"/>
                <span>123 Extreme Plaza, Main St, Nairobi</span>
              </div>
              <div className="space-y-2">
                 <ContactItem icon={<Phone/>} label="Call Us: +254 712 345 678" href="tel:+254712345678"/>
                 <ContactItem icon={<Phone/>} label="Call Us: +254 723 456 789" href="tel:+254723456789"/>
                 <ContactItem icon={<MessageCircle/>} label="WhatsApp: +254 734 567 890" href="https://wa.me/254734567890"/>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 p-8 rounded-2xl space-y-6">
            <h3 className="text-2xl font-bold">Opening Hours</h3>
            <div className="flex justify-between border-b border-slate-700 pb-2"><span>Mon - Fri</span> <span>7:00 AM - 8:00 PM</span></div>
            <div className="flex justify-between border-b border-slate-700 pb-2"><span>Saturday</span> <span>7:00 AM - 9:00 PM</span></div>
            <div className="flex justify-between font-bold text-blue-500"><span>Sunday</span> <span>8:00 AM - 6:00 PM</span></div>
          </div>
        </div>
      </section>

      <footer className="bg-black text-gray-600 py-10 text-center text-sm">
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
