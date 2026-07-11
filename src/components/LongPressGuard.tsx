'use client';

import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 3000; // 3 seconds for a 3-year-old

export function LongPressGuard({ onActivate, children }: { onActivate: () => void; children: React.ReactNode }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number | null>(null);

  const start = () => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? 0);
      setProgress(Math.min(100, (elapsed / HOLD_MS) * 100));
      if (elapsed >= HOLD_MS) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setProgress(0);
        onActivate();
      }
    }, 50);
  };

  const cancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    setProgress(0);
  };

  useEffect(() => () => cancel(), []);

  return (
    <div
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      style={{ touchAction: 'none', userSelect: 'none' }}
    >
      {/* Progress ring */}
      {progress > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
          style={{ pointerEvents: 'none' }}
        >
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#FFE082" strokeWidth="6" />
            <circle
              cx="36" cy="36" r="30" fill="none" stroke="#FFC107" strokeWidth="6"
              strokeDasharray={`${(progress / 100) * 188.5} 188.5`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.05s linear' }}
            />
          </svg>
          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full shadow">
            {Math.ceil((HOLD_MS - (Date.now() - (startRef.current ?? 0))) / 1000)}s
          </span>
        </div>
      )}
      {children}
    </div>
  );
}