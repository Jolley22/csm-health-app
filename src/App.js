import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import CustomerHealthTracker from './CustomerHealthTracker';

function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const loadUserProfile = async (userId) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, role, csm_name, full_name, is_active')
        .eq('id', userId)
        .single();

      if (error) {
        // No profile found — user signed in via Google but hasn't been provisioned yet
        if (error.code === 'PGRST116') {
          await supabase.auth.signOut();
          setProfileError('Your account has not been provisioned yet. Please contact an administrator.');
          return;
        }
        throw error;
      }

      if (data && !data.is_active) {
        await supabase.auth.signOut();
        setProfileError('Your account has been deactivated. Please contact an administrator.');
        return;
      }

      setProfileError(null);
      setUserProfile(data);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      await supabase.auth.signOut();
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const sessionTimeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading || profileLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    );
  }

  if (!session || !session.user || !userProfile) {
    return <Auth onAuthSuccess={setSession} errorMessage={profileError} />;
  }

  return (
    <CustomerHealthTracker
      session={session}
      userProfile={userProfile}
      onSignOut={handleSignOut}
    />
  );
}

export default App;
