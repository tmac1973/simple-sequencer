# Sounds considered and excluded

Only CC0 and CC-BY sounds can be bundled. These were considered during planning and left out:

| Source | Why it's excluded |
|---|---|
| 99Sounds packs | Their license forbids redistributing the audio files, even for free. |
| Bedroom Producers Blog (Cassette 808 / 909 etc.) | Pack terms forbid redistribution. |
| tidal-drum-machines, Dirt-Samples | No license; sampled from commercial hardware / unknown sources. |
| Hydrogen TR808EmulationKit | GPL, not CC0/CC-BY. |
| @fluid-music/tr-909, oramics/sampled | Unclear provenance. |
| Freesound "bdu" TR606 set (incl. Sonic Pi `hat_bdu`) | Re-uploaded from another sample set; uploader may not be the author. |
| Sonic Pi `loop_amen`, `loop_amen_full`, `loop_breakbeat` | Almost certainly sampled from records. |
| Sonic Pi `tabla_*`, `bass_hit_c`, `misc_cineboom` | Original source links are gone, so the license can't be re-checked. |
| f-r-a-g-i-l-e "Killer Queen", "Peggy", "Vintage" chops | Taken from copyrighted recordings. |

## Freesound packs (optional, need a token)

The plan's Freesound packs (menegass, Uberproduktion, oceansonmars, AKUSTIKA, waveplaySFX,
f-r-a-g-i-l-e) are all CC0 but Freesound requires an API token to download. The build
script supports entries with a `freesoundId` when `FREESOUND_TOKEN` is set; the shipped
library uses the Sonic Pi, VCSL and Salamander sources, which download without a token.
