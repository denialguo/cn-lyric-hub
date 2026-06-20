import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div className="max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo_inverse.svg" alt="CN Lyric Hub" className="w-8 h-8 rounded-lg logo-dark" />
              <img src="/logo.png" alt="CN Lyric Hub" className="w-8 h-8 rounded-lg logo-light" />
              <span className="font-bold text-lg text-white">CN Lyric Hub</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              A community-driven database of Chinese lyrics with Pinyin pronunciation and English translations.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Explore</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="text-slate-500 hover:text-primary transition-colors">Home</Link></li>
                <li><Link to="/stats" className="text-slate-500 hover:text-primary transition-colors">Stats</Link></li>
                <li><Link to="/add" className="text-slate-500 hover:text-primary transition-colors">Add a Song</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Help</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/faq" className="text-slate-500 hover:text-primary transition-colors">FAQ</Link></li>
                <li><Link to="/faq" className="text-slate-500 hover:text-primary transition-colors">Takedown Requests</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between gap-4 text-xs text-slate-600">
          <p className="max-w-2xl leading-relaxed">
            Lyrics are the property of their respective artists, songwriters, and publishers, and are provided here for
            educational and personal study only. CN Lyric Hub is a non-commercial community project and claims no ownership
            of the underlying works. Rights holders can{' '}
            <Link to="/faq" className="text-slate-500 hover:text-primary underline">request removal</Link> via the instructions in our FAQ.
          </p>
          <p className="shrink-0">© {year} CN Lyric Hub</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
