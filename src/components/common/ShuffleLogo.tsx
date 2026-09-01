import React from 'react';

export interface ShuffleLogoProps {
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Official Shuffle Security vector logo.
 */
export const ShuffleLogo: React.FC<ShuffleLogoProps> = ({
  size = 32,
  color = '#FF6600',
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    className={className}
    style={{
      display: 'inline-block',
      flexShrink: 0,
      verticalAlign: 'middle',
      ...style,
    }}
  >
    <path
      d="M14 14h28v6H20v16h16v-10h-8v-6h14v22H14V14z"
      fill={color}
    />
  </svg>
);

export const ShuffleSecurityLogo = ShuffleLogo;

export default ShuffleLogo;
