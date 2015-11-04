{CompositeDisposable} = require 'atom'
Path = require 'path'

module.exports =
  config:
    executablePath:
      type: 'string'
      title: 'Perlcritic Executable Path'
      default: 'perlcritic' # Let OS's $PATH handle the rest

  activate: ->
    require("atom-package-deps").install("linter-perlcritic")
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.config.observe "linter-perlcritic.executablePath",
      (executablePath) =>
        @executablePath = executablePath

  provideLinter: ->
    helpers = require('atom-linter')
    provider =
      name: 'perlcritic'
      grammarScopes: ['source.perl.mojolicious', 'source.perl']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        filePath = textEditor.getPath()
        fileDir = Path.dirname(filePath)
        command = @executablePath
        parameters = []
        parameters.push('-')
        text = textEditor.getText()
        return helpers.exec(command, parameters, {stdin: text, cwd: fileDir}).then (output) ->
          regex = /(.*) at line (\d+), column (\d+).\s+(.*\.)\s+\(Severity: (\d+)\)/g
          messages = []
          while ((match = regex.exec(output)) isnt null)
            line = parseInt(match[2], 10) - 1
            col = parseInt(match[3], 10) - 1
            messages.push
              type: 'Error'
              text: match[1]
              filePath: filePath
              range: helpers.rangeFromLineNumber(textEditor, line, col)
              trace: [
                type: 'Trace'
                text: match[4]
              ]
          return messages
