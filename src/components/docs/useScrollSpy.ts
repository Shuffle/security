import { useEffect, useState } from 'react';

interface UseScrollSpyOptions {
  /** Offset from the top of the viewport in pixels (accounts for sticky navbar). Default: 100 */
  offset?: number;
}

/**
 * Tracks which heading element in `headingIds` is currently in or closest to the top of the viewport.
 */
export const useScrollSpy = (
  headingIds: string[],
  options: UseScrollSpyOptions = {},
): string | null => {
  const { offset = 100 } = options;
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || headingIds.length === 0) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        ticking = false;

        const scrollY = window.scrollY || window.pageYOffset;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;

        // If at the very top of the page, activate the first heading (or none if far above)
        if (scrollY < 80) {
          setActiveId(headingIds[0] ?? null);
          return;
        }

        // If near the bottom of the page, activate the last heading
        if (scrollY + windowHeight >= docHeight - 50) {
          setActiveId(headingIds[headingIds.length - 1] ?? null);
          return;
        }

        // Find all heading elements present in the DOM
        const elements = headingIds
          .map((id) => ({ id, el: document.getElementById(id) }))
          .filter((item): item is { id: string; el: HTMLElement } => Boolean(item.el));

        if (elements.length === 0) return;

        // Find the last heading whose top has scrolled past or is at the offset
        let currentActive: string | null = null;
        for (const item of elements) {
          const rect = item.el.getBoundingClientRect();
          if (rect.top <= offset) {
            currentActive = item.id;
          } else {
            // Once we see a heading below the offset, we can stop
            break;
          }
        }

        // If no heading has reached the offset yet, pick the first one
        if (!currentActive && elements.length > 0) {
          currentActive = elements[0].id;
        }

        setActiveId((prev) => (prev !== currentActive ? currentActive : prev));
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headingIds, offset]);

  return activeId;
};
