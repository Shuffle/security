/**
 * AskAiWidget — Complete drop-in context-aware "Ask AI" solution for Shuffle-MCPs.
 *
 * Combines the ChatGPT docs-styled floating button in the bottom-right corner with
 * the context-aware AskAiDrawer. Supports both controlled and uncontrolled states,
 * and responds to legacy `openAgentDrawer` events.
 *
 * Self-contained: No host-app `@/` imports.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AskAiButton, AskAiButtonProps } from '@/Shuffle-MCPs/components/AskAiButton';
import { AskAiDrawer, AskAiDrawerProps } from '@/Shuffle-MCPs/components/AskAiDrawer';
import { AgentRunDrawerTab } from '@/Shuffle-MCPs/components/AgentRunDrawer';
import { AgentResolvedContext, resolveAgentContext } from '@/Shuffle-MCPs/agentContextRegistry';

export const AGENT_DRAWER_OPEN_EVENT = 'agent-drawer-open';

export interface AgentDrawerOpenDetail {
  tab?: 'run' | 'permissions' | 'localLLM';
  source?: string;
  defaultInput?: string;
}

export interface AskAiWidgetProps extends Omit<AskAiDrawerProps, 'open' | 'onClose'> {
  /** Controlled open state. When omitted, the widget manages its own open state. */
  open?: boolean;
  /** Controlled open state change handler. */
  onOpenChange?: (open: boolean) => void;
  /** Authoritative support user flag. When omitted, checks localStorage. */
  isSupport?: boolean;
  /** Whether to require support status to show the floating button. Default: true. */
  requireSupport?: boolean;
  /** Props forwarded to the floating AskAiButton */
  buttonProps?: Partial<AskAiButtonProps>;
  /** Hide the floating button completely (e.g. if controlled only by external triggers) */
  hideButton?: boolean;
}

export const AskAiWidget: React.FC<AskAiWidgetProps> = ({
  open: controlledOpen,
  onOpenChange,
  isSupport,
  requireSupport = true,
  buttonProps,
  hideButton = false,
  pathname,
  search,
  rules,
  initialTab: propInitialTab = 'run',
  onContextResolved,
  ...drawerProps
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AgentRunDrawerTab>(propInitialTab);
  const isDrawerOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setDrawerOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  // Track resolved context for button tooltip / hint
  const [currentContext, setCurrentContext] = useState<AgentResolvedContext | null>(null);

  const handleContextResolved = useCallback(
    (ctx: AgentResolvedContext) => {
      setCurrentContext(ctx);
      onContextResolved?.(ctx);
    },
    [onContextResolved],
  );

  // Listen to global openAgentDrawer events so existing UI triggers continue to work seamlessly
  useEffect(() => {
    const handleDrawerOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<AgentDrawerOpenDetail>).detail;
      if (detail?.tab) {
        setActiveTab(detail.tab);
      }
      setDrawerOpen(true);
    };

    window.addEventListener(AGENT_DRAWER_OPEN_EVENT, handleDrawerOpenEvent);
    return () => window.removeEventListener(AGENT_DRAWER_OPEN_EVENT, handleDrawerOpenEvent);
  }, [setDrawerOpen]);

  // Context hint for floating button (e.g. "Shuffle Incidents MCP")
  const contextHint =
    currentContext?.apps && currentContext.apps.length > 0
      ? currentContext.apps.map((a) => a.name.replace(/^shuffle_/, '').replace(/_/g, ' ')).join(', ')
      : undefined;

  return (
    <>
      {/* Floating ChatGPT docs-style button in bottom-right corner */}
      {!hideButton && (
        <AskAiButton
          onClick={() => setDrawerOpen(!isDrawerOpen)}
          isOpen={isDrawerOpen}
          isSupport={isSupport}
          requireSupport={requireSupport}
          contextHint={contextHint}
          {...buttonProps}
        />
      )}

      {/* Context-aware Agent Run Drawer */}
      <AskAiDrawer
        {...drawerProps}
        open={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialTab={activeTab}
        pathname={pathname}
        search={search}
        rules={rules}
        onContextResolved={handleContextResolved}
      />
    </>
  );
};

/**
 * Convenience hook to get the active agent context for a given route.
 */
export const useContextAwareAgent = (pathname?: string, search?: string) => {
  const [activeContext, setActiveContext] = useState<AgentResolvedContext>(() => {
    const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const s = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    return resolveAgentContext(p, s);
  });

  useEffect(() => {
    const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const s = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    setActiveContext(resolveAgentContext(p, s));
  }, [pathname, search]);

  return activeContext;
};

export default AskAiWidget;
