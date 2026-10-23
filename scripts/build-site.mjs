#!/usr/bin/env node
// Builds saysotto.com in every language from one template, with nothing but Node.
//
//   node scripts/build-site.mjs                  writes site/index.html in English and site/<path>/index.html for the rest
//   node scripts/build-site.mjs --check          writes nothing; fails when a page in site/ is not what the build writes
//   node scripts/build-site.mjs --lint <path>    checks one language's strings, writing nothing
//   node scripts/build-site.mjs --messages       prints every English message, in page order, as JSON
//
// site-src/index.html is the page in English. Each message in its markup is marked {{like this}}, and each one its
// scripts write is a tr('like this') call; {{=name}} is a value the build fills in for each language. A message is
// its English text, so the template reads as the page does. site-src/strings/<path>.json maps every English message
// to its translation, and site-src/locales.json lists the languages. A language with a message missing, left over
// or changed in its markup, placeholders or names fails the build, so no page ships half translated.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// Git on Windows may check files out with CRLF; the build reads and compares as LF and writes LF.
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n')
const args = process.argv.slice(2)

// Names that stay as they are in every language: Sotto's own, the providers', the systems' and the demo's.
const KEEP = ['Sotto', 'Owl', 'Watcher', 'Codex', 'Claude Code', 'Grok Build', 'OpenRouter', 'GitHub', 'Windows', 'macOS',
  'Linux', 'Omarchy', 'Arch', 'Mac', 'Apple', 'Intel', 'SmartScreen', 'MIT', 'Android', 'Priya', 'Kubernetes']

const template = read('site-src/index.html')
const { origin, locales } = JSON.parse(read('site-src/locales.json'))

const MARKER = /\{\{(=?)([^\n]*?)\}\}/g
const SCRIPT_MESSAGE = /\btr\('([^'\\\n]*)'/g

// A marker inside a tag is an attribute's value, where a translation's double quotes are escaped.
const inTag = (offset) => template.lastIndexOf('<', offset) > template.lastIndexOf('>', offset)

// Every message once, in the order the page has them, with where it goes: in an attribute (so no markup), and
// whether a script writes it (so its translation goes in the page's script strings). One message can be both in the
// markup and written by a script, as "See what it does" is.
function messages() {
  const found = new Map()
  const at = (message) => found.get(message) || found.set(message, { attribute: false, script: false }).get(message)
  for (const m of template.matchAll(MARKER)) {
    if (m[1]) continue
    if (/[{}]/.test(m[2])) fail([`The message "${m[2]}" has a brace in it; only messages in tr() take {placeholders}.`])
    if (inTag(m.index)) at(m[2]).attribute = true
    else at(m[2])
  }
  for (const m of template.matchAll(SCRIPT_MESSAGE)) at(m[1]).script = true
  const rest = template.replace(MARKER, '')
  if (rest.includes('{{') || rest.includes('}}')) fail(['The template has a {{ or }} that is not a whole marker.'])
  return found
}

function fail(problems) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const tags = (s) => [...new Set(s.match(/<[^>]*>/g) || [])].sort()
const placeholders = (s) => [...new Set(s.match(/\{\w+\}/g) || [])].sort()
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
const kept = (s) => KEEP.filter((name) => new RegExp(`(^|[^A-Za-z])${name}`).test(s))

// What is wrong with one language's strings, as plain sentences; none when it is ready to build.
function lint(locale, all) {
  const file = `site-src/strings/${locale.path}.json`
  if (!existsSync(join(root, file))) return [`${file} is missing.`]
  let strings
  try { strings = JSON.parse(read(file)) } catch (e) { return [`${file} is not valid JSON: ${e.message}`] }
  const problems = []
  for (const [message, use] of all) {
    const text = strings[message]
    if (typeof text !== 'string' || !text.trim()) { problems.push(`${file}: no translation for "${message}"`); continue }
    if (!same(tags(message), tags(text))) problems.push(`${file}: "${message}" must keep its markup exactly: ${tags(message).join(' ') || 'none'}`)
    if (!same(placeholders(message), placeholders(text))) problems.push(`${file}: "${message}" must keep its placeholders: ${placeholders(message).join(' ') || 'none'}`)
    for (const name of kept(message)) if (!text.includes(name)) problems.push(`${file}: "${message}" must keep the name ${name}`)
    if (/\{\{|\}\}/.test(text)) problems.push(`${file}: the translation of "${message}" has {{ or }} in it`)
    if (use.attribute && /[<>]/.test(text)) problems.push(`${file}: the translation of "${message}" is an attribute and cannot hold markup`)
  }
  for (const message of Object.keys(strings)) if (!all.has(message)) problems.push(`${file}: "${message}" is not on the page any more`)
  return problems
}

