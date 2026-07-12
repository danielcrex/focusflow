'use client';

import { useState, useEffect, useRef } from 'react';

type TimerState = 'idle' | 'running' | 'paused' | 'finished';
type Session = { id: number; time: string; note: string };

const SESSION_MINUTES = 25;
const SESSION_SECONDS = SESSION_MINUTES * 60;

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const HISTORY_KEY = 'focusflow-history';

export default function FocusFlow() {
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS);
  const [state, setState] = useState<TimerState>('idle');
  const [sessionNote, setSessionNote] = useState('');
  const [history, setHistory] = useState<Session[]>([]);

  const progress = ((SESSION_SECONDS - timeLeft) / SESSION_SECONDS) * 100;

  // Load persisted history once on mount. Reading localStorage in an effect
  // (rather than a lazy useState initializer) keeps the server and first client
  // render identical, avoiding a hydration mismatch on the session list.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time, hydration-safe load
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // Ignore malformed or unavailable storage.
    }
  }, []);

  // Persist history whenever it changes, skipping the initial mount so the
  // freshly-loaded value is never clobbered by the empty initial state.
  const isFirstSave = useRef(true);
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage write failures (e.g. private mode / quota).
    }
  }, [history]);

  // Latest time/note read by the interval callback, kept in refs so the tick
  // effect can stay keyed on `state` alone (typing a note won't restart it).
  const timeLeftRef = useRef(timeLeft);
  const sessionNoteRef = useRef(sessionNote);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);
  useEffect(() => {
    sessionNoteRef.current = sessionNote;
  }, [sessionNote]);

  // Tick down once per second while running. State updates happen inside the
  // interval callback (not the effect body), which finishes and logs the
  // session exactly once when the last second elapses.
  useEffect(() => {
    if (state !== 'running') return;
    const interval = setInterval(() => {
      if (timeLeftRef.current <= 1) {
        setTimeLeft(0);
        setState('finished');
        const now = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        setHistory((prev) => [
          {
            id: Date.now(),
            time: now,
            note: sessionNoteRef.current || 'Deep Work Session',
          },
          ...prev,
        ]);
      } else {
        setTimeLeft((prev) => prev - 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  const start = () => setState('running');
  const pause = () => setState('paused');
  const reset = () => {
    setTimeLeft(SESSION_SECONDS);
    setState('idle');
    setSessionNote('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const statusLabel =
    state === 'running'
      ? 'Deep Focus'
      : state === 'finished'
        ? 'Session complete'
        : 'Ready to begin';

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <div className="order-last lg:order-none lg:w-72 border-t lg:border-t-0 lg:border-r border-[var(--border)] p-6 lg:flex-shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)]" />
          <span className="font-semibold tracking-tight text-xl">FocusFlow</span>
        </div>

        <div className="mb-6">
          <p className="text-sm text-[var(--ink-2)] mb-3 font-medium">RECENT SESSIONS</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length > 0 ? (
              history.map((entry) => (
                <div key={entry.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-card)] p-4 text-sm">
                  <div className="font-mono text-[var(--accent)]">{entry.time}</div>
                  <div className="text-[var(--ink-2)] mt-1 line-clamp-1">{entry.note}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-[var(--ink-3)] text-sm">
                Your completed sessions will appear here
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Timer Area */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-md text-center">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto mb-10">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r={RING_RADIUS} fill="none" stroke="var(--border)" strokeWidth="7" />
              <circle
                cx="60"
                cy="60"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="7"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * progress) / 100}
                strokeLinecap="round"
                className="timer-ring"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="text-6xl sm:text-7xl font-semibold tabular-nums tracking-tighter"
                role="timer"
                aria-live="polite"
              >
                {formatTime(timeLeft)}
              </div>
              <div className="text-[var(--ink-2)] mt-3 text-base sm:text-lg">
                {statusLabel}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {state === 'idle' && (
              <button
                onClick={start}
                className="bg-[var(--accent)] text-white px-10 py-4 rounded-[var(--r-btn)] font-semibold text-lg active:scale-95 transition-transform shadow-[0_10px_25px_-5px_rgba(43,84,240,0.35)] w-full sm:w-auto"
              >
                Start Focus
              </button>
            )}

            {(state === 'running' || state === 'paused') && (
              <>
                <button
                  onClick={state === 'running' ? pause : start}
                  className="px-8 py-4 border border-[var(--border)] rounded-[var(--r-btn)] font-medium w-full sm:w-auto"
                >
                  {state === 'running' ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={reset}
                  className="px-8 py-4 border border-[var(--border)] text-[var(--ink-2)] rounded-[var(--r-btn)] font-medium w-full sm:w-auto"
                >
                  End Session
                </button>
              </>
            )}

            {state === 'finished' && (
              <button
                onClick={reset}
                className="bg-[var(--accent)] text-white px-10 py-4 rounded-[var(--r-btn)] font-semibold text-lg active:scale-95 transition-transform shadow-[0_10px_25px_-5px_rgba(43,84,240,0.35)] w-full sm:w-auto"
              >
                Start New Session
              </button>
            )}
          </div>

          <div className="mt-10 max-w-xs mx-auto">
            <input
              type="text"
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="What are you working on? (optional)"
              aria-label="Session note"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-btn)] px-5 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
