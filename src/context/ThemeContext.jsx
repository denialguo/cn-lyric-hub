import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // 1. Check LocalStorage first, otherwise default to 'blue' (NOT 'emerald')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'blue';
  });

  useEffect(() => {
    // 2. Save to LocalStorage whenever it changes
    localStorage.setItem('theme', theme);
    
    // 3. Update the HTML attribute so Tailwind sees it
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};