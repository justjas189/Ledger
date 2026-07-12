// Shared NVIDIA NIM client — an OpenAI-compatible gateway for the app's
// LLM-backed features (currently just POST /api/categorize). One client,
// auto-imported everywhere server-side.
import OpenAI from 'openai'

let client: OpenAI | null = null

/**
 * Lazily builds (and caches) the NVIDIA NIM client. Throws a clean 503
 * instead of a confusing runtime crash when the key isn't configured.
 */
export function nvidiaClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'AI categorization is not configured.'
      })
    }
    client = new OpenAI({
      apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      // The primary -> secondary model fallback in categorize.post.ts IS the
      // retry strategy — leave the SDK's own automatic retries off so a
      // failing primary fails over to the secondary promptly, instead of the
      // SDK silently re-trying the SAME model first.
      maxRetries: 0
    })
  }
  return client
}
