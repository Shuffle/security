/**
 * GlobalWorkflowRunDrawer — single app-level instance of the workflow run
 * explorer drawer. Any component (e.g. AgentUI's "View full execution"
 * button) can open it by dispatching the `workflow-run:open` window event
 * with `{ executionId }` in `detail`.
 *
 * Pages that mount their own WorkflowRunExplorerDrawer (IncidentDetailPage)
 * handle the event locally and mark it handled via `event.preventDefault()`
 * on a cancelable event; this global fallback covers every other route.
 */

import { useEffect, useState } from 'react';
import { WorkflowRunExplorerDrawer } from '@/Shuffle-Core';
import { useTheme } from '@/context/ThemeContext';

const GlobalWorkflowRunDrawer = () => {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ executionId?: string }>).detail;
      if (detail?.executionId) setExecutionId(String(detail.executionId));
    };
    window.addEventListener('workflow-run:open', handler as EventListener);
    return () => window.removeEventListener('workflow-run:open', handler as EventListener);
  }, []);

  return (
    <WorkflowRunExplorerDrawer
      open={!!executionId}
      executionId={executionId || ''}
      onClose={() => setExecutionId(null)}
      theme={resolvedTheme}
    />
  );
};

export default GlobalWorkflowRunDrawer;
