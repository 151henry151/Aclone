// SPDX-License-Identifier: GPL-3.0-or-later
/** Update delegated panel markup without replacing unchanged controls or their focus.
 * Dirty input values and native disclosure state belong to the player. */
export function patchPanelContent(root: Element, html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const identity = (node: Node) => {
    if (!(node instanceof Element)) return String(node.nodeType);
    return JSON.stringify([
      node.tagName,
      ...['id', 'class', 'name', 'data-do', 'data-id', 'data-player', 'data-action'].map((key) =>
        node.getAttribute(key),
      ),
    ]);
  };
  const patch = (current: Node, next: Node) => {
    if (current instanceof Element && next instanceof Element) {
      for (const { name } of [...current.attributes])
        if (!next.hasAttribute(name) && !(current instanceof HTMLDetailsElement && name === 'open'))
          current.removeAttribute(name);
      for (const { name, value } of next.attributes)
        if (
          current.getAttribute(name) !== value &&
          !(current instanceof HTMLDetailsElement && name === 'open')
        )
          current.setAttribute(name, value);
      children(current, next);
    } else if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
  };
  const children = (current: Node, next: Node) => {
    let cursor = current.firstChild;
    for (const child of [...next.childNodes]) {
      const key = identity(child);
      let match = cursor;
      while (match && identity(match) !== key) match = match.nextSibling;
      if (!match) {
        current.insertBefore(child, cursor);
        continue;
      }
      if (match !== cursor) current.insertBefore(match, cursor);
      patch(match, child);
      cursor = match.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      current.removeChild(cursor);
      cursor = next;
    }
  };
  children(root, template.content);
}
