# Shuffle Security — iOS Build & App Store Release Guide

This document explains how to build, test, and release the Shuffle Security iOS app to **TestFlight** and the **Apple App Store**.

---

## 1. Quick Commands

| Task | Command |
| :--- | :--- |
| **Build & Sync Web Assets to iOS** | `npm run ios:sync` |
| **Open Xcode Project** | `npm run ios:open` (or `npx cap open ios`) |
| **Clean Build** | `npm run build && npx cap sync ios` |

---

## 2. Project Structure

- **Xcode Workspace**: `ios/App/App.xcworkspace`
- **Native iOS Project**: `ios/App/App.xcodeproj`
- **Configuration & Permissions**: `ios/App/App/Info.plist`
- **Asset Catalog (Icons & Splash)**: `ios/App/App/Assets.xcassets`
- **Web Bundle**: `ios/App/App/public`

---

## 3. Local Testing in iOS Simulator / Device

1. Run:
   ```bash
   npm run ios:open
   ```
2. In Xcode:
   - Select your target simulator (e.g., **iPhone 16 Pro**) or connected physical iPhone from the top device toolbar.
   - Click **Run** (`⌘ + R`).
   - The app boots directly into the **Mobile Auth Gateway** or dashboard with full haptics and audio siren support.

---

## 4. APNs Push Notifications & Critical Alerts

To enable background on-call pager ringing when the iPhone is locked:

1. In Xcode, click on the root **App** project in the left navigator.
2. Select the **Signing & Capabilities** tab.
3. Click **+ Capability** and add:
   - **Push Notifications**
   - **Background Modes** -> Check **Remote notifications**
4. For Apple **Critical Alerts** (ringing through iPhone mute/Do Not Disturb):
   - Submit Apple's [Critical Alerts Entitlement Request](https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/) with your Developer Account.
   - Once approved by Apple, add the **Critical Alerts** entitlement in Xcode.

---

## 5. App Store / TestFlight Archive & Release

1. **Set Build & Version**:
   - In Xcode -> **App** target -> **General** tab.
   - Set **Version** (e.g. `1.0.0`) and **Build** (e.g. `1`).
2. **Signing**:
   - Under **Signing & Capabilities**, select your **Apple Developer Team** and check *Automatically manage signing*.
3. **Archive**:
   - In Xcode top menu, choose destination **Any iOS Device (arm64)**.
   - Go to **Product** -> **Archive**.
4. **Upload to TestFlight / App Store**:
   - In the Xcode Organizer window that appears, click **Distribute App**.
   - Select **App Store Connect** -> **Upload**.
   - Your build will appear in [App Store Connect](https://appstoreconnect.apple.com) under TestFlight within ~5-10 minutes.
