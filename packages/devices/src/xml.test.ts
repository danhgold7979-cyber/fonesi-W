import { expect, it } from 'vitest';
import { parseUiXml } from './xml.js';
import { pickUiElement, queryUiElements, suggestUiSelector } from '@autoreels/contracts';
const node = (attributes = '') =>
  `<node bounds="[0,0][360,640]" class="android.view.View" package="com.fixture" ${attributes}/>`;
const xml = (body = node(), rotation = 0) =>
  `<?xml version="1.0" encoding="UTF-8"?><hierarchy rotation="${rotation}">${body}</hierarchy>`;
it('strictly parses hierarchy, decodes escaped labels, preserves parent identity and redacts password fields', () => {
  const nodes = parseUiXml(
    xml(
      `<node bounds="[0,0][360,640]" class="Root">${node('text="A &amp; B" resource-id="com.fixture:id/name"')}${node('text="private" content-desc="secret" password="true"')}</node>`,
    ),
    360,
    640,
    0,
  );
  expect(nodes[1]).toMatchObject({ text: 'A & B', parentId: 'element_0', depth: 1 });
  expect(nodes[2]).toMatchObject({ text: '', description: '', password: true });
  expect(JSON.stringify(nodes)).not.toContain('private');
  expect(JSON.stringify(nodes)).not.toContain('secret');
});
it('rejects malformed XML, DTD/entities, out-of-range geometry and rotation mismatches', () => {
  for (const bad of [
    '<hierarchy>',
    xml().replace('360,640', '999,999'),
    xml(node(), 1),
    '<!DOCTYPE hierarchy [<!ENTITY x "value">]>' + xml(),
    xml(node('text="&unknown;"')),
    xml(node('clickable="yes"')),
    xml(node()) + '<node/>',
  ])
    expect(() => parseUiXml(bad, 360, 640, 0)).toThrow('XML');
});
it('enforces byte, depth and node budgets before accepting a tree', () => {
  expect(() => parseUiXml(xml(node('text="' + 'x'.repeat(8193) + '"')), 360, 640, 0)).toThrow();
  expect(() => parseUiXml(xml(node().repeat(10001)), 360, 640, 0)).toThrow();
  const nested = '<node bounds="[0,0][1,1]">'.repeat(130) + '</node>'.repeat(130);
  expect(() => parseUiXml(xml(nested), 360, 640, 0)).toThrow();
  expect(() => parseUiXml(' '.repeat(2097153), 360, 640, 0)).toThrow();
});
it('uses exact/contains predicates with actual 0/1/n counts and never evaluates selector code', () => {
  const nodes = parseUiXml(
    xml(
      node('text="Hello" resource-id="com.fixture:id/a"') +
        node('text="Hello again" resource-id="com.fixture:id/b"'),
    ),
    360,
    640,
    0,
  );
  expect(queryUiElements(nodes, suggestUiSelector(nodes[0]!))).toHaveLength(1);
  expect(
    queryUiElements(nodes, {
      version: 1,
      all: [{ field: 'text', op: 'CONTAINS', value: 'Hello' }],
    }),
  ).toHaveLength(2);
  expect(
    queryUiElements(nodes, { version: 1, all: [{ field: 'text', op: 'EQ', value: 'absent' }] }),
  ).toHaveLength(0);
  for (const bad of [
    { version: 1, all: [] },
    { version: 1, all: [{ field: '__proto__', op: 'EQ', value: 'x' }] },
    { version: 1, all: [{ field: 'text', op: 'REGEX', value: '.*' }] },
  ])
    expect(() => queryUiElements(nodes, bad)).toThrow();
});
it('picks the smallest visible bound and applies strict right/bottom boundaries', () => {
  const nodes = parseUiXml(
    xml(
      `<node bounds="[0,0][360,640]">${node().replace('[0,0][360,640]', '[20,30][100,80]')}</node>`,
    ),
    360,
    640,
    0,
  );
  expect(pickUiElement(nodes, 30, 40)?.id).toBe('element_1');
  expect(pickUiElement(nodes, 100, 80)?.id).toBe('element_0');
  expect(pickUiElement(nodes, 360, 640)).toBeNull();
});
