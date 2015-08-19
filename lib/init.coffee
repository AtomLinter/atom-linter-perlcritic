{CompositeDisposable} = require 'atom'

module.exports =
  config:
    executablePath:
      type: 'string'
      title: 'Perlcritic Executable Path'
      default: 'perlcritic' # Let OS's $PATH handle the rest

  provideLinter: ->
    helpers = require('atom-linter')
    regex = '[^:]*:(?<line>\\d+):(?<col>\\d+):(?<message>.*)'
    provider =
      grammarScopes: ['source.perl.mojolicious', 'source.perl']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        filePath   = textEditor.getPath()
        command    = atom.config.get "linter-perlcritic.executablePath"
        parameters = []
        parameters.push(filePath)
        text = textEditor.getText()
        return helpers.exec(command, parameters).then (output) ->
          errors = for message in helpers.parse(output, regex, {filePath: filePath})
            message.type = 'info'
            message

          return errors
