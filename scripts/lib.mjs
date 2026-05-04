import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const products = new Set(['deckfilter', 'decksettings'])
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const assetPattern = /^assets\/creators\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/

export async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  return JSON.parse(raw)
}

async function listJsonFiles(relativeDir) {
  const entries = await fs.readdir(path.join(repoRoot, relativeDir), { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(relativeDir, entry.name))
    .sort()
}

export async function loadDirectory() {
  const metadata = await readJson('data/metadata.json')
  const creators = await Promise.all((await listJsonFiles('data/creators')).map(readJson))
  const featuredPlaylists = await Promise.all((await listJsonFiles('data/playlists')).map(readJson))

  return {
    metadata,
    creators,
    featuredPlaylists,
  }
}

function fail(errors, message) {
  errors.push(message)
}

function validateId(errors, value, label) {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    fail(errors, `${label} must be lowercase kebab-case`)
  }
}

function validateStatus(errors, value, label) {
  if (!['active', 'paused'].includes(value)) {
    fail(errors, `${label} status must be active or paused`)
  }
}

function validateString(errors, value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(errors, `${label} must be a non-empty string`)
    return
  }

  if (value.length > maxLength) {
    fail(errors, `${label} must be ${maxLength} characters or less`)
  }
}

function validateUrl(errors, value, label) {
  if (typeof value !== 'string') {
    fail(errors, `${label} must be a string URL`)
    return
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      fail(errors, `${label} must use https`)
    }
  } catch {
    fail(errors, `${label} must be a valid URL`)
  }
}

async function validateAsset(errors, value, label) {
  if (typeof value !== 'string' || !assetPattern.test(value)) {
    fail(errors, `${label} must be a repo-relative creator asset path`)
    return
  }

  try {
    await fs.access(path.join(repoRoot, value))
  } catch {
    fail(errors, `${label} points to a missing file: ${value}`)
  }
}

async function validateAbsent(errors, relativePath, label) {
  try {
    await fs.access(path.join(repoRoot, relativePath))
    fail(errors, `${label} must not exist in the public directory repo`)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      fail(errors, `${label} could not be checked: ${error.message}`)
    }
  }
}

function validateProducts(errors, itemProducts, productSort, label) {
  if (!Array.isArray(itemProducts) || itemProducts.length === 0) {
    fail(errors, `${label} products must be a non-empty array`)
    return
  }

  const seen = new Set()
  for (const product of itemProducts) {
    if (!products.has(product)) {
      fail(errors, `${label} has unknown product: ${product}`)
    }
    if (seen.has(product)) {
      fail(errors, `${label} repeats product: ${product}`)
    }
    seen.add(product)
    if (productSort && !Number.isFinite(productSort[product])) {
      fail(errors, `${label} productSort missing numeric value for ${product}`)
    }
  }
}

function validateFilenameId(errors, relativeDir, id, suffix, label) {
  const expectedPath = path.join(repoRoot, relativeDir, `${id}.json`)
  return fs.access(expectedPath).catch(() => {
    fail(errors, `${label} id does not match filename: expected ${id}${suffix}`)
  })
}

