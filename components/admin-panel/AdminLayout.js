import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';

export default function AdminLayout({ children, title = 'Admin Panel' }) {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    verifyAuth();
  }, []);

  const verifyAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin-panel/login');
      return;
    }

    try {
      const res = await fetch('/api/admin-panel/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token }),
      });

      if (!res.ok) {
        localStorage.removeItem('admin_token');
        router.push('/admin-panel/login');
        return;
      }

      const data = await res.json();
      setAdmin(data.admin);
    } catch (error) {
      localStorage.removeItem('admin_token');
      router.push('/admin-panel/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin-panel/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin-panel', label: 'Dashboard', icon: '📊' },
    { href: '/admin-panel/users', label: 'Users', icon: '👥' },
    { href: '/admin-panel/bets', label: 'Bets', icon: '🎲' },
    { href: '/admin-panel/staff', label: 'Staff', icon: '🔐' },
    { href: '/admin-panel/analytics', label: 'Analytics', icon: '📈' },
  ];

  return (
    <>
      <Head>
        <title>{title} | Piks Admin</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <button
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 rounded-lg"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <img src="/funderlogo/Piks.png" alt="Piks" className="h-8" />
              <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-400 rounded-full font-medium">Admin</span>
            </div>
            <p className="text-sm text-gray-400">{admin?.email}</p>
          </div>
          
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  router.pathname === item.href
                    ? 'bg-green-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <main className="md:ml-64 min-h-screen">
          <div className="p-6 md:p-8">
            {children}
          </div>
        </main>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </>
  );
}
