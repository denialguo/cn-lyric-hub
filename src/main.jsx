import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'; // <--- Make sure this is imported!

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>         {/* Layer 2: Theme */}
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)