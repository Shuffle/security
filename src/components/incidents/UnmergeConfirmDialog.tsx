/**
 * Shared confirmation dialog for detaching a merged incident. Unmerging
 * is a destructive, rarely-correct operation: it removes the linked
 * pointer on both sides AND permanently disables auto-merge for that
 * specific pair (via `_unmerged_from`). The wording here needs to be
 * strong enough that an analyst does not click through by reflex.
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface UnmergeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human label for the incident being detached (used in the body copy). */
  targetLabel?: string;
  /** Called when the analyst confirms. May be async. */
  onConfirm: () => void | Promise<void>;
}

export const UnmergeConfirmDialog = ({
  open,
  onOpenChange,
  targetLabel,
  onConfirm,
}: UnmergeConfirmDialogProps) => {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--destructive))]" />
            Unmerge this incident?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 pt-2">
            <span className="block">
              This is almost never the right action. Unmerging{' '}
              {targetLabel ? <strong>{targetLabel}</strong> : 'this incident'} will:
            </span>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li>Detach it from the primary and restore its previous status.</li>
              <li>
                <strong>Permanently disable auto-merge for this pair</strong>{' '}
                — even if the same thread, correlations or observables match
                again later, the two incidents will stay separate.
              </li>
              <li>
                Break the union of observables, correlations, activity and
                email history that the primary was showing.
              </li>
            </ul>
            <span className="block pt-1">
              Only continue if you are certain these incidents should not be
              related.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep merged</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => { e.preventDefault(); void handleConfirm(); }}
            className="bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive))]/90"
          >
            {busy ? 'Unmerging...' : 'Unmerge anyway'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
