import site from '../lib/site.json';
import React, { useEffect, useState } from 'react';
import { Music, Flame, Disc, Activity, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SongCard from '../components/SongCard';
import Navbar from '../components/Navbar';
import CatalogueDiscovery from '../components/CatalogueDiscovery';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'motion/react';
import * as M from 'motion/react-m';
import { tify, sify } from 'chinese-conv';
import { searchSongs, listSongs, trendingSongs, recentlyActiveSongs, classicSongs, likedSongIds, translatedSongIds } from '../lib/queries';
import { readString, writeString } from '../lib/storage';
import { SITE_NAME, HOME_TITLE, HOME_DESCRIPTION, websiteJsonLd } from '../lib/pageMeta';

const PAGE_SIZE = 36;

// Which query backs each tab. Kept as data so the fetch effect stays one branch.
const TAB_QUERY = {
  all: listSongs,
  trending: trendingSongs,
  new: recentlyActiveSongs,
  classics: classicSongs,
};

// The hero sample cycles through real lyric-settings combinations. Fonts are the same
// data-lyric-font stacks the song page uses, so what you see is what you'd get.
const LOOKS = [
  { label: 'Your theme', font: 'default', scale: 1 },
  { label: 'Brush · Rose · Large', font: 'brush', ink: '#f43f5e', scale: 1.25 },
  { label: 'Kai · Amber', font: 'kai', ink: '#f59e0b', scale: 1.05 },
  { label: 'Rounded · Blue', font: 'round', ink: '#3b82f6', scale: 1 },
  { label: 'Monospace · Violet · Small', font: 'mono', ink: '#8b5cf6', scale: 0.8 },
  { label: 'Cursive · Pink · Large', font: 'cursive', ink: '#ec4899', scale: 1.2 },
  { label: 'Elegant · Teal', font: 'elegant', ink: '#14b8a6', scale: 1.1 },
  { label: 'Serif · Orange · Small', font: 'serif', ink: '#f97316', scale: 0.9 },
  { label: 'Handwritten · Indigo · Large', font: 'hand', ink: '#6366f1', scale: 1.15 },
  { label: 'System · Emerald', font: 'system', ink: '#10b981', scale: 1 },
];
const WEB_FONTS = ['Ma Shan Zheng', 'Zhi Mang Xing', 'Long Cang', 'ZCOOL KuaiLe', 'ZCOOL XiaoWei'];
// Slot-machine intro: gaps ease from 70ms to 300ms, so the fast burst lasts well under a second.
// It's a small crossfading text block (never blanks) and reduced-motion skips it entirely.
const LOOP_GAP_MS = 300;
const INTRO_GAPS_MS = Array.from({ length: 10 }, (_, i) => 70 + 230 * (i / 9) ** 2); // ends at LOOP_GAP_MS

const HomePage = () => {
  const { user } = useAuth();
  const { scriptMode } = useTheme();
  const [songs, setSongs] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const savedTab = readString('homeTab', 'trending');
  const requestedTab = searchParams.get('tab') || savedTab;
  const activeTab = Object.hasOwn(TAB_QUERY, requestedTab) ? requestedTab : 'trending';
  const searchQuery = searchParams.get('q') || '';
  const setSearchQuery = (query) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (query) next.set('q', query); else next.delete('q');
    next.set('tab', activeTab);
    return next;
  }, { replace: true });
  const setActiveTab = (tab) => setSearchParams({ tab });
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery.trim());
  const [translatedIds, setTranslatedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userLikedIds, setUserLikedIds] = useState(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lookIndex, setLookIndex] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(true);
  const look = LOOKS[lookIndex];

  // On load, speed through every look, then keep cycling forever at the intro's final (slowest) pace.
  // Fonts load first (capped at 1.5s) so no step flashes a fallback face. Clicking skips ahead.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setIntroPlaying(false); return; }
    let cancelled = false;
    let timers = [];
    let loop;
    const fontsReady = Promise.all(WEB_FONTS.map(font => document.fonts.load(`1em "${font}"`, '一起听聽歌'))).catch(() => {});
    Promise.race([fontsReady, new Promise(resolve => setTimeout(resolve, 1500))]).then(() => {
      if (cancelled) return;
      const steps = [...LOOKS.keys()].slice(1).concat(0);
      let at = 100;
      timers = steps.map((index, step) => setTimeout(() => {
        setLookIndex(index);
        if (step === steps.length - 1) {
          setIntroPlaying(false);
          loop = setInterval(() => setLookIndex(i => (i + 1) % LOOKS.length), LOOP_GAP_MS);
        }
      }, at += INTRO_GAPS_MS[step] ?? LOOP_GAP_MS));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const nextLook = () => {
    setIntroPlaying(false);
    setLookIndex(i => (i + 1) % LOOKS.length);
  };

  useEffect(() => { writeString('homeTab', activeTab); }, [activeTab]);

  // Debounce search input so we don't hit the DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset pagination whenever the view changes
  useEffect(() => { setPage(0); }, [activeTab, debouncedQuery]);

  // One branch: pick the query for the current view and run it. Every query lives
  // in src/lib/queries.js, which is also where input sanitising and 1000-row
  // paging happen — those used to be re-decided (and got wrong) per call site.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (page === 0) setLoading(true); else setLoadingMore(true);
      setLoadError(false);

      const result = debouncedQuery
        ? await searchSongs(debouncedQuery, { page, pageSize: PAGE_SIZE })
        : await (TAB_QUERY[activeTab] || listSongs)({ page, pageSize: PAGE_SIZE });

      if (cancelled) return;
      // A failed query used to render as "No songs found", indistinguishable from
      // an empty catalogue.
      if (result.error) setLoadError(true);
      setSongs(result.songs);
      setHasMore(result.hasMore);
      setLoading(false);
      setLoadingMore(false);
    };

    run();
    return () => { cancelled = true; };
  }, [debouncedQuery, activeTab, page, reloadKey]);

  // Which of these the viewer has liked. Scoped to one user, never the whole table.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      // Signing out must clear the hearts, or they stay filled for the next viewer.
      setUserLikedIds(new Set());
      return;
    }
    likedSongIds(user.id).then((ids) => { if (!cancelled) setUserLikedIds(ids); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    translatedSongIds(songs.map(song => song.id)).then(ids => {
      if (!cancelled) setTranslatedIds(ids);
    });
    return () => { cancelled = true; };
  }, [songs]);

  return (
    <div className="home-page min-h-screen bg-slate-950 text-slate-200 relative">
      <Helmet>
        <title>{HOME_TITLE}</title>
        <meta name="description" content={HOME_DESCRIPTION} />
        <link rel="canonical" href={`${site.origin}/`} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={HOME_TITLE} />
        <meta property="og:description" content={HOME_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${site.origin}/`} />
        <script type="application/ld+json">{JSON.stringify(websiteJsonLd(site.origin))}</script>
      </Helmet>

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <section className="home-intro" aria-labelledby="home-heading">
          <div className="min-w-0">
            <h1 id="home-heading" className="home-heading">Find a song.<br />Follow every word.</h1>
            <p className="home-description">Read Chinese lyrics with pinyin and English translations.</p>
            <form role="search" onSubmit={event => event.preventDefault()} className="home-search">
              <label htmlFor="song-search" className="sr-only">Search all songs and artists</label>
              <Search aria-hidden="true" size={20} className="absolute left-4 top-1/2 -translate-y-1/2" />
              <input id="song-search" name="q" type="search" enterKeyHint="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search songs or artists…" />
              {searchQuery && <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 p-3"><X size={20} /></button>}
            </form>
          </div>
          <figure className="home-reading-example" aria-label="Pinyin reading example">
            <p className="home-eyebrow">Character by character</p>
            <button type="button" onClick={nextLook} className="home-look-button" aria-label={`Lyric style: ${look.label}. Show another style`}>
            <span className="home-ruby" lang={scriptMode === 'traditional' ? 'zh-Hant' : 'zh-Hans'}>
              {/* popLayout takes the outgoing look out of flow, so old and new crossfade in place. */}
              <AnimatePresence mode="popLayout" initial={false}>
                <M.span
                  key={lookIndex}
                  className="home-look"
                  data-lyric-font={look.font}
                  style={{ '--look-scale': look.scale, '--look-ink': look.ink }}
                  initial={{ opacity: 0, filter: 'blur(6px)', y: 6 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                  exit={{ opacity: 0, filter: 'blur(6px)', y: -6 }}
                  transition={{ duration: introPlaying ? .1 : .25, ease: [.2, .8, .2, 1] }}
                >
                  <ruby>一<rp>(</rp><rt>yì</rt><rp>)</rp></ruby>
                  <ruby>起<rp>(</rp><rt>qǐ</rt><rp>)</rp></ruby>
                  <ruby>{scriptMode === 'traditional' ? '聽' : '听'}<rp>(</rp><rt>tīng</rt><rp>)</rp></ruby>
                  <ruby>歌<rp>(</rp><rt>gē</rt><rp>)</rp></ruby>
                </M.span>
              </AnimatePresence>
            </span>
            </button>
            <figcaption>Listen to music together.</figcaption>
            <div className="home-example-rule" aria-hidden="true" />
            <p className="home-example-note" aria-hidden="true">{look.label}<span className="home-look-hint"> · tap to try another</span></p>
          </figure>
        </section>

        <section aria-labelledby="library-heading">
          <div className="home-library-header">
            <h2 id="library-heading" className="text-xl sm:text-2xl font-semibold text-white tracking-tight min-w-0 break-words">
              {searchQuery.trim() ? `Search results for “${searchQuery.trim()}”` :
               activeTab === 'all' ? 'All Songs' :
               activeTab === 'trending' ? 'Popular Songs' :
               activeTab === 'new' ? 'Recently Active' : 'Timeless Classics'}
            </h2>
            {!searchQuery.trim() && <div className="home-categories" role="group" aria-label="Browse songs">
              {[
                { id: 'all', label: 'All Songs', icon: Music },
                { id: 'trending', label: 'Popular', icon: Flame },
                { id: 'new', label: 'Recently Active', icon: Activity },
                { id: 'classics', label: 'Classics', icon: Disc },
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id} className="home-category">
                  {activeTab === tab.id && <M.span layoutId="home-category-pill" className="home-category-pill" transition={{ type: 'spring', bounce: .2, duration: .4 }} />}
                  <tab.icon size={16} aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>}
          </div>

        {loading ? (
          <div role="status" className="text-slate-400 py-8">Loading library…</div>
        ) : loadError ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-red-500/20 border-dashed">
            <p className="text-slate-300 mb-2">We couldn't load the library just now.</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="text-primary hover:underline text-sm">Try again</button>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-white/5 border-dashed">
            <p className="text-slate-400 mb-4">No songs found matching your criteria.</p>
            <button onClick={() => {setSearchQuery(''); setActiveTab('all')}} className="text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div key={`${activeTab}:${debouncedQuery}`} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {songs.map((song, index) => {
                const rawChinese = song.title_zh || song.title_en || "Untitled";
                const displayChinese = scriptMode === 'traditional' ? tify(rawChinese) : sify(rawChinese);
                // Cards rise in a quick wave; the grid's key replays it per tab/search, and
                // "Load more" pages start their own wave instead of waiting behind the first.
                return (
                  <M.div key={song.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, ease: [.2, .8, .2, 1], delay: Math.min(index % PAGE_SIZE, 12) * .03 }}>
                    <SongCard
                      song={{ ...song, display_title: displayChinese }}
                      hasTranslation={translatedIds.has(song.id)}
                      initialLikeCount={song.song_likes?.[0]?.count || 0}
                      initialIsLiked={userLikedIds.has(song.id)}
                    />
                  </M.div>
                );
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={loadingMore}
              className="px-8 py-2.5 rounded-full text-sm font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
        </section>
        <CatalogueDiscovery />
      </main>
    </div>
  );
};

export default HomePage;
