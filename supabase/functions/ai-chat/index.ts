// Edge Function 'ai-chat': proxy Gemini cho man Tro chuyen voi tro ly.
// App goi qua supabase.functions.invoke('ai-chat') — key Gemini chi nam
// trong secret GEMINI_API_KEY cua project, khong bao gio vao app.
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapStatus(status: number): string {
  if (status === 401 || status === 403) return "ai_key_invalid";
  if (status === 429) return "ai_quota";
  if (status === 400) return "ai_bad_request";
  if (status === 404) return "ai_model_not_found";
  return "ai_failed";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt } = await req.json();
    const list: Array<{ role?: string; text?: string }> = Array.isArray(
      messages,
    )
      ? messages
      : [];
    const lastUser = [...list]
      .reverse()
      .find((m) => m?.role === "user" && m?.text?.trim());
    if (!lastUser) {
      return json({ error: "ai_bad_request" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "ai_not_configured" }, 503);
    }

    const transcript = list
      .slice(-8)
      .map(
        (m) => `${m.role === "user" ? "Người dùng" : "Trợ lý"}: ${m.text}`,
      )
      .join("\n");

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: `${transcript}\nTrợ lý:` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    };
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    let lastError = "ai_failed";
    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text: string =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: unknown) => {
              const part = p as { text?: string };
              return part?.text ?? "";
            })
            .join("") ?? "";
        if (!text.trim()) {
          return json({ error: "ai_failed" }, 502);
        }
        return json({ text: text.trim() });
      }
      const code = mapStatus(res.status);
      // Chi 404 (model khong con ton tai) moi dang thu model du phong.
      if (code === "ai_model_not_found") {
        lastError = code;
        continue;
      }
      return json({ error: code }, res.status);
    }
    return json({ error: lastError }, 502);
  } catch (err) {
    console.error("ai-chat failed:", err);
    return json({ error: "ai_failed" }, 500);
  }
});
