'use babel';

import Path from 'path';
import NamedRegexp from 'named-regexp';

const AtomPackageDeps = require('atom-package-deps');
const Helpers = require('atom-linter');

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
    AtomPackageDeps.install('linter-perlcritic');
  },

  provideLinter(): Linter$Provider {
    const self = this;

    return {
      name: 'perlcritic',
      grammarScopes: ['source.perl.mojolicious', 'source.perl'],
      scope: 'file',
      lintOnFly: true,
      lint: async(textEditor) => {
        const command = atom.config.get('linter-perlcritic.executablePath');

        // Parse command options, replace space by '='
        const cmdOptions = atom.config.get('linter-perlcritic.commandlineOptions');
        const parameters = self.parseCmdOptions(cmdOptions);

        // get cwd
        const filePath = textEditor.getPath();
        const cwd = self.getCwd(filePath);

        // Execute the perlcritic command
        const result = await Helpers.exec(
          command,
          parameters, {
            stdin: textEditor.getText(),
            cwd,
            env: process.env,
            ignoreExitCode: true,
          }
        );

        // Parse result
        let regex = new RegExp(atom.config.get('linter-perlcritic.regex'), 'ig');
        regex = NamedRegexp.named(regex);

        const messages = [];
        let match = regex.exec(result);
        while (match !== null) {
          const line = parseInt(match.capture('line'), 10) - 1;
          const col = parseInt(match.capture('col'), 10) - 1;
          let text = match.capture('text');

          // Get all named captures
          const captures = match.captures;

          // Severity
          if (captures.severity) {
            text += ` (Severity ${match.capture('severity')})`;
          }

          // Trace
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

  parseCmdOptions(cmdOptions) {
    if (!cmdOptions) {
      return [];
    }

    // Parse all the options into an array
    const parameters = [];
    let cmdOptionsTemp = cmdOptions;
    const options = cmdOptions.match(/\-\-?\w+\s*=?/ig);
    options.forEach(option => {
      // Clean the option
      cmdOptionsTemp = cmdOptionsTemp.replace(option, '');

      // Search for the next option
      let value = cmdOptionsTemp;
      const nextOption = cmdOptionsTemp.match(/\-\-?\w+\s*=?/i);
      if (nextOption) {
        const index = cmdOptionsTemp.indexOf(nextOption[0]);
        value = cmdOptionsTemp.substr(0, index);
      }

      // Clean the value
      cmdOptionsTemp = cmdOptionsTemp.replace(value, '');

      const cleanedOption = option.replace('=', '').trim();

      parameters.push(cleanedOption);
      parameters.push(value);
    });

    parameters.push('-');

    return parameters;
  },

  getCwd(filePath) {
    const projDirs = atom.project.getDirectories();
    for (const projDir of projDirs) {
      if (projDir.contains(filePath)) {
        return projDir.getPath();
      }
    }

    return Path.dirname(filePath);
  },
};
