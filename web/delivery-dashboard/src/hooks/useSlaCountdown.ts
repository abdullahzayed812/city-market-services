import { useState, useEffect, useRef } from 'react';

export interface SlaCountdownResult {
  remainingSeconds: number;
  isExpired: boolean;
  isWarning: boolean;
  formattedTime: string;
}

export function useSlaCountdown(deadline: string | Date | null | undefined): SlaCountdownResult {
  const getRemaining = () => {
    if (!deadline) return 0;
    return Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
  };

  const [remainingSeconds, setRemainingSeconds] = useState(getRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemainingSeconds(0);
      return;
    }

    setRemainingSeconds(getRemaining());

    intervalRef.current = setInterval(() => {
      const secs = getRemaining();
      setRemainingSeconds(secs);
      if (secs === 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deadline]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return {
    remainingSeconds,
    isExpired: remainingSeconds === 0 && !!deadline,
    isWarning: remainingSeconds > 0 && remainingSeconds < 120,
    formattedTime: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}
