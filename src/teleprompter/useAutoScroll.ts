import { useEffect, useRef, useState } from 'react';

/** requestAnimationFrame scroller with a stable pixels-per-second speed. */
export function useAutoScroll(speed: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const carry = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const el = ref.current;
      const dt = (t - last) / 1000;
      last = t;
      if (el) {
        carry.current += speed * dt;
        const whole = Math.floor(carry.current);
        if (whole > 0) {
          carry.current -= whole;
          const before = el.scrollTop;
          el.scrollTop = before + whole;
          if (el.scrollTop === before && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            setRunning(false);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const restart = () => {
    if (ref.current) ref.current.scrollTop = 0;
    carry.current = 0;
  };

  return { ref, running, setRunning, restart };
}
