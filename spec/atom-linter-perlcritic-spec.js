'use babel';

// eslint-disable-next-line no-unused-vars
import { it, fit, wait, beforeEach, afterEach } from 'jasmine-fix';
import * as path from 'path';

const { lint } = require('../lib/init.js').provideLinter();

const goodPath = path.join(__dirname, 'fixtures', 'good.pl');
const badPath = path.join(__dirname, 'fixtures', 'bad.pl');

const cbsExcerpt = 'Code before strictures are enabled (Severity 5) [See page 429 of PBP.]';

const checkCbsMessage = (message, excerpt = cbsExcerpt) => {
  expect(message.severity).toBe('info');
  expect(message.excerpt).toBe(excerpt);
  expect(message.location.file).toBe(badPath);
  expect(message.location.position).toEqual([[1, 0], [1, 2]]);
};

describe('The perlcritic provider for Linter', () => {
  beforeEach(async () => {
    atom.workspace.destroyActivePaneItem();

    await atom.packages.activatePackage('language-perl');
    await atom.packages.activatePackage('linter-perlcritic');
  });

  it('shows nothing wrong with a valid file', async () => {
    const editor = await atom.workspace.open(goodPath);
    const messages = await lint(editor);

    expect(messages.length).toBe(0);
  });

  it('properly shows messages for a problematic file', async () => {
    const editor = await atom.workspace.open(badPath);
    const messages = await lint(editor);

    expect(messages.length).toBe(1);
    checkCbsMessage(messages[0]);
  });

  describe('has settings that control the output', () => {
    it('allows controlling whether the severity shows', async () => {
      atom.config.set('linter-perlcritic.showSeverity', true);
      const editor = await atom.workspace.open(badPath);
      const messages = await lint(editor);

      expect(messages.length).toBe(1);
      checkCbsMessage(messages[0]);

      atom.config.set('linter-perlcritic.showSeverity', false);

      const newMessages = await lint(editor);
      expect(newMessages.length).toBe(1);
      const excerpt = 'Code before strictures are enabled [See page 429 of PBP.]';
      checkCbsMessage(newMessages[0], excerpt);
    });

    it('allows controlling whether the explanation shows', async () => {
      atom.config.set('linter-perlcritic.showExplanation', true);
      const editor = await atom.workspace.open(badPath);
      const messages = await lint(editor);

      expect(messages.length).toBe(1);
      checkCbsMessage(messages[0]);

      atom.config.set('linter-perlcritic.showExplanation', false);

      const newMessages = await lint(editor);
      expect(newMessages.length).toBe(1);
      const excerpt = 'Code before strictures are enabled (Severity 5)';
      checkCbsMessage(newMessages[0], excerpt);
    });

    it('allows controlling whether the policy shows', async () => {
      atom.config.set('linter-perlcritic.showPolicy', false);
      const editor = await atom.workspace.open(badPath);
      const messages = await lint(editor);

      expect(messages.length).toBe(1);
      checkCbsMessage(messages[0]);

      atom.config.set('linter-perlcritic.showPolicy', true);

      const newMessages = await lint(editor);
      expect(newMessages.length).toBe(1);
      const excerpt = `${cbsExcerpt} <TestingAndDebugging::RequireUseStrict>`;
      checkCbsMessage(newMessages[0], excerpt);
    });
  });

  describe('allows controlling the forced severity shown', () => {
    // This should actually test against a config file that uses a specific severity...
    let editor;

    beforeEach(async () => {
      editor = await atom.workspace.open(badPath);
    });

    it('defaults to not forcing the policy', async () => {
      atom.config.set('linter-perlcritic.forceMinimumSeverity', 'none');
      const messages = await lint(editor);
      expect(messages.length).toBe(1);
      checkCbsMessage(messages[0]);
    });

    it('supports forcing gentle severity', async () => {
      atom.config.set('linter-perlcritic.forceMinimumSeverity', 'gentle');
      const messages = await lint(editor);
      expect(messages.length).toBe(1);
      checkCbsMessage(messages[0]);
    });

    it('supports forcing stern severity', async () => {
      atom.config.set('linter-perlcritic.forceMinimumSeverity', 'stern');
      const messages = await lint(editor);
      expect(messages.length).toBe(4);
      checkCbsMessage(messages[2]);
    });

    it('supports forcing harsh severity', async () => {
      atom.config.set('linter-perlcritic.forceMinimumSeverity', 'harsh');
      const messages = await lint(editor);
      expect(messages.length).toBe(4);
      checkCbsMessage(messages[2]);
    });

    it('supports forcing cruel severity', async () => {
      atom.config.set('linter-perlcritic.forceMinimumSeverity', 'cruel');
      const messages = await lint(editor);
      expect(messages.length).toBe(6);
      checkCbsMessage(messages[3]);
    });
  });
});
