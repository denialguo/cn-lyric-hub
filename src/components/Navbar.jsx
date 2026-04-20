import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Globe, User, LogOut, LogIn, LayoutDashboard, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeSettings from './ThemeSettings';

const Navbar = ({ showSearch = false, searchQuery = '', setSearchQuery = null }) => {
  const { user, profile, signOut } = useAuth();
  const { scriptMode, toggleScript } = useTheme();
  const navigate = useNavigate();
  const [openPanel, setOpenPanel] = useState(null); // null | 'menu' | 'theme'
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef(null);

  // Escape key closes any open panel
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setOpenPanel(null); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Close panels on navigation
  useEffect(() => {
    setOpenPanel(null);
  }, []);

  const togglePanel = (panel) => {
    setOpenPanel(prev => prev === panel ? null : panel);
  };

  const handleLogout = async () => {
    await signOut();
    setOpenPanel(null);
  };

  const getDisplayName = () => {
    if (!user || user.is_anonymous || !user.email) return 'Guest';
    if (profile?.username) return profile.username;
    return user.email.split('@')[0];
  };

  return (
    <nav className="sticky top-0 z-[100] bg-slate-950 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo_inverse.svg" alt="Logo" className="w-10 h-10 rounded-lg object-cover logo-dark" />
          <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-lg object-cover logo-light" />
          <span className="font-bold text-xl tracking-tight text-white">CN Lyric Hub</span>
        </div>

        {/* Desktop Search */}
        {showSearch && setSearchQuery && (
          <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search songs, artists..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-900 border border-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all text-sm text-white"
            />
          </div>
        )}

        <div className="flex items-center gap-3 relative">
          {/* Mobile search toggle */}
          {showSearch && setSearchQuery && (
            <button 
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                setTimeout(() => mobileSearchRef.current?.focus(), 100);
              }}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              {mobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
          )}

          {/* Script Toggle */}
          <button 
            onClick={toggleScript}
            className="hidden sm:flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border border-slate-700 text-slate-300 hover:border-primary hover:text-primary transition-all"
          >
            <Globe className="w-4 h-4" />
            {scriptMode === 'simplified' ? '简体 Simplified' : '繁體 Traditional'}
          </button>

          <div className="flex items-center gap-3">
            <ThemeSettings isOpen={openPanel === 'theme'} onToggle={() => togglePanel('theme')} />

            {/* User Menu */}
            {user && !user.is_anonymous ? (
              <div className="relative isolate">
                <button 
                  onClick={() => togglePanel('menu')}
                  className={`relative z-20 p-2.5 rounded-lg hover:bg-white/10 transition-colors ${openPanel === 'menu' ? 'text-white bg-white/10' : 'text-slate-400'}`}
                >
                  <User className="w-5 h-5" />
                </button>

                {openPanel === 'menu' && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 overflow-hidden z-10">
                    <div className="px-4 py-3 border-b border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Signed in as</p>
                      <p className="text-sm font-bold text-white truncate">{getDisplayName()}</p>
                    </div>

                    {profile?.role === 'admin' && (
                      <button 
                        onClick={() => { navigate('/admin'); setOpenPanel(null); }}
                        className="w-full text-left px-4 py-3 text-sm text-yellow-500 hover:bg-slate-800 hover:text-yellow-400 flex items-center gap-3 transition-colors font-bold"
                      >
                        <LayoutDashboard size={16} /> Admin Dashboard
                      </button>
                    )}

                    <button 
                      onClick={() => { navigate('/profile'); setOpenPanel(null); }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-3 transition-colors"
                    >
                      <User size={16} className="text-primary" /> My Profile
                    </button>
                    
                    <div className="h-px bg-slate-800 mx-4" />

                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors"
                    >
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 text-slate-300 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
              >
                <LogIn size={16} /> Sign In
              </button>
            )}
          </div>

          <button
            onClick={() => navigate('/add')}
            className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-200 transition-colors"
          >
            <Plus size={16} /> 
            <span className="hidden sm:inline">Add Song</span>
          </button>
        </div>
      </div>

      {/* Mobile search dropdown */}
      {showSearch && setSearchQuery && mobileSearchOpen && (
        <div className="md:hidden px-4 pb-3 animate-in slide-in-from-top fade-in duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              ref={mobileSearchRef}
              type="text" 
              placeholder="Search songs, artists..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-full bg-slate-900 border border-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all text-sm text-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;