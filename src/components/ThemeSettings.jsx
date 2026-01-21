import React, { useState } from 'react';
import { Palette, Moon, Sun, X } from 'lucide-react'; // <--- Changed Settings to Palette
import { useTheme } from '../context/ThemeContext';

const colors = [
  // Top row
  { id: 'cyan', bg: 'bg-cyan-500', label: 'Cyan' },
  { id: 'emerald', bg: 'bg-emerald-500', label: 'Emerald' },
  { id: 'rose', bg: 'bg-rose-500', label: 'Rose' },
  { id: 'violet', bg: 'bg-violet-500', label: 'Violet' },
  { id: 'amber', bg: 'bg-amber-500', label: 'Amber' },
  // Bottom row
  { id: 'blue', bg: 'bg-blue-500', label: 'Blue' },
  { id: 'indigo', bg: 'bg-indigo-500', label: 'Indigo' },
  { id: 'pink', bg: 'bg-pink-500', label: 'Pink' },
  { id: 'teal', bg: 'bg-teal-500', label: 'Teal' },
  { id: 'orange', bg: 'bg-orange-500', label: 'Orange' },
];

const ThemeSettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isDarkMode, setIsDarkMode, accentColor, setAccentColor } = useTheme();

  const handleColorChange = (colorId) => {
    setAccentColor(colorId);
  };

  const handleModeChange = (darkMode) => {
    setIsDarkMode(darkMode);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        aria-label="Theme settings"
      >
        <Palette className="w-5 h-5" /> {/* <--- The Paintbrush Icon */}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Settings Panel */}
          <div className="absolute right-0 mt-2 w-[280px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 z-50">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-slate-200">Appearance</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dark/Light Mode Toggle */}
            <div className="flex items-center justify-between mb-4 bg-slate-800 p-2 rounded-lg">
              <span className="text-xs text-slate-400">Mode</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleModeChange(false)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
                    !isDarkMode 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span className="text-xs font-medium">Light</span>
                </button>
                <button
                  onClick={() => handleModeChange(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
                    isDarkMode 
                      ? 'bg-slate-700 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3 h-3" />
                  <span className="text-xs font-medium">Dark</span>
                </button>
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <span className="text-xs text-slate-400 mb-2 block">Accent Color</span>
              <div className="grid grid-cols-5 gap-2.5">
                {colors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleColorChange(c.id)}
                    className={`w-10 h-10 rounded-full ${c.bg} transition-all ${
                      accentColor === c.id 
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' 
                        : 'opacity-60 hover:opacity-100 hover:scale-105'
                    }`}
                    aria-label={`${c.label} theme`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSettings;