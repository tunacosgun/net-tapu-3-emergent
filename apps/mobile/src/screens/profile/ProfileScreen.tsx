import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/auth-store';
import apiClient from '../../api/client';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { colors: c, isDark } = useTheme();
  const { user, isAuthenticated, clearTokens, avatarUrl } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      apiClient.get('/auth/me').then((res) => setProfile(res.data)).catch(() => {});
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => clearTokens() },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={styles.loginPrompt}>
          <View style={[styles.loginIconWrap, { backgroundColor: isDark ? c.surface : '#f0fdf4' }]}>
            <Ionicons name="person-outline" size={40} color={c.primary} />
          </View>
          <Text style={[styles.loginTitle, { color: c.text }]}>Hesabınıza giriş yapın</Text>
          <Text style={[styles.loginDesc, { color: c.textSecondary }]}>
            İlanları favorileyin, ihalelere katılın ve daha fazlası
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
            style={[styles.loginBtn, { backgroundColor: c.primary }]}
          >
            <Text style={styles.loginBtnText}>Giriş Yap</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : user?.name || 'Kullanıcı';
  const initial = (displayName || user?.email || '?')[0].toUpperCase();

  const menuItems = [
    { icon: 'heart-outline', label: 'Favorilerim', screen: 'Favorites' },
    { icon: 'document-text-outline', label: 'Tekliflerim', screen: 'Offers' },
    { icon: 'card-outline', label: 'Ödemelerim', screen: 'Payments' },
    { icon: 'notifications-outline', label: 'Bildirimler', screen: 'Notifications' },
    { icon: 'settings-outline', label: 'Ayarlar', screen: 'Settings' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Simple centered profile header */}
        <View style={styles.header}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: c.border }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, {
              backgroundColor: isDark ? c.surface : c.primaryBg,
              borderColor: c.border,
            }]}>
              <Text style={[styles.avatarInitial, { color: c.primary }]}>{initial}</Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: c.text }]}>{displayName}</Text>
          <Text style={[styles.profileEmail, { color: c.textMuted }]}>{user?.email}</Text>
        </View>

        {/* Single menu card */}
        <View style={[styles.menuCard, {
          backgroundColor: isDark ? c.card : '#fff',
          borderColor: isDark ? c.border : '#e2e8f0',
        }]}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.screen}
              style={[styles.menuItem, i < menuItems.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: isDark ? c.borderLight : '#f1f5f9',
              }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.6}
            >
              <Ionicons name={item.icon as any} size={20} color={c.textMuted} />
              <Text style={[styles.menuLabel, { color: c.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, {
            borderColor: isDark ? 'rgba(220,38,38,0.15)' : '#fecaca',
            backgroundColor: isDark ? 'rgba(220,38,38,0.05)' : '#fef2f2',
          }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color={c.error} />
          <Text style={[styles.logoutText, { color: c.error }]}>Çıkış Yap</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: c.textMuted }]}>NetTapu v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  loginIconWrap: {
    width: 90, height: 90, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  loginTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  loginDesc: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14, gap: 8, width: '100%', maxWidth: 260,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 26, borderWidth: 1, marginBottom: 14,
  },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '700' },
  profileName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  profileEmail: { fontSize: 14, fontWeight: '400' },

  menuCard: {
    marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 14,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 24, paddingVertical: 15,
    borderRadius: 14, borderWidth: 1, gap: 8,
  },
  logoutText: { fontWeight: '600', fontSize: 15 },

  version: { textAlign: 'center', fontSize: 12, marginTop: 20, fontWeight: '400' },
});
