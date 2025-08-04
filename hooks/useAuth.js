
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for user in localStorage
    const checkAuth = () => {
      try {
        const userData = localStorage.getItem('current_user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for storage changes (if user logs in/out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'current_user') {
        if (e.newValue) {
          setUser(JSON.parse(e.newValue));
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (userData) => {
    localStorage.setItem('current_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('current_user');
    localStorage.removeItem('app_users');
    setUser(null);
    router.push('/auth');
  };

  const isLoggedIn = user && user.id;

  return {
    user,
    loading,
    isLoggedIn,
    login,
    logout
  };
};
