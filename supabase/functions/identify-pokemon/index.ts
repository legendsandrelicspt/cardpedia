// Cardpedia single-card identification proxy. Store CARDSIGHT_API_KEY as a Supabase Edge Function secret.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = Deno.env.get("CARDSIGHT_API_KEY");
  if (!apiKey) return json({ error: "Card identification is not configured yet." }, 503);
  try {
    const incoming = await req.formData();
    const image = incoming.get("image");
    if (!(image instanceof File)) return json({ error: "Upload one image in the image field." }, 400);
    if (!image.type.startsWith("image/")) return json({ error: "The uploaded file must be an image." }, 415);
    if (image.size > 12 * 1024 * 1024) return json({ error: "Image must be smaller than 12 MB." }, 413);
    const payload = new FormData();
    payload.append("image", image, image.name || "card-photo.jpg");
    const upstream = await fetch("https://api.cardsight.ai/v1/identify/card", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: payload,
    });
    const raw = await upstream.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = { error: "Invalid response from card identification provider." }; }
    if (!upstream.ok) return json({ error: result.error || "Card identification provider returned an error.", providerStatus: upstream.status }, upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : upstream.status);
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected identification error." }, 500);
  }
});
