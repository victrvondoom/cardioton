import React from 'react';

/**
 * CardioTwin Logo Component
 *
 * A reusable component for the CardioTwin logo with multiple variants.
 *
 * Props:
 *   - variant: 'full' | 'icon' | 'symbol' (default: 'full')
 *   - size: 'small' | 'medium' | 'large' | number (default: 'medium')
 *   - showTagline: boolean (default: true for 'full', false for others)
 *   - className: string (additional CSS classes)
 */

interface CardioTwinLogoProps {
  variant?: 'full' | 'icon' | 'symbol';
  size?: 'small' | 'medium' | 'large' | number;
  showTagline?: boolean;
  className?: string;
}

const CardioTwinLogo: React.FC<CardioTwinLogoProps> = ({
  variant = 'full',
  size = 'medium',
  showTagline = true,
  className = '',
}) => {
  // Determine dimensions based on variant and size
  const getDimensions = () => {
    if (variant === 'icon') {
      return { width: 64, height: 64 };
    }

    const sizeMap = {
      small: { width: 200, height: 150 },
      medium: { width: 300, height: 225 },
      large: { width: 400, height: 300 },
    };

    if (typeof size === 'number') {
      const ratio = variant === 'symbol' ? 1 : 1.33;
      return { width: size, height: size / ratio };
    }

    return sizeMap[size as keyof typeof sizeMap] || sizeMap.medium;
  };

  const { width, height } = getDimensions();

  // Show tagline only for full variant by default
  const displayTagline = variant === 'full' && showTagline;

  return (
    <div className={`cardiotwin-logo ${className}`}>
      {variant === 'full' && (
        <svg
          width={width}
          height={height}
          viewBox="0 0 400 300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          stroke="none"
        >
          {/* Left Heart (Patient Heart) */}
          <path
            d="M100 150 C100 100, 150 50, 200 100 C250 50, 300 100, 300 150 C300 200, 250 250, 200 250 C150 250, 100 200, 100 150 Z"
            fill="#ff4757"
            stroke="#ff6b81"
            strokeWidth="2"
          />

          {/* Right Heart (Digital Twin Heart) */}
          <path
            d="M300 150 C300 100, 350 50, 400 100 C450 50, 500 100, 500 150 C500 200, 450 250, 400 250 C350 250, 300 200, 300 150 Z"
            fill="#ff6b81"
            stroke="#ff8fa3"
            strokeWidth="2"
            opacity={0.9}
          />

          {/* Connecting Evidence Path (Temporal Continuity) */}
          <path
            d="M200 150 Q250 120, 300 150"
            stroke="#ffa502"
            strokeWidth="4"
            fill="none"
            strokeDasharray="5,5"
          />

          {/* Evidence Nodes (Multi-agent orchestration points) */}
          <circle cx="170" cy="130" r="8" fill="#ffa502" />
          <circle cx="230" cy="140" r="8" fill="#ffa502" />
          <circle cx="270" cy="130" r="8" fill="#ffa502" />

          {/* Central Evidence Hub */}
          <circle cx="250" cy="150" r="12" fill="#ffa502" opacity={0.8} />

          {/* CardioTwin Text */}
          <text
            x="250"
            y="280"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            fontSize="28"
            fontWeight="600"
            fill="#ff4757"
            textAnchor="middle"
          >
            CARDIOTWIN
          </text>

          {/* Tagline */}
          {displayTagline && (
            <text
              x="250"
              y="310"
              fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              fontSize="12"
              fill="#ffa502"
              textAnchor="middle"
              letterSpacing="1"
            >
              Cardiovascular Intelligence Workspace
            </text>
          )}
        </svg>
      )}

      {variant === 'icon' && (
        <svg
          width={width}
          height={height}
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* Left Heart */}
          <path
            d="M16 32 C16 24, 24 16, 32 24 C40 16, 48 24, 48 32 C48 40, 40 48, 32 48 C24 48, 16 40, 16 32 Z"
            fill="#ff4757"
          />

          {/* Right Heart (offset) */}
          <path
            d="M24 32 C24 24, 32 16, 40 24 C48 16, 56 24, 56 32 C56 40, 48 48, 40 48 C32 48, 24 40, 24 32 Z"
            fill="#ff6b81"
            opacity={0.9}
          />

          {/* Connecting Path */}
          <path
            d="M32 32 Q36 28, 40 32"
            stroke="#ffa502"
            strokeWidth="2"
            fill="none"
          />

          {/* Center Dot (Evidence Hub) */}
          <circle cx="32" cy="32" r="3" fill="#ffa502"/>
        </svg>
      )}

      {variant === 'symbol' && (
        <svg
          width={width}
          height={height}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* Simplified dual heart symbol */}
          <path
            d="M20 50 C20 30, 40 10, 50 30 C60 10, 80 30, 80 50 C80 70, 60 90, 50 90 C40 90, 20 70, 20 50 Z"
            fill="#ff4757"
          />
          <path
            d="M30 50 C30 30, 50 10, 70 30 C90 10, 110 30, 110 50 C110 70, 90 90, 70 90 C50 90, 30 70, 30 50 Z"
            fill="#ff6b81"
            opacity={0.8}
          />
          {/* Connection line */}
          <line x1="50" y1="50" x2="70" y2="50" stroke="#ffa502" strokeWidth="3"/>
          {/* Center dot */}
          <circle cx="60" cy="50" r="4" fill="#ffa502"/>
        </svg>
      )}
    </div>
  );
};

export default CardioTwinLogo;
