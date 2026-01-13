import { Typography, TypographyProps } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

interface MentionTextProps extends Omit<TypographyProps, 'children'> {
  text: string;
}

/**
 * Renders text with @username mentions highlighted.
 * Mentions of the current user are highlighted more prominently.
 */
export const MentionText = ({ text, sx, ...props }: MentionTextProps) => {
  const { userInfo } = useAuth();
  const currentUsername = userInfo?.username || '';
  
  // Split text by @mentions pattern
  const mentionRegex = /@(\w+)/g;
  const parts: { type: 'text' | 'mention'; content: string; isCurrentUser: boolean }[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
        isCurrentUser: false,
      });
    }
    
    // Add the mention
    const username = match[1];
    parts.push({
      type: 'mention',
      content: `@${username}`,
      isCurrentUser: username.toLowerCase() === currentUsername.toLowerCase(),
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
      isCurrentUser: false,
    });
  }
  
  // If no mentions found, just return plain text
  if (parts.length === 0) {
    return <Typography sx={sx} {...props}>{text}</Typography>;
  }
  
  return (
    <Typography component="span" sx={sx} {...props}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>;
        }
        
        return (
          <span
            key={idx}
            style={{
              backgroundColor: part.isCurrentUser ? 'rgba(255, 102, 0, 0.25)' : 'rgba(34, 184, 207, 0.15)',
              color: part.isCurrentUser ? '#ff6600' : '#22b8cf',
              padding: '1px 4px',
              borderRadius: '4px',
              fontWeight: part.isCurrentUser ? 600 : 500,
              border: part.isCurrentUser ? '1px solid rgba(255, 102, 0, 0.4)' : 'none',
            }}
          >
            {part.content}
          </span>
        );
      })}
    </Typography>
  );
};

export default MentionText;
