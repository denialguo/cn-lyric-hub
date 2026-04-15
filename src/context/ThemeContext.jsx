import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const transitionsEnabled = useRef(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true;
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('theme-color') || 'cyan';
  });

  const [scriptMode, setScriptMode] = useState(() => {
    return localStorage.getItem('script-mode') || 'simplified';
  });

  const [lyricColors, setLyricColors] = useState(() => {
    const saved = localStorage.getItem('lyric-colors');
    return saved ? JSON.parse(saved) : { pinyin: 'default', hanzi: 'default', english: 'default' };
  });

  // Enable transitions only after initial paint is done
  useEffect(() => {
    const timer = setTimeout(() => { transitionsEnabled.current = true; }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    
    if (transitionsEnabled.current) {
      html.classList.add('theme-transitioning');
    }
    
    if (isDarkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
    
    const timer = setTimeout(() => html.classList.remove('theme-transitioning'), 350);
    return () => clearTimeout(timer);
  }, [isDarkMode]);

  useEffect(() => {
    const html = document.documentElement;
    
    const allThemes = ['cyan', 'emerald', 'rose', 'violet', 'amber', 'blue', 'indigo', 'pink', 'teal', 'orange'];
    allThemes.forEach(theme => {
      html.removeAttribute(`data-theme-${theme}`);
    });
    
    html.setAttribute('data-theme', accentColor);
    localStorage.setItem('theme-color', accentColor);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('script-mode', scriptMode);
  }, [scriptMode]);

  useEffect(() => {
    localStorage.setItem('lyric-colors', JSON.stringify(lyricColors));
  }, [lyricColors]);

  const toggleScript = () => {
    setScriptMode(prev => prev === 'simplified' ? 'traditional' : 'simplified');
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        isDarkMode, 
        setIsDarkMode, 
        accentColor, 
        setAccentColor,
        scriptMode,
        setScriptMode,
        toggleScript,
        lyricColors,
        setLyricColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};