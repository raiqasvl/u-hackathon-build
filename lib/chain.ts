'use client'
/**
 * Avalanche Fuji (C-Chain testnet). The wallet is the browser's injected
 * provider (Core or MetaMask); no key ever passes through this app.
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  type Address,
  type EIP1193Provider,
  type Hex,
} from 'viem'
import { avalancheFuji } from 'viem/chains'
import artifact from './zerofreq.json'

export const ABI = artifact.abi
export const BYTECODE = artifact.bytecode as Hex
export const CONTRACT = (process.env.NEXT_PUBLIC_FREQ_CONTRACT || '') as Address | ''
export const EXPLORER = 'https://testnet.snowtrace.io'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
    avalanche?: EIP1193Provider
  }
}

export const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() })

function provider(): EIP1193Provider {
  const p = window.avalanche ?? window.ethereum
  if (!p) throw new Error('No wallet found. Install Core or MetaMask.')
  return p
}

export async function connect() {
  const wallet = createWalletClient({ chain: avalancheFuji, transport: custom(provider()) })
  const [account] = await wallet.requestAddresses()
  try {
    await wallet.switchChain({ id: avalancheFuji.id })
  } catch {
    await wallet.addChain({ chain: avalancheFuji })
    await wallet.switchChain({ id: avalancheFuji.id })
  }
  return { wallet, account }
}

export async function existingToken(account: Address): Promise<bigint> {
  if (!CONTRACT) return 0n
  return (await publicClient.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: 'tokenOf',
    args: [account],
  })) as bigint
}

export async function mint(args: {
  genomeHash: Hex
  genome: number[]
  coords: [number, number, number, number, number]
  svg: string
}) {
  if (!CONTRACT) throw new Error('Contract address is not configured.')
  const { wallet, account } = await connect()
  const hash = await wallet.writeContract({
    account,
    address: CONTRACT,
    abi: ABI,
    functionName: 'mint',
    args: [args.genomeHash, args.genome, args.coords, args.svg],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const [log] = parseEventLogs({ abi: ABI, logs: receipt.logs, eventName: 'Frequency' }) as unknown as {
    args: { tokenId: bigint }
  }[]
  return { hash, tokenId: log?.args.tokenId ?? 0n, account }
}

export async function deploy() {
  const { wallet, account } = await connect()
  const hash = await wallet.deployContract({ account, abi: ABI, bytecode: BYTECODE })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, address: receipt.contractAddress }
}
