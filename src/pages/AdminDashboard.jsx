import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Check, X, Clock, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react';

const AdminDashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Protect Route
  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== 'admin') {
        navigate('/');
      }
    }
  }, [user, profile, authLoading, navigate]);

  // 2. Fetch Pending
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (profile?.role !== 'admin') return;
      
      const { data, error } = await supabase
        .from('song_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) console.error('Fetch error:', error);
      else setSubmissions(data || []);
      setLoading(false);
    };

    fetchSubmissions();
  }, [profile]);

  // --- FIXED REJECT LOGIC ---
  const handleReject = async (id) => {
    if (!window.confirm("Permanently delete this submission?")) return;

    try {
      // 1. Attempt the delete
      const { error } = await supabase
        .from('song_submissions')
        .delete()
        .eq('id', id);

      // 2. CATCH THE ERROR
      if (error) {
        throw error;
      }

      // 3. Only update UI if DB success
      setSubmissions(prev => prev.filter(s => s.id !== id));

    } catch (error) {
      console.error("Delete failed:", error);
      alert("❌ Failed to delete: " + error.message + "\n\nCheck your Supabase RLS policies!");
    }
  };

  if (authLoading || loading) return <div className="p-10 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col gap-6 mb-8">
            <button 
                onClick={() => navigate('/')} 
                className="self-start flex items-center text-slate-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
            </button>
            
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <AlertCircle className="text-primary" /> Admin Dashboard
            </h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="font-bold text-slate-200">Pending Submissions ({submissions.length})</h2>
          </div>

          {submissions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All caught up! No pending submissions.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {submissions.map((item) => (
                <div key={item.id} className="p-6 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{item.title}</h3>
                        {item.title_chinese && (
                            <span className="text-sm text-primary border border-primary/20 px-2 py-0.5 rounded bg-primary/10">
                            {item.title_chinese}
                            </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm mb-4">
                        by <span className="text-slate-200">{item.artist}</span> • 
                        Submitted {new Date(item.created_at).toLocaleDateString()}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-lg text-xs font-mono border border-slate-800">
                         <div>
                            <p className="text-slate-500 mb-1">Chinese Sample</p>
                            <p className="text-slate-300 line-clamp-2">{item.lyrics_chinese}</p>
                         </div>
                         <div>
                            <p className="text-slate-500 mb-1">English Sample</p>
                            <p className="text-slate-300 line-clamp-2">{item.lyrics_english}</p>
                         </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-3 justify-center min-w-[140px]">
                      {/* REVIEW BUTTON */}
                      <button 
                        onClick={() => navigate(`/admin/review/${item.id}`)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                      >
                        <Clock size={16} /> Review
                      </button>
                      
                      {/* REJECT BUTTON */}
                      <button 
                        onClick={() => handleReject(item.id)}
                        className="bg-slate-800 hover:bg-red-500/10 hover:text-red-400 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;