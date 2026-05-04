# Creator Database Submissions

Use a creator-friendly private form or a public GitHub Issue Form for submissions, then publish accepted entries through reviewed GitHub pull requests. Do not publish directly from form responses or issue bodies.

## Public Links

- Creator Program website: https://deckfilter.app/creator-program/
- Private Creator Playlist Submission form: https://docs.google.com/forms/d/e/1FAIpQLSc31vv5ozbtrlByt2CWQhYHm9-ziwToQkat-BZPOxoL_Jn6ow/viewform
- Public GitHub Creator Playlist Submission form: https://github.com/DeckFilter/creator-database/issues/new/choose

## Intake Paths

- Use the Google Form when a creator wants the lowest-friction path or needs to share private contact details.
- Use the GitHub Issue Form when a creator is comfortable posting a public, structured submission.
- GitHub issues must not include private contact details, real names, Steam profile URLs, Steam IDs, phone numbers, or private messaging contacts.
- GitHub issue validation is advisory. A human review is still required before adding data or assets to the repository.

## Review Workflow

1. Review the Google Form response or GitHub issue for fit, consent, and completeness.
2. For GitHub issues, wait for the automated validation comment and labels.
3. If the issue is invalid, ask the submitter to edit the public issue or use the private Google Form.
4. Normalize the creator into `data/creators/{creatorId}.json`.
5. Normalize the playlist into `data/playlists/{playlistId}.json`.
6. Add creator images under `assets/creators/{creatorId}/`.
7. Run `npm run validate && npm run build`.
8. Open a pull request for review.
9. Merge only after validation passes.

## GitHub Issue Validation

GitHub submissions are labeled `submission:creator-playlist` by the issue template. The `Validate submission issue` workflow runs on opened, edited, and reopened issues with that label.

The workflow posts or updates one sticky validation comment and applies one status label:

- `submission:valid`: automated checks found no blockers.
- `submission:needs-review`: the submission is parseable but needs manual cleanup, duplicate review, game resolution, or asset review.
- `submission:invalid`: blocking issues must be fixed before review can continue.
- `privacy-warning`: the issue appears to include private contact details, Steam profile URLs, or Steam IDs.

Run local fixture checks with:

```bash
npm run validate:submission-fixtures
```

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
- Public GitHub submissions do not include private contact details, Steam profile URLs, or Steam IDs.

## Data Rules

- Use stable lowercase kebab-case IDs.
- Never key identity from display names.
- Keep `schemaVersion` at `1.0.0` for v1 entries.
- Additive fields are allowed; breaking changes require a new `v2` contract.
- Use `status: "paused"` for entries retained for future reuse but not currently shown by apps.
- Do not publish DeckFilter-only recently played curator data or Steam IDs.
