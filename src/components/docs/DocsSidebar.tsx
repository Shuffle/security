import { ExternalLink as OpenInNewIcon, Download as DownloadIcon, FileText as FileTextIcon, Search as SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { fetchDocsList, docSlug } from '@/components/docs/remoteDocs';
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
}

const externalLinks: DocLink[] = [
  {
    label: 'Shuffle API Docs',
    slug: 'api',
    icon: <OpenInNewIcon />,
    external: true,
    href: 'https://shuffler.io/docs/API',
  },
  {
    label: 'Shuffle Automation',
    slug: 'shuffle',
    icon: <OpenInNewIcon />,
    external: true,
    href: 'https://shuffler.io',
  },
  {
    label: 'Agent Skill (SHUFFLE_CORE.md)',
    slug: 'shuffle-core-md',
    icon: <DownloadIcon />,
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

export const DocsSidebar = ({ onNavigate }: DocsSidebarProps) => {
  const { slug = 'index' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [remoteDocs, setRemoteDocs] = useState<RemoteDoc[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

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
      const list = await fetchDocsList();
      const mapped: RemoteDoc[] = list
        .filter((d) => d?.name)
        .map((d) => ({
          name: d.name,
          slug: docSlug(d.name),
          label: toLabel(d.name),
          read_time: d.read_time,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      if (!cancelled) setRemoteDocs(mapped);
    })();
    return () => { cancelled = true; };
  }, []);


  const handleClick = () => {
    onNavigate?.();
  };




  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
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
            '&:hover': { border: '1px solid hsl(var(--border))', backgroundColor: 'transparent' },
          }}
        >
          <SearchIcon size={20} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', flexGrow: 1 }}>
            Search
          </Typography>
          <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontFamily: 'monospace' }}>
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
        }}
      >
        Documentation
      </Typography>
      
      <List sx={{ px: 1, mt: 1 }}>
        {remoteDocs.map((doc) => (
          <ListItem key={doc.slug} disablePadding>
            <ListItemButton
              onClick={() => {
                handleClick();
                navigate(`/docs/${doc.slug}`);
              }}
              selected={slug === doc.slug}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 102, 0, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(255, 102, 0, 0.15)' },
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                  '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 600 },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                <FileTextIcon size={18} />
              </ListItemIcon>
              <ListItemText
                primary={doc.label}
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
              />
              {doc.read_time ? (
                <Typography variant="caption" sx={{ color: 'text.disabled', ml: 1 }}>
                  {doc.read_time}m
                </Typography>
              ) : null}
            </ListItemButton>
          </ListItem>
        ))}
      </List>





      <Typography
        variant="overline"
        sx={{
          px: 3,
          mt: 4,
          display: 'block',
          color: 'text.secondary',
          fontWeight: 600,
          letterSpacing: 1.5,
        }}
      >
        External Resources
      </Typography>

      <List sx={{ px: 1, mt: 1 }}>
        {externalLinks.map((link) => (
          <ListItem key={link.slug} disablePadding>
            <ListItemButton
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                borderRadius: 1,
                mx: 1,
                py: 1,
                gap: 0.5,
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
              <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                {link.icon}
              </ListItemIcon>
              <ListItemText
                primary={link.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  sx: { color: 'inherit' },
                }}
              />
              <OpenInNewIcon
                className="ext-indicator"
                size={14} style={{ color: 'text.disabled', marginLeft: '8px', flexShrink: 0, transition: 'color 120ms ease' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
