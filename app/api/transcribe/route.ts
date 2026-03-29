import OpenAI from "openai";

const defaultModel = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
const localWhisperUrl =
  process.env.LOCAL_WHISPER_SERVER_URL || "http://127.0.0.1:8000/transcribe";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mode = formData.get("mode");
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return jsonResponse({ error: "Audio file is required." }, 400);
    }

    if (mode === "local-whisper") {
      const relayBody = new FormData();
      relayBody.append("audio", audio, audio.name);

      const localResponse = await fetch(localWhisperUrl, {
        method: "POST",
        body: relayBody
      });

      const data = (await localResponse.json()) as { error?: string; text?: string };

      if (!localResponse.ok) {
        return jsonResponse(
          {
            error:
              data.error ||
              "Local Whisper server did not respond successfully. Start it with `npm run local-whisper`."
          },
          localResponse.status
        );
      }

      return jsonResponse({
        provider: "local-whisper",
        text: data.text || ""
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(
        {
          error:
            "OPENAI_API_KEY is missing. Add it to `.env.local` for local runs or Vercel project settings for deployment."
        },
        500
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: defaultModel
    });

    return jsonResponse({
      provider: defaultModel,
      text: transcription.text
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected server error."
      },
      500
    );
  }
}
