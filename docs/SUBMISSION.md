# ∅FREQ · submission kit

## Project name
∅FREQ (0FREQ)

## Tagline (one line)
A voice becomes a frequency: an abstract, on-chain sonic identity for artists, made from their voice without ever storing it.

## Tracks
AI and Web3

## Links
- Live app: https://u-hackathon-build-0-freq.vercel.app
- Test mode without a microphone: https://u-hackathon-build-0-freq.vercel.app/?test
- GitHub: https://github.com/raiqasvl/u-hackathon-build
- Contract (Avalanche Fuji): https://testnet.snowtrace.io/address/0x1668483b1c38dc82d94d956eb20e29cad14bdf7b
- First community: https://bvlk.network

## Short description (~80 words)
In 2026 any voice can be cloned in a minute, so a recording no longer proves who you are. ∅FREQ turns an artist's voice into an abstract sonic identity. You sing ॐ and a Sanskrit mantra; the browser measures your voice into a genome and discards the recording. You place that genome anywhere in a continuous field of abstract sound, from drone to harsh noise, and render a unique sample and sigil. When you accept it, the recipe is written to Avalanche as a non-transferable token.

## Full description
**Problem.** For artists the voice is identity, and in the age of voice cloning a recording proves nothing. Underground creative communities like BVLK in Bangkok also live by privacy: no photos, no recordings, locations disclosed on access. Artists need an identity that is provably theirs, impossible to copy, and that never exposes the person behind it.

**How it works.**
1. **Signal.** Sing ॐ as a glide from your lowest to your highest note, then speak *Om Saccidānanda Parabrahma Puruṣottama Paramātmā*. Together they sweep the full range of a voice: pitch, every vowel, sibilants, rolled r, plosives and nasals. Recorded and analysed in the browser; the recording is never uploaded and is released once measured.
2. **Genome.** Pitch range and centre, 13 MFCC timbre coefficients, spectral centroid, flatness, rolloff, jitter, shimmer and speech pulse, quantised and hashed with keccak256.
3. **Field.** A continuous space of abstraction instead of presets: tone to noise, continuous to fragmented, plus dark, density and space. Sixteen genres (drone, harsh noise wall, microsound, musique concrète, power electronics...) are only landmarks. The voice places itself first; the artist then moves anywhere, including unnamed space.
4. **Engine.** A seeded modular synthesis engine: harmonic bank from the timbre, FM from the formant ratio, noise bank at the voice's own formants, and a voice ghost resynthesised from the genome alone. The same recipe always renders the same 15 second loop.
5. **Sigil.** A point-density mark in the BVLK visual language, generated from the same recipe.
6. **Human gate.** Nothing is written without the artist's decision. "This is my frequency" signs a transaction that stores genome, coordinates and SVG sigil fully on Avalanche. One per wallet, non-transferable. The chain holds the score, not the recording.

**ElevenLabs.** Text to Speech (multilingual v2) is the System voice that announces the frequency in English, Russian or Thai. Sound Effects generates an extra texture layer from a text description derived from the recipe, never from the voice. The API key stays on the server.

**Avalanche.** ZeroFreq contract on Fuji C-Chain: soulbound ERC-721 with fully on-chain metadata (base64 JSON plus SVG), one token per wallet.

**Why it matters.** Every artist gets a sonic identity: a producer tag for releases, an avatar for communities that ban photos, an access credential for events. Two artists can intersect their genomes into a shared frequency for a B2B set (A ∩ B). The engine accepts any input with a genome; token economies from Tokenomist data are the next input. BVLK uses it first, at FIELD/001 in Bangkok on 31 October.

## Tech stack
Next.js 16, React 19, TypeScript, Meyda, Web Audio API (OfflineAudioContext), viem, Solidity 0.8 + OpenZeppelin, Avalanche Fuji C-Chain, ElevenLabs API (TTS, Sound Effects), Vercel.

## Team
Rai Qasvl (solo): concept, sound design, development. BVLK.EXE, Bangkok.

## 60-second demo script
1. "Your voice can be cloned in a minute. So how does an artist prove a sound is theirs?"
2. Sing ॐ low to high, speak the mantra. "The recording never leaves this device."
3. Genome appears: root note, pitch range, timbre. The System voice announces the frequency.
4. Drag the point across the field: drone → microsound → harsh noise. Same root, same character, different abstraction.
5. Sigil. "This is my frequency" → wallet signs → token on Avalanche. "The chain holds the score, not the recording."
6. "BVLK uses it first, on 31 October. Next: every artist, every collective, and B2B frequencies for collaborations."
