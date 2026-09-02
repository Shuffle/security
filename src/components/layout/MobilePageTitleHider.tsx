import { useEffect } from 'react';
import { useLocation } from '@/lib/router-compat';
import { getPageTitle } from './IosWebViewNavHeader';

const HIDDEN_ATTR = 'data-mobile-title-hidden';

/**
 * On mobile the page name is already shown in the top navigation header, so
 * the in-page heading with the same text is a duplicate. This hides that
 * secondary heading on small screens for every page, without each page
 * needing to know about the mobile header.
 */
export const MobilePageTitleHider = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 599.95px)');
    const { title } = getPageTitle(location.pathname);
    const target = (title || '').trim().toLowerCase();

    const restore = () => {
      document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`).forEach((el) => {
        el.style.display = '';
        el.removeAttribute(HIDDEN_ATTR);
      });
    };

    const apply = () => {
      restore();
      if (!mq.matches || !target) return;
      const main = document.querySelector('main');
      if (!main) return;
      const nodes = main.querySelectorAll<HTMLElement>(
        'h1, h2, h3, .MuiTypography-h4, .MuiTypography-h5, .MuiTypography-h6'
      );
      for (const el of Array.from(nodes)) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (!text) continue;
        if (text === target) {
          el.style.display = 'none';
          el.setAttribute(HIDDEN_ATTR, 'true');
          break;
        }
      }
    };

    apply();
    const timers = [50, 200, 600, 1200].map((ms) => window.setTimeout(apply, ms));
    const observer = new MutationObserver(() => apply());
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    mq.addEventListener('change', apply);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      observer.disconnect();
      mq.removeEventListener('change', apply);
      restore();
    };
  }, [location.pathname]);

  return null;
};

export default MobilePageTitleHider;
