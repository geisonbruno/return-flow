/**
 * The approved ReturnFlow dark palette for the redesigned driver screens.
 *
 * <p>Extracted when My Returns became the second redesigned surface: Login had
 * already declared these exact values screen-locally, and copying them again
 * for the list, bottom navigation and Profile would have made four copies of
 * one palette. The values here are byte-identical to the ones Login shipped
 * with, so its rendered appearance is unchanged by adopting them.
 *
 * <p>Deliberately a small token module, not a design system: colours, a
 * spacing scale and a radius scale. No component library, no theme provider,
 * no variants — screens still own their own `StyleSheet`.
 */
export const colors = {
  /** Page background. */
  page: '#080E13',
  /** Card and panel background. */
  surface: '#0D141A',
  /** Raised surface: inputs, nav bar, badges. */
  surfaceRaised: '#111A22',
  border: '#29343E',
  borderSoft: '#1C2730',
  text: '#F3F5F7',
  muted: '#A4AEB8',
  green: '#47CE65',
  greenDark: '#173D25',
  /** Purely decorative ambient corner fill/edge (Login). */
  ambient: 'rgba(71, 206, 101, 0.06)',
  ambientEdge: 'rgba(71, 206, 101, 0.10)',
  /** Error text/surface/border. */
  danger: '#FF9B9B',
  dangerSurface: '#2A1517',
  dangerBorder: '#6C3434',
  /** Session-notice text/surface/border. */
  warning: '#F1BF31',
  warningSurface: '#2B230D',
  warningBorder: '#8B670B',
  /** Informational (in review) text/surface. */
  info: '#70B9FF',
  infoSurface: '#10243A',
  /** Success (closed) text/surface. */
  success: '#65D67C',
  successSurface: '#112B18',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
} as const;

/** Minimum comfortable touch target, used by taps that are not full-width rows. */
export const TOUCH_TARGET = 44;
