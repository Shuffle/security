# Mobile CI/CD Deployment Guide (Google Play & Apple App Store)

This repository includes enterprise-grade GitHub Actions workflows to build, sign, and manually deploy **Shuffle Security** to both **Google Play** and the **Apple App Store / TestFlight**.

Because this repository is open source, **all sensitive signing keys, certificates, service account JSONs, and passwords must be stored exclusively in GitHub Repository Secrets**.

---

## 🚀 Available Workflows

You can trigger builds manually under the **Actions** tab in GitHub:

1. **Deploy Android to Google Play** (`.github/workflows/deploy-android.yml`)
   - Builds signed Android App Bundle (`.aab`) and Universal APK (`.apk`).
   - Automatically uploads to the selected Google Play track (`internal`, `alpha`, `beta`, `production`).
2. **Deploy iOS to Apple App Store / TestFlight** (`.github/workflows/deploy-ios.yml`)
   - Builds and codesigns `.xcarchive` on macOS runner.
   - Exports `.ipa` and uploads directly to TestFlight / App Store Connect.
3. **Deploy Mobile (Android & iOS)** (`.github/workflows/deploy-mobile.yml`)
   - All-in-one trigger to dispatch Android, iOS, or both in parallel.

---

## 🔐 Required GitHub Secrets & Variables

Navigate to **GitHub Repository $\rightarrow$ Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions** and add the following:

### 🤖 1. Android Secrets (Google Play)

| Secret Name | Description | Example / How to generate |
| :--- | :--- | :--- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release `.keystore` or `.jks` file | `base64 -i my-release-key.keystore \| pbcopy` |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the Keystore | `YourKeystorePassword` |
| `ANDROID_KEY_ALIAS` | Key alias name | `shuffle-release-key` |
| `ANDROID_KEY_PASSWORD` | Password for the specific key alias | `YourKeyPassword` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Raw contents of the Google Cloud Service Account JSON key | `{"type": "service_account", "project_id": ...}` |
| `GOOGLE_SERVICES_JSON_BASE64` *(Optional)* | Base64-encoded `google-services.json` for Firebase / FCM | `base64 -i google-services.json \| pbcopy` |

---

### 🍏 2. iOS Secrets (Apple App Store / TestFlight)

| Secret Name | Description | Example / How to generate |
| :--- | :--- | :--- |
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded Apple Distribution Certificate (`.p12`) | `base64 -i AppleDist.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | Password set when exporting the `.p12` from Keychain | `YourP12Password` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64-encoded App Store Provisioning Profile (`.mobileprovision`) | `base64 -i AppStore_Profile.mobileprovision \| pbcopy` |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID | `ABCDE12345` (found on Apple Developer Membership page) |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect API Key ID | `2X9R4274KC` |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect API Issuer ID (UUID) | `69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `APP_STORE_CONNECT_PRIVATE_KEY_BASE64` | Base64-encoded App Store Connect API private key (`.p8`) | `base64 -i AuthKey_2X9R4274KC.p8 \| pbcopy` |

---

## 🛠 Step-by-Step Credential Setup

### Part A: Android Setup

#### 1. Generate Release Keystore (if you don't already have one)
Run in your local terminal:
```bash
keytool -genkey -v -keystore shuffle-release.keystore \
  -alias shuffle-release-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

#### 2. Base64 Encode Keystore for GitHub Secrets
- **macOS:**
  ```bash
  base64 -i shuffle-release.keystore | pbcopy
  ```
- **Linux:**
  ```bash
  base64 -w 0 shuffle-release.keystore
  ```
Paste this into GitHub Secret: `ANDROID_KEYSTORE_BASE64`.

#### 3. Google Play Service Account Setup (For Automated Uploads)
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project (e.g., `Shuffle-Mobile-Deploy`).
3. Enable the **Google Play Android Developer API**.
4. Go to **IAM & Admin $\rightarrow$ Service Accounts**, create a Service Account, and assign the role **Service Account User**.
5. Create and download a **JSON Key** for this Service Account.
6. Open [Google Play Console](https://play.google.com/console/) $\rightarrow$ **API Access**.
7. Link the Google Cloud project and grant the Service Account **Admin** (or **Releases**) permissions to `io.shuffle.security`.
8. Copy the entire JSON file contents into GitHub Secret: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

---

### Part B: iOS Setup

#### 1. Export Apple Distribution Certificate (`.p12`)
1. In Xcode or Keychain Access on Mac, locate your **Apple Distribution** certificate and private key.
2. Right-click the certificate and select **Export "Apple Distribution: ..."**.
3. Choose format **Personal Information Exchange (.p12)** and set a secure password.
4. Base64 encode the `.p12`:
   ```bash
   base64 -i DistributionCertificate.p12 | pbcopy
   ```
5. Add to GitHub Secrets:
   - `APPLE_CERTIFICATE_BASE64`: (the clipboard content)
   - `APPLE_CERTIFICATE_PASSWORD`: (the password you entered during export)

#### 2. Download App Store Provisioning Profile
1. In [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list), create an **App Store** distribution provisioning profile for Bundle ID `io.shuffle.security`.
2. Download `Shuffle_Security_AppStore.mobileprovision`.
3. Base64 encode it:
   ```bash
   base64 -i Shuffle_Security_AppStore.mobileprovision | pbcopy
   ```
4. Add to GitHub Secret: `APPLE_PROVISIONING_PROFILE_BASE64`.

#### 3. Generate App Store Connect API Key (For Automated Uploads)
1. Go to [App Store Connect](https://appstoreconnect.apple.com/) $\rightarrow$ **Users and Access** $\rightarrow$ **Integrations** (or **Keys**).
2. Click **+** to generate a new API Key with **App Manager** or **Admin** access.
3. Note the **Issuer ID** (UUID at top of page) $\rightarrow$ `APP_STORE_CONNECT_ISSUER_ID`.
4. Note the **Key ID** $\rightarrow$ `APP_STORE_CONNECT_KEY_ID`.
5. Download the `.p8` private key file (e.g., `AuthKey_XXXXXX.p8`) and base64 encode it:
   ```bash
   base64 -i AuthKey_XXXXXX.p8 | pbcopy
   ```
6. Add to GitHub Secret: `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`.

---

## 🏃‍♂️ How to Run a Manual Deployment

1. Go to the **Actions** tab in GitHub.
2. Under "Workflows" on the left, click **Deploy Android to Google Play**, **Deploy iOS to Apple App Store**, or **Deploy Mobile**.
3. Click the **Run workflow** dropdown on the right.
4. Configure options:
   - **Track / Flight**: `internal`, `alpha`, `beta`, or `production`
   - **Version Name**: e.g., `1.0.0` (or leave blank to use `package.json` version)
   - **Build Number**: e.g., `15` (or leave blank to use the GitHub Run Number)
   - **Upload to store**: Check `true` (or uncheck `false` to just generate and download artifacts).
5. Click **Run workflow**.

---

## 📦 Accessing Built Artifacts

Every workflow run automatically attaches the generated binary artifacts to the GitHub Actions summary page:
- **Android**: `shuffle-security-android-v1.0.0-b1-aab` (`.aab` for Google Play) and `...-apk` (`.apk` for manual device testing).
- **iOS**: `shuffle-security-ios-v1.0.0-b1-ipa` (`.ipa` for TestFlight / manual installation).
