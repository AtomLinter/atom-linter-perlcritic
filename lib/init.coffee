{CompositeDisposable} = require 'atom'
Path = require 'path'
NamedRegexp = require 'named-regexp'

module.exports =
  config:
    executablePath:
      type: 'string'
      title: 'Perlcritic Executable Path'
      default: 'perlcritic' # Let OS's $PATH handle the rest
    level:
      type: 'string'
      title: 'Perlcritic Severity Level'
      default: '(5) gentle'
      enum: ['(5) gentle', '(4) stern', '(3) harsh', '(2) cruel', '(1) brutal']


  activate: ->
    require("atom-package-deps").install("linter-perlcritic")

  provideLinter: ->
    helpers = require('atom-linter')
    provider =
      name: 'perlcritic'
      grammarScopes: ['source.perl']
      scope: 'file'
      lintOnFly: true
      lint: (textEditor) =>
        new Promise (resolve, reject) =>
          filePath = textEditor.getPath()
          fileDir = Path.dirname(filePath)
          command = atom.config.get('linter-perlcritic.executablePath')
          [levelNum] = atom.config.get('linter-perlcritic.level').match /(\d)/
          parameters = []
          messages = []
          errors =
            1: 'Info'
            2: 'Info'
            3: 'Info'
            4: 'Warning'
            5: 'Error'
          RE = /(.*) at line (\d+), column (\d+)(.*)\(Severity: (\d)\)/
          parameters.push('-' + levelNum)
          parameters.push('--verbose')
          parameters.push(4)
          text = textEditor.getText(atom.config.get('linter-perlcritic.executablePath'))

          return helpers.exec(command, parameters, {stdin: text, cwd: fileDir}).then (output) ->
            lines = output.split(/\n/)
            lines.pop()
            for line in lines
              [unuse, message, lineNum, columnNum, pbp, levelNum] = line.match RE
              messages.push
                type: errors[levelNum]
                text: message + pbp
                filePath: filePath
                range: [
                  [lineNum - 1, columnNum - 1]
                  [lineNum - 1, textEditor.getBuffer().lineLengthForRow(lineNum - 1)]
                ]
            resolve messages;
