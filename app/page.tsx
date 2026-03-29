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
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Tap the mic and start speaking.");
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pipelinePromiseRef = useRef<Promise<WhisperPipeline> | null>(null);

  useEffect(() => {
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

            setStatus(
              percent > 0
                ? `Downloading model ${percent}%`
                : "Preparing speech model"
            );
          }
        })) as WhisperPipeline;

        return transcriber;
      });
    }

    return pipelinePromiseRef.current;
  }

  async function transcribeFile(file: File) {
    setIsSubmitting(true);
    setStatus("Processing audio...");

    try {
      const waveform = await decodeAudio(file);
      const transcriber = await getTranscriber();
      const result = await transcriber(waveform, {
        chunk_length_s: 20,
        stride_length_s: 5
      });

      const text = result.text?.trim() || "";
      setTranscript(text);
      setStatus(text ? "Done" : "No speech detected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transcription failed");
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
        await transcribeFile(file);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatus("Listening...");
    } catch {
      setStatus("Microphone access denied");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    setStatus("Finishing recording...");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await transcribeFile(file);
  }

  async function copyTranscript() {
    if (!transcript) {
      return;
    }

    await navigator.clipboard.writeText(transcript);
    setStatus("Copied");
  }

  return (
    <main className="shell">
      <div className="minimal">
        <button
          className={`mic ${isRecording ? "active" : ""}`}
          disabled={isSubmitting}
          onClick={isRecording ? stopRecording : startRecording}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? "Stop" : "Mic"}
        </button>

        <input
          ref={fileInputRef}
          hidden
          accept={ACCEPTED_AUDIO}
          type="file"
          onChange={handleFileChange}
        />

        <textarea
          className="minimal-textarea"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Transcript"
        />

        <div className="minimal-actions">
          <button
            className="button secondary"
            disabled={isSubmitting}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </button>

          <button
            className="button"
            disabled={!transcript}
            onClick={copyTranscript}
          >
            Copy text
          </button>
        </div>

        <p className="minimal-status">{status}</p>
      </div>
    </main>
  );
}
