// Setup type definitions for Supabase Edge Runtime (Deno)
// Supabase Edge Functions sử dụng Deno.serve có sẵn mà không cần import từ https://deno.land
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanBase64 = imageBase64.replace(
      /^data:image\/[a-zA-Z]+;base64,/,
      ""
    );
    const geminiKey =
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("EXPO_PUBLIC_GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "AI_NOT_CONFIGURED" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const prompt =
          "Bạn là chuyên gia dinh dưỡng và thị giác máy tính. Hãy nhận diện các món ăn có trong hình ảnh đĩa ăn này.\n" +
          "Ước lượng: tên món ăn tiếng Việt, khối lượng (estimatedGrams), calo (kcal), tinh bột (carbG), đạm (proteinG), chất béo (fatG).\n" +
          "Chỉ trả về định dạng mảng JSON thuần túy (không bọc trong markdown code fence ```json), ví dụ: " +
          '[{"name":"Cơm trắng","estimatedGrams":150,"kcal":195,"carbG":43,"proteinG":4,"fatG":0.5}]';

        const geminiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000,
            },
          }),
        });

        if (!geminiRes.ok) {
          throw new Error(`Gemini API returned ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const cleanText = text
          .replace(/```(?:json)?/gi, "")
          .replace(/```/g, "")
          .trim();
        const items = JSON.parse(cleanText);
        if (!Array.isArray(items)) {
          throw new Error("Gemini returned a non-array response");
        }

        return new Response(JSON.stringify({ items }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (geminiError) {
        console.error("Gemini invocation failed:", geminiError);
        return new Response(JSON.stringify({ error: "AI_ANALYSIS_FAILED" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "AI_NOT_CONFIGURED" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Meal analysis failed:", err);
    return new Response(JSON.stringify({ error: "AI_ANALYSIS_FAILED" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
