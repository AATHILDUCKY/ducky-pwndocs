'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Shield } from 'lucide-react';
import App from '@/App';

type SessionState = 'checking' | 'unauthenticated' | 'authenticated';

export default function AuthGate() {
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(identifier.trim() && password.trim()) && !submitting,
    [identifier, password, submitting]
  );

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (response.ok) {
          setSessionState('authenticated');
          return;
        }
      } catch {
        // no-op
      }
      setSessionState('unauthenticated');
    };

    checkSession();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error || 'Login failed.');
        return;
      }

      setSessionState('authenticated');
    } catch {
      setError('Unable to login right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.3em] text-slate-300">
          <Loader2 className="animate-spin" size={18} />
          Validating session
        </div>
      </div>
    );
  }

  if (sessionState === 'authenticated') {
    return <App />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="p-8 space-y-7">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Welford Systems Login</h1>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
                Authenticate to access workspace
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Username or Email
              </label>
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="admin or admin@welford.local"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-4 py-3 text-sm font-semibold text-slate-100 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors"
            >
              {submitting ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
