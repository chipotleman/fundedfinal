import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token || typeof token !== 'string') {
      setChecking(false);
      setValid(false);
      setError('Missing reset token.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.valid) {
          setValid(true);
        } else {
          setValid(false);
          setError(data?.error || 'This reset link is invalid or has expired.');
        }
      } catch {
        if (!cancelled) {
          setValid(false);
          setError('Could not verify reset link.');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data?.error || 'Failed to reset password.');
      }
    } catch {
      setError('Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-sm text-gray-400 mb-6">Choose a new password for your account.</p>

        {checking && (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!checking && !valid && (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3">
              {error || 'This reset link is invalid or has expired.'}
            </div>
            <Link href="/auth" className="block text-center bg-green-500 hover:bg-green-400 text-black font-semibold py-2.5 rounded-lg">
              Back to sign in
            </Link>
          </div>
        )}

        {!checking && valid && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="w-full bg-[#1a1a1a] text-white px-3 py-2 rounded-lg border border-[#222] focus:border-green-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
                className="w-full bg-[#1a1a1a] text-white px-3 py-2 rounded-lg border border-[#222] focus:border-green-400 focus:outline-none"
              />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg p-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold py-2.5 rounded-lg"
            >
              {submitting ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        {done && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-lg p-3">
              Your password has been updated. You can now sign in with the new password.
            </div>
            <Link href="/auth" className="block text-center bg-green-500 hover:bg-green-400 text-black font-semibold py-2.5 rounded-lg">
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
