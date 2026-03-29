# OpenAI Whisper Speech to Text

A fresh browser-based speech-to-text project that supports:

- `OpenAI API` transcription for local use and Vercel deployment
- `Local Whisper` transcription using the open-source [`openai/whisper`](https://github.com/openai/whisper) package on your machine
- Android packaging through Capacitor
- GitHub Actions APK builds

## Stack

- Next.js App Router
- OpenAI Node SDK
- Local Python bridge for `openai-whisper`
- Capacitor for Android packaging
- Vercel for deployment

## Local development

1. Install Node dependencies:

   ```bash
   npm install
   ```

2. Create your local env file:

   ```bash
   cp .env.example .env.local
   ```

3. Add `OPENAI_API_KEY` in `.env.local`.

4. Start the web app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Running the local Whisper server

This uses the open-source Whisper package from the official GitHub project.

1. Create a virtual environment and install Python deps:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Start the local server:

   ```bash
   npm run local-whisper
   ```

3. In the browser UI, switch mode to `Local Whisper server`.

Notes:

- The first run may download model weights.
- `ffmpeg` is typically required by Whisper for broad audio format support.
- For Vercel, use the default `OpenAI API / Vercel-ready` mode.

## Deploying to Vercel

1. Import this repository into Vercel.
2. Add the environment variable `OPENAI_API_KEY`.
3. Optionally add `OPENAI_TRANSCRIPTION_MODEL`.
4. Deploy.

## Android APK

This repo includes:

- `capacitor.config.ts`
- a GitHub Actions workflow at `.github/workflows/android-apk.yml`

### Local Android build

If you have Android Studio, Java, and the Android SDK installed:

```bash
npx cap add android
CAP_SERVER_URL=https://your-vercel-app.vercel.app npx cap sync android
npx cap open android
```

Then build the APK from Android Studio.

### GitHub Actions APK build

After pushing the repo to GitHub:

1. Open the `Actions` tab.
2. Run the `Android APK` workflow.
3. Download the generated `app-debug.apk` artifact.
4. Before running it, add a repository secret named `CAP_SERVER_URL` that points to your deployed Vercel app URL.

## Important architecture note

Vercel cannot practically host the open-source Whisper model runtime from `openai/whisper` as part of this lightweight app. This project therefore supports two modes:

- `OpenAI API`: production-friendly and deployable on Vercel
- `Local Whisper`: development-friendly and powered by the official open-source Whisper package on your own machine
