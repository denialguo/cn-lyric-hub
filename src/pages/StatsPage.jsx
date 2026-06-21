import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Music, Users, Type, Heart, TrendingUp, Hash, Sparkles, MessageSquare, Globe, Calendar, Repeat, BookOpen, Fingerprint, Ghost, Mic } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../lib/supabaseClient';
import Navbar from '../components/Navbar';
import { pinyin as getPinyin } from 'pinyin-pro';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { isChinese } from '../utils/lyrics';
import { sify, tify } from 'chinese-conv';
import { useTheme } from '../context/ThemeContext';

const MOOD_KEYWORDS = {
  'Love': '爱情恋心吻亲甜蜜',
  'Heartbreak': '泪哭伤痛悲苦愁碎',
  'Dreams': '梦想星月光夜空飞',
  'Nature': '风雨花海天山水云雪',
  'Longing': '思念等候望归忆远',
  'Solitude': '寂寞孤独冷暗默影',
};

// --- ANALYSIS FUNCTIONS ---

const analyzeCharacters = (songs) => {
  const freq = {};
  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    [...song.lyrics_chinese].forEach(char => {
      if (isChinese(char)) freq[char] = (freq[char] || 0) + 1;
    });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]);
};

const analyzeCompounds = (songs) => {
  const freq = {};
  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    song.lyrics_chinese.split('\n').forEach(line => {
      const chars = [...line].filter(isChinese);
      for (let i = 0; i < chars.length - 1; i++) {
        const compound = chars[i] + chars[i + 1];
        freq[compound] = (freq[compound] || 0) + 1;
      }
    });
  });
  return Object.entries(freq)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
};

const analyzeTones = (songs) => {
  const tones = { '1st (ā)': 0, '2nd (á)': 0, '3rd (ǎ)': 0, '4th (à)': 0, 'Neutral': 0 };
  const t1 = /[āēīōūǖ]/g, t2 = /[áéíóúǘ]/g, t3 = /[ǎěǐǒǔǚ]/g, t4 = /[àèìòùǜ]/g;

  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    [...song.lyrics_chinese].filter(isChinese).forEach(char => {
      const py = getPinyin(char, { toneType: 'symbol' });
      if (t1.test(py)) tones['1st (ā)']++;
      else if (t2.test(py)) tones['2nd (á)']++;
      else if (t3.test(py)) tones['3rd (ǎ)']++;
      else if (t4.test(py)) tones['4th (à)']++;
      else tones['Neutral']++;
    });
  });
  return Object.entries(tones).map(([name, value]) => ({ name, value }));
};

const analyzeLineLength = (songs) => {
  const buckets = { '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0, '21-25': 0, '26+': 0 };
  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    song.lyrics_chinese.split('\n').forEach(line => {
      const count = [...line].filter(isChinese).length;
      if (count === 0) return;
      if (count <= 5) buckets['1-5']++;
      else if (count <= 10) buckets['6-10']++;
      else if (count <= 15) buckets['11-15']++;
      else if (count <= 20) buckets['16-20']++;
      else if (count <= 25) buckets['21-25']++;
      else buckets['26+']++;
    });
  });
  return Object.entries(buckets).map(([range, count]) => ({ range, count }));
};

const findRepeatedLines = (songs) => {
  const lineFreq = {};
  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    const lines = song.lyrics_chinese.split('\n').map(l => l.trim()).filter(l => l && isChinese(l[0]) && l.length > 4);
    const seen = new Set();
    lines.forEach(line => {
      if (!seen.has(line)) {
        lineFreq[line] = (lineFreq[line] || { count: 0, songs: [] });
        lineFreq[line].count++;
        lineFreq[line].songs.push(song.title_zh || song.title_en);
        seen.add(line);
      }
    });
  });
  return Object.entries(lineFreq)
    .filter(([, data]) => data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([line, data]) => ({ line, ...data }));
};

