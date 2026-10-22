# CZ/SK Grayjay plugins

Three Grayjay sources for Czech/Slovak content. Everything runs inside Grayjay —
no local server, no extra software.

| Plugin | Source |
|---|---|
| SkTOnline | online.sktorrent.eu |
| Bombuj.si | bombuj.si / serialy.bombuj.si |
| Prehraj.to | prehraj.to |

## Install on Windows (or any Grayjay desktop)

1. Install **Grayjay** from the official site: <https://grayjay.app>
   (Desktop build → Windows installer.)
2. Open Grayjay → **Sources** (plugins) → **Add source / Install from URL**.
3. Paste one URL per plugin and confirm the "unsigned plugin" prompt:

```
https://polybreaker1.github.io/czsk-grayjay-plugins/sktorrent/config.json
https://polybreaker1.github.io/czsk-grayjay-plugins/bombuj/config.json
https://polybreaker1.github.io/czsk-grayjay-plugins/prehrajto/config.json
```

4. Use the search box in Grayjay; results from all three sources appear together.

## Notes

- No account, login or configuration is required for any of the three.
- Bombuj resolves **streamtape** and **mixdrop** players to direct MP4
  (most titles have at least one). Other players (voe, filemoon) are not
  resolved yet.
- SkTOnline plays h264 MP4 from online.sktorrent.eu.
- Prehraj.to plays direct MP4 from premiumcdn.

## Updating

Re-run step 2–3 with the same URL after a `version` bump in `config.json`;
Grayjay replaces the installed copy.
