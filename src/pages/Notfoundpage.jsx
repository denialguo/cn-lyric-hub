import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-full border border-slate-800 mb-6">
          <Music className="w-8 h-8 text-slate-600" />
        </div>
        <h1 className="text-6xl font-black text-white mb-2">404</h1>
        <p className="text-slate-400 text-lg mb-8">This page doesn't exist — maybe the lyrics were lost in translation.</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={18} /> Back to Library
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;