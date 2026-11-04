import site from '../lib/site.json';
import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Navbar from '../components/Navbar';
import { CatalogueNav, CatalogueLinks } from '../components/CatalogueLinks';
import { useCataloguePage } from '../hooks/useCataloguePage';

export default function CataloguePage({ kind }) {
  const { page: parameter } = useParams();
  const page = parameter === undefined ? 1 : /^[1-9]\d*$/.test(parameter) && parameter !== '1' ? Number(parameter) : NaN;
  const { data, error, loading, retry } = useCataloguePage(kind, page);
  useEffect(() => { window.scrollTo(0, 0); }, [kind, page]);
  const invalid = !Number.isSafeInteger(page) || (!loading && !error && !data);
  return <div className="min-h-screen bg-slate-950 text-slate-200">
    <Helmet>
      <title>{data?.title || (invalid ? 'Page not found' : 'Catalogue')} | CN Lyric Hub</title>
      {data && <meta name="description" content={data.description} />}
      {data && <link rel="canonical" href={`${site.origin}${data.path}`} />}
      {invalid && <meta name="robots" content="noindex, follow" />}
    </Helmet>
    <Navbar />
    <main className="max-w-6xl mx-auto px-6 py-12">
      <CatalogueNav />
      <h1 className="text-4xl font-bold tracking-tight text-white mb-4">{data?.title || (invalid ? 'Page not found' : 'Catalogue')}</h1>
      {data ? <>
        <p className="text-slate-400 mb-8">{data.description}</p>
        <CatalogueLinks items={data.items} />
        {data.pages > 1 && <nav aria-label="Song directory pages" className="flex flex-wrap items-center gap-6 mt-8">
          {data.previous && <Link className="min-h-11 inline-flex items-center text-primary hover:underline" to={data.previous} rel="prev">Previous page</Link>}
          <span className="text-slate-400">Page {data.page} of {data.pages}</span>
          {data.next && <Link className="min-h-11 inline-flex items-center text-primary hover:underline" to={data.next} rel="next">Next page</Link>}
        </nav>}
      </> : error ? <div role="status">Couldn’t load the catalogue. <button className="min-h-11 text-primary" onClick={retry}>Try again</button></div>
        : !invalid && <p role="status" className="text-slate-400">Loading catalogue…</p>}
    </main>
  </div>;
}
