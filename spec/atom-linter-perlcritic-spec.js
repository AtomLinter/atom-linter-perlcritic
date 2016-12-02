'use babel';

import * as path from 'path';

const goodPath = path.join(__dirname, 'fixtures', 'good.pl');
const badPath = path.join(__dirname, 'fixtures', 'bad.pl');

describe('The perlcritic provider for Linter', () => {
  const lint = require('../lib/init.js').provideLinter().lint;

  beforeEach(() => {
    atom.workspace.destroyActivePaneItem();

    waitsForPromise(() =>
      Promise.all([
        atom.packages.activatePackage('linter-perlcritic'),
        atom.packages.activatePackage('language-perl'),
      ]),
    );
  });

  it('shows nothing wrong with a valid file', () => {
    waitsForPromise(() =>
      atom.workspace.open(goodPath).then(editor => lint(editor)).then(messages =>
        expect(messages.length).toBe(0),
      ),
    );
  });

  it('properly shows messages for a problematic file', () => {
    const cbS = 'Code before strictures are enabled (Severity 5) [See page 429 of PBP.]';
    waitsForPromise(() =>
      atom.workspace.open(badPath).then(editor => lint(editor)).then((messages) => {
        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0].type).toBe('Info');
        expect(messages[0].text).toBe(cbS);
        expect(messages[0].html).not.toBeDefined();
        expect(messages[0].filePath).toBe(badPath);
        expect(messages[0].range).toEqual([[0, 0], [0, 2]]);
      }),
    );
  });
});
