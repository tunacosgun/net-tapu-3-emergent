import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const sizeStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
    sm: { container: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }, text: { fontSize: 13 } },
    md: { container: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }, text: { fontSize: 15 } },
    lg: { container: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: 14 }, text: { fontSize: 17 } },
  };

  const variantStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: theme.colors.primary },
      text: { color: '#ffffff' },
    },
    secondary: {
      container: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
      text: { color: theme.colors.text },
    },
    outline: {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.colors.primary },
      text: { color: theme.colors.primary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: theme.colors.primary },
    },
    danger: {
      container: { backgroundColor: theme.colors.error },
      text: { color: '#ffffff' },
    },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        ss.container,
        vs.container,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text.color as string} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, ss.text, vs.text, { fontWeight: '600' }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
