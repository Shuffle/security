import { ExternalLink as OpenInNewIcon, Download as DownloadIcon, FileText as FileTextIcon } from 'lucide-react';
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
        {docLinks.map((link) => (
          <ListItem key={link.slug} disablePadding>
            <ListItemButton
              component={Link}
              to={link.slug === 'index' ? '/docs' : `/docs/${link.slug}`}
              onClick={handleClick}
              selected={slug === link.slug || (slug === 'index' && link.slug === 'index')}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 102, 0, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 102, 0, 0.15)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                {link.icon}
              </ListItemIcon>
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {remoteDocs.length > 0 && (
        <List sx={{ px: 1, mt: 0 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              selected={remoteDocs.some((d) => d.slug === slug)}
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
                <BookOpenIcon size={20} />
              </ListItemIcon>
              <ListItemText primary="Reference Docs" />
              <ChevronDownIcon
                size={16}
                style={{
                  transition: 'transform 150ms ease',
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  opacity: 0.7,
                }}
              />
            </ListItemButton>
          </ListItem>
          <Menu
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: {
                  maxHeight: 420,
                  minWidth: 240,
                  mt: 0.5,
                },
              },
            }}
          >
            {remoteDocs.map((doc) => (
              <MenuItem
                key={doc.slug}
                selected={slug === doc.slug}
                onClick={() => {
                  setMenuAnchor(null);
                  handleClick();
                  navigate(`/docs/${doc.slug}`);
                }}
                sx={{
                  fontSize: '0.875rem',
                  gap: 1.25,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(255, 102, 0, 0.1)',
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                }}
              >
                <FileTextIcon size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
                <Box component="span" sx={{ flex: 1 }}>{doc.label}</Box>
                {doc.read_time ? (
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 1 }}>
                    {doc.read_time}m
                  </Typography>
                ) : null}
              </MenuItem>
            ))}
          </Menu>
        </List>
      )}




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
