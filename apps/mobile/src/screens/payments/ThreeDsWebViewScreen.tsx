import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useTheme } from '../../theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';

export default function ThreeDsWebViewScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ThreeDsWebView'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);

  const { url, paymentId, auctionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Detect callback/result URLs
  const handleNavigationChange = (navState: WebViewNavigation) => {
    const currentUrl = navState.url.toLowerCase();

    // Check if the bank redirected to our success/fail URL
    if (
      currentUrl.includes('/payment/result') ||
      currentUrl.includes('/payment/callback') ||
      currentUrl.includes('payment-result') ||
      currentUrl.includes('mdstatus=1') || // 3DS success
      currentUrl.includes('status=success')
    ) {
      // Navigate to payment result screen
      navigation.navigate('PaymentResult' as any, {
        paymentId,
        auctionId,
        status: 'pending', // Will poll for actual status
      });
    } else if (
      currentUrl.includes('status=fail') ||
      currentUrl.includes('mdstatus=0') ||
      currentUrl.includes('payment-failed')
    ) {
      navigation.navigate('PaymentResult' as any, {
        paymentId,
        auctionId,
        status: 'failed',
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Ödemeyi İptal Et',
              '3D Secure doğrulamasını iptal etmek istediğinize emin misiniz?',
              [
                { text: 'Devam Et', style: 'cancel' },
                { text: 'İptal Et', style: 'destructive', onPress: () => navigation.goBack() },
              ]
            );
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backIcon, { color: theme.colors.text }]}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>3D Secure Doğrulama</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Bankanızın güvenli ödeme sayfası
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Security indicator */}
      <View style={styles.securityBar}>
        <Text style={styles.securityIcon}>🔒</Text>
        <Text style={styles.securityUrl} numberOfLines={1}>
          {url.replace(/^https?:\/\//, '').split('/')[0]}
        </Text>
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Banka sayfası yükleniyor...
          </Text>
        </View>
      )}

      {/* Error state */}
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Sayfa Yüklenemedi</Text>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            Banka sayfasına ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setError(false);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 400) setError(true);
          }}
          onNavigationStateChange={handleNavigationChange}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          startInLoadingState={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },

  securityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#bbf7d0',
  },
  securityIcon: { fontSize: 12 },
  securityUrl: { fontSize: 12, color: '#15803d', fontWeight: '500', flex: 1 },

  webview: { flex: 1 },

  loadingOverlay: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: { marginTop: 12, fontSize: 14 },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  retryBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
