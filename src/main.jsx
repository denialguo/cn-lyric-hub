import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 1. Import BOTH Providers
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './context/ThemeContext'; // Check this path matches your file structure

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Nest them like this */}
    <HelmetProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);