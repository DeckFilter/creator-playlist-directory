import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadDirectory } from './lib.mjs'

const marker = '<!-- creator-database-submission-validation -->'
const managedLabels = ['submission:valid', 'submission:needs-review', 'submission:invalid', 'privacy-warning']

const fields = {
  creatorName: 'Creator/channel name',
  creatorBio: 'Creator bio',
  creatorLinks: 'Creator public links',
  creatorImages: 'Creator image links',
  playlistTitle: 'Playlist title',
  playlistDescription: 'Playlist description',
  playlistGames: 'Playlist game list',
  permission: 'Permission confirmation',
  acknowledgement: 'Review acknowledgement',
}

const maxLengths = {
  creatorName: 80,
  creatorBio: 280,
  playlistTitle: 80,
  playlistDescription: 280,
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--event') args.eventPath = argv[++index]
    else if (arg === '--body-file') args.bodyFile = argv[++index]
    else if (arg === '--out-dir') args.outDir = argv[++index]
    else if (arg === '--help') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function printHelp() {
  console.log(`Usage: node scripts/validate-submission-issue.mjs [--event path] [--body-file path] [--out-dir path]

Validates a Creator Database GitHub issue-form submission and writes:
- submission-result.json
- submission-report.md`)
}

async function readSubmissionInput(args) {
  if (args.bodyFile) {
    return {
      body: await fs.readFile(args.bodyFile, 'utf8'),
      issueNumber: null,
      issueTitle: path.basename(args.bodyFile),
    }
  }

  const eventPath = args.eventPath || process.env.GITHUB_EVENT_PATH
  if (!eventPath) {
    throw new Error('Provide --event, --body-file, or GITHUB_EVENT_PATH')
  }

  const event = JSON.parse(await fs.readFile(eventPath, 'utf8'))
  return {
    body: event.issue?.body || '',
    issueNumber: event.issue?.number || null,
    issueTitle: event.issue?.title || '',
    author: event.issue?.user?.login || '',
  }
}

function normalizeResponse(value) {
  const normalized = String(value || '').replace(/\r\n/g, '\n').trim()
  return normalized === '_No response_' ? '' : normalized
}

function extractSections(body) {
  const sections = new Map()
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n')
  let currentLabel = null
  let currentLines = []

  function flush() {
    if (!currentLabel) return
    sections.set(currentLabel.toLowerCase(), normalizeResponse(currentLines.join('\n')))
  }

  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      flush()
      currentLabel = heading[1].trim()
      currentLines = []
    } else if (currentLabel) {
      currentLines.push(line)
    }
  }

  flush()
  return sections
}

function getField(sections, label) {
  return normalizeResponse(sections.get(label.toLowerCase()) || '')
}

function nonEmptyLines(value) {
  return normalizeResponse(value)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== '_No response_')
}

function isChecked(value) {
  return /-\s*\[[xX]\]\s+/.test(value)
}

function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toKebabId(value) {
  return normalizeComparableText(value).replace(/\s+/g, '-')
}

function extractUrls(value) {
  const matches = String(value || '').match(/https?:\/\/[^\s<>"'`)\]]+/gi) || []
  return matches.map((url) => url.replace(/[.,;:!?]+$/g, ''))
}

function normalizeUrl(value) {
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return String(value || '').trim().toLowerCase()
  }
}

function scanPrivacy(value, label, addBlocker) {
  const text = String(value || '')
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
    addBlocker(`${label} appears to include an email address. Use the private Google Form for contact details.`, true)
  }

  if (/steamcommunity\.com\/(?:id|profiles)\//i.test(text)) {
    addBlocker(`${label} appears to include a Steam profile URL. Steam profiles are not collected in public GitHub submissions.`, true)
  }

  if (/\b7656119\d{10}\b/.test(text)) {
    addBlocker(`${label} appears to include a SteamID64. Steam IDs are not published in this public repository.`, true)
  }

  if (/(?:phone|mobile|whatsapp|signal)\s*[:\-]?\s*\+?[0-9][0-9 ()-]{6,}/i.test(text)) {
    addBlocker(`${label} appears to include a private phone or messaging contact. Use the private Google Form for contact details.`, true)
  }
}

function validateTextLength(value, label, maxLength, addBlocker) {
  if (!value) {
    addBlocker(`${label} is required.`)
    return
  }

  if (value.length > maxLength) {
    addBlocker(`${label} must be ${maxLength} characters or less.`)
  }
}

