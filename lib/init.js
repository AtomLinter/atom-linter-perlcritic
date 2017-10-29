'use babel';

// eslint-disable-next-line import/extensions
import { CompositeDisposable } from 'atom';

// Dependencies
let Path;
let Helpers;

// Internal vars
const sep = '~~lpc~~';

function loadDeps() {
  if (!Path) {
    Path = require('path');
  }
  if (!Helpers) {
    Helpers = require('atom-linter');
  }
}

const getCwd = (filePath) => {
  const projDir = atom.project.relativizePath(filePath)[0];
  if (projDir !== null) {
    return projDir;
  }

  return Path.dirname(filePath);
};

const parseCmdOptions = (cmdOptions) => {
  const parameters = [];

  // Parse all the options into an array
  if (cmdOptions) {
    let cmdOptionsTemp = cmdOptions;
    const options = cmdOptions.match(/--?\w+\s*=?/ig);
    options.forEach((option) => {
      // Clean the option
      cmdOptionsTemp = cmdOptionsTemp.replace(option, '');

      // Search for the next option
      let value = cmdOptionsTemp;
      const nextOption = cmdOptionsTemp.match(/--?\w+\s*=?/i);
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
  }

  return parameters;
};

export default {
  activate() {
    this.idleCallbacks = new Set();
    let depsCallbackID;
    const installLinterPerlcriticDeps = () => {
      this.idleCallbacks.delete(depsCallbackID);
      if (!atom.inSpecMode()) {
        require('atom-package-deps').install('linter-perlcritic');
      }
      // Opportunisticly load the dependencies if they haven't already
      loadDeps();
    };
    depsCallbackID = window.requestIdleCallback(installLinterPerlcriticDeps);
    this.idleCallbacks.add(depsCallbackID);

    // FIXME: Remove after 2017-11-01
    if (atom.config.get('linter-perlcritic.regex')) {
      atom.config.unset('linter-perlcritic.regex');
    }

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('linter-perlcritic.executablePath', (value) => {
        this.executablePath = value;
      }),
      atom.config.observe('linter-perlcritic.commandlineOptions', (value) => {
        this.commandlineOptions = value;
      }),
      atom.config.observe('linter-perlcritic.level', (value) => {
        this.level = value;
      }),
      atom.config.observe('linter-perlcritic.showSeverity', (value) => {
        this.showSeverity = value;
      }),
      atom.config.observe('linter-perlcritic.showExplanation', (value) => {
        this.showExplanation = value;
      }),
      atom.config.observe('linter-perlcritic.showPolicy', (value) => {
        this.showPolicy = value;
      }),
      atom.config.observe('linter-perlcritic.forceMinimumSeverity', (value) => {
        this.forceMinimumSeverity = value;
      }),
    );
  },

  deactivate() {
    this.idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID));
    this.idleCallbacks.clear();
    this.subscriptions.dispose();
  },

  provideLinter() {
    return {
      name: 'perlcritic',
      grammarScopes: ['source.perl.mojolicious', 'source.perl'],
      scope: 'file',
      lintsOnChange: true,
      lint: async (textEditor) => {
        // Ensure dependencies are loaded
        loadDeps();

        const command = this.executablePath;

        // Parse command options, replace space by '='
        const cmdOptions = this.commandlineOptions;
        const parameters = parseCmdOptions(cmdOptions);
        // Force the output format to our predefined one
        // See the following for more details:
        // http://search.cpan.org/~petdance/Perl-Critic-1.130/lib/Perl/Critic/Violation.pm#OVERLOADS
        // The double separator at the end is needed to distinguish between multiple
        // records since the %d output spans multiple lines.
        parameters.push('-verbose');
        parameters.push(`%L:%c${sep}%m${sep}%e${sep}%p${sep}%s${sep}%d${sep}${sep}\\n`);

        if (this.forceMinimumSeverity !== 'none') {
          parameters.push(`--${this.forceMinimumSeverity}`);
        }

        parameters.push('-');

        // get cwd
        const filePath = textEditor.getPath();
        const cwd = getCwd(filePath);

        // get document text
        const fileText = textEditor.getText();

        // Execute the perlcritic command
        let result;
        try {
          result = await Helpers.exec(
            command,
            parameters, {
              stdin: fileText,
              cwd,
              env: process.env,
              ignoreExitCode: true,
            },
          );
        } catch (error) {
          const notifications = atom.notifications.getNotifications();
          const isDisplayingNotification = notifications.some(notification => (
            notification.message === `Error: ${error.message}`
            && notification.dismissed === false
          ));

          if (!isDisplayingNotification) {
            atom.notifications.addError(`Error: ${error.message}`, {
              dismissable: true,
              stack: error.stack,
            });
          }
          return null;
        }

        // Return if document has changed
        if (textEditor.getText() !== fileText) {
          return null;
        }

        // Parse result
        const regex = new RegExp([
          `(\\d+):(\\d+)${sep}`, // [1-2] line:column (%L:%c)
          `(.+)${sep}`, // [3] Brief description (%m)
          `(.+)${sep}`, // [4] Explination of violation or PBP page # (%e)
          `(.+)${sep}`, // [5] Policy name of violation module (%p)
          `(\\d+)${sep}`, // [6] Severity (%s)
          `([\\s\\S]+?)${sep}${sep}$`, // [7] Full diagnostic discussion (%d)
        ].join(''), 'gm');

        const messages = [];
        let match = regex.exec(result);
        while (match !== null) {
          const line = Math.max(Number.parseInt(match[1], 10) - 1, 0);
          const col = Math.max(Number.parseInt(match[2], 10) - 1, 0);
          const excerptParts = [match[3]];
          if (this.showSeverity) {
            excerptParts.push(`(Severity ${match[6]})`);
          }
          if (this.showExplanation) {
            excerptParts.push(`[${match[4]}.]`);
          }
          if (this.showPolicy) {
            excerptParts.push(`<${match[5]}>`);
          }

          messages.push({
            severity: this.level,
            excerpt: excerptParts.join(' '),
            location: {
              file: filePath,
              position: Helpers.generateRange(textEditor, line, col),
            },
            description: match[7],
          });

          match = regex.exec(result);
        }

        return messages;
      },
    };
  },
};
