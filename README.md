# Creator & Playlist Directory

Shared public data for DeckFilter and DeckSettings creator profiles, featured playlists, recently played curator cards, and creator-facing images.

## Public Files

- `https://deckfilter.github.io/creator-playlist-directory/v1/manifest.json`
- `https://deckfilter.github.io/creator-playlist-directory/v1/creators.json`
- `https://deckfilter.github.io/creator-playlist-directory/v1/featured-playlists.json`
- `https://deckfilter.github.io/creator-playlist-directory/v1/recently-played-curators.json`

## Source Layout

- `data/v1/creators/{creatorId}.json`
- `data/v1/playlists/{playlistId}.json`
- `data/v1/recently-played-curators.json`
- `assets/creators/{creatorId}/`
- `schemas/v1/`

## Commands

```bash
npm run validate
npm run build
```

`npm run build` validates source data, copies public assets, and generates the `public/v1/` JSON files used by GitHub Pages.

## Rights Notice

Creator-submitted profile text, links, playlist text, and images are included for DeckFilter and DeckSettings directory use only. Do not reuse creator assets outside this directory, DeckFilter, DeckSettings, or related official project pages without verifying rights and consent.

