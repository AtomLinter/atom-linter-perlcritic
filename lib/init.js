'use babel';

import Path from 'path';
import NamedRegexp from 'named-regexp';

type Linter$Provider = Object;

module.exports = {
  config: {
    executablePath: {
      type: 'string',
      title: 'Perlcritic Executable Path',
      default: 'perlcritic', // Let OS's $PATH handle the rest
    },

    regex: {
      type: 'string',
      title: 'Perlcritic Verbose Regex',
      default: '(:<text>.*) at line (:<line>\\d+), ' +
        'column (:<col>\\d+).\\s+(:<trace>.*\\.)\\s+\\(Severity: (:<severity>\\d+)\\)',
    },

    level: {
      type: 'string',
      title: 'Perlcritic Level of warning',
      default: 'Info',
    },

    commandlineOptions: {
      type: 'string',
      title: 'Additional Commandline options',
      default: '',
    },
  },

  activate() {
    require('atom-package-deps').install('linter-perlcritic');
  },

  provideLinter(): Linter$Provider {
    const Helpers = require('atom-linter');

    return {
      name: 'perlcritic',
      grammarScopes: ['source.perl.mojolicious', 'source.perl'],
      scope: 'file',
      lintOnFly: true,
      lint: async(textEditor) => {
        const filePath = textEditor.getPath();
        const fileDir = Path.dirname(filePath);
        const command = atom.config.get('linter-perlcritic.executablePath');

        // parse command options, replace space by '='
        const cmdOptions = atom.config.get('linter-perlcritic.commandlineOptions');
        const parameters = [];

        if (cmdOptions) {
            // parse all the options into an array
            let cmdOptionsTemp = cmdOptions;
            let options = cmdOptions.match(/\-\-?\w+\s*=?/ig);
            options.forEach(function(option) {
                // clean the option
                cmdOptionsTemp = cmdOptionsTemp.replace(option, '');

                // search for the next option
                var value = cmdOptionsTemp;
                const nextOption = cmdOptionsTemp.match(/\-\-?\w+\s*=?/i);
                if (nextOption) {
                    let index = cmdOptionsTemp.indexOf(nextOption[0]);
                    value = cmdOptionsTemp.substr(0, index);
                }

                // clean the value
                cmdOptionsTemp = cmdOptionsTemp.replace(value, '');

                const cleanedOption = option.replace('=', '').trim();

                parameters.push(cleanedOption);
                parameters.push(value);
            });
        }

        parameters.push('-');

        // execute the perlcritic command
        const result = await Helpers.exec(
          command,
          parameters, {
            stdin: textEditor.getText(),
            cwd: fileDir,
            ignoreExitCode: true,
          }
        );

        // parse result
        let regex = new RegExp(atom.config.get('linter-perlcritic.regex'), 'ig');
        regex = NamedRegexp.named(regex);

        const messages = [];
        let match = regex.exec(result);
        while (match !== null) {
          const line = parseInt(match.capture('line'), 10) - 1;
          const col = parseInt(match.capture('col'), 10) - 1;
          let text = match.capture('text');

          // get all named captures
          const captures = match.captures;

          // severity
          if (captures.severity) {
            text += ` (Severity ${match.capture('severity')})`;
          }

          // trace
          if (captures.trace) {
            text += ` [${match.capture('trace')}]`;
          }

          messages.push({
            type: atom.config.get('linter-perlcritic.level'),
            text,
            filePath,
            range: Helpers.rangeFromLineNumber(textEditor, line, col),
          });

          match = regex.exec(result);
        }

        return messages;
      },
    };
  },
};
