
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
          // Validate that the user data is complete
          if (parsedUser && parsedUser.id && parsedUser.username) {
            setUser(parsedUser);
          } else {
            // Clear invalid user data
            localStorage.removeItem('current_user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        // Clear corrupted data
        localStorage.removeItem('current_user');
        setUser(null);
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
    try {
      // Ensure we have valid user data
      if (userData && userData.id && userData.username) {
        localStorage.setItem('current_user', JSON.stringify(userData));
        setUser(userData);
        
        // Also update the users array if it exists
        const existingUsers = JSON.parse(localStorage.getItem('app_users') || '[]');
        const userIndex = existingUsers.findIndex(u => u.id === userData.id);
        if (userIndex !== -1) {
          existingUsers[userIndex] = userData;
          localStorage.setItem('app_users', JSON.stringify(existingUsers));
        }
      } else {
        console.error('Invalid user data provided to login function');
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
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
