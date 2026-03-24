import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function SplashScreen() {
  return (
    <LinearGradient
      colors={['#15803d', '#16a34a', '#22c55e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.logoBox}>
        <Ionicons name="business" size={36} color="#fff" />
      </View>
      <Text style={styles.logo}>NetTapu</Text>
      <Text style={styles.subtitle}>Gayrimenkul & Canlı İhale</Text>
      <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" style={{ marginTop: 40 }} />
      {/* Decorative circles */}
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 6, letterSpacing: 0.3 },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circle1: { width: 250, height: 250, top: -60, right: -80 },
  circle2: { width: 180, height: 180, bottom: -40, left: -50 },
});
