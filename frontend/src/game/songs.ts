// Original chiptune loops for Cram Cartridge, written for this game.
//
// Notation: one token per 16th note. A note name (C5, F#4, Bb3) starts a note,
// '-' holds the previous note, '.' is a rest. Bars are separated by '|' (ignored).
// Every line is a whole number of 16-step bars.
// Bass is written as one chord root per bar and played in `bassStyle`.
// Drums: k = kick, s = snare, h = hat, '.' = nothing (16 steps, repeated).

export interface Song {
  /** The brief this piece was written to. */
  mood: string
  bpm: number
  lead: string
  /** Lead waveform: pulse duty (0.125 / 0.25 / 0.5) or 'triangle'. */
  leadWave: 0.125 | 0.25 | 0.5 | 'triangle'
  /** Optional second voice (soft 50% pulse), same notation as lead. */
  harmony?: string
  /** One root per bar, e.g. 'A2 F2 D2 E2'. */
  roots: string
  bassStyle: 'pulse' | 'octave' | 'drone' | 'arp' | 'gallop'
  drums: string
  loop: boolean
}

export const SONGS: Record<string, Song> = {
  title: {
    mood: 'Bold, theatrical, slightly cheeky and ambitious: confident and inviting.',
    bpm: 126,
    leadWave: 0.25,
    lead: `C5 . E5 . G5 - . G5 A5 . G5 . E5 - . . | F5 . E5 . D#5 . E5 . C5 - - - . . G4 . |
           A4 . C5 . F5 - . F5 G5 . F5 . D5 - . . | E5 . D5 . C#5 . D5 . G5 - - - - - . . |
           C6 - . C6 B5 . A5 . G5 - . E5 G5 . A5 . | Bb5 - . A5 G5 . F5 . E5 - D5 - C5 - . . |
           F5 . A5 . C6 . A5 . G5 . E5 . C5 . E5 . | D5 - - - G5 - - - C5 - - - . . . .`,
    harmony: `E4 - - - - - - - E4 - - - - - - - | A4 - - - - - - - G4 - - - - - - - |
              C5 - - - - - - - A4 - - - - - - - | B4 - - - - - - - B4 - - - - - - - |
              E5 - - - - - - - C5 - - - - - - - | D5 - - - - - - - Bb4 - - - - - - - |
              A4 - - - - - - - C5 - - - - - - - | B4 - - - F4 - - - E4 - - - . . . .`,
    roots: 'C2 C2 F2 G2 A1 Bb1 F2 G2',
    bassStyle: 'octave',
    drums: 'k . h . s . h k . k h . s . h h',
    loop: true,
  },
  level1: {
    mood: 'High-stakes, driven and dramatic: urgency and determination.',
    bpm: 144,
    leadWave: 0.125,
    lead: `D5 - . D5 F5 - . D5 A5 - . A5 G5 - F5 - | E5 - . E5 G5 - . E5 Bb5 - . Bb5 A5 - G5 - |
           F5 - . F5 A5 - . F5 C6 - . C6 Bb5 - A5 - | G5 - - - A5 - - - C#6 - - - A5 - - - |
           D6 - . D6 C6 - . Bb5 A5 - . G5 F5 - E5 - | F5 - . F5 E5 - . D5 C#5 - . D5 E5 - A4 - |
           D5 - F5 - A5 - D6 - C6 - Bb5 - A5 - G5 - | A5 - - - C#5 - E5 - D5 - - - . . . .`,
    roots: 'D2 C2 F2 A1 Bb1 A1 D2 A1',
    bassStyle: 'gallop',
    drums: 'k . h k s . h . k k h . s . s h',
    loop: true,
  },
  level2: {
    mood: 'Tense, atmospheric and suspenseful.',
    bpm: 88,
    leadWave: 0.125,
    lead: `E5 - - - - - - - F5 - - - E5 - - - | . . . . D#5 - - - E5 - - - - - - - |
           A5 - - - - - G5 - F5 - - - E5 - - - | D#5 - - - - - - - . . . . . . . . |
           C6 - - - B5 - - - Bb5 - - - A5 - - - | G#5 - - - - - - - A5 - - - - - . . |
           E5 - F5 - E5 - D#5 - E5 - F5 - G#5 - - - | A5 - - - - - - - . . . . . . . .`,
    roots: 'A1 A1 F1 B1 A1 E1 A1 E1',
    bassStyle: 'pulse',
    drums: 'k . . . . . h . k . . . s . . .',
    loop: true,
  },
  level3: {
    mood: 'Dark, ominous and foreboding.',
    bpm: 70,
    leadWave: 'triangle',
    lead: `E4 - - - - - - - F4 - - - - - - - | E4 - - - - - - - . . . . . . . . |
           G4 - - - F4 - - - E4 - - - D4 - - - | C4 - - - - - - - B3 - - - - - - - |
           E5 - - - - - D#5 - E5 - - - F5 - - - | E5 - - - - - - - . . . . B4 - - - |
           C5 - - - B4 - - - Bb4 - - - A4 - - - | B4 - - - - - - - - - - - . . . .`,
    roots: 'E1 F1 C2 A1 E1 E1 A1 B1',
    bassStyle: 'drone',
    drums: 'k . k . . . . . . . . . . . . .',
    loop: true,
  },
  level4: {
    mood: 'Fast-paced, mysterious, hybrid-cinematic: brisk momentum with an uncanny edge.',
    bpm: 152,
    leadWave: 0.125,
    lead: `B4 F#5 D5 F#5 B4 F#5 D5 F#5 B4 G5 D5 G5 B4 G5 D5 G5 |
           A4 F#5 C#5 F#5 A4 F#5 C#5 F#5 A4 F5 C#5 F5 A4 F5 C#5 F5 |
           G4 E5 B4 E5 G4 E5 B4 E5 G4 D#5 B4 D#5 G4 D#5 B4 D#5 |
           F#4 C#5 A#4 C#5 F#4 C#5 A#4 C#5 F#4 D5 C5 D5 F#4 D5 C5 D5 |
           B4 F#5 D5 F#5 B4 F#5 D5 F#5 B4 G5 D5 G5 B4 G5 D5 G5 |
           A4 F#5 C#5 F#5 A4 F#5 C#5 F#5 A4 F5 C#5 F5 A4 F5 C#5 F5 |
           E5 G5 B5 G5 E5 G5 B5 G5 F#5 A#5 C#6 A#5 F#5 A#5 C#6 A#5 |
           B5 - - - F5 - - - F#5 - - - - - - -`,
    roots: 'B1 A1 G1 F#1 B1 A1 E2 F#1',
    bassStyle: 'pulse',
    drums: 'k h h k s h k h k h h k s h s h',
    loop: true,
  },
  level5: {
    mood: 'Fierce, raw and intense: aggressive, heated energy.',
    bpm: 168,
    leadWave: 0.25,
    lead: `E4 E4 . E4 G4 . E4 . A#4 . A4 . G4 . E4 . | E4 E4 . E4 G4 . E4 . D5 . C#5 . C5 . B4 . |
           E5 . E5 . D5 . E5 . G5 - F#5 - F5 - E5 - | D#5 - - - B4 - - - E5 - - - . . . . |
           B5 . B5 . A#5 . B5 . E6 - D6 - B5 - A#5 - | A5 . A5 . G5 . A5 . D6 - C6 - A5 - G5 - |
           E5 G5 A#5 B5 E6 B5 A#5 G5 E5 G5 A#5 B5 D6 C#6 C6 B5 | E5 - - - E4 - - - E5 . . . . . . .`,
    roots: 'E1 E1 C2 B1 E1 D2 E1 B1',
    bassStyle: 'gallop',
    drums: 'k k s h k k s k k k s h k s s s',
    loop: true,
  },
  summit: {
    mood: 'Sweeping, resolute and climactic: grand payoff energy.',
    bpm: 112,
    leadWave: 0.25,
    lead: `D5 - - - A5 - - - F#5 - - - E5 - D5 - | E5 - - - B5 - - - A5 - - - G5 - - - |
           F#5 - - - D6 - - - C#6 - - - B5 - A5 - | A5 - - - - - - - G5 - F#5 - E5 - - - |
           D5 - F#5 - A5 - D6 - B5 - - - A5 - - - | G5 - B5 - D6 - G6 - F#6 - - - E6 - - - |
           D6 - - - C#6 - B5 - A5 - - - G5 - F#5 - | G5 - - - E5 - - - D5 - - - - - - -`,
    harmony: `F#4 - - - - - - - A4 - - - - - - - | G4 - - - - - - - B4 - - - - - - - |
              D5 - - - - - - - C#5 - - - - - - - | C#5 - - - - - - - - - - - - - - - |
              F#4 - - - - - - - D5 - - - - - - - | B4 - - - - - - - D5 - - - - - - - |
              F#5 - - - - - - - E5 - - - - - - - | D5 - - - C#5 - - - A4 - - - - - - -`,
    roots: 'D2 E2 B1 A1 D2 G1 A1 D2',
    bassStyle: 'octave',
    drums: 'k . . h s . . h k . k h s . h h',
    loop: true,
  },
  // Retep: the summit theme turned dark and fast.
  boss: {
    mood: 'The summit theme turned to a storm: relentless.',
    bpm: 140,
    leadWave: 0.125,
    lead: `D5 - - - A4 - D5 - F5 - - - E5 - D5 - | G5 - - - F5 - E5 - F5 - - - D5 - - - |
           Bb4 - - - C5 - D5 - E5 - - - F5 - G5 - | A5 - - - - - G5 - F5 - E5 - C#5 - - - |
           D6 - . D6 A5 - . A5 Bb5 - . Bb5 F5 - . F5 | G5 - . G5 D5 - . D5 E5 - F5 - G5 - - - |
           A5 - - - F5 - D5 - E5 - F5 - G5 - E5 - | D5 - - - A4 - - - D5 - - - . . . .`,
    roots: 'D2 G2 Bb1 A1 D2 G2 A1 D2',
    bassStyle: 'gallop',
    drums: 'k h s h k k s h k h s k k k s s',
    loop: true,
  },
  victory: {
    mood: 'A short fanfare.',
    bpm: 132,
    leadWave: 0.25,
    lead: `C5 . E5 . G5 . C6 - - - G5 . C6 - - - | D6 - - - E6 - - - C6 - - - - - - - | . . . . . . . . . . . . . . . .`,
    roots: 'C2 G2 C2',
    bassStyle: 'octave',
    drums: 'k . . . s . . . k . k . s s s s',
    loop: false,
  },
  defeat: {
    mood: 'A falling lament.',
    bpm: 72,
    leadWave: 'triangle',
    lead: `A4 - - - G4 - - - F4 - - - E4 - - - | D4 - - - C#4 - - - D4 - - - - - - - | . . . . . . . . . . . . . . . .`,
    roots: 'A1 D2 D2',
    bassStyle: 'drone',
    drums: 'k . . . . . . . . . . . . . . .',
    loop: false,
  },
}

/** Slots without their own song borrow one. */
export const SONG_FOR_SLOT: Record<string, string> = {
  title: 'title',
  shelf: 'title',
  map: 'title',
  level1: 'level1',
  level2: 'level2',
  level3: 'level3',
  level4: 'level4',
  level5: 'level5',
  summit: 'summit',
  boss: 'boss',
  victory: 'victory',
  defeat: 'defeat',
}
