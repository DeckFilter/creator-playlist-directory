# Creator Database

Shared public data for DeckFilter and DeckSettings creator profiles, featured playlists, and creator-facing images.

## Status

This repository is an early work-in-progress draft. The current data model and generated JSON are experimental and may change while DeckFilter and DeckSettings integration is being designed.

The public files are useful for previewing the intended directory shape, but the apps do not consume this repository yet. Treat the current content as first-pass directory data, not a finalized public API or creator website.

DeckFilter-only recently played curator data and Steam IDs are intentionally not published in this public repository.

## Creator Program

- Public website: https://deckfilter.app/creator-program/
- Private submission form: https://docs.google.com/forms/d/e/1FAIpQLSc31vv5ozbtrlByt2CWQhYHm9-ziwToQkat-BZPOxoL_Jn6ow/viewform
- Public GitHub submission form: https://github.com/DeckFilter/creator-database/issues/new/choose

Use the public website for creator-facing context. Use the Google Form for creator-friendly submissions that include private contact details. Use the GitHub Issue Form only for public, structured submissions that should be validated in this repository.

Accepted entries are still reviewed manually and normalized into this Creator Database through pull requests before publishing.

## Public Files

- `https://deckfilter.github.io/creator-database/v1/manifest.json`
- `https://deckfilter.github.io/creator-database/v1/creators.json`
- `https://deckfilter.github.io/creator-database/v1/featured-playlists.json`

## Source Layout

- `data/creators/{creatorId}.json`
- `data/playlists/{playlistId}.json`
- `assets/creators/{creatorId}/`
- `schemas/`

## Commands

```bash
npm run validate
npm run validate:submission-fixtures
npm run build
```

`npm run build` validates source data, copies public assets, and generates the `public/v1/` JSON files used by GitHub Pages.

`npm run validate:submission-fixtures` checks the GitHub submission issue validator against local fixtures for valid, needs-review, invalid, privacy-warning, duplicate, overlong, and command-looking text scenarios.

## Rights Notice

Creator-submitted profile text, links, playlist text, and images are included for DeckFilter and DeckSettings directory use only. Do not reuse creator assets outside this directory, DeckFilter, DeckSettings, or related official project pages without verifying rights and consent.