const analyzeByYear = (songs) => {
  const yearSongs = songs.filter(s => s.year && s.lyrics_chinese);
  if (yearSongs.length < 3) return null;

  const byYear = {};
  yearSongs.forEach(song => {
    const decade = Math.floor(song.year / 10) * 10;
    if (!byYear[decade]) byYear[decade] = { songs: [], totalChars: 0, uniqueChars: new Set(), totalLines: 0 };
    byYear[decade].songs.push(song);
    byYear[decade].totalLines += song.lyrics_chinese.split('\n').filter(l => l.trim()).length;
    [...song.lyrics_chinese].forEach(char => {
      if (isChinese(char)) {
        byYear[decade].totalChars++;
        byYear[decade].uniqueChars.add(char);
      }
    });
  });

  return Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([decade, data]) => ({
      decade: `${decade}s`,
      songs: data.songs.length,
      avgLineLength: Math.round(data.totalChars / Math.max(data.totalLines, 1)),
      uniqueRatio: Math.round((data.uniqueChars.size / Math.max(data.totalChars, 1)) * 100),
      vocabulary: data.uniqueChars.size,
    }));
};

const analyzeDiversity = (songs) => {
  return songs
    .filter(s => s.lyrics_chinese)
    .map(song => {
      const chars = [...song.lyrics_chinese].filter(isChinese);
      const unique = new Set(chars);
      return {
        title: song.title_zh || song.title_en || 'Untitled',
        slug: song.slug,
        total: chars.length,
        unique: unique.size,
        ratio: chars.length > 0 ? Math.round((unique.size / chars.length) * 100) : 0,
      };
    })
    .filter(s => s.total > 20)
    .sort((a, b) => b.ratio - a.ratio);
};

const analyzeMoods = (songs) => {
  const scores = {};
  const songScores = {};
  Object.keys(MOOD_KEYWORDS).forEach(mood => { scores[mood] = 0; songScores[mood] = { max: 0, song: null }; });

  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    const chars = [...song.lyrics_chinese];
    Object.entries(MOOD_KEYWORDS).forEach(([mood, keywords]) => {
      const count = chars.filter(c => keywords.includes(c)).length;
      scores[mood] += count;
      if (count > songScores[mood].max) {
        songScores[mood] = { max: count, song };
      }
    });
  });

  const max = Math.max(...Object.values(scores), 1);
  const radar = Object.entries(scores).map(([mood, score]) => ({
    mood,
    value: Math.round((score / max) * 100),
    raw: score,
  }));

  const champions = Object.entries(songScores)
    .filter(([, data]) => data.song)
    .map(([mood, data]) => ({
      mood,
      title: data.song.title_zh || data.song.title_en,
      slug: data.song.slug,
      count: data.max,
    }));

  return { radar, champions };
};

const analyzeGhostChars = (songs) => {
  const charSongs = {};
  songs.forEach(song => {
    if (!song.lyrics_chinese) return;
    const seen = new Set();
    [...song.lyrics_chinese].forEach(char => {
      if (isChinese(char) && !seen.has(char)) {
        if (!charSongs[char]) charSongs[char] = [];
        charSongs[char].push(song);
        seen.add(char);
      }
    });
  });

  const ghosts = Object.entries(charSongs)
    .filter(([, s]) => s.length === 1)
    .map(([char, s]) => ({ char, song: s[0] }));

  const bySong = {};
  ghosts.forEach(({ char, song }) => {
    const key = song.slug;
    if (!bySong[key]) bySong[key] = { title: song.title_zh || song.title_en, slug: song.slug, chars: [] };
    bySong[key].chars.push(char);
  });

  return {
    total: ghosts.length,
    bySong: Object.values(bySong).sort((a, b) => b.chars.length - a.chars.length).slice(0, 8),
  };
};

