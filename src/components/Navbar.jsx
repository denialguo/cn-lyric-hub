import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Globe, User, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isRealAccount } from '../lib/identity';
import { useTheme } from '../context/ThemeContext';
import ThemeSettings from './ThemeSettings';

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { scriptMode, toggleScript } = useTheme();
  const [openPanel, setOpenPanel] = useState(null);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const panelRef = useRef(null);
  const menuRef = useRef(null);
  const realAccount = isRealAccount(user);
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const accountName = profile?.display_name || profile?.username || user?.user_metadata?.full_name || user?.user_metadata?.name;

  useEffect(() => {
    const dismiss = (event) => {
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return;
        if (openPanel === 'menu') menuRef.current?.focus();
      } else if (panelRef.current?.contains(event.target)) return;
      setOpenPanel(null);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [openPanel]);

  const closeMenu = () => setOpenPanel(null);
  const menuLink = 'flex min-h-11 items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white';

  return (
    <nav aria-label="Main" className="sticky top-0 z-[100] bg-slate-950 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="CN Lyric Hub home">
          <img src="/logo_inverse.svg" alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg logo-dark" />
          <img src="/logo.png" alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg logo-light" />
          <span className="hidden min-[360px]:inline font-bold text-base sm:text-xl tracking-tight text-white whitespace-nowrap">CN Lyric Hub</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3 relative" ref={panelRef}>
          <button onClick={toggleScript} className="hidden md:flex min-h-11 items-center gap-2 text-sm px-4 rounded-full border border-slate-700 text-slate-300 hover:text-primary" aria-label={`Switch to ${scriptMode === 'simplified' ? 'Traditional' : 'Simplified'} Chinese`}>
            <Globe size={16} /> {scriptMode === 'simplified' ? '简体 Simplified' : '繁體 Traditional'}
          </button>
          <Link to="/add" className="hidden md:flex min-h-11 items-center gap-2 bg-white text-slate-900 px-4 rounded-full text-sm font-bold hover:bg-slate-200">
            <Plus size={16} /> Add Song
          </Link>
          <ThemeSettings isOpen={openPanel === 'theme'} onToggle={() => setOpenPanel(openPanel === 'theme' ? null : 'theme')} />
          {!realAccount && <Link to="/login" onClick={closeMenu} className="flex min-h-11 items-center px-2 sm:px-3 text-sm font-semibold text-slate-300 hover:text-primary whitespace-nowrap">Sign In</Link>}
          <button ref={menuRef} onClick={() => setOpenPanel(openPanel === 'menu' ? null : 'menu')} aria-label={realAccount ? `Account menu${accountName ? ` for ${accountName}` : ''}` : 'Navigation menu'} aria-expanded={openPanel === 'menu'} aria-controls="navigation-menu" className={`flex h-11 w-11 items-center justify-center text-slate-300 hover:bg-white/10 ${realAccount ? 'rounded-full' : 'rounded-lg md:hidden'}`}>
            {realAccount ? (
              <span className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-primary ring-2 ${openPanel === 'menu' ? 'ring-primary' : 'ring-slate-700'}`}>
                {avatarUrl && failedAvatar !== avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedAvatar(avatarUrl)} />
                ) : accountName ? <span className="text-sm font-semibold">{Array.from(accountName)[0].toUpperCase()}</span> : <User size={18} />}
              </span>
            ) : openPanel === 'menu' ? <X size={20} /> : <Menu size={20} />}
          </button>
          {openPanel === 'menu' && (
            <div id="navigation-menu" className={`absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-xl py-2 shadow-xl ${realAccount ? '' : 'md:hidden'}`}>
              <button onClick={toggleScript} className={`${menuLink} md:hidden w-full`}>
                <Globe size={16} /> Switch to {scriptMode === 'simplified' ? '繁體 Traditional' : '简体 Simplified'}
              </button>
              <Link to="/add" onClick={closeMenu} className={`${menuLink} md:hidden`}><Plus size={16} /> Add Song</Link>
              {realAccount && <>
                {profile?.role === 'admin' && <Link to="/admin" onClick={closeMenu} className={menuLink}><LayoutDashboard size={16} /> Admin Dashboard</Link>}
                <Link to="/profile" onClick={closeMenu} className={menuLink}><User size={16} /> My Profile</Link>
                <button onClick={async () => { await signOut(); closeMenu(); }} className={`${menuLink} w-full`}><LogOut size={16} /> Log Out</button>
              </>}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
