# Creator & Playlist Directory

Shared public data for DeckFilter and DeckSettings creator profiles, featured playlists, recently played curator cards, and creator-facing images.

## Status

This repository is an early work-in-progress draft. The current data model and generated JSON are experimental and may change while DeckFilter and DeckSettings integration is being designed.

The public files are useful for previewing the intended directory shape, but the apps do not consume this repository yet. Treat the current content as first-pass directory data, not a finalized public API or creator website.

## Creator Program

- Public website: https://deckfilter.app/creator-program/
- Submission form: https://docs.google.com/forms/d/e/1FAIpQLSc31vv5ozbtrlByt2CWQhYHm9-ziwToQkat-BZPOxoL_Jn6ow/viewform

Use the public website for creator-facing context. Use the form for new creator playlist submissions; accepted entries are reviewed and normalized into this repository before publishing.

## Public Files

- `https://deckfilter.github.io/creator-playlist-directory/v1/manifest.json`
- `https://deckfilter.github.io/creator-playlist-directory/v1/creators.json`
- `https://deckfilter.github.io/creator-playlist-directory/v1/featured-playlists.json`
- `https://deckfilter.github.io/creator-playlist-directory/v1/recently-played-curators.json`

## Source Layout

- `data/creators/{creatorId}.json`
- `data/playlists/{playlistId}.json`
- `data/recently-played-curators.json`
- `assets/creators/{creatorId}/`
- `schemas/`

## Commands

```bash
npm run validate
npm run build
```

`npm run build` validates source data, copies public assets, and generates the `public/v1/` JSON files used by GitHub Pages.

## Rights Notice

Creator-submitted profile text, links, playlist text, and images are included for DeckFilter and DeckSettings directory use only. Do not reuse creator assets outside this directory, DeckFilter, DeckSettings, or related official project pages without verifying rights and consent.
