import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "GOOGLE_TTS_API_KEY not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { text?: string; lang?: string; voice?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }

        const text = (body.text ?? "").toString().slice(0, 2000);
        if (!text.trim()) {
          return new Response(JSON.stringify({ error: "Missing text" }), { status: 400 });
        }

        const lang = (body.lang ?? "ar-XA").toString();
        const isArabic = lang.toLowerCase().startsWith("ar");
        // Google's Arabic locale is ar-XA. Chirp3-HD voices are the newest and
        // by far the most natural-sounding Arabic voices Google offers.
        // Fallback chain: Chirp3-HD -> Neural2 -> Wavenet.
        const languageCode = isArabic ? "ar-XA" : lang;
        const voiceName =
          body.voice ?? (isArabic ? "ar-XA-Chirp3-HD-Achernar" : undefined);

        // Chirp3-HD voices do NOT support pitch or speakingRate adjustments;
        // sending them returns 400. Only set those for non-Chirp voices.
        const isChirp = (voiceName ?? "").toLowerCase().includes("chirp");
        const audioConfig: Record<string, unknown> = { audioEncoding: "MP3" };
        if (!isChirp) {
          audioConfig.speakingRate = isArabic ? 0.95 : 1.0;
          audioConfig.pitch = 0;
        }

        const payload = {
          input: { text },
          voice: voiceName ? { languageCode, name: voiceName } : { languageCode },
          audioConfig,
        };


        const res = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const errText = await res.text();
          return new Response(
            JSON.stringify({ error: "Google TTS failed", status: res.status, detail: errText }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as { audioContent?: string };
        if (!data.audioContent) {
          return new Response(JSON.stringify({ error: "No audio returned" }), { status: 502 });
        }

        return new Response(JSON.stringify({ audio: data.audioContent, mime: "audio/mpeg" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
