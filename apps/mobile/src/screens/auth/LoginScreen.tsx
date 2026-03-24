import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Animated,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import LinearGradient from 'react-native-linear-gradient';
import { loginSchema } from '../../lib/validators';
import { useAuthStore } from '../../stores/auth-store';
import apiClient, { RateLimitError } from '../../api/client';
import { Input } from '../../components/ui';
import { useTheme } from '../../theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { LoginResponse } from '../../types';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Google Sign-In — lazy load
let GoogleSignin: any = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });
} catch {}

const { width: SCREEN_W } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FormData = { email: string; password: string };

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const setTokens = useAuthStore((s) => s.setTokens);
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    try {
      const { data: res } = await apiClient.post<LoginResponse>('/auth/login', data);
      await setTokens(res.accessToken, res.refreshToken);
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        Alert.alert('Çok fazla deneme', `Lütfen ${err.retryAfter} saniye bekleyin.`);
      } else {
        const msg = err?.response?.data?.message || 'Giriş başarısız';
        Alert.alert('Hata', Array.isArray(msg) ? msg[0] : msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!GoogleSignin) {
      Alert.alert('Google ile Giriş', 'Google OAuth entegrasyonu yakında aktif olacak.');
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('Google ID token alınamadı');
      const { data: res } = await apiClient.post<LoginResponse>('/auth/google/one-tap', {
        credential: idToken,
        deviceInfo: Platform.OS,
      });
      await setTokens(res.accessToken, res.refreshToken);
    } catch (err: any) {
      if (err?.code === 'SIGN_IN_CANCELLED') return;
      const msg = err?.response?.data?.message || err?.message || 'Google ile giriş başarısız';
      Alert.alert('Hata', msg);
    } finally {
      setGoogleLoading(false);
    }
  }

  const isDark = theme.isDark;
  const c = theme.colors;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0a0f1a' : '#f8faf9' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <LinearGradient
                colors={isDark ? ['#16a34a', '#059669'] : ['#16a34a', '#15803d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="business-outline" size={26} color="#fff" />
              </LinearGradient>
              <Text style={[styles.brandName, { color: c.text }]}>
                Net<Text style={{ color: c.primary }}>Tapu</Text>
              </Text>
              <Text style={[styles.tagline, { color: c.textMuted }]}>
                Arsa & Açık Artırma Platformu
              </Text>
            </View>

            {/* Welcome Text */}
            <View style={styles.welcomeSection}>
              <Text style={[styles.welcomeTitle, { color: c.text }]}>
                Tekrar hoş geldiniz
              </Text>
              <Text style={[styles.welcomeDesc, { color: c.textSecondary }]}>
                Hesabınıza giriş yaparak devam edin
              </Text>
            </View>

            {/* Form Container */}
            <View style={[styles.formContainer, {
              backgroundColor: isDark ? c.card : '#ffffff',
              borderColor: isDark ? c.border : '#e8ebe9',
            }]}>
              {/* Google Button */}
              <TouchableOpacity
                style={[styles.googleBtn, {
                  backgroundColor: isDark ? c.surface : '#ffffff',
                  borderColor: isDark ? c.border : '#e2e5e3',
                }]}
                onPress={handleGoogleLogin}
                activeOpacity={0.7}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={c.textSecondary} />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <Ionicons name="logo-google" size={18} color="#4285F4" />
                    </View>
                    <Text style={[styles.googleLabel, { color: c.text }]}>Google ile devam et</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.separator}>
                <View style={[styles.separatorLine, { backgroundColor: isDark ? c.border : '#edf0ee' }]} />
                <View style={[styles.separatorPill, { backgroundColor: isDark ? c.card : '#ffffff' }]}>
                  <Text style={[styles.separatorText, { color: c.textMuted }]}>veya</Text>
                </View>
                <View style={[styles.separatorLine, { backgroundColor: isDark ? c.border : '#edf0ee' }]} />
              </View>

              {/* Email Field */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="E-posta Adresi"
                    placeholder="ornek@email.com"
                    leftIcon="mail-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />

              {/* Password Field */}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Şifre"
                    placeholder="Şifrenizi girin"
                    leftIcon="lock-closed-outline"
                    isPassword
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                  />
                )}
              />

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.forgotText, { color: c.primary }]}>Şifremi unuttum</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  onPress={handleSubmit(onSubmit)}
                  activeOpacity={0.85}
                  disabled={loading}
                  style={{ borderRadius: 14, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={loading ? ['#86efac', '#86efac'] : ['#16a34a', '#15803d']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.loginBtnText}>Giriş Yap</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: c.textMuted }]}>
                Henüz hesabınız yok mu?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.footerLink, { color: c.primary }]}> Üye Ol</Text>
              </TouchableOpacity>
            </View>

            {/* Trust Badges */}
            <View style={styles.trustRow}>
              {[
                { icon: 'shield-checkmark-outline', label: 'SSL Güvenli' },
                { icon: 'lock-closed-outline', label: 'KVKK Uyumlu' },
                { icon: 'card-outline', label: '3D Secure' },
              ].map((item) => (
                <View key={item.label} style={styles.trustBadge}>
                  <Ionicons name={item.icon} size={14} color={c.textMuted} />
                  <Text style={[styles.trustLabel, { color: c.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Welcome
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  welcomeDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  // Form
  formContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },

  // Google
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  googleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorPill: {
    paddingHorizontal: 14,
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'lowercase',
  },

  // Forgot
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 18,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Login Button
  loginBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Trust
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 32,
    paddingBottom: 20,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
