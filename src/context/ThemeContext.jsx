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
  const isFirstRender = useRef(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true;
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('theme-color') || 'cyan';
  });

  useEffect(() => {
    const html = document.documentElement;
    
    // Only animate after the first render (skip initial page load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
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
    
    const timer = setTimeout(() => html.classList.remove('theme-transitioning'), 400);
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

  return (
    <ThemeContext.Provider 
      value={{ 
        isDarkMode, 
        setIsDarkMode, 
        accentColor, 
        setAccentColor 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};