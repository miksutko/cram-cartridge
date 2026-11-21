# Music slots

Drop audio files here named by slot (`.mp3`, `.ogg` or `.wav`), e.g. `level2.mp3`.
They are picked up automatically (no code changes) and played through a retro
filter (bit-crush, sample-rate reduction, tiny-speaker band-pass) so every track
sounds like it comes out of the handheld. Music starts after the first key press or
click (browsers block autoplay), loops (except victory/defeat), and crossfades.

| File | Plays on | Team's chosen track |
|---|---|---|
| `title.*` | start screen, name entry, settings, manual; also the shelf and map if those slots are empty | "The Throne is Mine" by Ruiqi Zhao |
| `shelf.*` | cartridge shelf | (falls back to title) |
| `map.*` | the mountain map | (falls back to title) |
| `level1.*` | Underground | "At All Costs" by Dream Cave |
| `level2.*` | Stormy cave | "A Sinking Ship" by Wendel Scherer |
| `level3.*` | Dead forest | "The End is Nigh" by Max Anson |
| `level4.*` | Snowy mountain | "Anomaly" by Christoffer Moe Ditlevsen |
| `level5.*` | Volcano | "Howling Hell" by Jon Bjork |
| `summit.*` | Cloudy summit, and the Retep fight if `boss.*` is missing | "Epic Triumph" by Elm Lake |
| `boss.*` | the Retep fight | (falls back to summit) |
| `victory.*`, `defeat.*` | results (play once) | (victory falls back to summit) |

Rule: only add a track if the team's licence allows it in this project (or it is CC0 /
our own), and credit every track in the main README.
