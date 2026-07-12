'use client';

import { useState, useEffect, useRef } from 'react';
import ParticleField from './ParticleField';

type TimerState = 'idle' | 'running' | 'paused' | 'finished';

const DURATIONS = [15, 25, 45, 60] as const;
const DEFAULT_MINUTES = 25;
const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function FocusFlow() {
  const [durationMin, setDurationMin] = useState(DEFAULT_MINUTES);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('30');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_MINUTES * 60);
  const [state, setState] = useState<TimerState>('idle');

  const totalSeconds = durationMin * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  const parsedCustom = parseInt(customText, 10);
  const customValid =
    !isNaN(parsedCustom) &&
    parsedCustom >= MIN_MINUTES &&
    parsedCustom <= MAX_MINUTES;
  const canStart = !customMode || customValid;

  const clockRef = useRef<HTMLDivElement>(null);

  // Latest time read by the interval callback, kept in a ref so the tick effect
  // can stay keyed on `state` alone.
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Tick down once per second while running. State updates happen inside the
  // interval callback (not the effect body), finishing exactly once when the
  // last second elapses.
  useEffect(() => {
    if (state !== 'running') return;
    const interval = setInterval(() => {
      if (timeLeftRef.current <= 1) {
        setTimeLeft(0);
        setState('finished');
      } else {
        setTimeLeft((prev) => prev - 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  const applyDuration = (min: number) => {
    setDurationMin(min);
    setTimeLeft(min * 60);
  };
  const selectPreset = (min: number) => {
    setCustomMode(false);
    applyDuration(min);
  };
  const enableCustom = () => {
    setCustomMode(true);
    if (customValid) applyDuration(parsedCustom);
  };
  const onCustomChange = (value: string) => {
    setCustomText(value);
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= MIN_MINUTES && n <= MAX_MINUTES) applyDuration(n);
  };

  const start = () => setState('running');
  const pause = () => setState('paused');
  const reset = () => {
    setTimeLeft(totalSeconds);
    setState('idle');
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6">
      <ParticleField originRef={clockRef} active={state === 'running'} />

      {/* Brand */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
        <a
          href="https://danielcrex.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit danielcrex.com"
          className="block w-8 h-8 rounded-xl bg-[var(--accent)] hover:opacity-90 transition-opacity"
        />
        <span className="font-semibold tracking-tight text-xl">FocusFlow</span>
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <div ref={clockRef} className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto mb-10">
          <svg className="w-full h-full -rotate-90 relative" viewBox="0 0 120 120" aria-hidden="true">
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
              key={timeLeft}
              className="ff-tick text-6xl sm:text-7xl font-semibold tabular-nums tracking-tighter"
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

        {/* Focus length selector — only before a session starts */}
        {state === 'idle' && (
          <div className="mb-8" role="group" aria-label="Focus length">
            <div className="flex justify-center gap-2 flex-wrap">
              {DURATIONS.map((min) => {
                const active = !customMode && durationMin === min;
                return (
                  <button
                    key={min}
                    onClick={() => selectPreset(min)}
                    aria-pressed={active}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {min} min
                  </button>
                );
              })}
              <button
                onClick={enableCustom}
                aria-pressed={customMode}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  customMode
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--ink-2)] hover:border-[var(--accent)]'
                }`}
              >
                Custom
              </button>
            </div>

            {customMode && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <input
                  type="number"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  value={customText}
                  onChange={(e) => onCustomChange(e.target.value)}
                  aria-label="Custom minutes"
                  autoFocus
                  className={`w-20 bg-[var(--surface)] border rounded-[var(--r-btn)] px-3 py-2 text-sm text-center focus:outline-none ${
                    customValid
                      ? 'border-[var(--border)] focus:border-[var(--accent)]'
                      : 'border-red-400'
                  }`}
                />
                <span className="text-sm text-[var(--ink-2)]">minutes</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {state === 'idle' && (
            <button
              onClick={start}
              disabled={!canStart}
              className="bg-[var(--accent)] text-white px-10 py-4 rounded-[var(--r-btn)] font-semibold text-lg active:scale-95 transition-transform shadow-[0_10px_25px_-5px_rgba(43,84,240,0.35)] w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
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
      </div>
    </div>
  );
}
