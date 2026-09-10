import {
  ExternalLink as OpenInNewIcon,
  Download as DownloadIcon,
  FileText as FileTextIcon,
  Search as SearchIcon,
  BookOpen,
  Zap,
  Shield,
  Cpu,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@/lib/router-compat';
import {
  Box,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { fetchDocsList, docSlug } from '@/components/docs/remoteDocs';
import {
  groupRemoteDocs,
  getDocGroup,
  loadGroupDocsContent,
  getDocDisplayLabel,
  type GroupedDocsCategory,
} from '@/components/docs/docGroups';
import { activateGroupDocPromptContext } from '@/lib/docsPromptContext';
import { openAgentDrawer } from '@/lib/agentDrawer';
import { SidebarSearchDialog } from '@/components/layout/SidebarSearchDialog';

interface DocLink {
  label: string;
  slug: string;
  icon: React.ReactNode;
  external?: boolean;
  href?: string;
}

interface DocsSidebarProps {
  onNavigate?: () => void;
  /** API folder to list documents from (e.g. "legal"). */
  folder?: string;
  /** URL prefix for the document links (defaults to /docs). */
  basePath?: string;
  /** Section heading above the list. */
  title?: string;
  /** Hide the external resources block (not relevant outside documentation). */
  hideExternal?: boolean;
}

const externalLinks: DocLink[] = [
  {
    label: 'Shuffle Automation',
    slug: 'shuffle',
    icon: <OpenInNewIcon size={16} />,
    external: true,
    href: 'https://shuffler.io',
  },
  {
    label: 'Agent Skill (SHUFFLE_CORE.md)',
    slug: 'shuffle-core-md',
    icon: <DownloadIcon size={16} />,
    external: true,
    href: '/SHUFFLE_CORE.md',
  },
];

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
  hideExternal = false,
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

  const handleAskAboutGroup = async (
    category: GroupedDocsCategory,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      const contents = await loadGroupDocsContent(category.id, folder);
      const snippets = Object.entries(contents).map(([s, md]) => ({
        slug: s,
        title: getDocDisplayLabel(s),
        content: md,
      }));
      activateGroupDocPromptContext(category.id, category.label, snippets);
    } catch {
      // Continue even if group preload fails
    }
    openAgentDrawer('run');
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'usability':
        return <BookOpen size={16} />;
      case 'automation':
        return <Zap size={16} />;
      case 'security':
        return <Shield size={16} />;
      case 'infrastructure':
        return <Cpu size={16} />;
      default:
        return <FileTextIcon size={16} />;
    }
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

      <Typography
        variant="overline"
        sx={{
          px: 3,
          color: 'text.secondary',
          fontWeight: 600,
          letterSpacing: 1.5,
          display: 'block',
          mb: 1,
        }}
      >
        {title}
      </Typography>

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
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 0.6,
                  borderRadius: 1,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 120ms ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    '& .group-ask-btn': {
                      opacity: 1,
                    },
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

                <Tooltip title={`Ask AI about ${category.label}`} arrow placement="right">
                  <IconButton
                    className="group-ask-btn"
                    size="small"
                    onClick={(e) => handleAskAboutGroup(category, e)}
                    sx={{
                      p: 0.4,
                      opacity: 0.7,
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'rgba(255, 102, 0, 0.1)',
                      },
                      transition: 'all 120ms ease',
                    }}
                    aria-label={`Ask AI about ${category.label}`}
                  >
                    <Sparkles size={13} />
                  </IconButton>
                </Tooltip>
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
                              '& .MuiListItemIcon-root': { color: 'primary.main' },
                              '& .MuiListItemText-primary': {
                                color: 'primary.main',
                                fontWeight: 600,
                              },
                            },
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 28,
                              color: isSelected ? 'primary.main' : 'text.secondary',
                            }}
                          >
                            {getCategoryIcon(category.id)}
                          </ListItemIcon>
                          <ListItemText
                            primary={doc.label}
                            primaryTypographyProps={{
                              fontSize: '0.84rem',
                              fontWeight: isSelected ? 600 : 500,
                              noWrap: true,
                            }}
                          />
                          {doc.read_time ? (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.disabled',
                                ml: 0.5,
                                fontSize: '0.72rem',
                                flexShrink: 0,
                              }}
                            >
                              {doc.read_time}m
                            </Typography>
                          ) : null}
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

      {!hideExternal && (
        <>
          <Typography
            variant="overline"
            sx={{
              px: 3,
              mt: 3,
              display: 'block',
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: 1.5,
            }}
          >
            External Resources
          </Typography>

          <List sx={{ px: 1, mt: 0.5 }}>
            {externalLinks.map((link) => (
              <ListItem key={link.slug} disablePadding sx={{ mb: 0.2 }}>
                <ListItemButton
                  component="a"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    borderRadius: 1,
                    mx: 0.5,
                    py: 0.8,
                    px: 1.5,
                    color: 'text.secondary',
                    transition: 'background-color 120ms ease, color 120ms ease',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      color: 'text.primary',
                      '& .MuiListItemIcon-root, & .ext-indicator': {
                        color: 'primary.main',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                    {link.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={link.label}
                    primaryTypographyProps={{
                      fontSize: '0.84rem',
                      fontWeight: 500,
                      sx: { color: 'inherit' },
                    }}
                  />
                  <OpenInNewIcon
                    className="ext-indicator"
                    size={13}
                    style={{
                      color: 'text.disabled',
                      marginLeft: '6px',
                      flexShrink: 0,
                      transition: 'color 120ms ease',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
};
