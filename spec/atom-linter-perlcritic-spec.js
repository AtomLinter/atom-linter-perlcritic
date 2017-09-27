'use babel';

// eslint-disable-next-line no-unused-vars
import { it, fit, wait, beforeEach, afterEach } from 'jasmine-fix';
import * as path from 'path';

const { lint } = require('../lib/init.js').provideLinter();

const goodPath = path.join(__dirname, 'fixtures', 'good.pl');
const badPath = path.join(__dirname, 'fixtures', 'bad.pl');

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
    const cbS = 'Code before strictures are enabled (Severity 5) [See page 429 of PBP.]';
    const editor = await atom.workspace.open(badPath);
    const messages = await lint(editor);

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].severity).toBe('info');
    expect(messages[0].excerpt).toBe(cbS);
    expect(messages[0].location.file).toBe(badPath);
    expect(messages[0].location.position).toEqual([[0, 0], [0, 2]]);
  });
});
