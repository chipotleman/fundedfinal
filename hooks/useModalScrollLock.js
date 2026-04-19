import { useEffect, useRef } from 'react';

export default function useModalScrollLock(isOpen, { restoreScroll = false } = {}) {
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (isOpen) {
      if (restoreScroll) {
        savedScrollY.current = window.scrollY;
      } else {
        window.scrollTo(0, 0);
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (restoreScroll && savedScrollY.current > 0) {
        const y = savedScrollY.current;
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: 'smooth' });
        });
        savedScrollY.current = 0;
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, restoreScroll]);
}
