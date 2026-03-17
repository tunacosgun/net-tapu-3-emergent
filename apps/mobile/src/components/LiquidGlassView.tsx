import { requireNativeComponent, Platform, View, ViewStyle } from 'react-native';

interface LiquidGlassProps {
  style?: ViewStyle;
  cornerRadius?: number;
  activeIndex?: number;
  tabCount?: number;
  children?: React.ReactNode;
}

// Native iOS component
const NativeLiquidGlass =
  Platform.OS === 'ios'
    ? requireNativeComponent<LiquidGlassProps>('LiquidGlassView')
    : null;

/**
 * iOS Liquid Glass View — native UIVisualEffectView with systemThinMaterial
 * Falls back to a simple semi-transparent view on Android
 */
export function LiquidGlassView({
  style,
  cornerRadius = 34,
  activeIndex = 0,
  tabCount = 4,
  children,
}: LiquidGlassProps) {
  if (NativeLiquidGlass) {
    return (
      <NativeLiquidGlass
        style={style}
        cornerRadius={cornerRadius}
        activeIndex={activeIndex}
        tabCount={tabCount}
      >
        {children}
      </NativeLiquidGlass>
    );
  }

  // Android fallback
  return (
    <View
      style={[
        style,
        {
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: cornerRadius,
          elevation: 12,
        },
      ]}
    >
      {children}
    </View>
  );
}
