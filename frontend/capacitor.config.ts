import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.workoutleveling.app',
  appName: 'Workout Leveling',
  webDir: 'public',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#03060d',
      launchShowDuration: 1200,
      launchAutoHide: true,
    },
  },
};

export default config;
