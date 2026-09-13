import { pinyin as getPinyin } from 'pinyin-pro';
import { sify } from 'chinese-conv';
import { isChinese } from '../utils/lyrics.js';

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
  const t1 = /[āēīōūǖ]/, t2 = /[áéíóúǘ]/, t3 = /[ǎěǐǒǔǚ]/, t4 = /[àèìòùǜ]/;

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


export function buildCatalogueStats(rows, counts) {
  // Analyse simplified text consistently; the UI's script toggle changes labels.
  const songs = rows.map(s => ({ ...s, lyrics_chinese: sify(s.lyrics_chinese || '') }));
  const charFreq = analyzeCharacters(songs);
  const tags = {};
  let totalLines = 0;
  let longestSong = null;
  const lyricSamples = [];
  let eligibleSongs = 0;
  for (const song of songs) {
    for (const tag of song.tags || []) tags[tag.toLowerCase()] = (tags[tag.toLowerCase()] || 0) + 1;
    const lines = song.lyrics_chinese.split('\n').filter(l => l.trim());
    totalLines += lines.length;
    if (!longestSong || lines.length > longestSong.lines) {
      longestSong = { title: song.title_zh || song.title_en, lines: lines.length };
    }
    const eligible = lines.filter(l => [...l].some(isChinese));
    if (eligible.length) {
      const sample = {
      line: eligible[Math.floor(Math.random() * eligible.length)],
      song: { title_zh: song.title_zh, title_en: song.title_en, artist_en: song.artist_en, artist_zh: song.artist_zh, slug: song.slug },
      };
      // Keep a bounded, uniformly sampled pool without sending every lyric.
      const slot = Math.floor(Math.random() * ++eligibleSongs);
      if (lyricSamples.length < 100) lyricSamples.push(sample);
      else if (slot < 100) lyricSamples[slot] = sample;
    }
  }
  const liked = rows.map(s => ({
    id: s.id, title_zh: s.title_zh, title_en: s.title_en,
    artist_en: s.artist_en, slug: s.slug, likeCount: s.song_likes?.[0]?.count || 0,
  }));
  const diversity = analyzeDiversity(songs);
  const totalChars = charFreq.reduce((sum, [, count]) => sum + count, 0);
  return {
    songCount: songs.length, ...counts, totalLines, totalChars,
    avgLines: songs.length ? Math.round(totalLines / songs.length) : 0,
    uniqueCharCount: charFreq.length, charFreq: charFreq.slice(0, 50),
    compounds: analyzeCompounds(songs), toneData: analyzeTones(songs),
    lineLengthData: analyzeLineLength(songs), repeatedLines: findRepeatedLines(songs),
    yearData: analyzeByYear(songs), diversityData: diversity.slice(0, 10),
    mostRepetitive: diversity.at(-1) || null,
    moodData: analyzeMoods(songs), ghostData: analyzeGhostChars(songs),
    signatureData: analyzeSongSignatures(songs), rhymeData: analyzeRhymes(songs).slice(0, 10),
    tagDist: Object.entries(tags).sort((a, b) => b[1] - a[1]),
    topLiked: liked.filter(s => s.likeCount > 0).sort((a, b) => b.likeCount - a.likeCount).slice(0, 10),
    totalLikes: liked.reduce((sum, s) => sum + s.likeCount, 0),
    longestSong, lyricSamples,
  };
}
