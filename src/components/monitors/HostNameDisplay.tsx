import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Hostnames reported by the Host Monitor can include a backend machine ID
 * appended after a pipe. Example:
 *   MACBOOK-PRO|D17487DC-4C26-5823-8474-B6A19946CDA0
 *
 * The user-visible part is everything before the first `|`. The full value is
 * surfaced only on hover, to keep the UI readable while still making the ID
 * discoverable.
 */

export const displayHostname = (hostname?: string | null): string => {
  const full = String(hostname || '');
  const idx = full.indexOf('|');
  if (idx < 0) return full;
  return full.slice(0, idx).trim();
};

export const machineIdFromHostname = (hostname?: string | null): string => {
  const full = String(hostname || '');
  const idx = full.indexOf('|');
  if (idx < 0) return '';
  return full.slice(idx + 1).trim();
};

interface HostNameDisplayProps {
  hostname?: string | null;
  className?: string;
  /** Tooltip content. `full` shows the full hostname. `machineId` only shows the machine ID. */
  tooltip?: 'full' | 'machineId';
}

export const HostNameDisplay = ({
  hostname,
  className,
  tooltip = 'full',
}: HostNameDisplayProps) => {
  const full = String(hostname || '');
  const short = displayHostname(full);
  const machineId = machineIdFromHostname(full);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{short}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="z-[9999] max-w-sm">
          <div className="space-y-0.5">
            {tooltip === 'full' ? (
              <>
                <p className="text-xs font-semibold">Hostname</p>
                <p className="text-xs font-mono">{full || '—'}</p>
                {machineId && (
                  <p className="text-[0.65rem] text-muted-foreground">Machine ID: {machineId}</p>
                )}
              </>
            ) : machineId ? (
              <p className="text-xs font-mono">Machine ID: {machineId}</p>
            ) : (
              <p className="text-xs font-mono">{full || '—'}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HostNameDisplay;