function validateUrlField(value, label, addBlocker) {
  const lines = nonEmptyLines(value)
  const urls = []

  for (const line of lines) {
    const lineUrls = extractUrls(line)
    if (lineUrls.length === 0) {
      addBlocker(`${label} contains a line without a valid URL: "${safeInline(line)}".`)
      continue
    }

    for (const rawUrl of lineUrls) {
      try {
        const url = new URL(rawUrl)
        if (url.protocol !== 'https:') {
          addBlocker(`${label} must use HTTPS URLs only.`)
        }
        urls.push(url.toString())
      } catch {
        addBlocker(`${label} contains an invalid URL: "${safeInline(rawUrl)}".`)
      }
    }
  }

  return urls
}

function parseGameList(value, addBlocker, addWarning) {
  const lines = nonEmptyLines(value)
  const appIds = new Set()
  const unresolvedLines = []

  if (lines.length < 5 || lines.length > 20) {
    addBlocker('Playlist game list must include 5-20 non-empty game lines.')
  }

  for (const line of lines) {
    const lineIds = new Set()
    for (const match of line.matchAll(/store\.steampowered\.com\/app\/([0-9]{1,10})/gi)) {
      lineIds.add(Number(match[1]))
    }
    for (const match of line.matchAll(/(?:^|[-:#]\s*|app\s*id\D+|steam\s*app\s*id\D+)([0-9]{1,10})(?:\s|$)/gi)) {
      lineIds.add(Number(match[1]))
    }

    for (const appId of lineIds) {
      if (Number.isInteger(appId) && appId > 0) appIds.add(appId)
    }

    if (lineIds.size === 0) unresolvedLines.push(line)
  }

  if (appIds.size < 5) {
    addWarning('Fewer than 5 Steam app IDs or Steam Store URLs were detected. A reviewer must resolve game names manually.')
  }

  if (unresolvedLines.length > 0) {
    addWarning(`${unresolvedLines.length} game line(s) do not include a Steam app ID or Steam Store URL.`)
  }

  return {
    lines,
    appIds: [...appIds].sort((a, b) => a - b),
    unresolvedLines,
  }
}

function imageLinksNeedReview(urls) {
  return urls.some((rawUrl) => {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    const pathname = url.pathname.toLowerCase()
    if (/\.(jpe?g|png|webp)$/.test(pathname)) return false
    if (host.endsWith('ytimg.com')) return false
    return true
  })
}

function findDuplicateWarnings(directory, creatorName, creatorUrls) {
  const warnings = []
  const submittedName = normalizeComparableText(creatorName)
  const submittedId = toKebabId(creatorName)
  const existingUrls = new Map()

  for (const creator of directory.creators) {
    if (normalizeComparableText(creator.displayName) === submittedName || creator.creatorId === submittedId) {
      warnings.push(`Creator appears to duplicate existing creator "${creator.displayName}" (${creator.creatorId}).`)
    }

    for (const url of Object.values(creator.links || {})) {
      existingUrls.set(normalizeUrl(url), creator)
    }
  }

  for (const url of creatorUrls) {
    const existingCreator = existingUrls.get(normalizeUrl(url))
    if (existingCreator) {
      warnings.push(`Public link appears to duplicate existing creator "${existingCreator.displayName}" (${existingCreator.creatorId}).`)
    }
  }

  return [...new Set(warnings)]
}

function safeInline(value, maxLength = 120) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim()
  const clipped = compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact
  return clipped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '&#96;')
}

function formatList(items, emptyText) {
  if (items.length === 0) return `- ${emptyText}`
  return items.map((item) => `- ${item}`).join('\n')
}

function createReport(result) {
  const statusLabel = {
    valid: '[OK]',
    'needs-review': '[REVIEW]',
    invalid: '[INVALID]',
  }[result.status]

  return `${marker}
## ${statusLabel} Creator Database Submission Validation

**Status:** \`${result.status}\`

${result.status === 'valid' ? 'Automated validation found no blocking issues. Manual review is still required before publishing.' : ''}
${result.status === 'needs-review' ? 'The submission has no blocking issues, but a reviewer must resolve the warnings before publishing.' : ''}
${result.status === 'invalid' ? 'The submission has blocking issues that must be fixed before review can continue.' : ''}

### Summary

| Field | Value |
|---|---|
| Creator/channel | ${safeInline(result.summary.creatorName) || 'Missing'} |
| Playlist | ${safeInline(result.summary.playlistTitle) || 'Missing'} |
| Game lines | ${result.summary.gameLineCount} |
| Detected Steam app IDs | ${result.summary.appIdCount} |
| Public links | ${result.summary.publicLinkCount} |
| Image links | ${result.summary.imageLinkCount} |

### Blocking Issues

${formatList(result.blockers, 'None')}

### Needs Manual Review

${formatList(result.warnings, 'None')}

### Reviewer Checklist

- Confirm the submitter is authorized to represent the creator or channel.
- Confirm submitted text and public assets can be displayed in DeckFilter, DeckSettings, and official directory pages.
- Confirm links point to the claimed creator's public profiles.
- Confirm image rights before copying assets into the repository.
- Normalize accepted data manually into creator and playlist JSON.
- Run \`npm run validate && npm run build\` before merging the publishing PR.
`
}

export async function validateSubmissionIssue({ body, issueNumber = null, issueTitle = '', author = '' } = {}) {
  const directory = await loadDirectory()
  const sections = extractSections(body)
  const values = Object.fromEntries(Object.entries(fields).map(([key, label]) => [key, getField(sections, label)]))
  const blockers = []
  const warnings = []
  let privacyWarning = false

  function addBlocker(message, privacy = false) {
    blockers.push(message)
    if (privacy) privacyWarning = true
  }

  function addWarning(message) {
    warnings.push(message)
  }

  validateTextLength(values.creatorName, fields.creatorName, maxLengths.creatorName, addBlocker)
  validateTextLength(values.creatorBio, fields.creatorBio, maxLengths.creatorBio, addBlocker)
  validateTextLength(values.playlistTitle, fields.playlistTitle, maxLengths.playlistTitle, addBlocker)
  validateTextLength(values.playlistDescription, fields.playlistDescription, maxLengths.playlistDescription, addBlocker)

  for (const [key, label] of Object.entries(fields)) {
    scanPrivacy(values[key], label, addBlocker)
  }

  const creatorUrls = validateUrlField(values.creatorLinks, fields.creatorLinks, addBlocker)
  const imageUrls = validateUrlField(values.creatorImages, fields.creatorImages, addBlocker)

  if (imageUrls.length === 0) {
    addWarning('No creator image links were provided. A reviewer must source or request creator-facing images manually.')
  } else if (imageLinksNeedReview(imageUrls)) {
    addWarning('At least one creator image link is not a direct common image URL. A reviewer must confirm rights and download the final asset manually.')
  }

  if (!isChecked(values.permission)) {
    addBlocker('Permission confirmation must be checked.')
  }

  if (!isChecked(values.acknowledgement)) {
    addBlocker('Review acknowledgement must be checked.')
  }

  const gameList = parseGameList(values.playlistGames, addBlocker, addWarning)
  warnings.push(...findDuplicateWarnings(directory, values.creatorName, creatorUrls))

  const uniqueBlockers = [...new Set(blockers)]
  const uniqueWarnings = [...new Set(warnings)]
  const status = uniqueBlockers.length > 0 ? 'invalid' : uniqueWarnings.length > 0 ? 'needs-review' : 'valid'
  const statusLabel = `submission:${status}`

  return {
    status,
    privacyWarning,
    issueNumber,
    issueTitle,
    author,
    labels: {
      managed: managedLabels,
      status: statusLabel,
    },
    summary: {
      creatorName: values.creatorName,
      playlistTitle: values.playlistTitle,
      gameLineCount: gameList.lines.length,
      appIdCount: gameList.appIds.length,
      publicLinkCount: creatorUrls.length,
      imageLinkCount: imageUrls.length,
    },
    parsed: {
      creatorUrls,
      imageUrls,
      steamAppIds: gameList.appIds,
      unresolvedGameLines: gameList.unresolvedLines,
    },
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
  }
}

export async function writeSubmissionOutputs(result, outDir) {
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(path.join(outDir, 'submission-result.json'), `${JSON.stringify(result, null, 2)}\n`)
  await fs.writeFile(path.join(outDir, 'submission-report.md'), createReport(result))
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const input = await readSubmissionInput(args)
  const result = await validateSubmissionIssue(input)
  const outDir = args.outDir || process.cwd()
  await writeSubmissionOutputs(result, outDir)
  console.log(`Submission validation: ${result.status} (${result.blockers.length} blocker(s), ${result.warnings.length} warning(s))`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
