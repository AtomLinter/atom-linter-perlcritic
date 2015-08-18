{CompositeDisposable} = require 'atom'

module.exports =
  config:
    executablePath:
      type: 'string'
      title: 'Perlcritic Executable Path'
      default: 'perlcritic' # Let OS's $PATH handle the rest

  provideLinter: ->
    helpers = require('atom-linter')
    regex = '(?<message>.*) at line (?<line>\\d+), column (?<col>\\d+). (?<message1>.*)'
    provider =
      grammarScopes: ['source.perl.mojolicious', 'source.perl']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        filePath = textEditor.getPath()
        command = atom.config.get('linter-perlcritic.executablePath') or @config.executablePath.default
        parameters = []
        parameters.push '--verbose'
        parameters.push '8'
        parameters.push filePath
        text = textEditor.getText()
        return helpers.exec(command, parameters).then (output) ->
          errors = for message in helpers.parse(output, regex, {filePath: filePath})
            message.type = 'error'
            message

          return errors