const pageHref = (l) => `/${l.path ? `${l.path}/` : ''}`

function render(locale, all) {
  const strings = locale.path ? JSON.parse(read(`site-src/strings/${locale.path}.json`)) : {}
  const say = (message) => (locale.path ? strings[message] : message)
  const scriptStrings = {}
  if (locale.path) for (const [message, use] of all) if (use.script) scriptStrings[message] = strings[message]
  const values = {
    lang: locale.lang,
    dir: locale.dir || 'ltr',
    url: `${origin}${pageHref(locale)}`,
    og: locale.og,
    name: locale.name,
    alternates: [
      ...locales.map((l) => `<link rel="alternate" hreflang="${l.lang}" href="${origin}${pageHref(l)}">`),
      `<link rel="alternate" hreflang="x-default" href="${origin}/">`,
    ].join('\n'),
    languages: locales.map((l) => `\n        <li><a href="${pageHref(l)}" hreflang="${l.lang}" lang="${l.lang}"${l === locale ? ' aria-current="page"' : ''}>${l.name}</a></li>`).join('') + '\n      ',
    // A closing tag inside the JSON would end its script element early.
    strings: JSON.stringify(scriptStrings).replace(/<\//g, '<\\/'),
  }
  return template.replace(MARKER, (marker, isValue, body, offset) => {
    if (isValue) {
      if (!(body in values)) fail([`The template asks for {{=${body}}}, which the build does not fill in.`])
      return values[body]
    }
    const text = say(body)
    return inTag(offset) ? text.replace(/"/g, '&quot;') : text
  })
}

const all = messages()

if (args[0] === '--messages') {
  console.log(JSON.stringify([...all].map(([message, use]) => ({ message, ...use })), null, 2))
  process.exit(0)
}

if (args[0] === '--lint') {
  const locale = locales.find((l) => l.path === args[1] && l.path)
  if (!locale) fail([`No language has the path "${args[1]}". The paths are: ${locales.filter((l) => l.path).map((l) => l.path).join(', ')}.`])
  const problems = lint(locale, all)
  if (problems.length) fail(problems)
  console.log(`${locale.path}: all ${all.size} messages are ready.`)
  process.exit(0)
}

const problems = locales.filter((l) => l.path).flatMap((l) => lint(l, all))
if (problems.length) fail(problems)

const check = args[0] === '--check'
const stale = []
for (const locale of locales) {
  const path = `site/${locale.path ? `${locale.path}/` : ''}index.html`
  const page = render(locale, all)
  const now = existsSync(join(root, path)) ? read(path) : null
  if (now === page) continue
  if (check) { stale.push(path); continue }
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), page)
  console.log(`wrote ${path}`)
}
// A page left in a folder no language has any more would still be published.
const paths = new Set(locales.map((l) => l.path))
for (const entry of readdirSync(join(root, 'site'), { withFileTypes: true })) {
  if (entry.isDirectory() && !paths.has(entry.name) && existsSync(join(root, 'site', entry.name, 'index.html'))) {
    stale.push(`site/${entry.name}/index.html, which no language in site-src/locales.json has`)
  }
}
if (stale.length) {
  fail([check
    ? `The site is out of date with site-src. Run node scripts/build-site.mjs and commit what it writes:\n  ${stale.join('\n  ')}`
    : `Remove what no language has any more:\n  ${stale.join('\n  ')}`])
}
console.log(check ? `The site matches site-src in all ${locales.length} languages.` : `The site is built in all ${locales.length} languages.`)
