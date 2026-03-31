"use client";

import { useEffect, useRef, useState } from "react";

const MODEL_ID = "onnx-community/whisper-tiny.en";
const CHUNK_MS = 4000;

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
  const [status, setStatus] = useState("Ready for microphone access.");
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [selectedMode, setSelectedMode] = useState("Audio");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const restartTimeoutRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);
  const pipelinePromiseRef = useRef<Promise<WhisperPipeline> | null>(null);

  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        window.clearTimeout(restartTimeoutRef.current);
      }
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

            setStatus(percent > 0 ? `Loading model ${percent}%` : "Preparing model...");
          }
        })) as WhisperPipeline;

        setIsModelReady(true);
        setStatus("Model ready. Live transcription is available.");
        return transcriber;
      });
    }

    return pipelinePromiseRef.current;
  }

  async function transcribeBlob(blob: Blob) {
    if (blob.size === 0) {
      return;
    }

    setIsProcessing(true);

    try {
      const file = blobToFile(blob, `live-${Date.now()}.webm`);
      const waveform = await decodeAudio(file);
      const transcriber = await getTranscriber();
      const result = await transcriber(waveform, {
        chunk_length_s: 20,
        stride_length_s: 5
      });

      const text = result.text?.trim();
      if (text) {
        setTranscript((current) => (current ? `${current} ${text}` : text));
      }

      setStatus(stoppingRef.current ? "Stopped." : "Listening live...");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transcription failed.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function startChunkRecording(stream: MediaStream) {
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      await transcribeBlob(blob);

      if (!stoppingRef.current && streamRef.current) {
        restartTimeoutRef.current = window.setTimeout(() => {
          void startChunkRecording(streamRef.current as MediaStream);
        }, 120);
      }
    };

    recorder.start();
    setStatus("Listening live...");
    window.setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, CHUNK_MS);
  }

  async function startListening() {
    try {
      stoppingRef.current = false;
      setStatus("Requesting microphone...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsListening(true);

      void getTranscriber();
      await startChunkRecording(stream);
    } catch {
      setStatus("Microphone access was denied.");
      setIsListening(false);
    }
  }

  function stopListening() {
    stoppingRef.current = true;
    setIsListening(false);
    setStatus("Stopping...");

    if (restartTimeoutRef.current) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus("Stopped.");
    }
  }

  useEffect(() => {
    if (!isListening && stoppingRef.current) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      stoppingRef.current = false;
    }
  }, [isListening]);

  async function copyTranscript() {
    if (!transcript) {
      return;
    }

    await navigator.clipboard.writeText(transcript);
    setStatus("Transcript copied.");
  }

  function clearTranscript() {
    setTranscript("");
    setStatus(isListening ? "Listening live..." : "Transcript cleared.");
  }

  return (
    <main className="shell">
      <section className="live-card">
        <div className="ambient ambient-left" aria-hidden="true" />
        <div className="ambient ambient-right" aria-hidden="true" />

        <div className="wave-panel" aria-hidden="true">
          <div className="wave-line wave-line-1" />
          <div className="wave-line wave-line-2" />
          <div className="wave-line wave-line-3" />
          <div className="wave-line wave-line-4" />
          <span className="wave-node wave-node-1" />
          <span className="wave-node wave-node-2" />
          <span className="wave-node wave-node-3" />
          <span className="wave-node wave-node-4" />
          <span className="wave-node wave-node-5" />
        </div>

        <div className="live-top">
          <div>
            <p className="eyebrow">Live Speech To Text</p>
            <h1>Capture speech in a glowing live workspace.</h1>
          </div>

          <div className="state-dot-wrap">
            <span className={`state-dot ${isListening ? "live" : ""}`} />
            <span>{isListening ? "Listening" : "Idle"}</span>
          </div>
        </div>

        <div className="mode-row" role="tablist" aria-label="Capture mode">
          {["Video", "Audio", "Interview"].map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={selectedMode === mode}
              className={`mode-pill ${selectedMode === mode ? "active" : ""}`}
              onClick={() => setSelectedMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="mic-wrap">
          <button
            className={`mic ${isListening ? "active" : ""}`}
            disabled={isProcessing && !isListening}
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? "Stop live transcription" : "Start live transcription"}
          >
            <span className="mic-ring" aria-hidden="true" />
            <span className="mic-core" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path
                  d="M12 16.25a3.75 3.75 0 0 0 3.75-3.75V7.75a3.75 3.75 0 0 0-7.5 0v4.75A3.75 3.75 0 0 0 12 16.25Zm6-3.75a.75.75 0 0 0-1.5 0 4.5 4.5 0 0 1-9 0 .75.75 0 0 0-1.5 0 6 6 0 0 0 5.25 5.95v2.05H9.5a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-1.75v-2.05A6 6 0 0 0 18 12.5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="sr-only">{isListening ? "Stop" : "Start"}</span>
          </button>
          <p className="minimal-status">
            <span className="status-label">{selectedMode} mode</span>
            <span>{status}</span>
            {isProcessing ? " Processing latest chunk..." : ""}
            {isModelReady ? "" : " First run may take longer while the model loads."}
          </p>
        </div>

        <textarea
          className="minimal-textarea"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Live transcript appears here..."
        />

        <div className="minimal-actions">
          <button className="button secondary" disabled={!transcript} onClick={clearTranscript}>
            Clear
          </button>
          <button className="button" disabled={!transcript} onClick={copyTranscript}>
            Copy text
          </button>
        </div>
      </section>
    </main>
  );
}