const analyzeSongSignatures = (songs) => {
  const songsWithCompounds = songs.filter(s => s.lyrics_chinese).map(song => {
    const freq = {};
    song.lyrics_chinese.split('\n').forEach(line => {
      const chars = [...line].filter(isChinese);
      for (let i = 0; i < chars.length - 1; i++) {
        const compound = chars[i] + chars[i + 1];
        freq[compound] = (freq[compound] || 0) + 1;
      }
    });
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    return { song, freq, total };
  }).filter(s => s.total > 0);

  const docFreq = {};
  songsWithCompounds.forEach(({ freq }) => {
    Object.keys(freq).forEach(compound => {
      docFreq[compound] = (docFreq[compound] || 0) + 1;
    });
  });

  const N = songsWithCompounds.length;

  return songsWithCompounds.map(({ song, freq, total }) => {
    const scores = Object.entries(freq).map(([compound, count]) => ({
      compound,
      score: (count / total) * Math.log(N / (docFreq[compound] || 1)),
      count,
    }));
    scores.sort((a, b) => b.score - a.score);
    return {
      title: song.title_zh || song.title_en || 'Untitled',
      slug: song.slug,
      signatures: scores.slice(0, 5).filter(s => s.score > 0),
    };
  }).filter(s => s.signatures.length >= 3)
    .sort((a, b) => b.signatures[0].score - a.signatures[0].score)
    .slice(0, 8);
};

