import { Globe, Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsSupport } from '@/hooks/useIsSupport';
import { cn } from '@/lib/utils';

export type RegionCode = 'eu' | 'us' | 'ca' | 'onprem';

export const REGION_OPTIONS: { value: RegionCode; label: string; url: string }[] = [
  { value: 'eu', label: 'Europe', url: 'shuffler.io' },
  { value: 'us', label: 'United States', url: 'us.shuffler.io' },
  { value: 'ca', label: 'Canada', url: 'ca.shuffler.io' },
  { value: 'onprem', label: 'Self-hosted / On-prem', url: '' },
];

interface RegionSwitcherProps {
  value?: RegionCode;
  onChange?: (value: RegionCode) => void;
  /** Force disabled regardless of support status */
  forceDisabled?: boolean;
  showLabel?: boolean;
  className?: string;
  triggerClassName?: string;
}

export const RegionSwitcher = ({
  value = 'eu',
  onChange,
  forceDisabled = false,
  showLabel = true,
  className,
  triggerClassName,
}: RegionSwitcherProps) => {
  const isSupport = useIsSupport();
  const disabled = forceDisabled || !isSupport;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {showLabel && (
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Region
        </label>
      )}
      <Select value={value} onValueChange={(v) => onChange?.(v as RegionCode)} disabled={disabled}>
        <SelectTrigger className={cn('h-9 w-[260px]', triggerClassName)}>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {REGION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}{opt.url ? ` — ${opt.url}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Region switching is restricted to Shuffle support.
        </p>
      )}
    </div>
  );
};

export default RegionSwitcher;
