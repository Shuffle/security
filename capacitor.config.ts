import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || "com.shuffle.security",
  appName: "Shuffle Security",
  webDir: ".output/public",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    url: process.env.CAPACITOR_SERVER_URL || "https://shuffle.security",
    cleartext: Boolean(process.env.CAPACITOR_SERVER_URL),
    allowNavigation: [
      "shuffle.security",
      "*.shuffle.security",
      "shuffler.io",
      "*.shuffler.io",
      "localhost",
      "10.0.2.2",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1a1a1a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1a1a",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  android: {
    buildOptions: {
      keystorePath: process.env.ANDROID_KEYSTORE_PATH,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keystoreAlias: process.env.ANDROID_KEY_ALIAS,
      keystoreAliasPassword: process.env.ANDROID_KEY_PASSWORD,
      releaseType: "AAB",
    },
  },
};

export default config;
