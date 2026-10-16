/**
 * The ElevenLabs sound layer. Only a text description derived from the recipe
 * is sent; the recording never leaves the browser.
 */
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return new Response('ElevenLabs is not configured', { status: 501 })
  const { text } = (await req.json()) as { text?: string }
  if (!text || text.length > 450) return new Response('Bad text', { status: 400 })

  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: 10, prompt_influence: 0.6 }),
  })
  if (!r.ok) return new Response(await r.text(), { status: r.status })
  return new Response(r.body, { headers: { 'content-type': 'audio/mpeg' } })
}

export async function GET() {
  return Response.json({ enabled: Boolean(process.env.ELEVENLABS_API_KEY) })
}
