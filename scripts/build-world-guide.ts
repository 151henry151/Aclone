// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { Marked } from 'marked';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function buildWorldGuide(root: string, output: string, version: string) {
  const docRoot = join(root, 'docs');
  const markdown = readFileSync(join(docRoot, 'WORLD_BUILDING_GUIDE.md'), 'utf8');
  const headings: { id: string; text: string; depth: number }[] = [];
  const images = new Set<string>();
  const used = new Set<string>();
  // Only repository-authored Markdown is rendered, never uploads or user input.
  const marked = new Marked({
    renderer: {
      heading({ tokens, text, depth }) {
        const base = text
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .replace(/ +/g, '-');
        let id = base,
          n = 1;
        while (used.has(id)) id = `${base}-${n++}`;
        used.add(id);
        headings.push({ id, text, depth });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>`;
      },
      image({ href, text }) {
        if (
          !/^screenshots\/world-building\/[a-z-]+\.webp$/.test(href) ||
          !existsSync(join(docRoot, href))
        )
          throw Error('Missing or unexpected guide screenshot: ' + href);
        images.add(href);
        const url = '/assets/world-building/' + href.split('/').at(-1);
        return `<figure><a href="${url}" aria-label="Enlarge: ${escape(text)}"><img src="${url}" width="1440" height="1100" loading="lazy" alt="${escape(text)}"></a><figcaption>${escape(text)}</figcaption></figure>`;
      },
      link({ href, tokens }) {
        let url = href;
        if (!href.startsWith('#') && !href.startsWith('https://')) {
          const file = resolve(docRoot, href.split('#')[0]);
          if (!file.startsWith(docRoot + sep) || !existsSync(file))
            throw Error('Missing guide link: ' + href);
          url = 'https://github.com/151henry151/Aclone/blob/main/docs/' + href;
        }
        return `<a href="${escape(url)}">${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  const body = marked.parse(markdown, { async: false });
  const toc = headings
    .filter((h) => h.depth === 2)
    .map((h) => `<li><a href="#${h.id}">${escape(h.text)}</a></li>`)
    .join('');
  const template = readFileSync(join(root, 'website/world-building/index.html'), 'utf8');
  const html = template
    .replace('__GUIDE_BODY__', body)
    .replace('__GUIDE_TOC__', toc)
    .replaceAll('__VERSION__', escape(version));
  mkdirSync(join(output, 'world-building'), { recursive: true });
  mkdirSync(join(output, 'assets/world-building'), { recursive: true });
  writeFileSync(join(output, 'world-building/index.html'), html);
  cpSync(join(root, 'website/world-building/guide.css'), join(output, 'world-building/guide.css'));
  for (const img of images)
    cpSync(join(docRoot, img), join(output, 'assets/world-building', img.split('/').at(-1)!));
  console.log(
    `Built world-building guide: ${headings.length} sections, ${images.size} screenshots`,
  );
}
