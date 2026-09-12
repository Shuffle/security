import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { IncidentTask } from '@/config/ocsfIncidentSchema';

interface SimpleCaseLayoutProps {
  narrativeLabel: string;
  narrative: ReactNode;
  timeline: ReactNode;
  tasks: ReactNode;
  observables: ReactNode;
  correlations: ReactNode;
  taskItems: IncidentTask[];
  observableCount: number;
  correlationCount: number;
}

const SECTIONS = ['narrative', 'tasks', 'observables', 'correlations'] as const;
type SectionKey = typeof SECTIONS[number];

export const SimpleCaseLayout = ({
  narrativeLabel,
  narrative,
  timeline,
  tasks,
  observables,
  correlations,
  taskItems,
  observableCount,
  correlationCount,
}: SimpleCaseLayoutProps) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('narrative');
  const refs = useRef<Record<SectionKey, HTMLElement | null>>({
    narrative: null,
    tasks: null,
    observables: null,
    correlations: null,
  });

  useEffect(() => {
    const elements = SECTIONS.map((key) => refs.current[key]).filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const key = visible?.target.getAttribute('data-simple-section') as SectionKey | null;
      if (key) setActiveSection(key);
    }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (key: SectionKey, taskId?: string) => {
    const target = taskId
      ? document.querySelector(`[data-simple-task-id="${CSS.escape(taskId)}"]`)
      : refs.current[key];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openTasks = taskItems.filter((task) => !task.completed && !task.disabled);
  const sectionData: Array<{ key: SectionKey; label: string; count?: number }> = [
    { key: 'narrative', label: narrativeLabel },
    { key: 'tasks', label: 'Tasks', count: openTasks.length },
    { key: 'observables', label: 'Observables', count: observableCount },
    { key: 'correlations', label: 'Correlations', count: correlationCount },
  ];

  const sectionSx = {
    scrollMarginTop: 88,
    pb: { xs: 4, md: 7 },
  } as const;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: '280px minmax(480px, 1fr) 220px' }, gap: { xs: 3, xl: 5 }, alignItems: 'start' }}>
      <Box sx={{ order: { xs: 2, xl: 1 }, position: { xl: 'sticky' }, top: { xl: 24 }, minWidth: 0, maxHeight: { xl: 'calc(100vh - 48px)' }, overflowY: { xl: 'auto' } }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', mb: 1.5 }}>
          Timeline
        </Typography>
        {timeline}
      </Box>

      <Box sx={{ order: { xs: 1, xl: 2 }, minWidth: 0, maxWidth: 820, width: '100%', mx: 'auto' }}>
        <Box ref={(node: HTMLElement | null) => { refs.current.narrative = node; }} data-simple-section="narrative" sx={sectionSx}>
          <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 2.5 }}>{narrativeLabel}</Typography>
          {narrative}
        </Box>
        <Box ref={(node: HTMLElement | null) => { refs.current.tasks = node; }} data-simple-section="tasks" sx={sectionSx}>
          <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 2.5 }}>Tasks</Typography>
          {tasks}
        </Box>
        <Box ref={(node: HTMLElement | null) => { refs.current.observables = node; }} data-simple-section="observables" sx={sectionSx}>
          <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 2.5 }}>Observables</Typography>
          {observables}
        </Box>
        <Box ref={(node: HTMLElement | null) => { refs.current.correlations = node; }} data-simple-section="correlations" sx={{ ...sectionSx, pb: 2 }}>
          <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 2.5 }}>Correlations</Typography>
          {correlations}
        </Box>
      </Box>

      <Box component="nav" aria-label="Case contents" sx={{ display: { xs: 'none', xl: 'block' }, order: 3, position: 'sticky', top: 24 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', mb: 1.25 }}>
          Contents
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          {sectionData.map(({ key, label, count }) => (
            <Button
              key={key}
              onClick={() => scrollTo(key)}
              sx={{
                minHeight: 32,
                justifyContent: 'space-between',
                px: 1,
                textTransform: 'none',
                fontSize: '0.78rem',
                fontWeight: activeSection === key ? 700 : 500,
                color: activeSection === key ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                borderLeft: '2px solid',
                borderColor: activeSection === key ? 'hsl(var(--primary))' : 'transparent',
                borderRadius: 0,
              }}
            >
              <span>{label}</span>
              {count !== undefined && <span>{count}</span>}
            </Button>
          ))}
        </Box>
        {openTasks.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', mb: 0.75 }}>
              Open tasks
            </Typography>
            {openTasks.slice(0, 8).map((task) => (
              <Button
                key={task.id}
                onClick={() => scrollTo('tasks', task.id)}
                title={task.title}
                sx={{ display: 'block', width: '100%', minHeight: 30, px: 1, textAlign: 'left', textTransform: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {task.title}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SimpleCaseLayout;