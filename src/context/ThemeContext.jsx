import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { readJson, writeJson, readString, writeString } from '../lib/storage';

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
    const saved = readString('theme-mode', null);
    return saved ? saved === 'dark' : true;
  });

  const [accentColor, setAccentColor] = useState(() => {
    return readString('theme-color', 'cyan');
  });

  const [scriptMode, setScriptMode] = useState(() => {
    return readString('script-mode', 'simplified');
  });

  const [lyricColors, setLyricColors] = useState(() =>
    readJson('lyric-colors', { pinyin: 'default', hanzi: 'default', english: 'default' })
  );

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
    
    writeString('theme-mode', isDarkMode ? 'dark' : 'light');
    
    const timer = setTimeout(() => html.classList.remove('theme-transitioning'), 350);
    return () => clearTimeout(timer);
  }, [isDarkMode]);

  useEffect(() => {
    const html = document.documentElement;
    
    html.setAttribute('data-theme', accentColor);
    writeString('theme-color', accentColor);
  }, [accentColor]);

  useEffect(() => {
    writeString('script-mode', scriptMode);
  }, [scriptMode]);

  useEffect(() => {
    writeJson('lyric-colors', lyricColors);
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