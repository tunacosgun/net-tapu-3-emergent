import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

/**
 * NetTapu Typography Scale
 * 3 weights: 400 (regular), 500 (medium), 700 (bold)
 * Price = strongest visual emphasis
 */
export const Typography = {
  display: { fontSize: 32, fontWeight: '700', fontFamily, lineHeight: 38, letterSpacing: -0.5 } as TextStyle,
  h1: { fontSize: 26, fontWeight: '700', fontFamily, lineHeight: 32, letterSpacing: -0.4 } as TextStyle,
  h2: { fontSize: 20, fontWeight: '700', fontFamily, lineHeight: 26, letterSpacing: -0.3 } as TextStyle,
  h3: { fontSize: 17, fontWeight: '700', fontFamily, lineHeight: 22, letterSpacing: -0.2 } as TextStyle,
  h4: { fontSize: 15, fontWeight: '700', fontFamily, lineHeight: 20, letterSpacing: -0.1 } as TextStyle,
  body: { fontSize: 15, fontWeight: '400', fontFamily, lineHeight: 22 } as TextStyle,
  bodyMedium: { fontSize: 15, fontWeight: '500', fontFamily, lineHeight: 22 } as TextStyle,
  bodySmall: { fontSize: 13, fontWeight: '400', fontFamily, lineHeight: 18 } as TextStyle,
  caption: { fontSize: 12, fontWeight: '400', fontFamily, lineHeight: 16 } as TextStyle,
  captionMedium: { fontSize: 12, fontWeight: '500', fontFamily, lineHeight: 16 } as TextStyle,
  label: { fontSize: 14, fontWeight: '500', fontFamily, lineHeight: 20 } as TextStyle,
  overline: { fontSize: 11, fontWeight: '500', fontFamily, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' } as TextStyle,
  button: { fontSize: 16, fontWeight: '700', fontFamily, lineHeight: 20 } as TextStyle,
  tabLabel: { fontSize: 10, fontWeight: '500', fontFamily, lineHeight: 14 } as TextStyle,
  price: { fontSize: 22, fontWeight: '700', fontFamily, lineHeight: 28, letterSpacing: -0.4 } as TextStyle,
  priceLarge: { fontSize: 30, fontWeight: '700', fontFamily, lineHeight: 36, letterSpacing: -0.5 } as TextStyle,
  priceSmall: { fontSize: 17, fontWeight: '700', fontFamily, lineHeight: 22, letterSpacing: -0.3 } as TextStyle,
};
