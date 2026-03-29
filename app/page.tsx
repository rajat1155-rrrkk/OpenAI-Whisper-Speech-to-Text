"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

const ACCEPTED_AUDIO = "audio/*";
const MODEL_ID = "onnx-community/whisper-tiny.en";

type WhisperPipeline = (audio: Float32Array, options?: Record<string, unknown>) => Promise<{
  text?: string;
}>;

function blobToFile(blob: Blob, name: string) {
  return new File([blob], name, { type: blob.type || "audio/webm" });
}

function mixToMono(audioBuffer: AudioBuffer) {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const output = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const input = audioBuffer.getChannelData(channel);
    for (let i = 0; i < input.length; i += 1) {
      output[i] += input[i] / audioBuffer.numberOfChannels;
    }
  }

  return output;
}

async function decodeAudio(file: File) {
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const audioBuffer = await context.decodeAudioData(await file.arrayBuffer());
    return mixToMono(audioBuffer);
  } finally {
    await context.close();
  }
}

export default function HomePage() {
  const [deviceType, setDeviceType] = useState<"desktop-web" | "mobile-web">("desktop-web");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(
    "This build runs Whisper directly in the browser. First use may take time while the model downloads."
  );
  const [transcript, setTranscript] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pipelinePromiseRef = useRef<Promise<WhisperPipeline> | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent || "";
    setDeviceType(/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ? "mobile-web" : "desktop-web");

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function getTranscriber() {
    if (!pipelinePromiseRef.current) {
      pipelinePromiseRef.current = import("@huggingface/transformers").then(async ({ env, pipeline }) => {
        env.allowLocalModels = false;
        const createPipeline = pipeline as (...args: unknown[]) => Promise<unknown>;

        const transcriber = (await createPipeline("automatic-speech-recognition", MODEL_ID, {
          progress_callback(progress: { progress?: number } | null) {
            const percent =
              progress && typeof progress.progress === "number"
                ? Math.max(0, Math.min(100, Math.round(progress.progress * 100)))
                : 0;
            setDownloadProgress(percent);
            setStatus(
              percent > 0
                ? `Preparing offline Whisper model (${percent}%).`
                : "Preparing offline Whisper model."
            );
          }
        })) as WhisperPipeline;

        setModelReady(true);
        setDownloadProgress(100);
        setStatus("Offline Whisper model is ready.");
        return transcriber;
      });
    }

    return pipelinePromiseRef.current;
  }

  async function transcribeFile(file: File) {
    setIsSubmitting(true);
    setStatus("Decoding audio in the browser...");

    try {
      const waveform = await decodeAudio(file);
      setStatus("Running offline Whisper transcription...");

      const transcriber = await getTranscriber();
      const result = await transcriber(waveform, {
        chunk_length_s: 20,
        stride_length_s: 5
      });

      const text = result.text?.trim() || "";
      setTranscript(text);
      setStatus(text ? "Offline transcription complete." : "No speech was detected.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Offline transcription failed on this device/browser."
      );
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
        await transcribeFile(file);
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
    setStatus("Processing your recording locally...");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    await transcribeFile(file);
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
          <span className="eyebrow">Offline Whisper</span>
          <h1>Speech to text, directly on the device.</h1>
          <p>
            This version bundles a browser-based Whisper pipeline so the app can run without any
            backend API. The homepage detects whether it is running on mobile or desktop, but both
            paths still transcribe locally on the device.
          </p>
        </section>

        <section className="grid">
          <div className="card stack">
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
              <span className="pill">No backend API</span>
              <span className="pill">Static export ready</span>
              <span className="pill">Capacitor-ready</span>
              <span className="pill">Vercel-friendly</span>
            </div>

            <div className="meta">
              <strong>Detected runtime</strong>
              <span>{deviceType === "mobile-web" ? "Mobile device" : "Desktop browser"}</span>
            </div>

            <div className="meta">
              <strong>Model</strong>
              <span>{MODEL_ID}</span>
            </div>

            <div className="meta">
              <strong>Model status</strong>
              <span>{modelReady ? "Ready" : `Preparing or not yet loaded (${downloadProgress}%)`}</span>
            </div>

            <div className="meta">
              <strong>Important note</strong>
              <span>
                The app does not call your own API, but the first run may need internet access to
                download the Whisper model files into the browser cache. After the model is cached,
                repeat use on the same device can work offline.
              </span>
            </div>
          </aside>
        </section>

        <p className="footer-note">
          The bundled model is optimized for a lightweight footprint. Accuracy and language support
          are more limited than larger Whisper variants, but it is far easier to run inside a web
          view and Android wrapper.
        </p>
      </div>
    </main>
  );
}
