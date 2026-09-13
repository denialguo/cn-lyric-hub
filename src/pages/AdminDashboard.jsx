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
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [rejectingId, setRejectingId] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== 'admin') {
        navigate('/');
      }
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    let cancelled = false;
    const fetchSubmissions = async () => {
      if (profile?.role !== 'admin') { setLoading(false); return; }
      setLoading(true);
      setLoadError(false);

      const { data: subs, error: subsError } = await supabase
        .from('song_submissions')
        .select('*')
        .in('status', ['pending', 'pending_edit'])
        .order('created_at', { ascending: false });

      if (subsError) {
        if (cancelled) return;
        console.error('Fetch error:', subsError);
        setLoadError(true);
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

      if (cancelled) return;
      setSubmissions(enrichedSubs || []);
      setLoading(false);
    };

    fetchSubmissions();
    return () => { cancelled = true; };
  }, [profile, reloadKey]);

  const handleReject = async (id) => {
    if (rejectingId) return;
    const ok = await confirm(
      "Reject this submission? The submitter will see it marked rejected on their profile.",
      { destructive: true, confirmLabel: 'Reject' }
    );
    if (!ok) return;
    setRejectingId(id);
    try {
      // Mark rather than delete, so the submitter gets an outcome instead of the
      // entry silently disappearing from their profile.
      const { error } = await supabase.from('song_submissions').update({ status: 'rejected' }).eq('id', id).select('id').single();
      if (error) throw error;
      setSubmissions(prev => prev.filter(s => s.id !== id));
      toast.success('Submission rejected');
    } catch (error) {
      toast.error("Failed to reject: " + error.message);
    } finally {
      setRejectingId(null);
    }
  };

  if (authLoading || loading) return <div className="p-10 text-white">Loading...</div>;

  return (
    <main className="min-h-screen bg-slate-950 p-4 sm:p-6 md:p-12">
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
            <h2 className="font-bold text-slate-200">{loadError ? 'Queue unavailable' : `Queue (${submissions.length})`}</h2>
            <button onClick={() => setReloadKey(key => key + 1)} className="min-h-11 px-3 text-sm text-primary">Refresh</button>
          </div>

          {loadError ? (
            <div role="alert" className="p-8 text-center text-slate-300">
              <p>Couldn’t load the review queue.</p>
              <button onClick={() => setReloadKey(key => key + 1)} className="min-h-11 mt-2 text-primary">Try again</button>
            </div>
          ) : submissions.length === 0 ? (
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
                  disabled={rejectingId !== null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default AdminDashboard;
