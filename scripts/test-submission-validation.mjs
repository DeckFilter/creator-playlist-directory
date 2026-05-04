import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSubmissionIssue, writeSubmissionOutputs } from './validate-submission-issue.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(scriptDir, 'fixtures/submission-issues')
const pwnedPath = '/tmp/creator-database-submission-validation-pwned'

const cases = [
  { file: 'valid.md', status: 'valid', privacyWarning: false },
  { file: 'game-names-only.md', status: 'needs-review', privacyWarning: false },
  { file: 'missing-permission.md', status: 'invalid', privacyWarning: false },
  { file: 'privacy-warning.md', status: 'invalid', privacyWarning: true },
  { file: 'duplicate.md', status: 'needs-review', privacyWarning: false },
  { file: 'overlong.md', status: 'invalid', privacyWarning: false },
  { file: 'malicious-text.md', status: 'valid', privacyWarning: false, assertNoExecution: true },
]

await fs.rm(pwnedPath, { force: true })

for (const testCase of cases) {
  const fixturePath = path.join(fixturesDir, testCase.file)
  const body = await fs.readFile(fixturePath, 'utf8')
  const result = await validateSubmissionIssue({ body, issueTitle: testCase.file })

  assert.equal(result.status, testCase.status, `${testCase.file} status`)
  assert.equal(result.privacyWarning, testCase.privacyWarning, `${testCase.file} privacyWarning`)

  if (testCase.assertNoExecution) {
    await assert.rejects(fs.access(pwnedPath), undefined, `${testCase.file} must not execute command-looking text`)
  }
}

const outputDir = path.join('/tmp', `creator-database-submission-validation-${process.pid}`)
const validBody = await fs.readFile(path.join(fixturesDir, 'valid.md'), 'utf8')
const validResult = await validateSubmissionIssue({ body: validBody, issueTitle: 'valid.md' })
await writeSubmissionOutputs(validResult, outputDir)

const resultJson = JSON.parse(await fs.readFile(path.join(outputDir, 'submission-result.json'), 'utf8'))
const reportMarkdown = await fs.readFile(path.join(outputDir, 'submission-report.md'), 'utf8')
assert.equal(resultJson.status, 'valid')
assert.match(reportMarkdown, /creator-database-submission-validation/)
await fs.rm(outputDir, { recursive: true, force: true })

console.log(`Submission validation fixtures passed: ${cases.length} cases.`)
