import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] ?? 'all'
assert.ok(['all', 'test', 'dist'].includes(mode), 'expected all, test or dist')
function run(command, args, cwd) { execFileSync(command, args, { cwd, stdio: 'inherit' }) }
function files(dir) {
 if (!existsSync(dir)) return []
 return readdirSync(dir, { withFileTypes: true }).filter(entry => entry.name !== '.DS_Store').flatMap(entry => entry.isDirectory()
   ? files(join(dir, entry.name)).map(path => entry.name + '/' + path) : [entry.name]).sort()
}
if (mode === 'all') run('pnpm', ['typecheck'], root)
const scratch = mkdtempSync(join(tmpdir(), 'dsh-check-'))
const candidate = join(scratch, 'candidate')
try {
 cpSync(root, candidate, { recursive: true, filter: path => {
   const top = relative(root, path).split('/')[0]
   return !relative(root, path).split('/').includes('.DS_Store') && !['.git', 'node_modules', '.build', '.agent-work', '.harness-contract', '.probe', 'lib', '.DS_Store'].includes(top)
 } })
 symlinkSync(join(root, 'node_modules'), join(candidate, 'node_modules'), 'dir')
 run(process.execPath, ['scripts/build-runtime.mjs'], candidate)
 if (mode !== 'dist') {
    run(process.execPath, ['--test', ...globSync('test/*.test.js', { cwd: candidate })], candidate)
 }
 if (mode !== 'test') {
   const expected = files(join(candidate, 'lib'))
   assert.deepEqual(files(join(root, 'lib')), expected, 'generated file set differs; run pnpm build:runtime')
   for (const file of expected) assert.deepEqual(readFileSync(join(root, 'lib', file)), readFileSync(join(candidate, 'lib', file)), `stale lib/${file}`)
   const pkg = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8'))
   for (const name of ['prepare', 'prepack', 'preinstall', 'install', 'postinstall', 'prepublish', 'build']) assert.ok(!pkg.scripts?.[name], `installation build hook: ${name}`)
   // Pack the actual candidate without suppressing lifecycle scripts.
   const report = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', scratch], { cwd: candidate, encoding: 'utf8' }))[0]
   const unpacked = join(scratch, 'packed')
   mkdirSync(unpacked)
   run('tar', ['-xzf', join(scratch, report.filename), '-C', unpacked, '--strip-components=1'], root)
   const packedFiles = files(unpacked)
   for (const file of expected) assert.ok(packedFiles.includes('lib/' + file), `not packed: lib/${file}`)
   for (const declared of pkg.files ?? []) {
     if (declared.includes('*')) continue
     const input = join(candidate, declared)
     assert.ok(existsSync(input), `missing declared input: ${declared}`)
     const paths = statSync(input).isDirectory() ? files(input).map(file => declared + '/' + file) : [declared]
     for (const path of paths) assert.ok(packedFiles.includes(path), `not packed: ${path}`)
   }
   for (const file of packedFiles.filter(file => file.endsWith('.md'))) {
     const body = readFileSync(join(unpacked, file), 'utf8')
     for (const match of body.matchAll(/\]\(([^)]+)\)/g)) {
       const target = match[1].split('#')[0]
       if (!target || /^[a-z]+:|^\//i.test(target)) continue
       assert.ok(existsSync(resolve(dirname(join(unpacked, file)), decodeURIComponent(target))), `broken packed link in ${file}: ${target}`)
     }
   }

   const targets = []
   function visit(value) {
     if (typeof value === 'string' && value.startsWith('./') && !value.includes('*')) targets.push(value)
     else if (typeof value === 'object' && value) Object.values(value).forEach(visit)
   }
   visit(pkg.exports)
   targets.push(pkg.main)
   if (pkg.types) targets.push(pkg.types)
   for (const target of targets) assert.ok(existsSync(join(unpacked, target)), `missing package entry: ${target}`)
   for (const file of expected.filter(file => file.endsWith('.map'))) {
     const map = JSON.parse(readFileSync(join(unpacked, 'lib', file), 'utf8'))
     for (const source of map.sources) assert.ok(existsSync(resolve(dirname(join(unpacked, 'lib', file)), map.sourceRoot ?? '', source)), `unresolved map source in ${file}: ${source}`)
   }
   for (const patch of [pkg.dsh?.bundle?.patch].flat().filter(Boolean)) assert.ok(existsSync(join(unpacked, patch)), `missing patch: ${patch}`)
   // Install from a tarball into a clean project, without the compiler or sibling source.
   const installed = join(scratch, 'install')
   mkdirSync(installed)
   const { writeFileSync } = await import('node:fs')
   writeFileSync(join(installed, 'package.json'), JSON.stringify({ private: true, type: 'module', packageManager: pkg.packageManager, dependencies: { ...Object.fromEntries(Object.entries(pkg.peerDependencies ?? {}).map(([name, range]) => [name, pkg.devDependencies?.[name] ?? range])), [pkg.name]: 'file:' + join(scratch, report.filename) } }))
   run('pnpm', ['install', '--prod', '--config.auto-install-peers=true'], installed)
   const entry = join(installed, 'node_modules', pkg.name, pkg.main)
   const loaded = await import(pathToFileURL(entry).href)
   assert.equal(typeof loaded.apply, 'function', 'installed Host has no apply')
   if (pkg.exports?.['./client']) {
     let registration
     runInNewContext(readFileSync(join(unpacked, 'lib/client.js'), 'utf8'), { window: { __ModuleLoader__: { load(value) { registration = value } } } })
     assert.equal(registration?.id, pkg.name)
     assert.equal(typeof registration.factory, 'function')
     // DSH 0.2.2-rc.1 platform modules consumed here. Primitives are a shell
     // facade: this checks factory loading, not UI mounting or interaction.
     const nativeModules = new Set(["react", "react-dom", "@deepseek-ai/dsh-client-ui-primitives"])
     const requireInstalled = createRequire(join(installed, 'package.json'))
     const client = registration.factory(specifier => {
       assert.ok(nativeModules.has(specifier), `unsupported browser module: ${specifier}`)
       return specifier === '@deepseek-ai/dsh-client-ui-primitives' ? {} : requireInstalled(specifier)
     })
     assert.equal(typeof client?.apply, 'function', 'installed Client has no apply')
   }
   // Exercise the same prebuilt package via pnpm's Git acquisition path.
   run('git', ['init', '--quiet', candidate], root)
   run('git', ['add', '.'], candidate)
   run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'candidate'], candidate)
   const gitInstall = join(scratch, 'git-install')
   mkdirSync(gitInstall)
   writeFileSync(join(gitInstall, 'package.json'), JSON.stringify({ private: true, type: 'module', packageManager: pkg.packageManager,
     dependencies: { ...Object.fromEntries(Object.entries(pkg.peerDependencies ?? {}).map(([name, range]) => [name, pkg.devDependencies?.[name] ?? range])), [pkg.name]: 'git+' + pathToFileURL(candidate).href } }))
   run('pnpm', ['install', '--prod'], gitInstall)
   assert.equal(typeof (await import(pathToFileURL(join(gitInstall, 'node_modules', pkg.name, pkg.main)).href)).apply, 'function')
   console.log('PASS: complete dist, packed exports/resources/maps, clean tarball/Git installation, Host load and Client factory load')
 }
} finally { rmSync(scratch, { recursive: true, force: true }) }
