import React from 'react';
import shuffleLogo from '@/assets/shuffle-logo.png';

interface ShuffleLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * Standardized Shuffle logo component used across all web, desktop, and mobile views.
 */
export const ShuffleLogo: React.FC<ShuffleLogoProps> = ({
  size = 32,
  className,
  style,
  alt = 'Shuffle',
}) => (
  <img
    src={shuffleLogo}
    alt={alt}
    width={size}
    height={size}
    className={className}
    style={{
      width: size,
      height: size,
      borderRadius: Math.max(4, Math.round(size * 0.18)),
      display: 'inline-block',
      objectFit: 'contain',
      flexShrink: 0,
      verticalAlign: 'middle',
      ...style,
    }}
  />
);

export default ShuffleLogo;
