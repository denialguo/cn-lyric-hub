import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import Navbar from './Navbar';

/**
 * Shared chrome for /privacy and /terms so the two pages can't drift apart.
 * Content lives in the pages; this owns the head tags, heading and section styling.
 */
const LegalLayout = ({ title, description, canonicalPath, updated, intro, children }) => (
  <div className="min-h-screen bg-slate-950 text-slate-200">
    <Helmet>
      <title>{title} — CN Lyric Hub</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={`https://cnlyrichub.vercel.app${canonicalPath}`} />
    </Helmet>
    <Navbar />

    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link to="/" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
      </Link>

      <h1 className="text-4xl font-black tracking-tight text-white mb-3">{title}</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated {updated}</p>

      {intro && <p className="text-slate-300 leading-relaxed mb-10">{intro}</p>}

      <div className="space-y-10">{children}</div>

      <div className="mt-16 pt-8 border-t border-white/5 text-sm text-slate-500">
        Questions about this page? Email{' '}
        <a href="mailto:danieldenialdeveloping@gmail.com" className="text-primary hover:underline">
          danieldenialdeveloping@gmail.com
        </a>
        .
      </div>
    </div>
  </div>
);

/** One numbered section of a legal document. */
export const Section = ({ heading, children }) => (
  <section>
    <h2 className="text-xl font-bold text-white mb-3">{heading}</h2>
    <div className="space-y-3 text-slate-300 leading-relaxed [&_a]:text-primary [&_a:hover]:underline [&_strong]:text-white">
      {children}
    </div>
  </section>
);

/** Bulleted list with consistent spacing. */
export const Bullets = ({ items }) => (
  <ul className="list-disc pl-5 space-y-2 text-slate-300">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

export default LegalLayout;
