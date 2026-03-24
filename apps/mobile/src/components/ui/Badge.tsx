import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e', label: 'Satışta' },
  sold: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444', label: 'Satıldı' },
  deposit_taken: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Kaparo Alındı' },
  reserved: { bg: '#faf5ff', text: '#6b21a8', dot: '#a855f7', label: 'Ayırtıldı' },
  draft: { bg: '#f8fafc', text: '#64748b', dot: '#94a3b8', label: 'Taslak' },
  withdrawn: { bg: '#f8fafc', text: '#94a3b8', dot: '#cbd5e1', label: 'Geri Çekildi' },
  live: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', label: 'Canlı' },
  scheduled: { bg: '#f0f9ff', text: '#0369a1', dot: '#38bdf8', label: 'Planlandı' },
  deposit_open: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Kaparo Açık' },
  ended: { bg: '#f8fafc', text: '#64748b', dot: '#94a3b8', label: 'Bitti' },
  settled: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e', label: 'Tamamlandı' },
  ending: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', label: 'Bitiyor' },
};

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: BadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.small]}>
      <View style={[styles.dot, { backgroundColor: config.dot }, isSmall && styles.dotSmall]} />
      <Text style={[styles.text, { color: config.text }, isSmall && styles.smallText]}>
        {config.label}
      </Text>
    </View>
  );
}

export function parcelStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#166534';
    case 'sold': return '#991b1b';
    case 'deposit_taken': return '#92400e';
    case 'reserved': return '#6b21a8';
    default: return '#64748b';
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 5,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 10,
  },
});
