import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rajat.whisperstt",
  appName: "OpenAI Whisper STT",
  webDir: "out",
  server: {
    androidScheme: "https"
  }
};

export default config;
