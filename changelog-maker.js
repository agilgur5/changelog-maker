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
  const refCmd = 'git rev-list --max-count=1 {{ref}}'
  const defaultStartRef = '--tags=v*.*.* 2> /dev/null ' +
        '|| git rev-list --max-count=1 --tags=*.*.* 2> /dev/null ' +
        '|| git rev-list --max-count=1 HEAD'

  let startRefCmd = replace(refCmd, { ref: argv['start-ref'] || defaultStartRef })
  let endRefCmd = replace(refCmd, { ref: argv['end-ref'] || 'HEAD' })
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

// print the changelog from start ref to end ref
function printChangelog (startRef, endRef) {
  const logCmd = `git log --pretty=full ${startRef}...${endRef}`
  return streamToPromList(gexec(logCmd)
    .pipe(commitStream(ghId.user, ghId.repo)))
    .then(onCommitList)
}

async function printReleaseChangeLog () {
  const [startRef, endRef] = await getRefs()
  await printChangelog(startRef, endRef)
}

printReleaseChangeLog()
