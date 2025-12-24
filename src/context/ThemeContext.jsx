import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true; // Default to dark mode
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('theme-color') || 'emerald';
  });

  useEffect(() => {
    // Apply accent color theme
    document.documentElement.setAttribute('data-theme', accentColor);
    localStorage.setItem('theme-color', accentColor);
  }, [accentColor]);

  useEffect(() => {
    // Apply dark/light mode
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
    
    // Debug log
    console.log('Theme mode:', isDarkMode ? 'dark' : 'light', 'Classes:', html.className);
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};