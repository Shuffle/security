# Google Play Store Release Guide for Shuffle Security

This guide covers everything needed to build, sign, and publish the **Shuffle Security** Android app to the **Google Play Store** using **Capacitor**.

---

## 1. App Configuration Overview

| Property | Value |
| :--- | :--- |
| **App Name** | `Shuffle Security` |
| **Package ID / Application ID** | `io.shuffle.security` |
| **Minimum SDK** | `24` (Android 7.0+) |
| **Target SDK** | `35` (Android 15 — Compliant with Google Play 2024–2026 policies) |
| **Format** | Android App Bundle (`.aab`) |
| **Build Framework** | Capacitor 8 + React + TanStack Router |

---

## 2. Generating a Release Keystore

Google Play requires all production release bundles to be cryptographically signed.

Run the following command to generate a 2048-bit RSA release keystore:

```bash
keytool -genkey -v -keystore shuffle-release.keystore \
  -alias shuffle-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

> [!CAUTION]
> **Backup your Keystore and Passwords!**
> If you lose your signing keystore or password, you will not be able to update your app on the Google Play Store (unless you enrolled in Google Play App Signing). Keep this file in a secure password manager or secret vault. Never commit `*.keystore` or `*.jks` to git.

---

## 3. Local Release Build

### Step 1: Set Environment Variables
Set the keystore credentials in your shell:

```bash
export ANDROID_KEYSTORE_PATH="/path/to/shuffle-release.keystore"
export ANDROID_KEYSTORE_PASSWORD="your_keystore_password"
export ANDROID_KEY_ALIAS="shuffle-key-alias"
export ANDROID_KEY_PASSWORD="your_key_password"
```

### Step 2: Build the Web App and Sync Capacitor
```bash
npm run cap:build:android
```

### Step 3: Build the Android App Bundle (.aab)
```bash
npm run android:bundle
```

The signed Android App Bundle will be created at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### (Optional) Build an APK for Local Testing
To test the release build directly on an Android device or emulator before uploading to the store:
```bash
npm run android:apk
# Output located at: android/app/build/outputs/apk/release/app-release.apk

# Install to connected device:
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Automated Builds via GitHub Actions

The repository includes a complete automated CI workflow in [`.github/workflows/android-release.yml`](.github/workflows/android-release.yml).

### Step 1: Add GitHub Repository Secrets
Go to **GitHub Repository → Settings → Secrets and variables → Actions** and add:

1. `ANDROID_KEYSTORE_BASE64`: Base64 string of your keystore file:
   ```bash
   base64 -i shuffle-release.keystore | pbcopy  # macOS
   # or base64 -w 0 shuffle-release.keystore     # Linux
   ```
2. `ANDROID_KEYSTORE_PASSWORD`: Password for the keystore.
3. `ANDROID_KEY_ALIAS`: Alias of your key (e.g. `shuffle-key-alias`).
4. `ANDROID_KEY_PASSWORD`: Password for the key.

### Step 2: Triggering a Release
Push a Git tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```
GitHub Actions will automatically build the signed `.aab` and `.apk`, attach them to the GitHub Release, and make them available for download.

---

## 5. Google Play Console Listing Setup

### 1. Create Application
- Go to [Google Play Console](https://play.google.com/console).
- Click **Create App**.
- **App name**: `Shuffle Security`
- **Default language**: `English (United States)`
- **App or game**: `App`
- **Free or paid**: `Free`

### 2. Store Assets (Provided in `android-store-assets/`)
- **App Icon**: `android-store-assets/app-icon-512x512.png` (512x512 PNG, 32-bit color).
- **Feature Graphic**: `android-store-assets/feature-graphic-1024x500.png` (1024x500 JPEG/PNG).
- **Screenshots**: Capture phone and tablet screenshots (at least 2 screenshots, 16:9 or 9:16 aspect ratio).

### 3. Store Listing Descriptions
- **Short Description** (up to 80 characters):
  > Open source security operations and incident response platform.
- **Full Description** (up to 4,000 characters):
  > Shuffle Security is the open source incident response and security operations platform built for and by security professionals. It brings alerts, cases, observables, host monitoring, vulnerabilities, and AI-driven response into a single unified mobile workspace.
  >
  > Features:
  > • Unified Incidents view for alerts and cases
  > • Observables and IOC correlation with threat intel enrichment
  > • AI Agent for triage, response suggestions, and automated workflows
  > • Real-time host and vulnerability monitoring
  > • Connects seamlessly with Shuffle Core and 3,000+ security integrations

### 4. Policy and Compliance Questions
- **Privacy Policy**: Link to your privacy policy (e.g., `https://shuffle.security/privacy` or hosted policy).
- **App Access**: If authentication is required, provide test/demo account credentials for Google Play Review team.
- **Ads**: Select "No, my app does not contain ads".
- **Content Rating**: Complete questionnaire (select "Utility, Productivity, Communication, or other").
- **Target Audience**: 18 and over.
- **Data Safety**: Declare network usage (data encrypted in transit via HTTPS).

---

## 6. Release Tracks and Rollout

1. **Internal Testing**:
   - Go to **Testing → Internal testing**.
   - Create a new release and upload `app-release.aab`.
   - Add testers via email list.
   - Share internal testing link for immediate installation.
2. **Production Release**:
   - Once verified, promote the release to **Production** with staged rollout (e.g., 20% → 50% → 100%).
