import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import WelcomeAnimation from '@/components/welcome/WelcomeAnimation';

const LOGO_SRC = 'https://media.base44.com/images/public/user_699e998295e6df9ade5456dd/ab50d79a4_CBV_Logo.png';

export default function Home() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  const redirectByRole = (user) => {
    if (user?.role === 'management') navigate('/firmwide/consolidated', { replace: true });
    else navigate('/my-plan/dashboard', { replace: true });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      const sessionKey = 'cbva_welcomed';
      const alreadyWelcomed = sessionStorage.getItem(sessionKey);
      if (!alreadyWelcomed) {
        sessionStorage.setItem(sessionKey, '1');
        setLoggedInUser(user);
        setShowWelcome(true);
      } else {
        redirectByRole(user);
      }
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  if (showWelcome && loggedInUser) {
    const name = loggedInUser.full_name || 'User';
    const firstName = name.split(' ')[0];
    return <WelcomeAnimation firstName={firstName} onComplete={() => redirectByRole(loggedInUser)} />;
  }

  return (
    <div className="min-h-screen bg-[#eeeafc] text-[var(--text)]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section
          className="relative hidden overflow-hidden px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            background: `
              radial-gradient(ellipse 66% 56% at 92% 6%, rgba(118,48,242,0.97) 0%, rgba(78,28,208,0.72) 26%, rgba(42,14,165,0.38) 52%, transparent 70%),
              radial-gradient(ellipse 64% 54% at 82% 60%, rgba(16,9,148,0.99) 0%, rgba(11,7,112,0.88) 30%, rgba(7,4,72,0.54) 58%, transparent 78%),
              radial-gradient(ellipse 44% 36% at 90% 96%, rgba(102,36,214,0.68) 0%, rgba(66,20,178,0.40) 44%, transparent 64%),
              radial-gradient(ellipse 30% 24% at 15% 82%, rgba(58,18,162,0.30) 0%, transparent 56%),
              radial-gradient(ellipse 50% 44% at 50% 50%, rgba(20,10,80,0.22) 0%, transparent 65%),
              linear-gradient(142deg, #020110 0%, #040220 26%, #07042a 62%, #030116 100%)
            `,
          }}
        >
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Clara.ai</p>
              <p className="text-xs text-white/55">CBVA executive intelligence</p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              Business Plan Control Room
            </p>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight">
              Business plan, pipeline, and collections in one calm view.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/62">
              A focused dashboard for leaders to track plan health, client movement, and execution signals without the noise.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {['Pipeline', 'Collections', 'Actions'].map((label) => (
              <div key={label} className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/48">{label}</p>
                <p className="mt-2 text-sm font-semibold text-white">Live dashboard</p>
              </div>
            ))}
          </div>
        </section>

        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
          <div className="pointer-events-none absolute -right-28 top-14 h-72 w-72 rounded-full bg-[rgb(var(--lavender-rgb)/0.34)] blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-10 h-64 w-64 rounded-full bg-[rgb(var(--success-rgb)/0.15)] blur-3xl" />

          <div className="relative z-10 w-full max-w-md">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={LOGO_SRC} alt="CBV & Associates" className="mb-5 h-14 w-auto object-contain" />
              <span className="executive-pill rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.20em] text-[var(--violet)]">
                Clara.ai Dashboard
              </span>
            </div>

            <div className="executive-glass rounded-[24px] p-7 sm:p-8">
              <h1 className="text-2xl font-semibold text-[var(--text)]">Welcome back</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">Sign in to your CBVA dashboard.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lavender)]" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@cbva.com"
                      className="login-input brand-input h-12 w-full rounded-xl px-10 text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Password</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lavender)]" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                      className="login-input brand-input h-12 w-full rounded-xl px-10 text-sm outline-none"
                    />
                  </div>
                </div>

                {error && <p className="rounded-xl border border-[rgb(var(--danger-rgb)/0.18)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs font-medium text-[var(--danger)]">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="login-btn h-12 w-full rounded-xl text-sm font-semibold text-white outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #8d57de 0%, #5d27ca 50%, #1f0798 100%)',
                    boxShadow: '0 12px 32px rgba(93,39,202,0.32)',
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {loading ? 'Signing in...' : 'Sign in'}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </span>
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-[11px] text-[var(--muted)]">
              © {new Date().getFullYear()} CBV & Associates. Powered by Clara.ai.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
