/**
 * InlineAgentQuestion — renders a workflow's stuck "Question" handoff inline
 * inside the incident Timeline, so the user can answer without opening the
 * global handoff dialog. Uses the same visual language as
 * `AgentQuestionDialog` (HelpCircle icon, "Question" chip, textarea, Submit)
 * so it feels like part of the same family.
 *
 * Wiring: submits with the same `continueAgentExecution({ note: {question_N} })`
 * + `approveAgentAction` pair the global dialog uses, then calls `onSubmitted`
 * so the caller can refresh notifications / timeline.
 */
import { useState } from 'react';
import { Box, Typography, Button, TextField, CircularProgress } from '@mui/material';
import { HelpCircle, Send } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  approveAgentAction,
  continueAgentExecution,
  stripAgentTitlePrefix,
  type AgentNotification,
} from '@/services/notifications';

interface Props {
  notification: AgentNotification;
  onSubmitted?: () => void;
}

const InlineAgentQuestion = ({ notification, onSubmitted }: Props) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const rawQuestions = notification.questions && notification.questions.length > 0
    ? notification.questions
    : [stripAgentTitlePrefix(notification.title) || notification.description || 'Provide an answer to continue'];

  const allAnswered = rawQuestions.every((_, i) => answers[i]?.trim());

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    try {
      const noteMap: Record<string, string> = {};
      Object.entries(answers).forEach(([idx, value]) => {
        noteMap[`question_${idx}`] = value;
      });
      await continueAgentExecution({ notification, approve: true, note: noteMap });
      await approveAgentAction(notification.id).catch(() => { /* non-fatal */ });
      toast.success('Answer submitted — the workflow will continue.');
      setAnswers({});
      onSubmitted?.();
    } catch (err) {
      console.error('[InlineAgentQuestion] submit failed:', err);
      toast.error('Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        mt: 0.75,
        p: 2,
        borderRadius: 1.5,
        border: '1px solid hsl(var(--severity-info) / 0.45)',
        bgcolor: 'hsl(var(--severity-info) / 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          Input needed to continue
        </Typography>
      </Box>

      {notification.description && (
        <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
          {notification.description}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {rawQuestions.map((q, i) => (
          <Box key={i} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontSize: '0.83rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.5 }}>
              {rawQuestions.length > 1 ? `${i + 1}. ` : ''}{q}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              placeholder="Your answer here…"
              value={answers[i] || ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
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
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
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
          {submitting ? 'Submitting…' : 'Submit answer'}
        </Button>
      </Box>
    </Box>
  );
};

export default InlineAgentQuestion;
