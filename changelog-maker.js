#!/usr/bin/env node

const split2 = require('split2')
const list = require('list-stream')
const fs = require('fs')
const path = require('path')
const stripAnsi = require('strip-ansi')
const pkgtoId = require('pkg-to-id')
const commitStream = require('commit-stream')
const gitexec = require('gitexec')
const commitToOutput = require('./commit-to-output')
const groupCommits = require('./group-commits')
const collectCommitLabels = require('./collect-commit-labels')
const isReleaseCommit = require('./groups').isReleaseCommit
const pkg = require('./package.json')
const debug = require('debug')(pkg.name)
const argv = require('minimist')(process.argv.slice(2))

const quiet = argv.quiet || argv.q
const simple = argv.simple || argv.s
const help = argv.h || argv.help
const commitUrl = argv['commit-url'] || 'https://github.com/{ghUser}/{ghRepo}/commit/{ref}'
const pkgFile = path.join(process.cwd(), 'package.json')
const pkgData = fs.existsSync(pkgFile) ? require(pkgFile) : {}
const pkgId = pkgtoId(pkgData)

const ghId = {
  user: argv._[0] || pkgId.user || 'nodejs',
  repo: argv._[1] || (pkgId.name && stripScope(pkgId.name)) || 'node'
}

debug(ghId)

if (help) {
  showUsage()
  process.exit(0)
}

function showUsage () {
  var usage = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8')
    .replace(/[\s\S]+(## Usage\n[\s\S]*)\n## [\s\S]+/m, '$1')
  if (process.stdout.isTTY) {
    usage = usage
      .replace(/## Usage\n[\s]*/m, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
  }
  process.stdout.write(usage)
}

function stripScope (name) {
  return name[0] === '@' && name.indexOf('/') > 0 ? name.split('/')[1] : name
}

function replace (s, m) {
  Object.keys(m).forEach(function (k) {
    s = s.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), m[k])
  })
  return s
}

function organiseCommits (list) {
  if (argv['start-ref'] || argv.a || argv.all) {
    if (argv['filter-release']) {
      list = list.filter(function (commit) { return !isReleaseCommit(commit.summary) })
    }
    return list
  }

  // filter commits to those _before_ 'working on ...'
  var started = false
  return list.filter(function (commit) {
    if (started) {
      return false
    }

    if (isReleaseCommit(commit.summary)) {
      started = true
    }

    return !started
  })
}

function printCommits (list) {
  var out = list.join('\n') + '\n'

  if (!process.stdout.isTTY) {
    out = stripAnsi(out)
  }

  process.stdout.write(out)
}

function onCommitList (list) {
  list = organiseCommits(list)

  // eslint-disable-next-line brace-style
  return new Promise((resolve, reject) => { collectCommitLabels(list, function (err) {
    if (err) { reject(err) }

    if (argv.group) {
      list = groupCommits(list)
    }

    list = list.map(function (commit) {
      return commitToOutput(commit, simple, ghId, commitUrl)
    })

    if (!quiet) {
      printCommits(list)
    }

    resolve()
  })}) // eslint-disable-line brace-style, block-spacing
}

// simple wrapper around gitexec.exec for normal DRY usage
function gexec (cmd) {
  return gitexec.exec(process.cwd(), cmd)
    .pipe(split2())
}

// convert a Stream into a ListStream, then List, then Promisify that List
function streamToPromList (stream) {
  return new Promise((resolve, reject) => {
    stream.pipe(list.obj((err, list) => {
      if (err) { reject(err) }
      resolve(list)
    }))
  })
}

// get the start ref and end ref
function getRefs () {
  const prevTagCmd = 'git describe --abbrev=0 --tags $(git rev-list --tags --skip=1 --max-count=1)'
  const latestTagCmd = 'git describe --abbrev=0 --tags'
  const refCmd = 'git rev-list --max-count=1 {{ref}}'

  const argSRef = argv['start-ref']
  const argERef = argv['end-ref']
  let startRefCmd = argSRef ? replace(refCmd, { ref: argSRef }) : prevTagCmd
  let endRefCmd = argERef ? replace(refCmd, { ref: argERef }) : latestTagCmd
  if (argv.a || argv.all) {
    startRefCmd = 'git rev-list --max-parents=0 HEAD'
    endRefCmd = 'git rev-list --max-count=1 HEAD'
  }

  return Promise.all([
    streamToPromList(gexec(startRefCmd))
      .then((list) => list.join('\n')),
    streamToPromList(gexec(endRefCmd))
      .then((list) => list.join('\n'))
  ])
}

// get the ref's commit message
function printRefMessage (ref) {
  const messageCmd = `git log --format=%B -n 1 ${ref}`
  return streamToPromList(gexec(messageCmd))
    .then((list) => {
      if (quiet) { return }
      // print the start ref's commit message in a code block if not simple
      if (!simple) { console.log('```') }
      printCommits(list)
      if (!simple) { console.log('```') }
    })
}

// print the changelog from start ref to end ref
function printChangelog (startRef, endRef) {
  const logCmd = `git log --pretty=full ${startRef}...${endRef}`
  return streamToPromList(gexec(logCmd)
    .pipe(commitStream(ghId.user, ghId.repo)))
    .then(onCommitList)
}

// print a GitHub comparison between the two refs
function printComparison (startRef, endRef) {
  if (quiet) { return }
  if (!simple) {
    console.log(`[${startRef}...${endRef}](https://github.com/${ghId.user}/${ghId.repo}/compare/${startRef}...${endRef})`)
  } else {
    console.log(`[${startRef}...${endRef}]: https://github.com/${ghId.user}/${ghId.repo}/compare/${startRef}...${endRef}`)
  }
}

async function printReleaseLog () {
  const [startRef, endRef] = await getRefs()
  console.log('')
  console.log(!simple ? '## Release' : 'Release:')
  console.log('')
  await printRefMessage(endRef)
  console.log('')
  console.log(!simple ? '## Changelog' : 'Changelog:')
  console.log('')
  await printChangelog(startRef, endRef)
  console.log('')
  await printComparison(startRef, endRef)
  console.log('')
}

printReleaseLog()
