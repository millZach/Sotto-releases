#!/usr/bin/env node
// Builds saysotto.com in every language from one template, with nothing but Node.
//
//   node scripts/build-site.mjs                  writes site/index.html in English and site/<path>/index.html for the rest
//   node scripts/build-site.mjs --check          writes nothing; fails when a page in site/ is not what the build writes
//   node scripts/build-site.mjs --lint <path>    checks one language's strings, writing nothing
//   node scripts/build-site.mjs --messages       prints every English message, in page order, as JSON
//   node scripts/build-site.mjs --self-test      tries the checks and escaping on strings made to break them
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

const markup = (s) => s.match(/<[^<>]*>/g) || []
const placeholders = (s) => [...new Set(s.match(/\{\w+\}/g) || [])].sort()
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
const tally = (list) => list.reduce((counts, item) => counts.set(item, (counts.get(item) || 0) + 1), new Map())

// A name counts only whole: no Latin letter or digit touching it on either side, so "Owlbert" is not Owl. Chinese,
// Japanese, Arabic and Indic text runs straight into a name, and a hyphen or apostrophe may join a suffix to it
// ("Windows-এর", "Sotto'yu"); those still count. Polish, Czech, Finnish and Hungarian write a case ending straight
// onto a name ("Windowsille", "Linuxra"), so a language may list its endings in locales.json as nameEndings, and a
// name with exactly one of them still counts.
const EDGE = '[\\p{Script=Latin}0-9]'
const literal = (s) => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
function hasName(name, s, endings = []) {
  const ending = endings.length ? `(?:${[...endings].sort((a, b) => b.length - a.length).map(literal).join('|')})?` : ''
  return new RegExp(`(?<!${EDGE})${literal(name)}${ending}(?!${EDGE})`, 'u').test(s)
}
const kept = (s) => KEEP.filter((name) => hasName(name, s))

// A line the demo types out word by word, one <span> per word: a translation has as many words as its language needs.
const wordByWord = (message) => /^(?:<span[^<>]*>[^<>]*<\/span>)+$/.test(message)

// What is wrong with a translation's markup. Every < must begin one of the English message's own tags, whole; the
// tags must open and close in order; and each tag appears as often as in English, except the plain word spans of a
// word-by-word line.
function markupProblems(message, text) {
  const allowed = new Set(markup(message))
  for (let at = text.indexOf('<'); at !== -1; at = text.indexOf('<', at + 1)) {
    const end = text.indexOf('>', at), tag = end === -1 ? '' : text.slice(at, end + 1)
    if (!allowed.has(tag)) return [`has markup the English does not: "${text.slice(at, at + 40)}". It may use only ${[...allowed].join(' ') || 'no markup'}`]
  }
  const problems = [], open = []
  for (const tag of markup(text)) {
    const closing = tag.match(/^<\/([a-z]+)>$/)
    if (!closing) { open.push(tag.match(/^<([a-z]+)/)[1]); continue }
    if (open.pop() !== closing[1]) { problems.push(`closes ${tag} where it is not the tag open`); break }
  }
  if (!problems.length && open.length) problems.push(`leaves <${open.join('>, <')}> open`)
  const english = tally(markup(message)), translated = tally(markup(text)), loose = wordByWord(message)
  if (loose && !wordByWord(text)) problems.push('must stay one <span> per word, with nothing between them')
  for (const tag of new Set([...english.keys(), ...translated.keys()])) {
    if (loose && (tag === '<span>' || tag === '</span>')) continue
    const want = english.get(tag) || 0, got = translated.get(tag) || 0
    if (want !== got) problems.push(`has ${tag} ${got} times where the English has it ${want}`)
  }
  return problems
}

