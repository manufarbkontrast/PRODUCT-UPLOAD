'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PIN_LENGTH = 4;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'username' | 'pin'>('username');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'username') {
      // Small delay to ensure DOM is ready on mobile
      setTimeout(() => usernameRef.current?.focus(), 100);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'pin') {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleLogin = async (pinValue: string) => {
    if (!username.trim() || pinValue.length !== PIN_LENGTH) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), pin: pinValue }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Falscher Benutzername oder PIN');
        setPin('');
        setTimeout(() => pinInputRef.current?.focus(), 100);
      }
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    setError('');

    // Auto-submit when all digits entered
    if (digits.length === PIN_LENGTH) {
      handleLogin(digits);
    }
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setStep('pin');
  };

  // Visual PIN dots/digits
  const pinDigits = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Title */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center">
            <svg className="w-8 h-8 text-white dark:text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">SPZ Upload</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {step === 'username' ? 'Bitte einloggen' : `Hallo, ${username}`}
          </p>
        </div>

        {/* Username Step */}
        {step === 'username' && (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                Benutzername
              </label>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="Benutzername"
                autoComplete="username"
                className="w-full px-4 py-3 text-lg border rounded-xl bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white text-center"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={!username.trim()}
              className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-base font-medium disabled:opacity-30 transition-opacity"
            >
              Weiter
            </button>
          </form>
        )}

        {/* PIN Step */}
        {step === 'pin' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-4 text-zinc-700 dark:text-zinc-300 text-center">
                PIN eingeben
              </label>

              {/* Single hidden input that captures all PIN digits */}
              <div className="relative">
                <input
                  ref={pinInputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={PIN_LENGTH}
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                  autoComplete="one-time-code"
                  autoFocus
                />

                {/* Visual PIN boxes */}
                <div
                  className="flex justify-center gap-3"
                  onClick={() => pinInputRef.current?.focus()}
                >
                  {pinDigits.map((digit, i) => (
                    <div
                      key={i}
                      className={`w-16 h-16 flex items-center justify-center text-2xl font-semibold border-2 rounded-xl bg-white dark:bg-zinc-900 transition-colors ${
                        digit
                          ? 'border-zinc-900 dark:border-white'
                          : i === pin.length
                            ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900 dark:ring-white'
                            : 'border-zinc-300 dark:border-zinc-700'
                      } ${error ? 'border-red-500' : ''}`}
                    >
                      {digit ? (
                        <span className="text-zinc-900 dark:text-white">{'\u2022'}</span>
                      ) : i === pin.length ? (
                        <span className="w-0.5 h-6 bg-zinc-900 dark:bg-white animate-pulse" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 text-center">
                {error}
              </p>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex justify-center">
                <svg className="w-6 h-6 animate-spin text-zinc-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            <button
              onClick={() => { setStep('username'); setPin(''); setError(''); }}
              className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Anderer Benutzer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