const analyzeRhymes = (songs) => {
  return songs
    .filter(s => s.lyrics_chinese)
    .map(song => {
      const lines = song.lyrics_chinese.split('\n')
        .map(l => l.trim())
        .filter(l => l && [...l].some(isChinese));

      if (lines.length < 4) return null;

      const finals = lines.map(line => {
        const chars = [...line].filter(isChinese);
        if (chars.length === 0) return '';
        const py = getPinyin(chars[chars.length - 1], { toneType: 'none' });
        const match = py.match(/[aeiouü].*/);
        return match ? match[0] : '';
      });

      let rhymes = 0;
      for (let i = 1; i < finals.length; i++) {
        if (!finals[i]) continue;
        for (let j = Math.max(0, i - 2); j < i; j++) {
          if (finals[j] && finals[j] === finals[i]) { rhymes++; break; }
        }
      }

      return {
        title: song.title_zh || song.title_en || 'Untitled',
        slug: song.slug,
        density: Math.round((rhymes / Math.max(lines.length - 1, 1)) * 100),
        rhymeLines: rhymes,
        totalLines: lines.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.density - a.density);
};

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
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState([]);
  const [topLiked, setTopLiked] = useState([]);
  const [artistCount, setArtistCount] = useState(0);
  const [translationCount, setTranslationCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [randomLyric, setRandomLyric] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: songsData } = await supabase
        .from('songs')
        .select('id, title_zh, title_en, artist_en, artist_zh, lyrics_chinese, tags, slug, cover_url, year');

      const { data: likedData } = await supabase
        .from('songs')
        .select('id, title_zh, title_en, artist_en, slug, cover_url, song_likes(count)');

      const { count: artists } = await supabase.from('artists').select('*', { count: 'exact', head: true });
      const { count: translations } = await supabase.from('line_translations').select('*', { count: 'exact', head: true });
      const { count: comments } = await supabase.from('comments').select('*', { count: 'exact', head: true });

      if (songsData) setSongs(songsData.map(s => s.lyrics_chinese ? { ...s, lyrics_chinese: sify(s.lyrics_chinese) } : s));

      if (likedData) {
        const sorted = likedData
          .map(s => ({ ...s, likeCount: s.song_likes?.[0]?.count || 0 }))
          .filter(s => s.likeCount > 0)
          .sort((a, b) => b.likeCount - a.likeCount)
          .slice(0, 10);
        setTopLiked(sorted);
      }

      setArtistCount(artists || 0);
      setTranslationCount(translations || 0);
      setCommentCount(comments || 0);

      if (songsData?.length) {
        const withLyrics = songsData.filter(s => s.lyrics_chinese);
        if (withLyrics.length) {
          const rs = withLyrics[Math.floor(Math.random() * withLyrics.length)];
          const lines = rs.lyrics_chinese.split('\n').filter(l => l.trim() && [...l].some(isChinese));
          if (lines.length) {
            setRandomLyric({ line: lines[Math.floor(Math.random() * lines.length)], song: rs });
          }
        }
      }

      setLoading(false);
    };
    fetchAll();
  }, []);

  const charFreq = useMemo(() => analyzeCharacters(songs), [songs]);
  const compounds = useMemo(() => analyzeCompounds(songs), [songs]);
  const toneData = useMemo(() => analyzeTones(songs), [songs]);
  const lineLengthData = useMemo(() => analyzeLineLength(songs), [songs]);
  const repeatedLines = useMemo(() => findRepeatedLines(songs), [songs]);
  const yearData = useMemo(() => analyzeByYear(songs), [songs]);
  const diversityData = useMemo(() => analyzeDiversity(songs), [songs]);
  const moodData = useMemo(() => analyzeMoods(songs), [songs]);
  const ghostData = useMemo(() => analyzeGhostChars(songs), [songs]);
  const signatureData = useMemo(() => analyzeSongSignatures(songs), [songs]);
  const rhymeData = useMemo(() => analyzeRhymes(songs), [songs]);
  const tagDist = useMemo(() => {
    const tags = {};
    songs.forEach(s => (s.tags || []).forEach(t => { tags[t.toLowerCase()] = (tags[t.toLowerCase()] || 0) + 1; }));
    return Object.entries(tags).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  const totalLines = useMemo(() => songs.reduce((t, s) => t + (s.lyrics_chinese?.split('\n').filter(l => l.trim()).length || 0), 0), [songs]);
  const totalChars = useMemo(() => songs.reduce((t, s) => t + (s.lyrics_chinese ? [...s.lyrics_chinese].filter(isChinese).length : 0), 0), [songs]);
  const uniqueCharCount = useMemo(() => {
    const set = new Set();
    songs.forEach(s => { if (s.lyrics_chinese) [...s.lyrics_chinese].forEach(c => { if (isChinese(c)) set.add(c); }); });
    return set.size;
  }, [songs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh] text-slate-500">Crunching the numbers...</div>
      </div>
    );
  }

  const avgLines = songs.length ? Math.round(totalLines / songs.length) : 0;

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
            <BarChart3 size={16} /> Live Stats
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">The Numbers</h1>
          <p className="text-slate-400 max-w-xl mx-auto">What {totalChars.toLocaleString()} characters across {songs.length} songs look like under a microscope.</p>
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
          <StatCard icon={Music} label="Songs" value={songs.length.toLocaleString()} />
          <StatCard icon={Users} label="Artists" value={artistCount.toLocaleString()} color="text-violet-400" />
          <StatCard icon={Type} label="Characters" value={totalChars.toLocaleString()} sub={`${uniqueCharCount.toLocaleString()} unique`} color="text-amber-400" />
          <StatCard icon={Hash} label="Lines" value={totalLines.toLocaleString()} sub={`~${avgLines} per song`} color="text-emerald-400" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Globe} label="Translations" value={translationCount.toLocaleString()} color="text-blue-400" />
          <StatCard icon={MessageSquare} label="Comments" value={commentCount.toLocaleString()} color="text-pink-400" />
          <StatCard icon={Heart} label="Likes" value={topLiked.reduce((s, x) => s + x.likeCount, 0).toLocaleString()} color="text-red-400" />
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
                    {item.songs.length > 4 && <span className="text-slate-600 text-xs">+{item.songs.length - 4} more</span>}
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
              <p className="text-white font-bold mt-1">{avgLines} lines, ~{songs.length ? Math.round(totalChars / songs.length) : 0} characters</p>
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
                <p className="text-white font-bold mt-1">{sc(diversityData[diversityData.length - 1].title)} ({diversityData[diversityData.length - 1].ratio}% unique)</p>
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
            {songs.length > 0 && (
              <div>
                <p className="text-slate-400">Longest song</p>
                <p className="text-white font-bold mt-1">
                  {(() => {
                    const longest = songs.filter(s => s.lyrics_chinese)
                      .sort((a, b) => b.lyrics_chinese.split('\n').filter(l => l.trim()).length - a.lyrics_chinese.split('\n').filter(l => l.trim()).length)[0];
                    return longest ? `${sc(longest.title_zh || longest.title_en)} (${longest.lyrics_chinese.split('\n').filter(l => l.trim()).length} lines)` : 'N/A';
                  })()}
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
