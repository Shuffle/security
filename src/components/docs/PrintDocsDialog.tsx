import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { Printer as PrinterIcon } from 'lucide-react';
import ShuffleMarkdown from '@/Shuffle-MCPs/components/Markdown';
import { fetchDocMarkdown, fetchDocsList, resolveDocName } from '@/components/docs/remoteDocs';

interface PrintDocsDialogProps {
  /** Slug of the currently viewed doc. */
  slug: string;
  /** Markdown of the currently viewed doc (used for the single page option). */
  currentMarkdown: string;
  /** Disabled while the page is still loading. */
  disabled?: boolean;
}

const PRINT_CSS = `
  @page { margin: 18mm 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
         color: #111; background: #fff; font-size: 12pt; line-height: 1.6; margin: 0; }
  .doc { page-break-after: always; }
  .doc:last-child { page-break-after: auto; }
  .doc-title { font-size: 20pt; font-weight: 700; margin: 0 0 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  h1, h2, h3, h4 { page-break-after: avoid; color: #111; }
  h1 { font-size: 18pt; } h2 { font-size: 15pt; } h3 { font-size: 13pt; }
  p, li { color: #222; }
  a { color: #b34700; text-decoration: none; word-break: break-word; }
  img, video, iframe { max-width: 100%; }
  pre { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px;
        white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; font-size: 10pt; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 10pt; background: #f5f5f5; padding: 0 3px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
  th { background: #f0f0f0; }
  blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 12px; color: #555; }
`;

/** Render markdown to static HTML using the standard renderer, off-screen. */
const renderMarkdownToHtml = async (markdown: string): Promise<string> => {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '800px';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<ShuffleMarkdown disableBreaks>{markdown}</ShuffleMarkdown>);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const html = host.innerHTML;
  root.unmount();
  host.remove();
  return html;
};

const openPrintWindow = (title: string, bodyHtml: string) => {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.open();
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
  return true;
};

export const PrintDocsDialog = ({ slug, currentMarkdown, disabled }: PrintDocsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = async () => {
    setBusy(true);
    setError(null);
    try {
      if (scope === 'current') {
        const name = (await resolveDocName(slug)) ?? slug;
        const html = await renderMarkdownToHtml(currentMarkdown);
        const ok = openPrintWindow(
          name,
          `<div class="doc"><div class="doc-title">${name}</div>${html}</div>`,
        );
        if (!ok) throw new Error('popup-blocked');
        setOpen(false);
        return;
      }

      const list = await fetchDocsList();
      if (list.length === 0) throw new Error('no-docs');
      setProgress({ done: 0, total: list.length });
      const sections: string[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const entry = list[i];
        const markdown = await fetchDocMarkdown(entry.name);
        if (markdown) {
          const html = await renderMarkdownToHtml(markdown);
          sections.push(`<div class="doc"><div class="doc-title">${entry.name}</div>${html}</div>`);
        }
        setProgress({ done: i + 1, total: list.length });
      }
      if (sections.length === 0) throw new Error('no-docs');
      const ok = openPrintWindow('Shuffle Documentation', sections.join(''));
      if (!ok) throw new Error('popup-blocked');
      setOpen(false);
    } catch (err: any) {
      setError(
        err?.message === 'popup-blocked'
          ? 'The print window was blocked. Please allow popups and try again.'
          : 'Could not prepare the documentation for printing.',
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={() => setOpen(true)}
        disabled={disabled}
        startIcon={<PrinterIcon size={14} />}
        sx={{
          textTransform: 'none',
          height: 36,
          borderColor: 'hsl(var(--border))',
          color: 'text.primary',
          '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
        }}
      >
        Print
      </Button>

      <Dialog open={open} onClose={() => (busy ? null : setOpen(false))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Print documentation</DialogTitle>
        <DialogContent>
          <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as 'current' | 'all')}>
            <FormControlLabel
              value="current"
              control={<Radio size="small" />}
              disabled={busy}
              label={<Typography variant="body2">This page only</Typography>}
            />
            <FormControlLabel
              value="all"
              control={<Radio size="small" />}
              disabled={busy}
              label={<Typography variant="body2">All documentation pages</Typography>}
            />
          </RadioGroup>

          {progress && (
            <Stack spacing={0.75} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Loading pages {progress.done} / {progress.total}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progress.total ? (progress.done / progress.total) * 100 : 0}
              />
            </Stack>
          )}

          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 2 }}>
              {error}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            A print view opens in a new tab. Choose "Save as PDF" in the print dialog to export.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handlePrint} disabled={busy} sx={{ textTransform: 'none' }}>
            {busy ? 'Preparing…' : 'Print'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PrintDocsDialog;
