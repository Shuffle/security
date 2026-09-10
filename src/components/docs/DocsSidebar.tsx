import {
  Search as SearchIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@/lib/router-compat';
import {
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { fetchDocsList, docSlug } from '@/components/docs/remoteDocs';
import {
  groupRemoteDocs,
  getDocGroup,
  getDocDisplayLabel,
  type GroupedDocsCategory,
} from '@/components/docs/docGroups';
import { SidebarSearchDialog } from '@/components/layout/SidebarSearchDialog';



interface DocsSidebarProps {
  onNavigate?: () => void;
  /** API folder to list documents from (e.g. "legal"). */
  folder?: string;
  /** URL prefix for the document links (defaults to /docs). */
  basePath?: string;
  /** Section heading above the list. */
  title?: string;
  /** @deprecated External resources block has been removed */
  hideExternal?: boolean;
}

interface RemoteDoc {
  name: string;
  slug: string;
  label: string;
  read_time?: number;
}

const toLabel = (name: string) =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Documents that should not clutter the sidebar (consolidated or special purpose)
const HIDDEN_DOC_SLUGS = new Set(['triggers', 'liquid', 'onboarding']);

export const DocsSidebar = ({
  onNavigate,
  folder,
  basePath = '/docs',
  title = 'Documentation',
}: DocsSidebarProps) => {
  const { slug = 'index' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [remoteDocs, setRemoteDocs] = useState<RemoteDoc[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchDocsList(false, folder);
      const isDocsFolder = !folder || folder === 'docs';
      const mapped: RemoteDoc[] = list
        .filter((d) => d?.name && (!isDocsFolder || !HIDDEN_DOC_SLUGS.has(docSlug(d.name))))
        .map((d) => ({
          name: d.name,
          slug: docSlug(d.name),
          label: toLabel(d.name),
          read_time: d.read_time,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      if (!cancelled) setRemoteDocs(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  // Group the loaded docs into Usability, Automation, Security, Infrastructure
  const categories = useMemo(() => {
    return groupRemoteDocs(remoteDocs, folder);
  }, [remoteDocs, folder]);

  // Automatically expand group when navigating to a document within it
  const activeGroup = useMemo(() => getDocGroup(slug), [slug]);
  useEffect(() => {
    if (activeGroup) {
      setCollapsedGroups((prev) => {
        if (!prev.has(activeGroup.id)) return prev;
        const next = new Set(prev);
        next.delete(activeGroup.id);
        return next;
      });
    }
  }, [slug, activeGroup]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        py: 3,
      }}
    >
      <Box sx={{ px: 2, mb: 2 }}>
        <Box
          onClick={() => setSearchOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'hsl(var(--muted))',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            gap: 1,
            cursor: 'pointer',
            border: '1px solid transparent',
            '&:hover': {
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'transparent',
            },
          }}
        >
          <SearchIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <Typography
            sx={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.875rem',
              flexGrow: 1,
            }}
          >
            Search
          </Typography>
          <Typography
            sx={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            Ctrl+K
          </Typography>
        </Box>
      </Box>

      <SidebarSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Render documentation grouped by category */}
      <Box sx={{ px: 1 }}>
        {categories.map((category) => {
          const isCollapsed = collapsedGroups.has(category.id);
          const hasActiveDoc = category.docs.some((d) => d.slug === slug);

          return (
            <Box key={category.id} sx={{ mb: 1.5 }}>
              {/* Group Header */}
              <Box
                onClick={() => toggleGroup(category.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.5,
                  py: 0.6,
                  borderRadius: 1,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 120ms ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isCollapsed ? (
                    <ChevronRight size={14} style={{ opacity: 0.6 }} />
                  ) : (
                    <ChevronDown size={14} style={{ opacity: 0.6 }} />
                  )}
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                      color: hasActiveDoc ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {category.label}
                  </Typography>
                </Box>
              </Box>

              {/* Group Document Items */}
              <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                <List dense disablePadding sx={{ mt: 0.5 }}>
                  {category.docs.map((doc) => {
                    const isSelected = slug === doc.slug;
                    return (
                      <ListItem key={doc.slug} disablePadding sx={{ mb: 0.2 }}>
                        <ListItemButton
                          onClick={() => {
                            handleClick();
                            navigate(`${basePath}/${doc.slug}`);
                          }}
                          selected={isSelected}
                          sx={{
                            borderRadius: 1,
                            mx: 0.5,
                            py: 0.6,
                            px: 1.5,
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(255, 102, 0, 0.1)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 102, 0, 0.15)',
                              },
                              '& .MuiListItemText-primary': {
                                color: 'primary.main',
                                fontWeight: 600,
                              },
                            },
                          }}
                        >
                          <ListItemText
                            primary={doc.label}
                            primaryTypographyProps={{
                              fontSize: '0.84rem',
                              fontWeight: isSelected ? 600 : 500,
                              noWrap: true,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
