/**
 * apps/mobile/components/PreviewIcon.tsx
 *
 * Vector-Identical SVG Icon Component:
 *  - Matches preview/preview-liquid-glass.html ICONS dictionary exactly
 *  - Uses react-native-svg with 24x24 viewBox, strokeWidth 2, round linecaps and joins
 *  - Guarantees 100% vector shape, dimension, and stroke weight parity across Preview, iOS, and Android
 */

import React from 'react';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Polyline,
  Polygon,
} from 'react-native-svg';

export type PreviewIconName =
  | 'chats'
  | 'updates'
  | 'calls'
  | 'communities'
  | 'search'
  | 'plus'
  | 'back'
  | 'close'
  | 'video'
  | 'camera'
  | 'send'
  | 'lock'
  | 'shield'
  | 'device'
  | 'link'
  | 'calendar'
  | 'palette'
  | 'bell'
  | 'globe'
  | 'trash'
  | 'user'
  | 'cloud'
  | 'key'
  | 'check'
  | 'storage'
  | 'help';

interface PreviewIconProps {
  name: PreviewIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function PreviewIcon({
  name,
  size = 20,
  color = '#8696a0',
  strokeWidth = 2,
}: PreviewIconProps) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const renderContent = () => {
    switch (name) {
      case 'chats':
        return (
          <Path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            {...common}
          />
        );
      case 'updates':
        return (
          <>
            <Circle cx="12" cy="12" r="10" {...common} />
            <Circle cx="12" cy="12" r="4" {...common} />
          </>
        );
      case 'calls':
        return (
          <Path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
            {...common}
          />
        );
      case 'communities':
        return (
          <>
            <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...common} />
            <Circle cx="9" cy="7" r="4" {...common} />
            <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...common} />
            <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...common} />
          </>
        );
      case 'search':
        return (
          <>
            <Circle cx="11" cy="11" r="8" {...common} />
            <Line x1="21" y1="21" x2="16.65" y2="16.65" {...common} />
          </>
        );
      case 'plus':
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" {...common} />
            <Line x1="5" y1="12" x2="19" y2="12" {...common} />
          </>
        );
      case 'back':
        return (
          <>
            <Line x1="19" y1="12" x2="5" y2="12" {...common} />
            <Polyline points="12 19 5 12 12 5" {...common} />
          </>
        );
      case 'close':
        return (
          <>
            <Line x1="18" y1="6" x2="6" y2="18" {...common} />
            <Line x1="6" y1="6" x2="18" y2="18" {...common} />
          </>
        );
      case 'video':
        return (
          <>
            <Polygon points="23 7 16 12 23 17 23 7" {...common} />
            <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" {...common} />
          </>
        );
      case 'camera':
        return (
          <>
            <Path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
              {...common}
            />
            <Circle cx="12" cy="13" r="4" {...common} />
          </>
        );
      case 'send':
        return (
          <>
            <Line x1="22" y1="2" x2="11" y2="13" {...common} />
            <Polygon points="22 2 15 22 11 13 2 9 22 2" {...common} />
          </>
        );
      case 'lock':
        return (
          <>
            <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" {...common} />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" {...common} />
          </>
        );
      case 'shield':
        return (
          <Path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            {...common}
          />
        );
      case 'device':
        return (
          <>
            <Rect x="4" y="2" width="16" height="20" rx="2" ry="2" {...common} />
            <Line x1="12" y1="18" x2="12.01" y2="18" {...common} />
          </>
        );
      case 'link':
        return (
          <>
            <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {...common} />
            <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...common} />
          </>
        );
      case 'calendar':
        return (
          <>
            <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" {...common} />
            <Line x1="16" y1="2" x2="16" y2="6" {...common} />
            <Line x1="8" y1="2" x2="8" y2="6" {...common} />
            <Line x1="3" y1="10" x2="21" y2="10" {...common} />
          </>
        );
      case 'palette':
        return (
          <>
            <Circle cx="13.5" cy="6.5" r=".5" fill={color} />
            <Circle cx="17.5" cy="10.5" r=".5" fill={color} />
            <Circle cx="8.5" cy="7.5" r=".5" fill={color} />
            <Circle cx="6.5" cy="12.5" r=".5" fill={color} />
            <Path
              d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
              {...common}
            />
          </>
        );
      case 'bell':
        return (
          <>
            <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...common} />
            <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...common} />
          </>
        );
      case 'globe':
        return (
          <>
            <Circle cx="12" cy="12" r="10" {...common} />
            <Line x1="2" y1="12" x2="22" y2="12" {...common} />
            <Path
              d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
              {...common}
            />
          </>
        );
      case 'trash':
        return (
          <>
            <Polyline points="3 6 5 6 21 6" {...common} />
            <Path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              {...common}
            />
          </>
        );
      case 'user':
        return (
          <>
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common} />
            <Circle cx="12" cy="7" r="4" {...common} />
          </>
        );
      case 'cloud':
        return (
          <Path
            d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
            {...common}
          />
        );
      case 'key':
        return (
          <Path
            d="M21 2l-2 2m-1.5 1.5L14 9l-2-2-4 4m6-6l2 2m-6 6l-6 6v3h3l6-6"
            {...common}
          />
        );
      case 'check':
        return <Polyline points="20 6 9 17 4 12" {...common} />;
      case 'storage':
        return (
          <>
            <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" {...common} />
            <Path d="M22 12A10 10 0 0 0 12 2v10z" {...common} />
          </>
        );
      case 'help':
        return (
          <>
            <Circle cx="12" cy="12" r="10" {...common} />
            <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...common} />
            <Line x1="12" y1="17" x2="12.01" y2="17" {...common} />
          </>
        );
      default:
        return <Circle cx="12" cy="12" r="10" {...common} />;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderContent()}
    </Svg>
  );
}
