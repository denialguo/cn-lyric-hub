import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

const LyricsEditor = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  minHeight = '150px',
  originalValue, // Optional — enables diff highlighting when provided
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const currentLines = (value || '').split('\n');
  const origLines =
    originalValue !== undefined && originalValue !== null
      ? String(originalValue).split('\n')
      : currentLines;
  const maxLines = Math.max(currentLines.length, origLines.length, 5);

  // Build diff info (only meaningful when originalValue is provided)
  const changedLines = [];
  if (originalValue !== undefined && originalValue !== null && originalValue !== value) {
    for (let i = 0; i < Math.max(currentLines.length, origLines.length); i++) {
      if (currentLines[i] !== origLines[i]) {
        changedLines.push({
          index: i + 1,
          orig: origLines[i],
          curr: currentLines[i],
        });
      }
    }
  }

  const isChanged = changedLines.length > 0;

  return (
    <div
      className={`flex flex-col gap-2 p-3 rounded-xl transition-colors ${
        isChanged
          ? 'bg-yellow-500/5 border border-yellow-500/30'
          : 'border border-transparent'
      }`}
    >
      <label className="text-slate-400 text-sm font-bold flex justify-between items-center">
        {label}
        {isChanged && (
          <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={12} /> Edited
          </span>
        )}
      </label>

      <div className="relative flex border border-slate-700 rounded-xl overflow-hidden bg-slate-900 focus-within:border-primary transition-colors">
        {/* Line Numbers */}
        <div className="bg-slate-800 text-slate-500 text-right pr-2 pt-4 font-mono text-sm leading-6 select-none w-12 flex-shrink-0 border-r border-slate-700">
          {Array.from({ length: maxLines }).map((_, i) => {
            const isDiff = changedLines.some((cl) => cl.index === i + 1);
            return (
              <div
                key={i}
                className={isDiff ? 'text-yellow-400 font-bold bg-yellow-500/20' : ''}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={onChange}
          rows={1}
          className="w-full bg-slate-900 text-white p-4 font-mono text-sm leading-6 outline-none resize-none whitespace-pre overflow-x-auto overflow-y-hidden"
          placeholder={placeholder}
          style={{ minHeight }}
        />
      </div>

      {/* Diff Details (only renders when there are actual changes) */}
      {isChanged && (
        <div className="mt-2 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Line Changes:</p>
          {changedLines.map((change) => (
            <div key={change.index} className="text-xs font-mono">
              <span className="text-slate-500 mb-1 block">Line {change.index}</span>
              {change.orig !== undefined && (
                <div className="text-red-400 bg-red-400/10 px-2 py-1 rounded mb-0.5 break-all">
                  - {change.orig === '' ? '(empty line)' : change.orig}
                </div>
              )}
              {change.curr !== undefined && (
                <div className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded break-all">
                  + {change.curr === '' ? '(empty line)' : change.curr}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LyricsEditor;