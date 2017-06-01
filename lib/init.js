'use babel';

// eslint-disable-next-line import/extensions
import { CompositeDisposable } from 'atom';

// Dependencies
let Path;
let Helpers;
let NamedRegexp;

function loadDeps() {
  if (!Path) {
    Path = require('path');
  }
  if (!Helpers) {
    Helpers = require('atom-linter');
  }
  if (!NamedRegexp) {
    NamedRegexp = require('named-regexp');
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
  if (!cmdOptions) {
    return [];
  }

  // Parse all the options into an array
  const parameters = [];
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

  parameters.push('-');

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

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('linter-perlcritic.executablePath', (value) => {
        this.executablePath = value;
      }),
      atom.config.observe('linter-perlcritic.commandlineOptions', (value) => {
        this.commandlineOptions = value;
      }),
      atom.config.observe('linter-perlcritic.regex', (value) => {
        this.regex = value;
      }),
      atom.config.observe('linter-perlcritic.level', (value) => {
        this.level = value;
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
      lintOnFly: true,
      lint: async (textEditor) => {
        // Ensure dependencies are loaded
        loadDeps();

        const command = this.executablePath;

        // Parse command options, replace space by '='
        const cmdOptions = this.commandlineOptions;
        const parameters = parseCmdOptions(cmdOptions);

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
        let regex = new RegExp(this.regex, 'ig');
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
            type: this.level,
            text,
            filePath,
            range: Helpers.generateRange(textEditor, line, col),
          });

          match = regex.exec(result);
        }

        return messages;
      },
    };
  },
};