// A translation as HTML. Its tags passed markupProblems; everything between them is text, so a bare &, < or >
// becomes an entity, and in an attribute so does ". Entities the translation wrote, as &amp; in "Privacy &amp;
// Security", stay as they are.
function asHtml(text, attribute) {
  return text.split(/(<[^<>]*>)/).map((part, i) => (i % 2 && !attribute) ? part : part
    .replace(/&(?![a-zA-Z]+;|#[0-9]+;|#x[0-9a-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, attribute ? '&quot;' : '"')).join('')
}

// The script strings as JSON safe inside a <script> element: no <, > or & at all, so no </script>, <!-- or <script
// can change how the page parses, and no line or paragraph separator. JSON.parse reads the escapes back.
const BACKSLASH = String.fromCharCode(92)
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, 'g')
const scriptJson = (strings) => JSON.stringify(strings)
  .replace(UNSAFE_IN_SCRIPT, (c) => `${BACKSLASH}u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)

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
    for (const problem of markupProblems(message, text)) problems.push(`${file}: the translation of "${message}" ${problem}`)
    if (!same(placeholders(message), placeholders(text))) problems.push(`${file}: "${message}" must keep its placeholders: ${placeholders(message).join(' ') || 'none'}`)
    for (const name of kept(message)) if (!hasName(name, text, locale.nameEndings)) problems.push(`${file}: "${message}" must keep the name ${name}, whole`)
    if (/\{\{|\}\}/.test(text)) problems.push(`${file}: the translation of "${message}" has {{ or }} in it`)
    if (use.attribute && /[<>]/.test(text)) problems.push(`${file}: the translation of "${message}" is an attribute and cannot hold markup`)
  }
  for (const message of Object.keys(strings)) if (!all.has(message)) problems.push(`${file}: "${message}" is not on the page any more`)
  return problems
}

const pageHref = (l) => `/${l.path ? `${l.path}/` : ''}`

function render(locale, all) {
  const strings = locale.path ? JSON.parse(read(`site-src/strings/${locale.path}.json`)) : {}
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
    strings: scriptJson(scriptStrings),
  }
  return template.replace(MARKER, (marker, isValue, body, offset) => {
    if (isValue) {
      if (!(body in values)) fail([`The template asks for {{=${body}}}, which the build does not fill in.`])
      return values[body]
    }
    // English is the template's own markup, written as the page is; a translation is escaped as text around its tags.
    return locale.path ? asHtml(strings[body], inTag(offset)) : body
  })
}

// Every tr() a script writes into an attribute value, as in aria-label="${...}", must go through esc(), so a translated
// " cannot end the attribute and start another. Returns each attribute expression that does not.
function unescapedAttributes(source) {
  const bad = []
  for (let at = source.indexOf('="${'); at !== -1; at = source.indexOf('="${', at + 1)) {
    let depth = 0, end = at + 3
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++
      else if (source[end] === '}' && --depth === 0) break
    }
    const expression = source.slice(at + 4, end).trim()
    if (/\btr\(/.test(expression) && !(expression.startsWith('esc(') && expression.endsWith(')'))) bad.push(expression)
  }
  return bad
}

// The build's own checks, tried on strings made to break them. node scripts/build-site.mjs --self-test
function selfTest() {
  const kbd = '<kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Space</kbd> in any app, then talk.'
  const lead = 'Watcher keeps these <b id="wleadN">3</b> threads going.'
  const words = '<span>Send</span><span class="hit">Priya</span><span>the</span><span class="hit">Kubernetes</span><span>note.</span>'
  const separators = String.fromCharCode(0x2028, 0x2029)
  const cases = [
    // 1. Markup a translation may not bring in, finished or not, and text that is escaped around the tags it may.
    ['an unfinished tag is refused', markupProblems('Ask <b>now</b>', 'Ask <b>now</b> <img src=x onerror="alert(1)" ').length > 0],
    ['a finished tag the English lacks is refused', markupProblems('Ask <b>now</b>', 'Ask <b>now</b><img src=x onerror="alert(1)">').length > 0],
    ['a bare < is refused', markupProblems('Ask now', 'Ask < now').length > 0],
    ['the English message\'s own tags are allowed', markupProblems('Ask <b>now</b>', '<b>Maintenant</b>, demandez').length === 0],
    ['text is escaped and tags are kept', asHtml('a & b > c "q" <b>d</b>', false) === 'a &amp; b &gt; c "q" <b>d</b>'],
    ['entities a translation wrote are kept', asHtml('Privacy &amp; Security &#39; &#x2019;', false) === 'Privacy &amp; Security &#39; &#x2019;'],
    ['an attribute escapes quotes and angle brackets', asHtml('say "hi" <x', true) === 'say &quot;hi&quot; &lt;x'],
    // 2. A script's attribute values escape what tr() gives them, in the template as it stands.
    ['the scanner finds a bare tr() in an attribute', unescapedAttributes('<a aria-label="${tr(\'x\')}">').length === 1],
    ['the scanner accepts esc(tr())', unescapedAttributes('<a aria-label="${esc(ok ? tr(\'x\', { a }) : tr(\'y\'))}">').length === 0],
    ['the template escapes every tr() in an attribute', unescapedAttributes(template).length === 0],
    // 3. The script strings cannot change how the page parses.
    ['the script strings hold no < > & or separators', !/[<>&]/.test(scriptJson({ a: `<!--<script></script>&${separators}` })) && !new RegExp(`[${separators}]`).test(scriptJson({ a: separators }))],
    ['the script strings read back the same', JSON.parse(scriptJson({ a: `<!--<script>&${separators}` })).a === `<!--<script>&${separators}`],
    // 4. Tags open and close in order and keep their count, except the words of a word-by-word line.
    ['a dropped </kbd> is refused', markupProblems(kbd, '<kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Space dans une app.').length > 0],
    ['tags closed out of order are refused', markupProblems('<b>a</b> <u>b</u>', '<b>a <u>b</b></u>').length > 0],
    ['a duplicated <b id> is refused', markupProblems(lead, 'Watcher garde ces <b id="wleadN">3</b> fils, <b id="wleadN">3</b>.').length > 0],
    ['a missing <b id> is refused', markupProblems(lead, 'Watcher garde ces 3 fils.').length > 0],
    ['a word-by-word line may have more or fewer words', markupProblems(words, '<span>Envoie</span><span>à</span><span class="hit">Priya</span><span>la</span><span>note</span><span class="hit">Kubernetes</span><span>.</span>').length === 0],
    ['a word-by-word line keeps every marked name', markupProblems(words, '<span>Envoie</span><span class="hit">Priya</span><span>la note.</span>').length > 0],
    ['a word-by-word line has nothing between its words', markupProblems(words, '<span>Envoie</span> <span class="hit">Priya</span><span class="hit">Kubernetes</span>').length > 0],
    // 5. Names count only whole.
    ['"Owlbert" is not Owl', !hasName('Owl', 'Owlbert')],
    ['"MacBook" is not Mac', !hasName('Mac', 'Téléchargez pour MacBook')],
    ['a name runs into Chinese text', hasName('Owl', '下载Owl的版本')],
    ['a name runs into Arabic text', hasName('Watcher', 'يبدأWatcher')],
    ['a hyphen or apostrophe joins a suffix', hasName('Windows', 'Windows-এর') && hasName('Sotto', "Sotto'yu")],
    ['a case ending counts only where the language lists it', !hasName('Linux', 'Linuxra') && hasName('Linux', 'Linuxra', ['ra'])],
    ['a listed ending does not let any word through', !hasName('Owl', 'Owlbert', ['ra', 'a'])],
  ]
  const failed = cases.filter(([, ok]) => !ok)
  for (const [name, ok] of cases) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (failed.length) fail([`${failed.length} of ${cases.length} self-test cases failed.`])
  console.log(`All ${cases.length} self-test cases pass.`)
}

if (args[0] === '--self-test') { selfTest(); process.exit(0) }

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
