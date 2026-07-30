/**
 * InlineAgentQuestion — renders a workflow's stuck "Question" handoff inline
 * inside the incident Timeline, so the user can answer without opening the
 * global handoff dialog.
 *
 * Behaviour:
 *  - Provenance header makes it obvious WHERE the question came from
 *    (workflow / agent name, execution id, when it was raised).
 *  - Question text and description are rendered as markdown.
 *  - Multiple questions are handled ONE AT A TIME. Each answer is submitted
 *    in realtime (`continueAgentExecution` with `{question_N: answer}`) before
 *    moving on to the next question.
 *  - Every question can be skipped with "Ignore". Ignoring the last remaining
 *    question dismisses the notification.
 */
import { useState } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Tooltip } from '@mui/material';
import { HelpCircle, Send, X, Check } from 'lucide-react';
import { toast } from '@/lib/toast';
import InlineMarkdown from '@/components/shared/InlineMarkdown';
import {
  approveAgentAction,
  continueAgentExecution,
  dismissNotification,
  stripAgentTitlePrefix,
  type AgentNotification,
} from '@/services/notifications';

interface Props {
  notification: AgentNotification;
  /** Human label for where the question came from (e.g. workflow name). */
  sourceLabel?: string;
  onSubmitted?: () => void;
}

const relativeTime = (unixSeconds?: number): string => {
  if (!unixSeconds) return '';
  const ms = unixSeconds > 1e12 ? unixSeconds : unixSeconds * 1000;
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const InlineAgentQuestion = ({ notification, sourceLabel, onSubmitted }: Props) => {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [done, setDone] = useState(false);

  const questions = notification.questions && notification.questions.length > 0
    ? notification.questions
    : [stripAgentTitlePrefix(notification.title) || notification.description || 'Provide an answer to continue'];

  const total = questions.length;
  const current = questions[index];

  const shortExec = notification.execution_id ? String(notification.execution_id).slice(0, 8) : '';
  const origin = sourceLabel
    || stripAgentTitlePrefix(notification.title)
    || 'AI Agent run';

  const advance = () => {
    if (index + 1 < total) {
      setIndex(index + 1);
      setAnswer('');
    } else {
      setDone(true);
      onSubmitted?.();
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await continueAgentExecution({
        notification,
        approve: true,
        note: { [`question_${index}`]: answer.trim() },
      });
      if (index + 1 >= total) {
        await approveAgentAction(notification.id).catch(() => { /* non-fatal */ });
      }
      setAnsweredCount((c) => c + 1);
      toast.success(total > 1 ? `Answer ${index + 1} of ${total} submitted.` : 'Answer submitted — the workflow will continue.');
      onSubmitted?.();
      advance();
    } catch (err) {
      console.error('[InlineAgentQuestion] submit failed:', err);
      toast.error('Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIgnore = async () => {
    if (submitting) return;
    setIgnoredCount((c) => c + 1);
    if (index + 1 >= total && answeredCount === 0) {
      // Nothing was answered at all — clear the notification entirely.
      await dismissNotification(notification.id).catch(() => { /* non-fatal */ });
      onSubmitted?.();
    }
    advance();
  };

  if (done) {
    return (
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          mt: 0.75,
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--muted) / 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Check size={14} style={{ color: 'hsl(var(--severity-info))' }} />
        <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
          {answeredCount > 0
            ? `${answeredCount} answer${answeredCount === 1 ? '' : 's'} submitted${ignoredCount ? `, ${ignoredCount} ignored` : ''}.`
            : 'Question ignored.'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{
        mt: 0.75,
        p: 2,
        borderRadius: 1.5,
        border: '1px solid hsl(var(--severity-info) / 0.45)',
        bgcolor: 'hsl(var(--severity-info) / 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {/* Header — who is asking, from where, and when */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <HelpCircle size={16} style={{ color: 'hsl(var(--severity-info))' }} />
        <Box
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 999,
            fontSize: '0.68rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'hsl(var(--severity-info))',
            bgcolor: 'hsl(var(--severity-info) / 0.12)',
          }}
        >
          Question
        </Box>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          The AI Agent needs your input to continue
        </Typography>
        {total > 1 && (
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--severity-info))', ml: 'auto' }}>
            {index + 1} of {total}
          </Typography>
        )}
      </Box>

      {/* Provenance line */}
      <Typography
        sx={{
          fontSize: '0.72rem',
          color: 'hsl(var(--muted-foreground))',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flexWrap: 'wrap',
        }}
      >
        <span>Asked by</span>
        <Box component="span" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          <InlineMarkdown text={origin} />
        </Box>
        {shortExec && (
          <Tooltip title={`Execution ${notification.execution_id}`} arrow>
            <Box
              component="span"
              sx={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.68rem',
                px: 0.75,
                py: 0.1,
                borderRadius: 0.75,
                border: '1px solid hsl(var(--border))',
                cursor: 'help',
              }}
            >
              {shortExec}
            </Box>
          </Tooltip>
        )}
        {relativeTime(notification.created_at) && <span>· {relativeTime(notification.created_at)}</span>}
      </Typography>

      {notification.description && (
        <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.55 }}>
          <InlineMarkdown text={notification.description} />
        </Typography>
      )}

      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.75, lineHeight: 1.5 }}>
          <InlineMarkdown text={current} />
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          autoFocus={total > 1 && index > 0}
          placeholder="Your answer here…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={submitting}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              bgcolor: 'hsl(var(--background))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
              '&:hover fieldset': { borderColor: 'hsl(var(--primary) / 0.5)' },
              '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
            },
            '& .MuiOutlinedInput-input': { color: 'hsl(var(--foreground))' },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          onClick={handleIgnore}
          disabled={submitting}
          size="small"
          variant="outlined"
          startIcon={<X size={13} />}
          sx={{
            fontSize: '0.78rem',
            textTransform: 'none',
            fontWeight: 600,
            height: 32,
            px: 2,
            color: 'hsl(var(--muted-foreground))',
            borderColor: 'hsl(var(--border))',
            '&:hover': { borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--muted) / 0.4)' },
          }}
        >
          Ignore
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!answer.trim() || submitting}
          size="small"
          variant="contained"
          startIcon={submitting ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <Send size={13} />}
          sx={{
            fontSize: '0.78rem',
            textTransform: 'none',
            fontWeight: 600,
            height: 32,
            px: 2,
            boxShadow: 'none',
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: 'none' },
            '&.Mui-disabled': { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
          }}
        >
          {submitting ? 'Submitting…' : index + 1 < total ? 'Submit & next' : 'Submit answer'}
        </Button>
      </Box>
    </Box>
  );
};

export default InlineAgentQuestion;
