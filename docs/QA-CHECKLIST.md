# Manual QA checklist (v1)

Run in the latest **Chrome**, **Firefox** and **Safari** on a desktop. Automated coverage is noted
in brackets. Boxes marked ✅ were verified automatically on this build; ☐ need a human (mostly
"does it sound right").

| | Check | Chrome | Firefox | Safari |
|---|---|---|---|---|
| 1 | Open the app → Lo-fi template appears with the "Press Space" tip; change a kick step and hear it within 2 minutes [smoke.spec] | ✅ ☐ listen | ✅ ☐ listen | ☐ |
| 2 | An 8-track × 16-bar song plays for 5 minutes with no timing glitches or drift | ☐ | ☐ | ☐ |
| 3 | Stress song (open `/?debug`, then run `__ss.loadStress()` in the console): plays with no dropouts [perf.spec: 0 long tasks, no interaction > 16 ms] | ✅ ☐ listen | ☐ | ☐ |
| 4 | Synth notes stay in key when the key/scale changes [synth.spec, scheduler tests] | ✅ ☐ listen | ✅ ☐ listen | ☐ |
| 5 | All 10 synth presets sound distinct; Tone / Punch / Space / Length are clearly audible | ☐ | ☐ | ☐ |
| 6 | Import a WAV / MP3 / FLAC (and OGG in Chrome/Firefox); it survives a reload [import.spec] | ✅ | ✅ | ☐ |
| 7 | Record from the microphone, save to My Sounds, use it on a track [record.spec, fake mic] | ✅ ☐ real mic | ☐ | ☐ |
| 8 | Sample editor: trim, reverse, tune ±12, loop + long melodic note, fade, normalize all audible [sampleVoice tests] | ✅ ☐ listen | ☐ | ☐ |
| 9 | Each of the 8 effects is audible at its defaults; reorder changes the sound; bypass is click-free [trackGraph.audio tests, effects.spec] | ✅ ☐ listen | ✅ | ☐ |
| 10 | Swing, velocity, 1–4 bar patterns and triplets are heard in playback **and** export | ☐ | ☐ | ☐ |
| 11 | Automation: a filter sweep is smooth (no zipper noise); a volume step is exact; it's in the export too [automation tests] | ✅ ☐ listen | ✅ | ☐ |
| 12 | Close the browser mid-edit and reopen → nothing lost [persistence.spec] | ✅ | ✅ | ☐ |
| 13 | A song using a recorded sound saves as `.zip` and opens identically in another browser profile [songFile tests] | ✅ ☐ | ☐ | ☐ |
| 14 | WAV and MP3 exports play in a normal media player and match live playback; reverb tails aren't cut [export.spec, mp3 tests] | ✅ ☐ listen | ✅ ☐ listen | ☐ |
| 15 | Credits lists every CC-BY sound (Salamander piano) with attribution [CreditsModal test] | ✅ | ✅ | ☐ |
| 16 | Every control shows a plain-English tooltip; 💡 turns them off [tooltipCoverage test] | ✅ | ✅ | ☐ |
| 17 | The deployed GitHub Pages site works, including mic recording over HTTPS | ☐ | ☐ | ☐ |

WebKit (Safari's engine) runs in CI on Ubuntu; it can't launch on the Fedora dev machine because
Playwright's WebKit build needs Ubuntu libraries.
