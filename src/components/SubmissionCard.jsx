import React from 'react';
import { Clock, AlertCircle, Trash2, Edit3, Sparkles, Music, ArrowRight } from 'lucide-react';

const DIFF_FIELDS = [
  { key: 'title_en',        label: 'Title (EN)' },
  { key: 'title_zh',        label: 'Title (ZH)' },
  { key: 'artist_en',       label: 'Artist (EN)' },
  { key: 'artist_zh',       label: 'Artist (ZH)' },
  { key: 'cover_url',       label: 'Cover URL' },
  { key: 'youtube_url',     label: 'YouTube URL' },
  { key: 'bio',             label: 'About' },
  { key: 'credits',         label: 'Credits' },
  { key: 'year',            label: 'Release Year' },
  { key: 'lyrics_chinese',  label: 'Chinese Lyrics' },
  { key: 'lyrics_pinyin',   label: 'Pinyin' },
  { key: 'lyrics_english',  label: 'English Lyrics' },
];

const LONG_FIELDS = new Set(['lyrics_chinese', 'lyrics_pinyin', 'lyrics_english']);

const getChangedFields = (sub, orig) => {
  if (!orig) return [];
  const changes = [];

  for (const { key, label } of DIFF_FIELDS) {
    const oldVal = orig[key] || '';
    const newVal = sub[key] || '';
    if (oldVal !== newVal) {
      changes.push({ label, key, oldVal, newVal });
    }
  }

  const oldTags = (orig.tags || []).join(', ');
  const newTags = (sub.tags || []).join(', ');
  if (oldTags !== newTags) {
    changes.push({ label: 'Tags', key: 'tags', oldVal: oldTags || '(none)', newVal: newTags || '(none)' });
  }

  return changes;
};

const truncate = (str, max = 60) => {
  if (!str) return '(empty)';
  return str.length > max ? str.slice(0, max) + '…' : str;
};

const SubmissionCard = ({ item, onReview, onReject }) => {
  const isEdit = item.status === 'pending_edit' || item.original_song_id;
  const mainTitle = item.title_en || item.title_zh || "Untitled";
  const displayArtist = item.artist_en || item.artist_zh || "Unknown Artist";

  const changedFields = isEdit ? getChangedFields(item, item.originalData) : [];
  const metadataChanges = changedFields.filter(c => !LONG_FIELDS.has(c.key));
  const contentChanges = changedFields.filter(c => LONG_FIELDS.has(c.key));

  return (
    <div className="p-6 hover:bg-slate-800/30 transition-colors">
      <div className="flex flex-col md:flex-row justify-between gap-6">

        <div className="flex-1 flex flex-col sm:flex-row gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
            {item.cover_url ? (
              <img src={item.cover_url} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-8 h-8 text-slate-700" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h3 className="text-xl font-bold text-white">{mainTitle}</h3>
              {item.title_zh && item.title_zh !== mainTitle && (
                <span className="text-sm text-slate-400 border border-slate-700 px-2 py-0.5 rounded bg-slate-800/50">
                  {item.title_zh}
                </span>
              )}
              {isEdit ? (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded">
                  <Edit3 size={12} /> Edit Suggestion
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded">
                  <Sparkles size={12} /> New Song
                </span>
              )}
            </div>

            <p className="text-slate-400 text-sm mb-4">
              by <span className="text-slate-200 font-medium">{displayArtist}</span> •
              Submitted by <span className="text-primary font-medium">{item.submitted_by || 'Anonymous'}</span> on {new Date(item.created_at).toLocaleDateString()}
            </p>

            {isEdit ? (
              <div className="bg-purple-950/20 border border-purple-900/50 p-4 rounded-lg space-y-3">
                <p className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle size={14} /> {changedFields.length} Field{changedFields.length !== 1 ? 's' : ''} Modified
                </p>

                {changedFields.length === 0 && (
                  <p className="text-xs text-slate-500 italic">No detectable changes from original.</p>
                )}

                {metadataChanges.length > 0 && (
                  <div className="space-y-2">
                    {metadataChanges.map((change, idx) => (
                      <div key={idx} className="bg-slate-950/50 rounded-lg p-3 border border-purple-900/30">
                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1.5">{change.label}</p>
                        <div className="flex items-start gap-2 text-xs font-mono">
                          <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded flex-1 break-all">
                            {truncate(change.oldVal)}
                          </span>
                          <ArrowRight size={14} className="text-slate-600 flex-shrink-0 mt-1" />
                          <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded flex-1 break-all">
                            {truncate(change.newVal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {contentChanges.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {contentChanges.map((change, idx) => (
                      <span key={idx} className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs px-2 py-1 rounded flex items-center gap-1.5">
                        <Edit3 size={10} /> {change.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-lg text-xs font-mono border border-slate-800">
                <div>
                  <p className="text-slate-500 mb-1">Chinese Sample</p>
                  <p className="text-slate-300 line-clamp-2">{item.lyrics_chinese || "(No Chinese lyrics provided)"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">English Sample</p>
                  <p className="text-slate-300 line-clamp-2">{item.lyrics_english || "(No English lyrics provided)"}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex md:flex-col gap-3 justify-center min-w-[140px] pt-2 md:pt-0">
          <button
            onClick={() => onReview(item.id)}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg ${isEdit ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20 text-white' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 text-white'}`}
          >
            <Clock size={16} /> Review
          </button>
          <button
            onClick={() => onReject(item.id)}
            className="bg-slate-800 hover:bg-red-500/10 hover:text-red-400 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>

      </div>
    </div>
  );
};

export default SubmissionCard;