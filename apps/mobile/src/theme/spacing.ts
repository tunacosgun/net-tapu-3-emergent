/**
 * NetTapu Spacing & Layout Tokens
 *
 * 8pt grid system. More whitespace = more premium.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,

  // Semantic spacing
  screenPadding: 20,
  sectionGap: 32,
  cardPadding: 18,
  cardGap: 14,
};

/**
 * Standardized border-radius:
 *   badge: 12
 *   small boxes: 16
 *   cards: 20
 *   large cards: 24
 *   buttons: 14 or pill
 */
export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
};

/**
 * Shadow presets — soft, not heavy
 */
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
};
