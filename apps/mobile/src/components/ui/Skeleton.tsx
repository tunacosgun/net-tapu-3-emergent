import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const { colors: c } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: c.skeleton, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonParcelCard() {
  return (
    <View style={skeletonStyles.card}>
      <Skeleton width="100%" height={200} borderRadius={0} />
      <View style={skeletonStyles.content}>
        <Skeleton width="70%" height={18} borderRadius={6} />
        <Skeleton width="50%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
        <Skeleton width="40%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
        <Skeleton width="35%" height={22} borderRadius={6} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

export function SkeletonAuctionCard() {
  return (
    <View style={skeletonStyles.auctionCard}>
      <Skeleton width={100} height={100} borderRadius={0} />
      <View style={skeletonStyles.auctionInfo}>
        <Skeleton width="80%" height={16} borderRadius={6} />
        <Skeleton width="50%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
        <Skeleton width="60%" height={20} borderRadius={6} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  content: {
    padding: 18,
  },
  auctionCard: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  auctionInfo: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
});
