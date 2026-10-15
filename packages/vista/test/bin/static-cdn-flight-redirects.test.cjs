#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { prepareStaticCdnOutput } = require('../../dist/deploy/utils');

function makePagesDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vista-flight-'));
  const pages = path.join(root, 'static', 'pages');
  fs.mkdirSync(path.join(pages, 'blog'), { recursive: true });
  fs.writeFileSync(path.join(pages, 'index.rsc'), '0:flight-index');
  fs.writeFileSync(path.join(pages, 'docs.rsc'), '0:flight-docs');
  fs.writeFileSync(path.join(pages, 'blog', 'post.rsc'), '0:flight-blog-post');
  return { root, pages };
}

test('prepareStaticCdnOutput emits .rsc identity rewrites so Flight never falls through to HTML', () => {
  const { root } = makePagesDir();
  const target = path.join(root, 'out');
  fs.mkdirSync(target, { recursive: true });

  try {
    prepareStaticCdnOutput(target);
    const redirects = fs
      .readFileSync(path.join(target, '_redirects'), 'utf8')
      .split('\n')
      .filter(Boolean);

    // Extensionless `/rsc/foo` aliases must map to the `.rsc` file.
    assert.ok(
      redirects.includes('/rsc/docs /rsc/docs.rsc 200'),
      'missing extensionless /rsc/docs alias'
    );
    assert.ok(
      redirects.includes('/rsc/blog/post /rsc/blog/post.rsc 200'),
      'missing nested /rsc/blog/post alias'
    );

    // The `.rsc` URL itself must be an identity rewrite, otherwise the
    // `^/(.+)$` -> `.html` catch-all rewrites Flight to HTML.
    assert.ok(
      redirects.includes('/rsc/docs.rsc /rsc/docs.rsc 200'),
      'missing /rsc/docs.rsc identity rewrite'
    );
    assert.ok(
      redirects.includes('/rsc/blog/post.rsc /rsc/blog/post.rsc 200'),
      'missing /rsc/blog/post.rsc identity rewrite'
    );

    // Root index aliases.
    assert.ok(redirects.includes('/rsc /rsc/index.rsc 200'));
    assert.ok(redirects.includes('/rsc/ /rsc/index.rsc 200'));

    // No duplicate lines.
    assert.equal(new Set(redirects).size, redirects.length);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
