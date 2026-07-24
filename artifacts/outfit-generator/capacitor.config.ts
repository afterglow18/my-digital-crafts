import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalcrafts.app',
  appName: 'My Crafts',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#F9F4EE',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // iOS privacy usage descriptions — all three are required for camera/photo access.
    // Missing any one causes a hard SIGABRT crash (TCC) or silent refusal.
    infoPlist: {
      NSCameraUsageDescription:
        'My Digital Crafts uses your camera so you can photograph clothing items and add them to your wardrobe.',
      NSPhotoLibraryUsageDescription:
        'My Digital Crafts reads your photo library so you can select clothing photos to add to your wardrobe.',
      NSPhotoLibraryAddUsageDescription:
        'My Digital Crafts saves photos you take with the camera to your photo library.',
      // Universal (iPhone + iPad) support. Without family 2, the app only runs
      // on iPhone and cannot be submitted for iPad or shown as "Designed for iPad".
      UIDeviceFamily: [1, 2],
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F9F4EE',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F9F4EE',
      overlaysWebView: true,
    },
  },
};

export default config;
