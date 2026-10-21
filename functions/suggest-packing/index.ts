// suggest-packing — generates a context-aware packing list via Cloudflare AI Gateway → DeepSeek.
// Accepts POST { destination, departDate, returnDate, tripType?, weather? } and returns
// { categories: [{ id, name, items: [{ label, qty, essential, note }] }] }.

const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_KEY") || "";
// All model traffic goes through Cloudflare AI Gateway -> DeepSeek. No other providers, no direct fallback.
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_AIG_GATEWAY = Deno.env.get("CF_AIG_GATEWAY") || "default";
const CF_AIG_TOKEN = Deno.env.get("CF_AIG_TOKEN") || ""; // set if the gateway is authenticated
const AIG_DEEPSEEK = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_AIG_GATEWAY}/deepseek/chat/completions`;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

interface PackingItem {
  label: string;
  qty: number;
  essential: boolean;
  note?: string;
}

interface PackingCategory {
  id: string;
  name: string;
  items: PackingItem[];
}

interface PackingList {
  categories: PackingCategory[];
}

interface SuggestRequest {
  destination?: string;
  departDate?: string;
  returnDate?: string;
  tripType?: string;
  weather?: unknown;
}

function jsonHeaders(): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders() });
}

function tripDurationDays(depart?: string, ret?: string): number | null {
  if (!depart || !ret) return null;
  const a = Date.parse(depart);
  const b = Date.parse(ret);
  if (isNaN(a) || isNaN(b) || b < a) return null;
  return Math.max(1, Math.round((b - a) / 86400000));
}

function buildPrompt(req: SuggestRequest): string {
  const { destination, departDate, returnDate, tripType, weather } = req;
  const days = tripDurationDays(departDate, returnDate);
  const durationStr = days ? `${days} day${days === 1 ? "" : "s"}` : "unspecified duration";

  const lines: string[] = [
    "You are an expert travel packing assistant. Generate a smart, context-aware packing list for a trip.",
    "",
    `Destination: ${destination || "unspecified"}.`,
    `Departure date: ${departDate || "unspecified"}.`,
    `Return date: ${returnDate || "unspecified"}.`,
    `Trip duration: ${durationStr}.`,
    `Trip type: ${tripType || "general"}.`,
  ];

  if (weather && typeof weather === "object" && Object.keys(weather as Record<string, unknown>).length > 0) {
    lines.push(`Weather data (JSON): ${JSON.stringify(weather)}`);
    lines.push("Use the weather forecast to adapt the packing list — e.g. rain gear if precipitation is likely, warm layers if cold, sun protection if high UV, snow gear if snow is expected.");
  } else {
    lines.push("Weather data: not provided. Infer typical climate for the destination and season from the departure date.");
  }

  lines.push("");
  lines.push("Consider the destination's climate, the trip duration, the trip type (beach / business / city / adventure / ski), and the weather data above.");
  lines.push("Adjust item quantities sensibly for the trip length — e.g. enough clothing for the number of days, with laundry assumptions for longer trips.");
  lines.push("Tailor categories to the trip type: beach trips need swimwear & sun protection; business trips need formalwear & laptop; ski trips need thermal layers, goggles & gloves; adventure trips need rugged gear; city trips need comfortable walking shoes & a day bag.");
  lines.push("");
  lines.push("Return ONLY a valid JSON object with EXACTLY this shape and no other text:");
  lines.push("{");
  lines.push('  "categories": [');
  lines.push("    {");
  lines.push('      "id": "a short kebab-case id like apparel or tech",');
  lines.push('      "name": "Human readable category name",');
  lines.push('      "items": [');
  lines.push("        {");
  lines.push('          "label": "Item name",');
  lines.push('          "qty": 1,');
  lines.push('          "essential": true,');
  lines.push('          "note": "Optional short note explaining why or how to pack it"');
  lines.push("        }");
  lines.push("      ]");
  lines.push("    }");
  lines.push("  ]");
  lines.push("}");
  lines.push("");
  lines.push("Rules:");
  lines.push("- 4 to 8 categories, each with 3 to 12 items.");
  lines.push("- `id` must be kebab-case (lowercase, hyphens). `name` should be Title Case.");
  lines.push("- `qty` is a positive integer. `essential` is a boolean.");
  lines.push("- `note` is optional; include it only when it adds value (e.g. weather or trip-type reasoning).");
  lines.push("- Output ONLY the JSON object — no markdown fences, no prose, no commentary.");

  return lines.join("\n");
}

async function generatePackingList(req: SuggestRequest): Promise<PackingList> {
  if (!CF_ACCOUNT_ID) throw new Error("CF_ACCOUNT_ID not set");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // DEEPSEEK_KEY unset = key stored in the gateway (BYOK)
  if (DEEPSEEK_KEY) headers.Authorization = `Bearer ${DEEPSEEK_KEY}`;
  if (CF_AIG_TOKEN) headers["cf-aig-authorization"] = `Bearer ${CF_AIG_TOKEN}`;

  const prompt = buildPrompt(req);
  const res = await fetch(AIG_DEEPSEEK, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${detail || res.statusText}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("DeepSeek returned empty content");

  let parsed: PackingList;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Fallback: extract the first JSON object from the text (handles stray markdown fences).
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("DeepSeek response was not valid JSON: " + content.slice(0, 200));
    parsed = JSON.parse(match[0]);
  }

  if (!parsed || !Array.isArray(parsed.categories)) {
    throw new Error("DeepSeek response missing `categories` array");
  }

  // Normalize/validate each category so downstream consumers get a stable shape.
  parsed.categories = parsed.categories.map((cat: any, i: number): PackingCategory => ({
    id: typeof cat?.id === "string" && cat.id.trim() ? cat.id.trim() : `category-${i + 1}`,
    name: typeof cat?.name === "string" && cat.name.trim() ? cat.name.trim() : `Category ${i + 1}`,
    items: Array.isArray(cat?.items)
      ? cat.items.map((it: any, j: number): PackingItem => ({
          label: typeof it?.label === "string" ? it.label : String(it?.label ?? `Item ${j + 1}`),
          qty: Number.isFinite(it?.qty) ? Math.max(1, Math.floor(it.qty)) : 1,
          essential: Boolean(it?.essential),
          ...(typeof it?.note === "string" && it.note.trim() ? { note: it.note.trim() } : {}),
        }))
      : [],
  }));

  return parsed;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "POST only");

  let body: SuggestRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  if (!body || typeof body !== "object") return errorResponse(400, "Missing request body");
  if (!body.destination || !String(body.destination).trim()) {
    return errorResponse(400, "destination is required");
  }

  try {
    const packingList = await generatePackingList(body);
    return new Response(JSON.stringify(packingList), { headers: jsonHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate packing list";
    return errorResponse(500, message);
  }
});
