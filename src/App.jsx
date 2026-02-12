import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './context/AuthContext';

import HomePage from './pages/HomePage';
import SongPage from './pages/SongPage';
import AddSongPage from './pages/AddSongPage';
import EditSongPage from './pages/EditSongPage';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import PublicProfile from './pages/PublicProfile';
import ArtistPage from './pages/ArtistPage';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 text-slate-200">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/song/:slug" element={<SongPage />} />
            <Route path="/add" element={<AddSongPage />} />
            <Route path="/edit/:id" element={<EditSongPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/review/:id" element={<EditSongPage isReviewMode={true} />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/user/:username" element={<PublicProfile />} />
            <Route path="/artist/:name" element={<ArtistPage />} />
          </Routes>
          
          <Analytics />
          <SpeedInsights />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App; // <--- THIS WAS MISSING!