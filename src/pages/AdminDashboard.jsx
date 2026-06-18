import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Check, AlertCircle, ArrowLeft } from 'lucide-react';
import SubmissionCard from '../components/SubmissionCard';

const AdminDashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { toast, confirm } = useToast();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== 'admin') {
        navigate('/');
      }
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (profile?.role !== 'admin') return;

      const { data: subs, error: subsError } = await supabase
        .from('song_submissions')
        .select('*')
        .in('status', ['pending', 'pending_edit'])
        .order('created_at', { ascending: false });

      if (subsError) {
        console.error('Fetch error:', subsError);
        setLoading(false);
        return;
      }

      const editSubs = subs.filter(s => s.original_song_id);
      const origIds = editSubs.map(s => s.original_song_id);

      let originalSongsMap = {};
      if (origIds.length > 0) {
          const { data: origSongs } = await supabase
            .from('songs')
            .select('*')
            .in('id', origIds);

          if (origSongs) {
              origSongs.forEach(song => {
                  originalSongsMap[song.id] = song;
              });
          }
      }

      const enrichedSubs = subs.map(sub => ({
          ...sub,
          originalData: sub.original_song_id ? originalSongsMap[sub.original_song_id] : null
      }));

      setSubmissions(enrichedSubs || []);
      setLoading(false);
    };

    fetchSubmissions();
  }, [profile]);

  const handleReject = async (id) => {
    const ok = await confirm("Permanently delete this submission?", { destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      const { error } = await supabase.from('song_submissions').delete().eq('id', id);
      if (error) throw error;
      setSubmissions(prev => prev.filter(s => s.id !== id));
      toast.success('Submission deleted');
    } catch (error) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  if (authLoading || loading) return <div className="p-10 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">

        <div className="flex flex-col gap-6 mb-8">
            <button onClick={() => navigate('/')} className="self-start flex items-center text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
            </button>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <AlertCircle className="text-primary" /> Admin Dashboard
            </h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-slate-200">Queue ({submissions.length})</h2>
          </div>

          {submissions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All caught up! No pending submissions.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {submissions.map((item) => (
                <SubmissionCard
                  key={item.id}
                  item={item}
                  onReview={(id) => navigate(`/admin/review/${id}`)}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;