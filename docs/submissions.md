# Creator And Playlist Submissions

Use a creator-friendly form for submissions, then publish accepted entries through reviewed GitHub pull requests. Do not publish directly from form responses.

## Review Workflow

1. Review the form response for fit, consent, and completeness.
2. Normalize the creator into `data/creators/{creatorId}.json`.
3. Normalize the playlist into `data/playlists/{playlistId}.json`.
4. Add creator images under `assets/creators/{creatorId}/`.
5. Run `npm run validate` and `npm run build`.
6. Open a pull request for review.
7. Merge only after validation passes.

## Reviewer Checklist

- The submitter has permission to represent the creator or channel.
- Submitted text and images may be displayed in DeckFilter, DeckSettings, and official directory pages.
- Creator identity is not impersonating another channel or person.
- Links point to the claimed creator's public profiles.
- Images are public, appropriate, and not unrelated copyrighted artwork.
- Playlist title and description are concise.
- Steam app IDs are valid positive numbers.
- The creator or playlist is not a duplicate under another ID.
- Content does not include profanity, NSFW material, hate speech, harassment, or misleading claims.

## Data Rules

- Use stable lowercase kebab-case IDs.
- Never key identity from display names.
- Keep `schemaVersion` at `1.0.0` for v1 entries.
- Additive fields are allowed; breaking changes require a new `v2` contract.
- Use `status: "paused"` for entries retained for future reuse but not currently shown by apps.
