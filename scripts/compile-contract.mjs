// Compiles contracts/ZeroFreq.sol with solc-js into lib/zerofreq.json (abi + bytecode).
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const solc = require('solc')
const root = resolve(import.meta.dirname, '..')

const input = {
  language: 'Solidity',
  sources: { 'ZeroFreq.sol': { content: readFileSync(resolve(root, 'contracts/ZeroFreq.sol'), 'utf8') } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
}

function findImports(path) {
  try {
    return { contents: readFileSync(resolve(root, 'node_modules', path), 'utf8') }
  } catch {
    return { error: `not found: ${path}` }
  }
}

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))
const errors = (out.errors ?? []).filter((e) => e.severity === 'error')
for (const e of out.errors ?? []) console.error(e.formattedMessage)
if (errors.length) process.exit(1)

const c = out.contracts['ZeroFreq.sol'].ZeroFreq
writeFileSync(
  resolve(root, 'lib/zerofreq.json'),
  JSON.stringify({ abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2) + '\n',
)
console.log(`ZeroFreq compiled with solc ${solc.version()}: ${c.evm.bytecode.object.length / 2} bytes`)
