import localFont from 'next/font/local'
import { Tiro_Devanagari_Sanskrit } from 'next/font/google'

/** Faces from BVLK.EXE (D007): 3270 carries ∅ ∩ Λ; Aldrich is display only. */
export const terminal = localFont({ src: './fonts/3270-Regular.otf', variable: '--font-terminal', display: 'swap', weight: '400' })
export const terminalCondensed = localFont({ src: './fonts/3270Condensed-Regular.otf', variable: '--font-terminal-condensed', display: 'swap', weight: '400' })
export const pixel = localFont({ src: './fonts/DepartureMono-Regular.woff2', variable: '--font-pixel', display: 'swap', weight: '400' })
export const display = localFont({ src: './fonts/Aldrich-Regular.ttf', variable: '--font-display', display: 'swap', weight: '400' })

/** Devanagari for ॐ and the mantra: 3270 has no Devanagari, and many devices ship none either. */
export const sanskrit = Tiro_Devanagari_Sanskrit({ subsets: ['devanagari'], weight: '400', variable: '--font-sanskrit', display: 'swap' })

export const fontVariables = [terminal.variable, terminalCondensed.variable, pixel.variable, display.variable, sanskrit.variable].join(' ')
