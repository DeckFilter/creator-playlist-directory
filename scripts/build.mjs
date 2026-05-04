import fs from 'node:fs/promises'
import path from 'node:path'
import { enrichAssetPath, repoRoot, validateDirectory } from './lib.mjs'

const { errors, directory } = await validateDirectory()

if (errors.length > 0) {
  console.error(`Build blocked by ${errors.length} validation issue(s):`)
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

const { metadata, creators, featuredPlaylists, recentlyPlayedCurators } = directory
const publicDir = path.join(repoRoot, 'public')
const publicV1Dir = path.join(publicDir, 'v1')

function enrichCreator(creator) {
  const images = {}
  for (const [key, value] of Object.entries(creator.images || {})) {
    images[key] = enrichAssetPath(metadata.assetBaseUrl, value)
  }
  return { ...creator, images }
}

function enrichRecentlyPlayedCard(card) {
  return {
    ...card,
    image: enrichAssetPath(metadata.assetBaseUrl, card.image),
  }
}

async function writeJson(relativePath, value) {
  await fs.mkdir(path.dirname(path.join(repoRoot, relativePath)), { recursive: true })
  await fs.writeFile(path.join(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`)
}

const publicCreators = creators.map(enrichCreator)
const publicRecentlyPlayedCurators = recentlyPlayedCurators.map(enrichRecentlyPlayedCard)
const basePayload = {
  schemaVersion: metadata.schemaVersion,
  publishedAt: metadata.publishedAt,
  revision: metadata.revision,
  assetBaseUrl: metadata.assetBaseUrl,
}
const manifest = {
  ...basePayload,
  creators: publicCreators,
  featuredPlaylists,
  recentlyPlayedCurators: publicRecentlyPlayedCurators,
}

await fs.rm(publicDir, { recursive: true, force: true })
await fs.mkdir(publicV1Dir, { recursive: true })
await fs.cp(path.join(repoRoot, 'assets'), path.join(publicDir, 'assets'), { recursive: true })

await writeJson('public/v1/manifest.json', manifest)
await writeJson('public/v1/creators.json', { ...basePayload, creators: publicCreators })
await writeJson('public/v1/featured-playlists.json', { ...basePayload, featuredPlaylists })
await writeJson('public/v1/recently-played-curators.json', {
  ...basePayload,
  recentlyPlayedCurators: publicRecentlyPlayedCurators,
})

await fs.writeFile(
  path.join(publicDir, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Creator & Playlist Directory</title>
  </head>
  <body>
    <main>
      <h1>Creator & Playlist Directory</h1>
      <p>Shared public data for DeckFilter and DeckSettings.</p>
      <ul>
        <li><a href="./v1/manifest.json">v1 manifest</a></li>
        <li><a href="./v1/creators.json">v1 creators</a></li>
        <li><a href="./v1/featured-playlists.json">v1 featured playlists</a></li>
        <li><a href="./v1/recently-played-curators.json">v1 recently played curators</a></li>
      </ul>
    </main>
  </body>
</html>
`
)

console.log(`Built public v1 directory: ${publicCreators.length} creators, ${featuredPlaylists.length} playlists, ${publicRecentlyPlayedCurators.length} recently played curator cards.`)

