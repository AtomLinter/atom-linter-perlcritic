fs = require 'fs'
linterPath = atom.packages.getLoadedPackage("linter").path
Linter = require "#{linterPath}/lib/linter"
# {findFile, warn} = require "#{linterPath}/lib/utils"
{CompositeDisposable} = require "atom"

class LinterPerlcritic extends Linter
  # The syntax that the linter handles. May be a string or
  # list/tuple of strings. Names should be all lowercase.
  @syntax: 'source.perl'

  # A string, list, tuple or callable that returns a string, list or tuple,
  # containing the command line (with arguments) used to lint.
  cmd: ['perlcritic']

  linterName: 'perlcritic'

  # force the defaultLevel to info which will map to the generic css class .highlight-info which is blue
  # not red (error) nor brown - orange (warning)
  defaultLevel: 'info'

  # A regex pattern used to extract information from the executable's output.
  regex: "[^:]*:(?<line>\\d+):(?<col>\\d+):(?<message>.*)"

  constructor: (editor) ->
    super(editor)

    @disposables = new CompositeDisposable
    @disposables.add atom.config.observe 'linter-perlcritic.perlcriticExecutablePath', @formatShellCmd

  lintFile: (filePath, callback) ->
    super(filePath, callback)

  formatShellCmd: =>
    executablePath = atom.config.get 'linter-perlcritic.perlcriticExecutablePath'
    @executablePath = "#{executablePath}"

  destroy: ->
    super
    @disposables.dispose()

module.exports = LinterPerlcritic
