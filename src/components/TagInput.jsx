import React, { useState } from 'react';
import { X } from 'lucide-react';

const TagInput = ({ tags, setTags, placeholder }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.trim();
      if (value && !tags.includes(value)) {
        setTags([...tags, value]);
        setInput('');
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="bg-transparent outline-none text-white flex-1 min-w-[120px] text-sm"
        />
      </div>
      {/* THIS IS THE TEXT WE ARE MATCHING */}
      <p className="text-[10px] text-slate-500 mt-1 pl-1">
        Press Enter or comma to add multiple tags.
      </p>
    </div>
  );
};

export default TagInput;