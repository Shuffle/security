import React from 'react';
import shuffleCompanyLogoImg from '@/assets/shuffle-logo.png';

export interface ShuffleLogoProps {
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Official Shuffle Security vector logo ("S" badge).
 * Used across the Shuffle Security website, landing pages, headers, and footer.
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

export interface ShuffleCompanyLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * Official Shuffle Automation / Company brand logo.
 * Used for company branding, mobile app packaging, and mobile app login gateway.
 */
export const ShuffleCompanyLogo: React.FC<ShuffleCompanyLogoProps> = ({
  size = 48,
  className,
  style,
  alt = 'Shuffle',
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 48;

  return (
    <img
      src={shuffleCompanyLogoImg}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, Math.round(numericSize * 0.2)),
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
};

export const ShuffleAutomationLogo = ShuffleCompanyLogo;

export default ShuffleLogo;

