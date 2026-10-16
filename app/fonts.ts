import localFont from 'next/font/local'

/** Faces from BVLK.EXE (D007): 3270 carries ∅ ∩ Λ; Aldrich is display only. */
export const terminal = localFont({ src: './fonts/3270-Regular.otf', variable: '--font-terminal', display: 'swap', weight: '400' })
export const terminalCondensed = localFont({ src: './fonts/3270Condensed-Regular.otf', variable: '--font-terminal-condensed', display: 'swap', weight: '400' })
export const pixel = localFont({ src: './fonts/DepartureMono-Regular.woff2', variable: '--font-pixel', display: 'swap', weight: '400' })
export const display = localFont({ src: './fonts/Aldrich-Regular.ttf', variable: '--font-display', display: 'swap', weight: '400' })

export const fontVariables = [terminal.variable, terminalCondensed.variable, pixel.variable, display.variable].join(' ')
