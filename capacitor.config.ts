import type { CapacitorConfig } from "@capacitor/cli";

const remoteUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.rajat.whisperstt",
  appName: "OpenAI Whisper STT",
  webDir: "capacitor-web",
  server: remoteUrl
    ? {
        url: remoteUrl,
        cleartext: false,
        androidScheme: "https"
      }
    : {
        androidScheme: "https"
      }
};

export default config;
