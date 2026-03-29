# OpenAI Whisper Speech to Text

A browser-based speech-to-text project that runs Whisper-style transcription directly on the device.

- No local server
- No app-owned transcription API
- Browser and mobile-webview friendly local processing
- Android packaging through Capacitor
- GitHub Actions APK builds

## Stack

- Next.js App Router
- `@huggingface/transformers` for in-browser ASR
- Capacitor for Android packaging
- Vercel for deployment

## Local development

1. Install Node dependencies:

   ```bash
   npm install
   ```

2. Start the web app:

   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000`.

Notes:

- The first run may download model weights into the browser cache.
- After the model is cached on a device, repeat use can work without calling your own backend API.
- Mobile devices can use the same on-device/browser-side path inside the Capacitor app.

## Deploying to Vercel

1. Import this repository into Vercel.
2. Deploy.

This project is exported as a static site, so Vercel does not need any transcription env vars.

## Android APK

This repo includes:

- `capacitor.config.ts`
- a GitHub Actions workflow at `.github/workflows/android-apk.yml`

### Local Android build

If you have Android Studio, Java, and the Android SDK installed:

```bash
npm run build
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio.

### GitHub Actions APK build

After pushing the repo to GitHub:

1. Open the `Actions` tab.
2. Run the `Android APK` workflow.
3. Download the generated `app-debug.apk` artifact.

## Architecture note

This app does not rely on your own API for speech-to-text. The transcription runs in the browser layer using a lightweight local model. The main limitation is that the first run may still need internet access to fetch model assets unless you later decide to bundle larger model files directly into the app package.
