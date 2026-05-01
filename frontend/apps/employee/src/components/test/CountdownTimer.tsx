import { useEffect, useRef, useState } from 'react';

interface Props {
  initialSeconds: number;
  onExpire?: () => void;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function CountdownTimer({ initialSeconds, onExpire }: Props) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpireRef.current?.();
      return;
    }
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const isWarning = remaining <= 60;
  const isCritical = remaining <= 30;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm tabular-nums transition
        ${isCritical ? 'bg-red-100 text-red-700 animate-pulse' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}
    >
      <span>{isCritical ? '⚠️' : '⏱'}</span>
      <span>{formatTime(remaining)}</span>
    </div>
  );
}
