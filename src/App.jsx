import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './context/AuthContext';

// HomePage is the LCP landing route — keep it eager so first paint isn't gated on a chunk
import HomePage from './pages/HomePage';
import Footer from './components/Footer';

// Everything else loads on demand so visitors don't download recharts/editors/admin up front
const SongPage = lazy(() => import('./pages/SongPage'));
const AddSongPage = lazy(() => import('./pages/AddSongPage'));
const EditSongPage = lazy(() => import('./pages/EditSongPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const ArtistPage = lazy(() => import('./pages/ArtistPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const RouteFallback = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 text-slate-200">
          <Suspense fallback={<RouteFallback />}>
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
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          <Footer />

          <Analytics />
          <SpeedInsights />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;