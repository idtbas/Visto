// Shared types of everything that deals with music: notes, pieces, and the one interface every
// transcriber (the brain, or the plain signal-processing yardstick) has to offer.

/** one note: MIDI pitch 21 (A0) .. 108 (C8), start and end in seconds, velocity 1..127 */
export interface Note {
  pitch: number
  start: number
  end: number
  velocity: number
}

/** lowest and highest key of a piano as MIDI pitches, and their number */
export const LOWEST = 21
export const HIGHEST = 108
export const KEYS = 88

/** audio everywhere in this project: mono Float32Array at this rate, values about -1..1 */
export const SAMPLE_RATE = 22050

/** frequency of a key in equal temperament, A4 (69) = 440 Hz */
export function freqOf(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12)
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** "C4", "F#3"; middle C (60) is C4 */
export function nameOf(pitch: number): string {
  return NAMES[((pitch % 12) + 12) % 12] + (Math.floor(pitch / 12) - 1)
}

/** a piece of music with known notes */
export interface Piece {
  id: string
  title: string
  composer: string
  notes: Note[]
  /** seconds, end of the last note */
  duration: number
  /** where the notes come from (edition, licence), if they were not written out by hand */
  source?: string
}

/**
 * Anything that turns sound into notes. The returned note starts must already be corrected
 * for whatever constant delay the method has, so that they can be compared with the truth directly.
 */
export interface Transcriber {
  transcribe(pcm: Float32Array, sampleRate: number): Promise<Note[]>
  /** one line that says what this transcriber is, for tables */
  describe?: string
}
