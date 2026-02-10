'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'username' | 'pin'>('username');
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === 'pin') {
      pinRefs[0].current?.focus();
    }
  }, [step]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    // Zum naechsten Feld springen
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }

    // Auto-Submit wenn alle 4 Ziffern eingegeben
    if (value && index === 3) {
      const fullPin = [...newPin.slice(0, 3), value.slice(-1)].join('');
      if (fullPin.length === 4) {
        handleLogin(fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handleLogin = async (pinValue?: string) => {
    const finalPin = pinValue || pin.join('');
    if (!username.trim() || finalPin.length !== 4) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), pin: finalPin }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Falscher Benutzername oder PIN');
        setPin(['', '', '', '']);
        pinRefs[0].current?.focus();
      }
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setStep('pin');
  };

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
              <div className="flex justify-center gap-3">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    className={`w-16 h-16 text-center text-2xl font-semibold border-2 rounded-xl bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-colors ${
                      digit
                        ? 'border-zinc-900 dark:border-white'
                        : 'border-zinc-300 dark:border-zinc-700'
                    } ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 text-center animate-[shake_0.3s_ease-in-out]">
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
              onClick={() => { setStep('username'); setPin(['', '', '', '']); setError(''); }}
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
