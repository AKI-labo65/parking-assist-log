import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// This command only deploys the preview repository. Production is released by
// merging a reviewed PR into main in parking-assist-log.
const repository = 'AKI-labo65/parking-assist-log-preview'
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const previewUrl = 'https://aki-labo65.github.io/parking-assist-log-preview/'

function run(command, args, { cwd = projectRoot, capture = false, allowFailure = false, env = {} } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, stdio: capture ? 'pipe' : 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} failed (${result.status}): ${result.stderr || ''}`)
  return capture ? { ok: result.status === 0, text: (result.stdout || '').trim(), error: result.stderr } : result
}

if (run('git', ['status', '--porcelain'], { capture: true }).text) {
  throw new Error('Commit the tested source before deploying the preview so it can be promoted unchanged.')
}
const sourceCommit = run('git', ['rev-parse', 'HEAD'], { capture: true }).text
const sourceBranch = run('git', ['branch', '--show-current'], { capture: true }).text
run('npm', ['test'])

const workspace = mkdtempSync(join(tmpdir(), 'parking-assist-preview-'))
const output = join(workspace, 'site')
run('npm', ['run', 'build:preview', '--', '--outDir', output], { env: { VITE_BASE_PATH: '/parking-assist-log-preview/' } })
writeFileSync(join(output, '.nojekyll'), '')
const indexPath = join(output, 'index.html')
writeFileSync(indexPath, readFileSync(indexPath, 'utf8').replace('<title>精算機補助</title>', '<meta name="robots" content="noindex, nofollow" />\n    <title>精算機補助｜テスト版</title>'))
writeFileSync(join(output, 'deployment.json'), JSON.stringify({ environment: 'preview', sourceRepository: 'AKI-labo65/parking-assist-log', sourceCommit, sourceBranch, builtAt: new Date().toISOString() }, null, 2) + '\n')
const manifestPath = join(output, 'manifest.webmanifest')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
Object.assign(manifest, { name: '精算機補助 テスト版', short_name: '精算機補助 テスト', description: '本番とは保存データを分けた動作確認用アプリ' })
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
// Preview pages deliberately have no offline cache, so the URL always serves
// the latest reviewed build and never manages another app's Cache Storage.
if (existsSync(join(output, 'sw.js'))) rmSync(join(output, 'sw.js'))

const existing = run('gh', ['repo', 'view', repository, '--json', 'nameWithOwner'], { capture: true, allowFailure: true })
if (!existing.ok) {
  if (!existing.error?.includes('Could not resolve to a Repository')) throw new Error(existing.error || 'Unable to read preview repository')
  run('gh', ['repo', 'create', repository, '--public', '--description', '精算機補助のテスト環境。本番とは記録を分けたプレビュー専用サイト。'])
}
const checkout = join(workspace, 'checkout')
const refs = run('gh', ['api', `repos/${repository}/git/ref/heads/gh-pages`], { capture: true, allowFailure: true })
if (refs.ok) {
  run('gh', ['repo', 'clone', repository, checkout, '--', '--depth=1', '--branch', 'gh-pages'])
  for (const entry of readdirSync(checkout)) if (entry !== '.git') rmSync(join(checkout, entry), { recursive: true, force: true })
} else {
  if (!refs.error?.includes('404') && !refs.error?.includes('409')) throw new Error(refs.error || 'Unable to inspect preview branch')
  mkdirSync(checkout)
  run('git', ['init', '-b', 'gh-pages'], { cwd: checkout })
  run('git', ['remote', 'add', 'origin', `https://github.com/${repository}.git`], { cwd: checkout })
}
cpSync(output, checkout, { recursive: true })
run('git', ['add', '--all'], { cwd: checkout })
run('git', ['commit', '-m', `Preview ${sourceCommit.slice(0, 12)}`], { cwd: checkout })
run('git', ['push', '-u', 'origin', 'gh-pages'], { cwd: checkout })

const pages = run('gh', ['api', `repos/${repository}/pages`], { capture: true, allowFailure: true })
if (!pages.ok) {
  if (!pages.error?.includes('404')) throw new Error(pages.error || 'Unable to inspect preview Pages')
  run('gh', ['api', '--method', 'POST', `repos/${repository}/pages`, '-f', 'source[branch]=gh-pages', '-f', 'source[path]=/'], { capture: true })
} else if (JSON.parse(pages.text).source?.branch !== 'gh-pages') {
  throw new Error('Preview Pages uses an unexpected source branch; inspect its settings before retrying.')
}
console.log(`Preview publication requested: ${previewUrl}\nSource commit: ${sourceCommit}\nBuild directory: ${output}`)
