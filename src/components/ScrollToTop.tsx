import { useEffect } from 'react';
import { useLocation } from '@/lib/router-compat';

export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Allow the page to render, then scroll to the hash target
      setTimeout(() => {
        try {
          const rawId = decodeURIComponent(hash.replace(/^#/, ''));
          if (!rawId) return;

          // 1. Direct getElementById lookup (safest: never throws on digits, symbols, or punctuation)
          let el: HTMLElement | null = document.getElementById(rawId);

          // 2. CSS-escaped selector lookup if direct lookup by ID didn't find the element
          if (!el && typeof CSS !== 'undefined' && CSS.escape) {
            try {
              el = document.querySelector(`#${CSS.escape(rawId)}`) as HTMLElement | null;
            } catch {
              // Ignore invalid selector
            }
          }

          // 3. Match anchor elements by name attribute (classic HTML anchor tags)
          if (!el && typeof CSS !== 'undefined' && CSS.escape) {
            try {
              el = document.querySelector(`[name="${CSS.escape(rawId)}"]`) as HTMLElement | null;
            } catch {
              // Ignore invalid selector
            }
          }

          // 4. Fallback anchor normalization for documentation headings (e.g. "1_automated_quarantine...")
          if (!el) {
            try {
              const targetKey = rawId
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
              if (targetKey) {
                const headings = Array.from(
                  document.querySelectorAll('h1, h2, h3, h4, h5, h6')
                ) as HTMLElement[];
                el =
                  headings.find((h) => {
                    const hId = (h.id || '')
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/^_+|_+$/g, '');
                    const hText = (h.textContent || '')
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/^_+|_+$/g, '');
                    return hId === targetKey || hText === targetKey;
                  }) || null;
              }
            } catch {
              // Ignore normalization errors
            }
          }

          // 5. Final fallback: try raw querySelector only inside try-catch
          if (!el) {
            try {
              el = document.querySelector(hash) as HTMLElement | null;
            } catch {
              // Ignore invalid selector syntax, never throw or crash the page
            }
          }

          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        } catch {
          // Never let an anchor scroll error crash the app
        }
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
};
