import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useTagSuggestions } from '../hooks/useTagSuggestions';

const MAX_SUGGESTIONS = 8;

const TagInput = ({ tags, setTags, placeholder }) => {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const allSuggestions = useTagSuggestions();

  const trimmed = input.trim();
  const selectedLower = new Set(tags.map((t) => t.toLowerCase()));

  // Existing tags that aren't already picked, filtered by what's typed
  const matches = allSuggestions
    .filter((s) => !selectedLower.has(s.toLowerCase()))
    .filter((s) => !trimmed || s.toLowerCase().includes(trimmed.toLowerCase()))
    .slice(0, MAX_SUGGESTIONS);

  const exactExists =
    selectedLower.has(trimmed.toLowerCase()) ||
    matches.some((s) => s.toLowerCase() === trimmed.toLowerCase());

  // Rows = matching existing tags, plus a "Create" row when the typed value is new
  const rows = [
    ...matches.map((value) => ({ type: 'tag', value })),
    ...(trimmed && !exactExists ? [{ type: 'create', value: trimmed }] : []),
  ];

  const addTag = (raw) => {
    const value = (raw || '').trim();
    if (value && !selectedLower.has(value.toLowerCase())) {
      setTags([...tags, value]);
    }
    setInput('');
    setHighlight(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlight >= 0 && rows[highlight]) addTag(rows[highlight].value);
      else if (trimmed) addTag(trimmed);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full relative">
      <div className="flex flex-wrap gap-2 bg-slate-900 border border-slate-700 p-2 rounded-lg focus-within:border-primary transition-colors min-h-[50px]">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="flex items-center gap-1 bg-slate-800 text-primary px-2 py-1 rounded text-sm border border-slate-700 animate-fade-in"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-slate-500 hover:text-white"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setHighlight(-1); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="bg-transparent outline-none text-white flex-1 min-w-[120px] text-sm"
        />
      </div>

      {open && rows.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {rows.map((row, i) => (
            <button
              key={`${row.type}-${row.value}`}
              type="button"
              // mousedown (not click) so the input doesn't blur away before we add
              onMouseDown={(e) => { e.preventDefault(); addTag(row.value); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                highlight === i ? 'bg-slate-800' : 'hover:bg-slate-800'
              } ${row.type === 'create' ? 'text-primary' : 'text-slate-200'}`}
            >
              {row.type === 'create' ? (
                <>
                  <Plus size={14} />
                  <span>Create <span className="font-semibold">"{row.value}"</span></span>
                </>
              ) : (
                row.value
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-500 mt-1 pl-1">
        Press Enter or comma to add. Pick a suggestion or create your own.
      </p>
    </div>
  );
};

export default TagInput;
