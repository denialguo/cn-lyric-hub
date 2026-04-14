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
    return saved ? saved === 'dark' : true;
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('theme-color') || 'cyan';
  });

  useEffect(() => {
    const html = document.documentElement;
    
    if (isDarkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
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