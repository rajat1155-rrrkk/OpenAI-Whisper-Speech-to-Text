import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenAI Whisper Speech to Text",
  description: "Browser-based speech-to-text app with local Whisper and OpenAI API transcription modes."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
