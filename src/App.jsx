import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react" // <--- 1. Import this

import HomePage from './pages/HomePage';
import SongPage from './pages/SongPage';
import AddSongPage from './pages/AddSongPage';
import EditSongPage from './pages/EditSongPage';

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/song/:slug" element={<SongPage />} />
          <Route path="/add" element={<AddSongPage />} />
          <Route path="/edit/:id" element={<EditSongPage />} />
        </Routes>
        
        {/* 2. Add the component here at the bottom */}
        <Analytics /> 
      </div>
    </Router>
  );
};

export default App;