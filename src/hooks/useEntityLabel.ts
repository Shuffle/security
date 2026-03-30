import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

/** Maps route prefix to display labels */
const ROUTE_LABELS: Record<string, { singular: string; plural: string }> = {
  '/alerts': { singular: 'Alert', plural: 'Alerts' },
  '/tickets': { singular: 'Ticket', plural: 'Tickets' },
  '/jobs': { singular: 'Job', plural: 'Jobs' },
  '/incidents': { singular: 'Incident', plural: 'Incidents' },
};

export function useEntityLabel() {
  const { pathname } = useLocation();

  return useMemo(() => {
    const prefix = Object.keys(ROUTE_LABELS).find(p => pathname.startsWith(p));
    const labels = prefix ? ROUTE_LABELS[prefix] : ROUTE_LABELS['/incidents'];
    return { ...labels, basePath: prefix || '/incidents' };
  }, [pathname]);
}
