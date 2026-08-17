import { toast } from 'sonner';

/**
 * Wrap a click/action handler so an unexpected throw never leaves the user
 * with a button that silently does nothing. The error is logged and surfaced
 * as a toast instead of taking down the React tree.
 */
export function safeHandler<T extends (...args: any[]) => any>(
  label: string,
  fn: T | undefined | null,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>) => {
    if (typeof fn !== 'function') {
      console.error(`[safeHandler] "${label}" has no handler attached`);
      toast.error(`${label} is not available right now`);
      return undefined;
    }
    try {
      const result = fn(...args);
      if (result && typeof (result as any).catch === 'function') {
        (result as Promise<unknown>).catch((err) => {
          console.error(`[safeHandler] "${label}" failed`, err);
          toast.error(`${label} failed`, {
            description: err instanceof Error ? err.message : String(err),
          });
        });
      }
      return result;
    } catch (err) {
      console.error(`[safeHandler] "${label}" failed`, err);
      toast.error(`${label} failed`, {
        description: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  };
}

export default safeHandler;
