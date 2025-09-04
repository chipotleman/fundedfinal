
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Supabase auth first (primary source of truth)
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Ensure user has a profile in the database
          await ensureUserProfile(user);
          setUser(user);
          localStorage.setItem('current_user', JSON.stringify(user));
        } else {
          // Check localStorage as fallback for demo/local users
          const storedUser = localStorage.getItem('current_user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              if (parsedUser && parsedUser.id) {
                setUser(parsedUser);
              }
            } catch (error) {
              console.error('Error parsing stored user:', error);
              localStorage.removeItem('current_user');
            }
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await ensureUserProfile(session.user);
        setUser(session.user);
        localStorage.setItem('current_user', JSON.stringify(session.user));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('current_user');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ensure user has a profile in the database
  const ensureUserProfile = async (user) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // Create profile for new user
        const { error } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
              email: user.email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);
        
        if (error && error.code !== '23505') { // Ignore duplicate key errors
          console.error('Error creating profile:', error);
        }
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Ensure user profile exists
    if (data.user) {
      await ensureUserProfile(data.user);
    }
    
    return data;
  };

  const signUp = async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });
    
    if (error) throw error;
    
    // Profile will be created in the auth state change listener
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('current_user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    signUp,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
