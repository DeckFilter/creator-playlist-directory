import { validateDirectory, validatePublicOutput } from './lib.mjs'

const { errors, directory } = await validateDirectory()
errors.push(...(await validatePublicOutput()))

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} issue(s):`)
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`Validation passed: ${directory.creators.length} creators, ${directory.featuredPlaylists.length} playlists.`)
