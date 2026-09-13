import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Music, Users, Type, Heart, TrendingUp, Hash, Sparkles, MessageSquare, Globe, Calendar, Repeat, BookOpen, Fingerprint, Ghost, Mic } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { catalogueStats } from '../lib/queries';
import Navbar from '../components/Navbar';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { tify } from 'chinese-conv';
import { useTheme } from '../context/ThemeContext';

// --- CHART THEME ---
const COLORS = ['#06b6d4', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-white text-sm font-bold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-slate-300 text-xs">{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

// --- COMPONENTS ---

const StatCard = ({ icon: Icon, label, value, sub, color = 'text-primary' }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
    <div className={`${color} bg-slate-800 p-2.5 rounded-xl w-fit mb-4`}>
      <Icon size={20} />
    </div>
    <p className="text-3xl font-black text-white mb-1">{value}</p>
    <p className="text-sm text-slate-400">{label}</p>
    {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
  </div>
);

const RankBar = ({ rank, label, value, maxValue, onClick, sub }) => (
  <div onClick={onClick} className={`flex items-center gap-3 group ${onClick ? 'cursor-pointer' : ''}`}>
    <span className="text-slate-600 text-xs font-mono w-5 text-right">{rank}</span>
    <div className="flex-1 relative">
      <div className="h-8 bg-slate-800/50 rounded-lg overflow-hidden">
        <div
          className="h-full bg-primary/20 rounded-lg transition-all duration-500 group-hover:bg-primary/30 flex items-center"
          style={{ width: `${Math.max((value / maxValue) * 100, 8)}%` }}
        >
          <span className="text-sm text-white font-medium pl-3 truncate">{label}</span>
        </div>
      </div>
    </div>
    <div className="text-right">
      <span className="text-slate-400 text-xs font-bold">{value}{sub ? '' : ''}</span>
      {sub && <span className="text-slate-600 text-[10px] block">{sub}</span>}
    </div>
  </div>
);

const SectionHeader = ({ icon: Icon, title, color = 'text-primary' }) => (
  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
    <Icon size={18} className={color} /> {title}
  </h2>
);

// --- MAIN PAGE ---

const StatsPage = () => {
  const navigate = useNavigate();
  const { scriptMode } = useTheme();
  const sc = (text) => scriptMode === 'traditional' ? tify(text) : text;
  const [snapshot, setSnapshot] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [randomLyric, setRandomLyric] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    catalogueStats().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data || data.payload?.version !== 1) {
        setLoadError(true);
        return;
      }
      setSnapshot(data);
      const samples = data.payload.lyricSamples;
      setRandomLyric(samples[Math.floor(Math.random() * samples.length)] || null);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-slate-400" role="status">
          {loadError ? <>Stats are temporarily unavailable.
            <button className="text-primary underline" onClick={() => setReloadKey(k => k + 1)}>Retry</button>
          </> : 'Loading stats…'}
        </div>
      </div>
    );
  }

  const {
    songCount, topLiked, artistCount, translationCount, commentCount,
    charFreq, compounds, toneData, lineLengthData, repeatedLines, yearData,
    diversityData, moodData, ghostData, signatureData, rhymeData, tagDist,
    totalLines, totalChars, uniqueCharCount, avgLines, totalLikes, longestSong, mostRepetitive,
  } = snapshot.payload;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Helmet>
        <title>Stats — CN Lyric Hub</title>
        <meta name="description" content="Explore analytics across the CN Lyric Hub catalog — most common characters, mood analysis, artist breakdowns, and more." />
        <link rel="canonical" href="https://cnlyrichub.vercel.app/stats" />
      </Helmet>
      <Navbar />

      {/* HERO */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/15 rounded-full blur-[100px] -z-10" />
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
            <BarChart3 size={16} /> Catalogue Stats
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">The Numbers</h1>
          <p className="text-xs text-slate-400 mb-3">Updated {new Date(snapshot.generated_at).toLocaleString()}</p>
          <p className="text-slate-400 max-w-xl mx-auto">What {totalChars.toLocaleString()} characters across {songCount} songs look like under a microscope.</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">

        {/* RANDOM LYRIC */}
        {randomLyric && (
          <div
            onClick={() => navigate(`/song/${randomLyric.song.slug}`)}
            className="bg-gradient-to-r from-slate-900 to-slate-900/50 border border-slate-800 rounded-2xl p-8 cursor-pointer hover:border-primary/30 transition-all group"
          >
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={12} /> Random Lyric
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-3 group-hover:text-primary transition-colors">
              {sc(randomLyric.line)}
            </p>
            <p className="text-slate-500 text-sm">
              — {sc(randomLyric.song.title_zh || randomLyric.song.title_en)} · {randomLyric.song.artist_en || sc(randomLyric.song.artist_zh)}
            </p>
          </div>
        )}

        {/* TOP STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Music} label="Songs" value={songCount.toLocaleString()} />
          <StatCard icon={Users} label="Artists" value={artistCount.toLocaleString()} color="text-violet-400" />
          <StatCard icon={Type} label="Characters" value={totalChars.toLocaleString()} sub={`${uniqueCharCount.toLocaleString()} unique`} color="text-amber-400" />
          <StatCard icon={Hash} label="Lines" value={totalLines.toLocaleString()} sub={`~${avgLines} per song`} color="text-emerald-400" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Globe} label="Translations" value={translationCount.toLocaleString()} color="text-blue-400" />
          <StatCard icon={MessageSquare} label="Comments" value={commentCount.toLocaleString()} color="text-pink-400" />
          <StatCard icon={Heart} label="Likes" value={totalLikes.toLocaleString()} color="text-red-400" />
        </div>

        {/* MOOD RADAR + MOOD CHAMPIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Heart} title="Emotional Palette" color="text-pink-400" />
            <p className="text-slate-500 text-xs mb-4">Keyword-driven mood profile across all lyrics</p>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={moodData.radar}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="mood" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Radar name="Intensity" dataKey="value" stroke="#ec4899" fill="#ec4899" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Music} title="Mood Champions" color="text-violet-400" />
            <p className="text-slate-500 text-xs mb-4">The song that best represents each vibe</p>
            <div className="space-y-3">
              {moodData.champions.map(({ mood, title, slug, count }) => (
                <div
                  key={mood}
                  onClick={() => navigate(`/song/${slug}`)}
                  className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-primary text-xs font-bold w-20">{mood}</span>
                    <span className="text-white text-sm font-medium truncate">{sc(title)}</span>
                  </div>
                  <span className="text-slate-500 text-xs flex-shrink-0">{count} hits</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MOST COMMON CHARACTERS + COMPOUNDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Type} title="Most Used Characters" color="text-amber-400" />
            <div className="space-y-2 mb-6">
              {charFreq.slice(0, 10).map(([char, count], i) => (
                <RankBar key={char} rank={i + 1} label={sc(char)} value={count} maxValue={charFreq[0][1]} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
              {charFreq.slice(10, 40).map(([char, count]) => (
                <span key={char} className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-sm border border-slate-700 hover:border-primary/50 hover:text-primary transition-colors cursor-default" title={`${count} uses`}>
                  {sc(char)} <span className="text-slate-600 text-[10px]">{count}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Hash} title="Most Used Phrases" color="text-pink-400" />
            <p className="text-slate-500 text-xs mb-4">Two-character pairs that keep showing up</p>
            {compounds.length === 0 ? (
              <p className="text-slate-600 text-sm italic">Not enough data yet.</p>
            ) : (
              <>
                <div className="space-y-2 mb-6">
                  {compounds.slice(0, 10).map(([word, count], i) => (
                    <RankBar key={word} rank={i + 1} label={sc(word)} value={count} maxValue={compounds[0][1]} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
                  {compounds.slice(10, 30).map(([word, count]) => (
                    <span key={word} className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-sm border border-slate-700 hover:border-primary/50 hover:text-primary transition-colors cursor-default" title={`${count} uses`}>
                      {sc(word)} <span className="text-slate-600 text-[10px]">{count}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* SONG SIGNATURES (TF-IDF) */}
        {signatureData.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Fingerprint} title="Song Signatures" color="text-cyan-400" />
            <p className="text-slate-500 text-xs mb-6">Phrases that are distinctive to each song — words you won't find much elsewhere in the catalog</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {signatureData.map((song, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/song/${song.slug}`)}
                  className="bg-slate-800/30 rounded-xl p-4 hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <p className="text-white text-sm font-bold mb-3 truncate">{sc(song.title)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {song.signatures.map(({ compound, count }) => (
                      <span key={compound} className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2.5 py-1 rounded-full text-sm">
                        {sc(compound)} <span className="text-cyan-500/50 text-[10px]">&times;{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TONE DISTRIBUTION + LINE LENGTH */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={BookOpen} title="Tone Distribution" color="text-violet-400" />
            <p className="text-slate-500 text-xs mb-4">Which of the four tones appears most</p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={toneData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  dataKey="value"
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {toneData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={BarChart3} title="Line Length" color="text-emerald-400" />
            <p className="text-slate-500 text-xs mb-4">Characters per line across all songs</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={lineLengthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Lines" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GHOST CHARACTERS + RHYME SCORE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {ghostData.total > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <SectionHeader icon={Ghost} title="Ghost Characters" color="text-orange-400" />
              <p className="text-slate-500 text-xs mb-2">{ghostData.total} characters appear in only one song across the entire catalog</p>
              <div className="space-y-4 mt-4">
                {ghostData.bySong.map((entry, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/song/${entry.slug}`)}
                    className="bg-slate-800/30 rounded-lg p-3 hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <p className="text-white text-sm font-medium mb-2 truncate">{sc(entry.title)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.chars.slice(0, 12).map(char => (
                        <span key={char} className="bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2 py-0.5 rounded text-sm font-medium">
                          {sc(char)}
                        </span>
                      ))}
                      {entry.chars.length > 12 && <span className="text-slate-600 text-xs self-center">+{entry.chars.length - 12}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rhymeData.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <SectionHeader icon={Mic} title="Rhyme Density" color="text-blue-400" />
              <p className="text-slate-500 text-xs mb-4">How often line endings rhyme with nearby lines</p>
              <div className="space-y-2">
                {rhymeData.slice(0, 10).map((song, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/song/${song.slug}`)}
                    className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-600 text-xs font-mono w-5">{i + 1}</span>
                      <span className="text-white text-sm font-medium truncate">{sc(song.title)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-blue-400 text-sm font-bold">{song.density}%</span>
                      <span className="text-slate-600 text-[10px]">{song.rhymeLines}/{song.totalLines}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* VOCABULARY RANGE */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <SectionHeader icon={BookOpen} title="Vocabulary Range" color="text-cyan-400" />
          <p className="text-slate-500 text-xs mb-4">Unique character ratio — higher means more variety, lower means more repetition</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {diversityData.slice(0, 10).map((song, i) => (
              <div
                key={i}
                onClick={() => navigate(`/song/${song.slug}`)}
                className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-600 text-xs font-mono w-5">{i + 1}</span>
                  <span className="text-white text-sm font-medium truncate">{sc(song.title)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-primary text-sm font-bold">{song.ratio}%</span>
                  <span className="text-slate-600 text-[10px]">{song.unique}/{song.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SHARED LINES */}
        {repeatedLines.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Repeat} title="Shared Lines" color="text-orange-400" />
            <p className="text-slate-500 text-xs mb-4">The same lyric showing up in completely different songs</p>
            <div className="space-y-3">
              {repeatedLines.map((item, i) => (
                <div key={i} className="bg-slate-800/30 rounded-lg p-4">
                  <p className="text-white font-medium mb-2">"{sc(item.line)}"</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-primary text-xs font-bold">{item.count} songs:</span>
                    {item.songs.slice(0, 4).map((song, j) => (
                      <span key={j} className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded">{sc(song)}</span>
                    ))}
                    {item.songCount > 4 && <span className="text-slate-600 text-xs">+{item.songCount - 4} more</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MOST LIKED + TAGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <SectionHeader icon={Heart} title="Most Liked" color="text-red-400" />
            {topLiked.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No liked songs yet.</p>
            ) : (
              <div className="space-y-2">
                {topLiked.map((song, i) => (
                  <RankBar
                    key={song.id} rank={i + 1}
                    label={`${sc(song.title_zh || song.title_en)} — ${song.artist_en || ''}`}
                    value={song.likeCount} maxValue={topLiked[0]?.likeCount || 1}
                    onClick={() => navigate(`/song/${song.slug}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {tagDist.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <SectionHeader icon={TrendingUp} title="Tags" color="text-emerald-400" />
              <div className="flex flex-wrap gap-3">
                {tagDist.map(([tag, count]) => (
                  <div key={tag} className="bg-slate-800 border border-slate-700 rounded-full px-4 py-2 flex items-center gap-2 hover:border-primary/50 transition-colors">
                    <span className="text-primary text-sm font-bold">#{tag}</span>
                    <span className="text-slate-500 text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* THROUGH THE DECADES */}
        {yearData && yearData.length >= 2 && (
          <div className="pt-8 border-t border-slate-800/50 space-y-8">
            <div className="text-center mb-4">
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-2">Over Time</p>
              <h2 className="text-3xl font-black">Through the Decades</h2>
              <p className="text-slate-500 text-sm mt-2">How the songwriting changed</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <SectionHeader icon={Calendar} title="Avg Characters Per Line" color="text-blue-400" />
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={yearData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="decade" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="avgLineLength" name="Avg chars/line" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <SectionHeader icon={TrendingUp} title="Vocabulary Diversity" color="text-violet-400" />
                <p className="text-slate-500 text-xs mb-4">Unique character ratio per decade</p>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={yearData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="decade" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="uniqueRatio" name="Unique ratio" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <SectionHeader icon={Music} title="Songs Per Decade" color="text-emerald-400" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={yearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="decade" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="songs" name="Songs" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* FUN FACTS */}
        <div className="bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 rounded-2xl p-8">
          <SectionHeader icon={Sparkles} title="Fun Facts" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-slate-400">Total text volume</p>
              <p className="text-white font-bold mt-1">{totalChars.toLocaleString()} characters — about {Math.round(totalChars / 3500)} pages</p>
            </div>
            {charFreq[0] && (
              <div>
                <p className="text-slate-400">Most used character</p>
                <p className="text-white font-bold mt-1 text-xl">{sc(charFreq[0][0])} — {charFreq[0][1].toLocaleString()} times</p>
              </div>
            )}
            <div>
              <p className="text-slate-400">Average song</p>
              <p className="text-white font-bold mt-1">{avgLines} lines, ~{songCount ? Math.round(totalChars / songCount) : 0} characters</p>
            </div>
            {diversityData[0] && (
              <div>
                <p className="text-slate-400">Widest vocabulary</p>
                <p className="text-white font-bold mt-1">{sc(diversityData[0].title)} ({diversityData[0].ratio}% unique)</p>
              </div>
            )}
            {diversityData.length > 0 && (
              <div>
                <p className="text-slate-400">Most repetitive</p>
                <p className="text-white font-bold mt-1">{sc(mostRepetitive.title)} ({mostRepetitive.ratio}% unique)</p>
              </div>
            )}
            {rhymeData[0] && (
              <div>
                <p className="text-slate-400">Heaviest rhymer</p>
                <p className="text-white font-bold mt-1">{sc(rhymeData[0].title)} ({rhymeData[0].density}% rhyme density)</p>
              </div>
            )}
            {ghostData.total > 0 && (
              <div>
                <p className="text-slate-400">Ghost characters</p>
                <p className="text-white font-bold mt-1">{ghostData.total} chars appear in only one song</p>
              </div>
            )}
            {songCount > 0 && (
              <div>
                <p className="text-slate-400">Longest song</p>
                <p className="text-white font-bold mt-1">
                  {longestSong ? `${sc(longestSong.title)} (${longestSong.lines} lines)` : 'N/A'}
                </p>
              </div>
            )}
            {compounds[0] && (
              <div>
                <p className="text-slate-400">Most used phrase</p>
                <p className="text-white font-bold mt-1 text-xl">{sc(compounds[0][0])} — {compounds[0][1]} times</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default StatsPage;
