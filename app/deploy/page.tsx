'use client'

import { useState } from 'react'
import { deploy, CONTRACT, EXPLORER } from '@/lib/chain'

/** One-time deploy of the ZeroFreq contract from the connected wallet. */
export default function DeployPage() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [out, setOut] = useState<{ hash: string; address?: string | null } | null>(null)
  const [error, setError] = useState('')

  async function run() {
    setError('')
    setState('busy')
    try {
      setOut(await deploy())
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0] : String(e))
      setState('idle')
    }
  }

  return (
    <main style={{ paddingTop: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '60ch' }}>
      <span className="ui-meta">∅FREQ / DEPLOY / AVALANCHE FUJI</span>
      <p className="ui-prose">Deploys the ZeroFreq contract from your wallet. Do this once, then set NEXT_PUBLIC_FREQ_CONTRACT to the address.</p>
      <p className="ui-meta">CURRENT / {CONTRACT || '∅'}</p>
      <button
        onClick={run}
        disabled={state === 'busy'}
        style={{ alignSelf: 'flex-start', background: 'transparent', color: 'inherit', border: '1px solid var(--bvlk-white)', padding: '1rem 1.5rem', font: 'inherit', cursor: 'pointer' }}
      >
        {state === 'busy' ? 'DEPLOYING' : 'DEPLOY CONTRACT'}
      </button>
      {out?.address && (
        <p className="ui-prose">
          ADDRESS / <code>{out.address}</code>
          <br />
          <a href={`${EXPLORER}/address/${out.address}`} target="_blank" rel="noreferrer">
            VIEW ON SNOWTRACE
          </a>
        </p>
      )}
      {error && <p className="ui-meta">{error}</p>}
    </main>
  )
}
