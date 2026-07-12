'use client';

import { useState, useEffect } from 'react';

type TimerState = 'idle' | 'running' | 'paused' | 'finished';

export default function FocusFlow() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [state, setState] = useState<TimerState>('idle');
  const [sessionNote, setSessionNote] = useState('');
  const [history, setHistory] = useState<Array<{ time: string; note: string }>>([]);

  const totalTime = 25 * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'running' && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && state === 'running') {
      setState('finished');
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setHistory((prev) => [{ time: now, note: sessionNote || 'Deep Work Session' }, ...prev]);
    }
    return () => clearInterval(interval);
  }, [state, timeLeft, sessionNote]);

  const start = () => setState('running');
  const pause = () => setState('paused');
  const reset = () => {
    setTimeLeft(totalTime);
    setState('idle');
    setSessionNote('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <div className="lg:w-72 border-b lg:border-r border-[var(--border)] p-6 lg:flex-shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)]" />
          <span className="font-semibold tracking-tight text-xl">FocusFlow</span>
        </div>

        <div className="mb-6">
          <p className="text-sm text-[var(--ink-2)] mb-3 font-medium">RECENT SESSIONS</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length > 0 ? (
              history.map((entry, i) => (
                <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-4 text-sm">
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
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="7" />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="7"
                strokeDasharray={338}
                strokeDashoffset={338 - (338 * progress) / 100}
                strokeLinecap="round"
                className="timer-ring"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-6xl sm:text-7xl font-semibold tabular-nums tracking-tighter">
                {formatTime(timeLeft)}
              </div>
              <div className="text-[var(--ink-2)] mt-3 text-base sm:text-lg">
                {state === 'running' ? 'Deep Focus' : 'Ready to begin'}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {state === 'idle' && (
              <button
                onClick={start}
                className="bg-[var(--accent)] text-white px-10 py-4 rounded-[10px] font-semibold text-lg active:scale-95 transition-transform shadow-lg shadow-[var(--accent)]/30 w-full sm:w-auto"
              >
                Start Focus
              </button>
            )}

            {(state === 'running' || state === 'paused') && (
              <>
                <button
                  onClick={state === 'running' ? pause : start}
                  className="px-8 py-4 border border-[var(--border)] rounded-[10px] font-medium w-full sm:w-auto"
                >
                  {state === 'running' ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={reset}
                  className="px-8 py-4 border border-[var(--border)] text-[var(--ink-2)] rounded-[10px] font-medium w-full sm:w-auto"
                >
                  End Session
                </button>
              </>
            )}
          </div>

          <div className="mt-10 max-w-xs mx-auto">
            <input
              type="text"
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="What are you working on? (optional)"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-5 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}