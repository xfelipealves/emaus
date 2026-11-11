# Documentation media

[← Project overview](../../README.md)

Captured on 11 November 2026 from Emaús running locally at a 1440 × 1050 desktop viewport, using the current session’s embedded Orca browser.

## Data provenance

The screenshots use a separate disposable SQLite database created for documentation. The seed ran from an isolated directory without `data/roster.json`: all displayed community member records and attendance are generated. Ministry names, the church label, and event themes come from the repository’s demo seed and are inspired by a real church. The demo account names also come from that seed. No production database was connected for these captures.

The local environment did not have a usable LLM provider key, so there are no fabricated assistant responses or claimed live-model results in this gallery. The assistant’s documented capabilities are traced to the source code.

## Assets

| Asset | Content |
| --- | --- |
| `dashboard.png` | Community metrics, attendance chart, events, care priorities, visitors, birthdays. |
| `people.png` | Unfiltered people directory. |
| `people-search.png` | Directory filtered to “Alice”. |
| `person-profile.png` | The generated Alice Rocha profile, family, notes, and follow-ups. |
| `attendance.png` | The same profile’s attendance tab. |
| `people-workflow.gif` | Directory → search → profile → attendance. |
| `product-tour.gif` | Dashboard → directory → profile → attendance. |

GIFs are looping walkthroughs assembled from real screenshots, with each view held for 2.5 seconds. They are not continuous screen recordings or timing benchmarks. Each animation is scaled to 1100 pixels wide and uses an optimized palette to keep repository assets small. Static full-resolution PNGs remain available alongside them.

## Reproduce

1. Use a fresh disposable database and follow the local setup in the README. Do not include a roster export or real people.
2. Sign in as the seeded local administrator and use a consistent desktop viewport.
3. Capture the dashboard, people directory, a search for Alice, the generated profile, and its attendance tab. Capture through the workspace’s authorized browser.
4. Normalize the captures to a common canvas size (these GIFs use 1100 × 804), then create an FFmpeg concat list of the PNGs with `duration 2.5` after each entry, repeating the final file at the end.
5. Encode a palette-optimized looping GIF. For example:

```bash
ffmpeg -f concat -safe 0 -i frames.txt -filter_complex \
  "fps=2,scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" \
  -loop 0 walkthrough.gif
```

Review every frame for personal data before publishing new captures. Browser development indicators can appear in these development-server captures.
