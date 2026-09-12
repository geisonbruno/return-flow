import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'brand' | 'mail' | 'lock' | 'eye' | 'eye-off' | 'returns' | 'plus' | 'plus-circle' | 'user' | 'chevron-right';

/**
 * The mobile app's own line-icon set, drawn with the `react-native-svg` that
 * ships with the project — no new dependency and no image asset.
 *
 * <p>The geometry deliberately matches the Web app's icon of the same name so
 * ReturnFlow reads as one product, but the implementation is native and
 * self-contained: `apps/mobile/CLAUDE.md` rules out sharing UI code with web.
 */
export function Icon({ name, size = 24, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  const stroke = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const glyphs: Record<IconName, React.ReactNode> = {
    brand: (
      <>
        <Path d="M4.5 10a7.8 7.8 0 0 1 13.2-4.2L20 8" {...stroke} />
        <Path d="M20 3v5h-5" {...stroke} />
        <Path d="M19.5 14a7.8 7.8 0 0 1-13.2 4.2L4 16" {...stroke} />
        <Path d="M4 21v-5h5" {...stroke} />
        <Path d="m9 12 2 2 4-5" {...stroke} />
      </>
    ),
    mail: (
      <>
        <Rect x={2.5} y={5} width={19} height={14} rx={2} {...stroke} />
        <Path d="m3 6.5 9 6 9-6" {...stroke} />
      </>
    ),
    lock: (
      <>
        <Rect x={4} y={10.5} width={16} height={10} rx={2} {...stroke} />
        <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...stroke} />
      </>
    ),
    eye: (
      <>
        <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...stroke} />
        <Circle cx={12} cy={12} r={3} {...stroke} />
      </>
    ),
    returns: (
      <>
        <Path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" {...stroke} />
        <Path d="m4 7.5 8 4.5 8-4.5M12 12v9" {...stroke} />
        <Path d="m8 5.2 8 4.5" {...stroke} />
      </>
    ),
    plus: <Path d="M12 5v14M5 12h14" {...stroke} />,
    'plus-circle': (
      <>
        <Circle cx={12} cy={12} r={9} {...stroke} />
        <Path d="M12 8.5v7M8.5 12h7" {...stroke} />
      </>
    ),
    user: (
      <>
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...stroke} />
        <Circle cx={12} cy={7} r={4} {...stroke} />
      </>
    ),
    'chevron-right': <Path d="m9 6 6 6-6 6" {...stroke} />,
    'eye-off': (
      <>
        <Path
          d="M9.9 5.8A8.7 8.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1M6.5 7.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5a8.9 8.9 0 0 0 3.4-.65"
          {...stroke}
        />
        <Path d="M10 10a3 3 0 0 0 4 4" {...stroke} />
        <Path d="m3.5 3.5 17 17" {...stroke} />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyphs[name]}
    </Svg>
  );
}
