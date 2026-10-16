/**
 * The System's voice. Text in, speech out, through ElevenLabs. The key stays on
 * the server. Without a key the route answers 501 and the UI stays silent.
 */
export const runtime = 'nodejs'

// Premade multilingual voice; override with ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb'

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return new Response('ElevenLabs is not configured', { status: 501 })
  const { text } = (await req.json()) as { text?: string }
  if (!text || text.length > 600) return new Response('Bad text', { status: 400 })

  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.75, similarity_boost: 0.6, style: 0.1 },
    }),
  })
  if (!r.ok) return new Response(await r.text(), { status: r.status })
  return new Response(r.body, { headers: { 'content-type': 'audio/mpeg' } })
}