export async function validateDirectory() {
  const errors = []
  const directory = await loadDirectory()
  const { metadata, creators, featuredPlaylists } = directory
  const expectedCounts = await readJson('scripts/expected-counts.json')

  if (metadata.schemaVersion !== '1.0.0') fail(errors, 'metadata.schemaVersion must be 1.0.0')
  await validateAbsent(errors, 'data/recently-played-curators.json', 'DeckFilter-only recently played curator source')
  validateUrl(errors, metadata.assetBaseUrl, 'metadata.assetBaseUrl')
  if (Number.isNaN(Date.parse(metadata.publishedAt))) fail(errors, 'metadata.publishedAt must be a valid date-time')
  validateString(errors, metadata.revision, 'metadata.revision', 80)

  const creatorIds = new Set()
  for (const creator of creators) {
    validateId(errors, creator.creatorId, `creator ${creator.creatorId || '<missing>'}`)
    await validateFilenameId(errors, 'data/creators', creator.creatorId, '.json', `creator ${creator.creatorId}`)
    validateStatus(errors, creator.status, `creator ${creator.creatorId}`)
    validateString(errors, creator.displayName, `creator ${creator.creatorId} displayName`, 80)
    validateString(errors, creator.description, `creator ${creator.creatorId} description`, 280)
    validateProducts(errors, creator.products, null, `creator ${creator.creatorId}`)

    if (creatorIds.has(creator.creatorId)) fail(errors, `duplicate creatorId: ${creator.creatorId}`)
    creatorIds.add(creator.creatorId)

    if (Object.prototype.hasOwnProperty.call(creator, 'steamId')) {
      fail(errors, `creator ${creator.creatorId} must not publish steamId`)
    }

    for (const [key, url] of Object.entries(creator.links || {})) {
      validateUrl(errors, url, `creator ${creator.creatorId} links.${key}`)
    }

    for (const [key, asset] of Object.entries(creator.images || {})) {
      await validateAsset(errors, asset, `creator ${creator.creatorId} images.${key}`)
      if (!asset.startsWith(`assets/creators/${creator.creatorId}/`)) {
        fail(errors, `creator ${creator.creatorId} images.${key} must live under its creator asset directory`)
      }
    }

    for (const [product, override] of Object.entries(creator.productOverrides || {})) {
      if (!products.has(product)) fail(errors, `creator ${creator.creatorId} has unknown product override ${product}`)
      if (override.displayName) validateString(errors, override.displayName, `creator ${creator.creatorId} ${product} displayName`, 80)
      if (override.description) validateString(errors, override.description, `creator ${creator.creatorId} ${product} description`, 280)
    }
  }

  const playlistIds = new Set()
  for (const playlist of featuredPlaylists) {
    validateId(errors, playlist.playlistId, `playlist ${playlist.playlistId || '<missing>'}`)
    await validateFilenameId(errors, 'data/playlists', playlist.playlistId, '.json', `playlist ${playlist.playlistId}`)
    validateStatus(errors, playlist.status, `playlist ${playlist.playlistId}`)
    validateString(errors, playlist.title, `playlist ${playlist.playlistId} title`, 80)
    validateString(errors, playlist.description, `playlist ${playlist.playlistId} description`, 280)
    validateProducts(errors, playlist.products, playlist.productSort, `playlist ${playlist.playlistId}`)

    if (playlistIds.has(playlist.playlistId)) fail(errors, `duplicate playlistId: ${playlist.playlistId}`)
    playlistIds.add(playlist.playlistId)

    if (playlist.creatorId && !creatorIds.has(playlist.creatorId)) {
      fail(errors, `playlist ${playlist.playlistId} references missing creator ${playlist.creatorId}`)
    }

    if (!Array.isArray(playlist.appIds) || playlist.appIds.length === 0) {
      fail(errors, `playlist ${playlist.playlistId} must include appIds`)
    } else {
      const seenAppIds = new Set()
      for (const appId of playlist.appIds) {
        if (!Number.isInteger(appId) || appId <= 0) {
          fail(errors, `playlist ${playlist.playlistId} has invalid appId: ${appId}`)
        }
        if (seenAppIds.has(appId)) {
          fail(errors, `playlist ${playlist.playlistId} repeats appId: ${appId}`)
        }
        seenAppIds.add(appId)
      }
    }
  }

  const activeCreators = creators.filter((creator) => creator.status === 'active').length
  const activePlaylists = featuredPlaylists.filter((playlist) => playlist.status === 'active').length

  if (creators.length !== expectedCounts.creators.total) fail(errors, `expected ${expectedCounts.creators.total} total creators, found ${creators.length}`)
  if (activeCreators !== expectedCounts.creators.active) fail(errors, `expected ${expectedCounts.creators.active} active creators, found ${activeCreators}`)
  if (featuredPlaylists.length !== expectedCounts.featuredPlaylists.total) fail(errors, `expected ${expectedCounts.featuredPlaylists.total} total playlists, found ${featuredPlaylists.length}`)
  if (activePlaylists !== expectedCounts.featuredPlaylists.active) fail(errors, `expected ${expectedCounts.featuredPlaylists.active} active playlists, found ${activePlaylists}`)

  return { errors, directory }
}

export async function validatePublicOutput() {
  const errors = []
  const manifestPath = path.join(repoRoot, 'public/v1/manifest.json')

  try {
    await fs.access(manifestPath)
  } catch {
    return errors
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  const expectedCounts = await readJson('scripts/expected-counts.json')

  if (manifest.schemaVersion !== '1.0.0') fail(errors, 'public manifest schemaVersion must be 1.0.0')
  if (Number.isNaN(Date.parse(manifest.publishedAt))) fail(errors, 'public manifest publishedAt must be a valid date-time')
  validateString(errors, manifest.revision, 'public manifest revision', 80)
  await validateAbsent(errors, 'public/v1/recently-played-curators.json', 'public recently played curator output')
  validateUrl(errors, manifest.assetBaseUrl, 'public manifest assetBaseUrl')

  if (!Array.isArray(manifest.creators)) fail(errors, 'public manifest creators must be an array')
  if (!Array.isArray(manifest.featuredPlaylists)) fail(errors, 'public manifest featuredPlaylists must be an array')
  if (Object.prototype.hasOwnProperty.call(manifest, 'recentlyPlayedCurators')) {
    fail(errors, 'public manifest must not publish recentlyPlayedCurators')
  }

  if (Array.isArray(manifest.creators) && manifest.creators.length !== expectedCounts.creators.total) {
    fail(errors, `public manifest expected ${expectedCounts.creators.total} creators, found ${manifest.creators.length}`)
  }

  if (Array.isArray(manifest.featuredPlaylists) && manifest.featuredPlaylists.length !== expectedCounts.featuredPlaylists.total) {
    fail(errors, `public manifest expected ${expectedCounts.featuredPlaylists.total} playlists, found ${manifest.featuredPlaylists.length}`)
  }

  const publicAssetChecks = []

  for (const creator of manifest.creators || []) {
    if (Object.prototype.hasOwnProperty.call(creator, 'steamId')) {
      fail(errors, `public creator ${creator.creatorId} must not publish steamId`)
    }

    for (const [key, asset] of Object.entries(creator.images || {})) {
      publicAssetChecks.push(validatePublicAsset(errors, asset, `public creator ${creator.creatorId} images.${key}`, manifest.assetBaseUrl))
    }
  }

  await Promise.all(publicAssetChecks)

  return errors
}

async function validatePublicAsset(errors, asset, label, assetBaseUrl) {
  if (!asset || typeof asset.path !== 'string' || typeof asset.url !== 'string') {
    fail(errors, `${label} must include path and url`)
    return
  }

  if (asset.url !== `${assetBaseUrl}/${asset.path}`) {
    fail(errors, `${label} url must match assetBaseUrl plus path`)
  }

  try {
    await fs.access(path.join(repoRoot, 'public', asset.path.replace(/^assets\//, 'assets/')))
  } catch {
    fail(errors, `${label} public file is missing: ${asset.path}`)
  }
}

export function enrichAssetPath(assetBaseUrl, value) {
  return {
    path: value,
    url: `${assetBaseUrl}/${value}`,
  }
}
