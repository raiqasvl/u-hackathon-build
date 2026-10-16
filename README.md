# ∅FREQ

**A voice becomes a frequency. The voice stays with you; the abstraction enters the record.**

U-Hackathon 2026 · Tracks: AI and Web3 · Built with ElevenLabs and Avalanche · First community: [BVLK.EXE](https://bvlk.network), Bangkok

## The problem

In 2026 anyone's voice can be cloned in a minute. For artists the voice is identity, and a recording no longer proves anything. Creative collectives with no permanent space, like BVLK, also live by privacy: no photos, no recordings, locations disclosed on access. Artists need an identity that is theirs, that cannot be copied, and that never exposes the person behind it.

## What ∅FREQ does

1. **Signal.** You sing ॐ as a glide from your lowest to your highest note, then speak the mantra *ॐ सच्चिदानंदपरब्रह्मपुरुषोत्तमपरमात्मा*. Together they sweep the whole frequency range of a voice: pitch range, every vowel, sibilants, rolled r, plosives, nasals. Recorded in the browser. **The recording never leaves the device** and is released as soon as it is measured.
2. **Genome.** The voice is measured into numbers: pitch range and centre, 13 MFCC timbre coefficients, spectral centroid, flatness, rolloff, jitter, shimmer and speech pulse. Quantised and hashed (keccak256). This is the only thing that leaves the browser.
3. **Field.** A continuous space of abstraction, not presets. X runs tone to noise, Y continuous to fragmented, plus dark, density and space. Named regions (drone, harsh noise wall, microsound, musique concrète, power electronics...) are only landmarks. The voice places itself first (∅ origin); the artist then moves freely, including into unnamed space.
4. **Engine.** A modular synthesis engine renders the genome at that point: a harmonic bank from the timbre, FM from the formant ratio, a noise bank at the voice's own formants driven by its roughness, and a voice ghost resynthesised from the pitch path and formants alone. Seeded and rendered offline, so the same recipe always produces the same 15 second loop.
5. **Sigil.** A point-density mark, an f(θ) construction in the BVLK visual language, generated from the same genome and coordinates.
6. **Human gate → Avalanche.** Nothing is written without the artist's decision. *This is my frequency* signs a transaction that stores the recipe on Avalanche: genome, coordinates and SVG sigil, fully on chain. One per wallet, non-transferable. **The chain holds the score, not the recording.**

### ElevenLabs

- **System voice** (Text to Speech, multilingual v2): announces the measured frequency in English, Russian or Thai.
- **Sound layer** (Sound Effects): a text description generated from the recipe (never the voice) becomes an extra texture layer in the engine.

The ElevenLabs key lives only on the server routes.

### Why it matters beyond BVLK

Every artist gets a sonic identity: a producer tag stamped on releases, an avatar in communities that ban photos, an access credential for events. Two artists can intersect their genomes into a shared frequency for a B2B set (A ∩ B). The engine takes any input with a genome; token economies from Tokenomist data are the next input.

## Run

```bash
npm install
cp .env.example .env.local   # ELEVENLABS_API_KEY, NEXT_PUBLIC_FREQ_CONTRACT
npm run dev                  # http://localhost:3000   (add ?test for a synthetic signal without a microphone)
```

Contract: `contracts/ZeroFreq.sol`, compiled with `npm run compile:contract` into `lib/zerofreq.json`. Deploy once from your wallet at `/deploy` on Avalanche Fuji (chainId 43113), then set `NEXT_PUBLIC_FREQ_CONTRACT`.

## Stack

Next.js 16 · React 19 · TypeScript · Meyda (feature extraction) · Web Audio (offline rendering) · viem · Solidity 0.8 + OpenZeppelin Base64 · Avalanche Fuji · ElevenLabs API. Design language, type (IBM 3270, Aldrich, Departure Mono) and tokens from BVLK.EXE.
