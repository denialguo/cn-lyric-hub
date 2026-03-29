import React, { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const ArtistSearch = ({ selectedArtists, onSelect, onRemove }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search DB when user types
  useEffect(() => {
    const searchDB = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      const { data } = await supabase
        .from('artists')
        .select('*')
        .or(`name_en.ilike.%${query}%,name_zh.ilike.%${query}%`)
        .limit(5);
      setResults(data || []);
      setSearching(false);
    };

    const debounce = setTimeout(searchDB, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (artist) => {
    onSelect(artist);
    setQuery('');
    setShowDropdown(false);
  };

  const createNewArtist = () => {
    onSelect({
      id: null,
      name_en: query,
      name_zh: '',
      isNew: true,
    });
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="relative space-y-2" ref={wrapperRef}>
      <label className="text-slate-400 text-sm font-bold">
        Artists <span className="text-primary">*</span>
      </label>

      {/* Selected Artists Chips */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedArtists.map((artist, i) => (
          <div
            key={`${i}-${artist.id || artist.name_en}`}
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${
              artist.isNew
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                : 'bg-primary/10 border-primary/50 text-primary'
            }`}
          >
            <span>
              {artist.name_en || artist.name_zh}{' '}
              {artist.name_zh && artist.name_en ? `(${artist.name_zh})` : ''}
            </span>
            <button type="button" onClick={() => onRemove(i)}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search for artist..."
          className="w-full bg-slate-900 border border-slate-700 p-3 pl-10 rounded-lg text-white focus:border-primary outline-none"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
      </div>

      {/* Dropdown Results */}
      {showDropdown && query && (
        <div className="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 shadow-xl overflow-hidden">
          {searching ? (
            <div className="p-4 text-xs text-slate-500 text-center">Searching...</div>
          ) : (
            <>
              {results.map((artist) => (
                <div
                  key={artist.id}
                  onClick={() => handleSelect(artist)}
                  className="p-3 hover:bg-slate-700 cursor-pointer flex items-center gap-3 border-b border-white/5 last:border-0"
                >
                  <div className="w-8 h-8 bg-slate-600 rounded-full overflow-hidden flex-shrink-0">
                    {artist.avatar_url ? (
                      <img src={artist.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">?</div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{artist.name_en}</p>
                    <p className="text-xs text-slate-400">{artist.name_zh}</p>
                  </div>
                </div>
              ))}

              {/* Option to Create New */}
              <div
                onClick={createNewArtist}
                className="p-3 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-2 text-emerald-400 border-t border-white/10"
              >
                <UserPlus size={16} />
                <span className="text-sm font-bold">Create new artist "{query}"</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtistSearch;