// POST /api/categorize
// LLM-backed category suggestion for a typed description or a whole OCR'd
// receipt. Routes through NVIDIA NIM's OpenAI-compatible gateway (see
// server/utils/nvidia.ts) with a primary/secondary model pair: if the
// primary model errors OR replies with something that isn't one of the
// caller's own category names, the secondary model gets an independent
// attempt before giving up. The client (useAutoCategory.ts) has its own
// further fallback — a local keyword vote — if BOTH of these fail or the
// gateway itself is unreachable: the same "smart endpoint, dumb offline
// fallback" shape already used for /api/stats/forecast vs. the client-side
// useForecast().
//
// The API key never reaches the browser: server/utils/nvidia.ts is the only
// thing that ever sees NVIDIA_API_KEY.

// Overridable via env — hosted-model catalogs churn fast (this app has
// already swapped LLM providers once; individual models get renamed or
// retired even faster), so swapping either tier is a config change, not a
// redeploy.
const PRIMARY_MODEL = process.env.NVIDIA_MODEL_PRIMARY || 'z-ai/glm-5.2'
const SECONDARY_MODEL = process.env.NVIDIA_MODEL_SECONDARY || 'meta/llama-3.1-8b-instruct'
const REQUEST_TIMEOUT_MS = 10_000
const UNCATEGORIZED = 'Uncategorized'

function systemPrompt(categories: string[]): string {
  return (
    'You are a financial routing assistant. Given a short piece of text ' +
    '(a typed expense description, or the raw text of a scanned receipt), ' +
    `choose the SINGLE best-matching category from this exact list: ${categories.join(', ')}. ` +
    `If none genuinely fit, respond with "${UNCATEGORIZED}". Reply with ONLY the category ` +
    'name (or the word Uncategorized) and nothing else — no punctuation, no explanation, ' +
    'no markdown, no code fences.'
  )
}

// NIM's support for structured/JSON output varies by model, so this route
// doesn't depend on it — the system prompt above asks for a bare name, and
// this parses whatever comes back (plain text, or JSON if a model does it
// anyway) rather than requiring one shape.
function extractCategory(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.category === 'string') return parsed.category.trim()
  } catch {
    // Plain text, as instructed — not an error.
  }
  return trimmed.replace(/^["'`]+|["'`]+$/g, '').replace(/[.!]+$/g, '').trim()
}

/** One model's attempt. Returns the matched category, or null if the model
 *  answered with something outside the given list (a caller-level try/catch
 *  handles an actual error or timeout). */
async function askModel(model: string, text: string, categories: string[]): Promise<string | null> {
  const response = await nvidiaClient().chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt(categories) },
        { role: 'user', content: text }
      ],
      temperature: 0,
      max_tokens: 30
    },
    { timeout: REQUEST_TIMEOUT_MS }
  )
  const raw = extractCategory(response.choices[0]?.message?.content)
  // Defense in depth: never forward anything to the client that isn't
  // EXACTLY one of the categories it sent us — no hallucinated or malformed
  // value, regardless of how well either model followed instructions.
  return categories.find((c) => c.toLowerCase() === raw.toLowerCase()) ?? null
}

export default defineEventHandler(async (event) => {
  // This calls metered, paid APIs — never let it run unauthenticated.
  await requireUser(event)
  const { text, categories } = parseCategorizeInput(await readBody(event))

  if (categories.length === 0) return { category: null }

  try {
    const primary = await askModel(PRIMARY_MODEL, text, categories)
    if (primary) return { category: primary }
  } catch (err) {
    console.error(`[categorize] primary model (${PRIMARY_MODEL}) failed:`, err)
  }

  // Primary either errored or found no valid match in its own reply — give
  // the secondary model an independent attempt before giving up entirely.
  try {
    const secondary = await askModel(SECONDARY_MODEL, text, categories)
    return { category: secondary }
  } catch (err) {
    console.error(`[categorize] secondary model (${SECONDARY_MODEL}) failed:`, err)
    // Both models are down or erroring — the client's own local fallback
    // (useAutoCategory.ts) picks up from here.
    throw createError({ statusCode: 502, statusMessage: 'AI categorization is unavailable.' })
  }
})
