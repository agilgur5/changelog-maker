# @agilgur5/changelog-maker

**A git log to release changelog tool**

<!-- releases / versioning -->
[![package-json](https://img.shields.io/github/package-json/v/agilgur5/changelog-maker.svg)](https://npmjs.org/package/changelog-maker)
[![releases](https://img.shields.io/github/release/agilgur5/changelog-maker.svg)](https://github.com/agilgur5/changelog-maker/releases)
[![commits](https://img.shields.io/github/commits-since/agilgur5/changelog-maker/latest.svg)](https://github.com/agilgur5/changelog-maker/commits/master)
<br><!-- downloads -->
[![dt](https://img.shields.io/npm/dt/@agilgur5/changelog-maker.svg)](https://npmjs.org/package/@agilgur5/changelog-maker)
[![dy](https://img.shields.io/npm/dy/@agilgur5/changelog-maker.svg)](https://npmjs.org/package/@agilgur5/changelog-maker)
[![dm](https://img.shields.io/npm/dm/@agilgur5/changelog-maker.svg)](https://npmjs.org/package/@agilgur5/changelog-maker)
[![dw](https://img.shields.io/npm/dw/@agilgur5/changelog-maker.svg)](https://npmjs.org/package/@agilgur5/changelog-maker)
<br>
[![NPM](https://nodei.co/npm/@agilgur5/changelog-maker.png?downloads=true&downloadRank=true&stars=true)](https://npmjs.org/package/@agilgur5/changelog-maker)

## Eh?

**@agilgur5/changelog-maker** is a slightly modified version of [Node's `changelog-maker`](https://github.com/nodejs/changelog-maker).
Along with the changelog described below, this version will add some Markdown around it as well, looking like:

````markdown
## Release

```
...latest tag's commit message goes here...
```

## Changelog

...changelog goes here...

[v1.0.1...v1.0.2](https://github.com/agilgur5/repo/compare/v1.0.1...v1.0.2)
````

**changelog-maker** will look at the git log of the current directory, pulling entries since the last tag. Commits with just a version number in the summary are removed, as are commits prior to, and including summaries that say `working on <version>` (this is an io.js / Node ism).

After collecting the list of commits, any that have `PR-URL: <url>` in them are looked up on GitHub and the labels of the pull request are collected, specifically looking for labels that start with `semver` (the assumption is that `semver-minor`, `semver-major` labels are used to indicate non-patch version bumps).

Finally, the list is formatted as Markdown and printed to stdout.

Each commit will come out something like this (on one line):

```
* [[`20f8e7f17a`](https://github.com/nodejs/io.js/commit/20f8e7f17a)] -
  **test**: remove flaky test functionality (Rod Vagg)
  [#812](https://github.com/nodejs/io.js/pull/812)
```

Note:

* When running `changelog-maker` on the command-line, the default GitHub repo is computed from the `package.json` that exists on `cwd`, otherwise fallback to `nodejs/node`, you can change this by supplying the user/org as the first argument and project as the second. e.g `changelog-maker joyent node`.
* Commit links will go to the assumed repo (default: nodejs/node)
* If a commit summary starts with a word, followed by a `:`, this is treated as a special label and rendered in bold
* Commits that have `semver*` labels on the pull request referred to in their `PR-URL` have those labels printed out at the start of the summary, in bold, upper cased.
* Pull request URLs come from the `PR-URL` data, if it matches the assumed repo (default: nodejs/node) then just a `#` followed by the number, if another repo then a full `user/project#number`.

When printing to a console some special behaviours are invoked:

* Commits with a summary that starts with `doc:` are rendered in grey
* Commits that have a `semver*` label on the pull request referred to in their `PR-URL` are rendered in bold green

## Install

```
$ npm i @agilgur5/changelog-maker -g
```

## Usage

**`changelog-maker [--simple] [--group] [--commit-url=<url/with/{ref}>] [--start-ref=<ref>] [--end-ref=<ref>] [github-user[, github-project]]`**

`github-user` and `github-project` should point to the GitHub repository that can be used to find the `PR-URL` data if just an issue number is provided and will also impact how the PR-URL issue numbers are displayed

 * `--simple`:          print a simple form, without additional Markdown cruft
 * `--group`:           reorder commits so that they are listed in groups where the `xyz:` prefix of the commit message defines the group. Commits are listed in original order _within_ group.
 * `--commit-url`:      pass in a url template which will be used to generate commit URLs for a repository not hosted in Github. `{ref}` is the placeholder that will be replaced with the commit, i.e. `--commit-url=https://gitlab.com/myUser/myRepo/commit/{ref}`
 * `--start-ref=<ref>`: use the given git `<ref>` as a starting point rather than the _second-to-last tag_. The `<ref>` can be anything commit-ish including a commit sha, tag, branch name. If you specify a `--start-ref` argument the commit log will not be pruned so that version commits and `working on <version>` commits are left in the list.
 * `--end-ref=<ref>`:   use the given git `<ref>` as a end-point rather than the _last tag_. The `<ref>` can be anything commit-ish including a commit sha, tag, branch name.
 * `--filter-release`:  exclude Node-style release commits from the list. e.g. "Working on v1.0.0" or "2015-10-21 Version 2.0.0" and also "npm version X" style commits containing _only_ an `x.y.z` semver designator.
 * `--quiet` or `-q`:   do not print to `process.stdout`
 * `--all` or `-a`:     process all commits since beginning, instead of last tag.
 * `--help` or `-h`:    show usage and help.

Please note that the defaults for `--start-ref` and `--end-ref` have changed slightly between `@agilgur5/changelog-maker` and the original `changelog-maker`.
`changelog-maker` used "last tag" and "now" whereas `@agilgur5/changelog-maker` uses "second-to-last tag" and "last tag".
