import React from 'react';
import { Link } from 'react-router-dom';

export function CatalogueNav() {
  return <nav aria-label="Catalogue" className="flex flex-wrap gap-x-6 gap-y-2 mb-6 text-primary">
    <Link className="inline-flex min-h-11 items-center hover:underline" to="/">Home</Link>
    <Link className="inline-flex min-h-11 items-center hover:underline" to="/songs">Song directory</Link>
    <Link className="inline-flex min-h-11 items-center hover:underline" to="/artists">Artist directory</Link>
  </nav>;
}

export function CatalogueLinks({ items }) {
  return <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
    {items.map(item => <li key={item.href} className="min-w-0 border-b border-white/10">
      <Link to={item.href} className="block py-3 hover:text-primary break-words">
        <span className="font-medium">{item.label}</span>
        {item.detail && <span className="block text-sm text-slate-400">{item.detail}</span>}
      </Link>
    </li>)}
  </ul>;
}
