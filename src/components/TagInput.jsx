import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const TagInput = ({ tags, setTags, placeholder = "Add a tag..." }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e) => {
    // If Enter or Comma is pressed, add the tag
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        setTags([...tags, input.trim()]);
      }
      setInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span key={index} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm flex items-center gap-1 border border-emerald-500/30">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-white">
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-white w-full pr-10 focus:border-emerald-500 focus:outline-none transition-colors"
          placeholder={placeholder}
        />
        <Plus className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
      </div>
      <p className="text-xs text-slate-500">Press Enter or comma to add a tag</p>
    </div>
  );
};

export default TagInput;