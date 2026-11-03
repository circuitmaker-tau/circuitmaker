import { useEffect } from 'react';
import { useSimStore } from '../store/simStore';

/** Drives simulated time from requestAnimationFrame while playing. */
export function usePlaybackClock() {
  const playing = useSimStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      useSimStore.getState().advance(now - last);
      last = now;
      if (useSimStore.getState().playing) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
}
