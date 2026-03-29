"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type TranscriptionMode = "openai" | "local-whisper";

const ACCEPTED_AUDIO = "audio/*";

function blobToFile(blob: Blob, name: string) {
  return new File([blob], name, { type: blob.type || "audio/webm" });
}

export default function HomePage() {
  const [mode, setMode] = useState<TranscriptionMode>("openai");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Choose a transcription mode, then record or upload audio.");
  const [transcript, setTranscript] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function submitAudio(file: File) {
    setIsSubmitting(true);
    setStatus("Uploading audio and waiting for transcription...");

    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("mode", mode);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as { error?: string; text?: string; provider?: string };

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed.");
      }

      setTranscript(data.text || "");
      setStatus(`Transcription complete via ${data.provider || mode}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected transcription error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = blobToFile(blob, `recording-${Date.now()}.webm`);
        setSelectedFileName(file.name);
        await submitAudio(file);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatus("Recording in progress...");
    } catch {
      setStatus("Microphone access was denied or unavailable.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    setStatus("Processing your recording...");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    await submitAudio(file);
  }

  async function copyTranscript() {
    if (!transcript) {
      return;
    }

    await navigator.clipboard.writeText(transcript);
    setStatus("Transcript copied to clipboard.");
  }

  return (
    <main className="shell">
      <div className="frame">
        <section className="hero">
          <span className="eyebrow">Speech To Text</span>
          <h1>Whisper on the web, with a local escape hatch.</h1>
          <p>
            This starter gives you a browser UI, an OpenAI-powered transcription path that works on
            Vercel, and a local Whisper server path that can run the open-source model from the
            official `openai/whisper` project on your machine.
          </p>
        </section>

        <section className="grid">
          <div className="card stack">
            <div className="stack">
              <label htmlFor="mode">Transcription mode</label>
              <select
                id="mode"
                className="select"
                value={mode}
                onChange={(event) => setMode(event.target.value as TranscriptionMode)}
              >
                <option value="openai">OpenAI API / Vercel-ready</option>
                <option value="local-whisper">Local Whisper server</option>
              </select>
            </div>

            <div className="controls">
              {!isRecording ? (
                <button className="button" disabled={isSubmitting} onClick={startRecording}>
                  Record in browser
                </button>
              ) : (
                <button className="button" onClick={stopRecording}>
                  Stop recording
                </button>
              )}

              <button
                className="button secondary"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload audio
              </button>

              <button
                className="button secondary"
                disabled={!transcript}
                onClick={copyTranscript}
              >
                Copy transcript
              </button>
            </div>

            <input
              ref={fileInputRef}
              hidden
              accept={ACCEPTED_AUDIO}
              type="file"
              onChange={handleFileChange}
            />

            <div className="status">{status}</div>

            <div className="stack">
              <label htmlFor="transcript">Transcript</label>
              <textarea
                id="transcript"
                className="textarea"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Your transcript will appear here."
              />
            </div>
          </div>

          <aside className="card stack">
            <div className="meta">
              <strong>Current selection</strong>
              <span>{selectedFileName || "No file selected yet"}</span>
            </div>

            <div className="pill-row">
              <span className="pill">Browser recorder</span>
              <span className="pill">File upload</span>
              <span className="pill">Vercel deployable</span>
              <span className="pill">Capacitor-ready</span>
            </div>

            <div className="meta">
              <strong>How the two modes differ</strong>
              <span>
                `OpenAI API` works locally and on Vercel using your API key. `Local Whisper` calls a
                Python server in `scripts/local_whisper_server.py`, which uses the open-source
                Whisper package on your own machine.
              </span>
            </div>

            <div className="meta">
              <strong>Android path</strong>
              <span>
                The repo includes Capacitor config plus a GitHub Actions workflow that can build an
                Android APK from the web app once the repository is pushed.
              </span>
            </div>
          </aside>
        </section>

        <p className="footer-note">
          Tip: for deployment, keep the default `OpenAI API` mode. The `Local Whisper` option is
          intended for local development where you want the open-source Whisper model running on
          your machine.
        </p>
      </div>
    </main>
  );
}
