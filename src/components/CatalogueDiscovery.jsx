import React from 'react';
import { useCataloguePage } from '../hooks/useCataloguePage';
import { CatalogueNav, CatalogueLinks } from './CatalogueLinks';

export default function CatalogueDiscovery() {
  const { data } = useCataloguePage('home');
  return <section className="mt-12 border-t border-white/10 pt-8" aria-labelledby="catalogue-heading">
    <h2 id="catalogue-heading" className="text-2xl font-semibold text-white mb-3">Explore the catalogue</h2>
    <CatalogueNav />
    {data && <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div><h3 className="text-lg font-semibold mb-2">Songs to explore</h3><CatalogueLinks items={data.songs} /></div>
      <div><h3 className="text-lg font-semibold mb-2">Artists to explore</h3><CatalogueLinks items={data.artists} /></div>
    </div>}
  </section>;
}
