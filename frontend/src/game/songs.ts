// Original chiptune loops for Cram Cartridge, written for this game.
// Each slot's mood follows the track the team picked for it (see MUSIC_MOODS in
// content.ts), but every melody here is our own.
//
// Notation: one token per 16th note. A note name (C5, F#4, Bb3) starts a note,
// '-' holds the previous note, '.' is a rest. Bars are separated by '|' (ignored).
// Bass is written as one chord root per bar and arpeggiated by `bassStyle`.
// Drums: k = kick, s = snare, h = hat, '.' = nothing (16 steps, repeated).

export interface Song {
  bpm: number
  lead: string
  /** Lead waveform: pulse duty (0.125 / 0.25 / 0.5) or 'triangle'. */
  leadWave: 0.125 | 0.25 | 0.5 | 'triangle'
  /** One root per bar, e.g. 'A2 F2 D2 E2'. */
  roots: string
  bassStyle: 'pulse' | 'octave' | 'drone' | 'arp' | 'gallop'
  drums: string
  loop: boolean
}

export const SONGS: Record<string, Song> = {
  // Title: regal, marching (mood of "The Throne is Mine").
  title: {
    bpm: 118,
    leadWave: 0.25,
    lead: `C5 - - - G4 - C5 - E5 - - - D5 - C5 - | D5 - - - B4 - G4 - D5 - E5 - F5 - - - |
           E5 - - - C5 - G4 - A4 - B4 - C5 - - - | D5 - B4 - G4 - B4 - C5 - - - - - . . |
           E5 - - - G5 - - - F5 - E5 - D5 - C5 - | A4 - - - C5 - F5 - E5 - - - D5 - - - |
           C5 - - - E5 - G5 - A5 - G5 - F5 - E5 - | D5 - - - G4 - B4 - C5 - - - - - - -`,
    roots: 'C2 G2 A2 G2 C2 F2 C2 G2',
    bassStyle: 'octave',
    drums: 'k . h . s . h . k . k . s . h h',
    loop: true,
  },
  // Underground: tense, driving, minor (mood of "At All Costs").
  level1: {
    bpm: 132,
    leadWave: 0.125,
    lead: `A4 - . A4 C5 - B4 - A4 - . E4 G4 - A4 - | . . A4 - C5 - D5 - E5 - D5 - C5 - B4 - |
           A4 - . A4 C5 - B4 - A4 - . E4 G4 - F4 - | E4 - - - G#4 - - - A4 - - - . . . . |
           E5 - . E5 D5 - C5 - D5 - . D5 C5 - B4 - | C5 - . C5 B4 - A4 - G#4 - A4 - B4 - E4 - |
           A4 - C5 - E5 - A5 - G5 - E5 - C5 - D5 - | E5 - - - G#4 - B4 - A4 - - - - - . .`,
    roots: 'A2 F2 D2 E2 C2 F2 A2 E2',
    bassStyle: 'pulse',
    drums: 'k . h k s . h . k . h k s . h s',
    loop: true,
  },
  // Stormy cave: swaying like a ship in a swell (mood of "A Sinking Ship").
  level2: {
    bpm: 96,
    leadWave: 0.5,
    lead: `D5 - - F5 - - A5 - - G5 - - F5 - E5 - | D5 - - - - - A4 - - C5 - - D5 - - - |
           Bb4 - - D5 - - F5 - - E5 - - D5 - C5 - | A4 - - - - - - - . . . . . . . . |
           F5 - - E5 - - D5 - - C5 - - A4 - - - | Bb4 - - A4 - - G4 - - F4 - - E4 - - - |
           D4 - - F4 - - A4 - - D5 - - C#5 - - - | D5 - - - - - - - . . . . . . . .`,
    roots: 'D2 D2 Bb1 A1 F2 G2 D2 A1',
    bassStyle: 'arp',
    drums: 'k . . h . . s . . h . . k . h .',
    loop: true,
  },
  // Dead forest: slow, ominous, phrygian (mood of "The End is Nigh").
  level3: {
    bpm: 84,
    leadWave: 'triangle',
    lead: `E5 - - - F5 - - - E5 - - - . . . . | B4 - - - C5 - - - B4 - A4 - G4 - - - |
           E5 - - - F5 - - - G5 - - - F5 - E5 - | F5 - - - E5 - - - - - - - . . . . |
           . . . . B4 - C5 - D5 - - - C5 - B4 - | A4 - - - G4 - - - F4 - - - E4 - - - |
           E4 - F4 - G4 - B4 - C5 - B4 - A4 - G4 - | F4 - - - - - - - E4 - - - - - - -`,
    roots: 'E2 E2 C2 B1 A1 F2 C2 E2',
    bassStyle: 'drone',
    drums: 'k . . . . . . . s . . . . . h .',
    loop: true,
  },
  // Snowy mountain: glittering, slightly off-kilter (mood of "Anomaly").
  level4: {
    bpm: 112,
    leadWave: 'triangle',
    lead: `F#5 . C#6 . A5 . F#5 . E5 . A5 . C#6 . B5 . | D5 . F#5 . A5 . D6 . C#6 . A5 . F#5 . E5 . |
           F#5 . C#6 . A5 . F#5 . E5 . A5 . C#6 . E6 . | D6 - - - C#6 - - - B5 - - - A5 - - - |
           B5 . F#5 . D5 . F#5 . B5 . D6 . C#6 . B5 . | A5 . E5 . C#5 . E5 . A5 . C#6 . B5 . A5 . |
           G5 - - - F#5 - - - E5 - - - D5 - - - | C#5 - - - - - - - . . . . . . . .`,
    roots: 'F#2 D2 F#2 E2 B1 A1 G2 C#2',
    bassStyle: 'arp',
    drums: 'k . h h . . s h . h k . . h s .',
    loop: true,
  },
  // Volcano: fast and furious (mood of "Howling Hell").
  level5: {
    bpm: 160,
    leadWave: 0.25,
    lead: `E5 E5 . E5 G5 . E5 . D5 . E5 . B4 - - - | E5 E5 . E5 G5 . A5 . B5 . A5 . G5 - - - |
           C6 - B5 - A5 - G5 - A5 - G5 - F#5 - E5 - | D#5 - - - F#5 - - - E5 - - - - - - - |
           B5 . B5 . A5 . G5 . F#5 . G5 . A5 . B5 . | C6 . C6 . B5 . A5 . G5 . A5 . B5 . G5 . |
           E5 - G5 - B5 - E6 - D6 - B5 - G5 - F#5 - | E5 - - - . . E5 . D#5 . E5 - - - . .`,
    roots: 'E2 E2 C2 B1 E2 C2 A1 B1',
    bassStyle: 'gallop',
    drums: 'k h s h k k s h k h s h k k s s',
    loop: true,
  },
  // Cloudy summit: epic, triumphant (mood of "Epic Triumph").
  summit: {
    bpm: 116,
    leadWave: 0.25,
    lead: `D5 - - - A4 - D5 - F#5 - - - E5 - D5 - | G5 - - - F#5 - E5 - F#5 - - - D5 - - - |
           B4 - - - C#5 - D5 - E5 - - - F#5 - G5 - | A5 - - - - - G5 - F#5 - E5 - D5 - - - |
           D6 - - - A5 - - - B5 - - - F#5 - - - | G5 - - - D5 - - - G5 - A5 - B5 - - - |
           A5 - - - F#5 - D5 - E5 - F#5 - G5 - E5 - | D5 - - - - - - - . . . . . . . .`,
    roots: 'D2 G2 B1 A1 D2 G2 A1 D2',
    bassStyle: 'octave',
    drums: 'k . h . s . h k k . h . s . s h',
    loop: true,
  },
  // Retep: the summit theme, faster and harder.
  boss: {
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
    bpm: 132,
    leadWave: 0.25,
    lead: `C5 . E5 . G5 . C6 - - - G5 . C6 - - - | D6 - - - E6 - - - C6 - - - - - - - | . . . . . . . . . . . . . . . .`,
    roots: 'C2 G2 C2',
    bassStyle: 'octave',
    drums: 'k . . . s . . . k . k . s s s s',
    loop: false,
  },
  defeat: {
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
