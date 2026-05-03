import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchResult } from '../../../hooks/useMapFilters';

interface SearchInputProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSelectResult: (result: SearchResult) => void;
}

const SearchInput: React.FC<SearchInputProps> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onSelectResult,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Sync local state with prop
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearchChange(localQuery);
      }
    }, 400); // 400ms delay

    return () => clearTimeout(handler);
  }, [localQuery, onSearchChange, searchQuery]);

  const handleClear = () => {
    setLocalQuery('');
    onSearchChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        onSelectResult(searchResults[selectedIndex]);
        setSelectedIndex(-1);
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setSelectedIndex(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10 focus-within:border-blue-500/50 transition-colors">
        <div className="flex-1 flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1">
          {isSearching ? (
            <div className="animate-spin h-3 w-3 md:h-3.5 md:w-3.5 border-2 border-blue-400 border-t-transparent rounded-full" />
          ) : (
            <Search size={12} className="md:w-3.5 md:h-3.5 text-blue-400/70" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un ménage..."
            className="w-full min-w-0 bg-transparent outline-none text-[10px] md:text-[10px] text-white placeholder:text-white/20"
          />

          {localQuery && (
            <button
              onClick={handleClear}
              title="Effacer la recherche"
              aria-label="Effacer la recherche"
              className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && localQuery && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full rounded-2xl border border-white/10 bg-[#050F1F]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[999] overflow-hidden">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {searchResults.map((res, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelectResult(res);
                  setSelectedIndex(-1);
                  inputRef.current?.blur();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full text-left px-4 py-3.5 flex flex-col gap-1 transition-colors border-b border-white/5 last:border-0 group ${
                  selectedIndex === i ? 'bg-blue-600/20' : 'hover:bg-blue-600/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[7px] font-black tracking-tighter ${
                      res.type === 'household' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {res.type === 'household' ? 'MÉNAGE' : 'LIEU'}
                  </span>
                  <span className={`text-[11px] font-bold transition-colors truncate ${
                    selectedIndex === i ? 'text-blue-400' : 'text-slate-200 group-hover:text-blue-400'
                  }`}>
                    {res.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchInput);
