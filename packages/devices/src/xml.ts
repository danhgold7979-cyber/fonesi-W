import { SaxesParser } from 'saxes';
import type { UiElement } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
export function parseUiXml(
  xml: string,
  width: number,
  height: number,
  rotation: number,
): UiElement[] {
  const fail = (): never => {
    throw new DomainError('INSPECTOR_XML', 'XML giao diện không hợp lệ hoặc vượt giới hạn.');
  };
  if (
    Buffer.byteLength(xml) > 2 * 1024 * 1024 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    /<!(?:DOCTYPE|ENTITY)/i.test(xml)
  )
    fail();
  const nodes: UiElement[] = [],
    stack: Array<string | null> = [];
  let roots = 0;
  const parser = new SaxesParser({ xmlns: false });
  parser.on('error', fail);
  parser.on('doctype', fail);
  parser.on('text', (text) => {
    if (text.trim()) fail();
  });
  parser.on('opentag', (tag) => {
    if (
      stack.length > 128 ||
      Object.values(tag.attributes).some((v) => typeof v !== 'string' || v.length > 8192)
    )
      fail();
    const attr = tag.attributes as Record<string, string>;
    if (stack.length === 0) {
      if (tag.name !== 'hierarchy' || ++roots !== 1 || Number(attr.rotation) !== rotation) fail();
      stack.push(null);
      return;
    }
    if (tag.name !== 'node' || nodes.length >= 10000) fail();
    const b = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attr.bounds ?? '');
    if (!b) fail();
    const [left, top, right, bottom] = b!.slice(1).map(Number) as [number, number, number, number];
    if (
      ![left, top, right, bottom].every(Number.isSafeInteger) ||
      right < left ||
      bottom < top ||
      right > width ||
      bottom > height
    )
      fail();
    const bool = (key: string) => {
      const value = attr[key];
      if (value !== undefined && !['true', 'false'].includes(value)) fail();
      return value === 'true';
    };
    const password = bool('password');
    const node: UiElement = {
      id: 'element_' + nodes.length,
      parentId: stack.at(-1)!,
      depth: stack.length - 1,
      resourceId: attr['resource-id'] ?? '',
      text: password ? '' : (attr.text ?? ''),
      description: password ? '' : (attr['content-desc'] ?? ''),
      className: attr.class ?? '',
      packageName: attr.package ?? '',
      clickable: bool('clickable'),
      enabled: bool('enabled'),
      focusable: bool('focusable'),
      scrollable: bool('scrollable'),
      password,
      bounds: { left, top, right, bottom },
    };
    nodes.push(node);
    stack.push(node.id);
  });
  parser.on('closetag', () => {
    stack.pop();
  });
  try {
    parser.write(xml).close();
  } catch {
    fail();
  }
  if (roots !== 1 || stack.length) fail();
  return nodes;
}
