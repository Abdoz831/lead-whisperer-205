import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({ text: z.string().min(1).max(2000) });

const Schema = z.object({
  bcp47: z
    .string()
    .describe(
      "Best-guess BCP-47 locale for the language being spoken. Use a common locale like en-US, ar-JO, fr-FR, es-ES, de-DE, it-IT, pt-BR, tr-TR, ru-RU, hi-IN, zh-CN, ja-JP, ko-KR, he-IL, th-TH, el-GR, nl-NL, pl-PL, sv-SE, ur-PK. If undecidable, return 'und'.",
    ),
  confidence: z.number().min(0).max(1).describe("0-1 confidence in the guess"),
});

export const detectLangFromText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash-lite"),
      schema: Schema,
      maxOutputTokens: 128,
      system:
        "You are a sensitive language identification model for live speech recognition. Given a short transcript — possibly wrong because Chrome first decoded the speech as English — identify the language the speaker is most likely actually speaking. Do not default to English just because the text uses Latin letters. Treat transliteration, phonetic spellings, and garbled English-looking output as clues. " +
        "Examples: 'pre vet menya zovut ivan', 'privet menya zovut ivan', 'menya zavut', 'spasiba ya rabotayu' → ru-RU. 'bonjour je m appelle' → fr-FR. 'hola me llamo' → es-ES. 'ni hao wo jiao' → zh-CN. 'salam ana esmi' → ar-JO. 'guten tag ich heisse' → de-DE. " +
        "If there are any credible non-English clues, prefer that language with moderate confidence rather than en-US. Return only the BCP-47 code plus a confidence 0-1.",
      prompt: `Transcript: ${data.text}`,
    });
    return object;
  });
