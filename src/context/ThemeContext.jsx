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
  // Dark/Light Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true; // Default to dark
  });

  // Accent Color State
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('theme-color') || 'cyan'; // Changed to cyan
  });

  // Apply Dark/Light Mode
  useEffect(() => {
    const html = document.documentElement;
    
    console.log('🎨 Setting mode:', isDarkMode ? 'dark' : 'light');
    
    if (isDarkMode) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
    
    // Debug check
    console.log('✅ HTML classes:', html.className);
  }, [isDarkMode]);

  // Apply Accent Color
  useEffect(() => {
    const html = document.documentElement;
    
    console.log('🎨 Setting color theme:', accentColor);
    
    // Remove all theme attributes first
    const allThemes = ['cyan', 'emerald', 'rose', 'violet', 'amber', 'blue', 'indigo', 'pink', 'teal', 'orange'];
    allThemes.forEach(theme => {
      html.removeAttribute(`data-theme-${theme}`);
    });
    
    // Set the new theme
    html.setAttribute('data-theme', accentColor);
    localStorage.setItem('theme-color', accentColor);
    
    // Debug check
    console.log('✅ data-theme:', html.getAttribute('data-theme'));
    console.log('✅ Computed --color-primary-rgb:', 
      getComputedStyle(html).getPropertyValue('--color-primary-rgb'));
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