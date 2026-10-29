import { expect, it } from 'vitest';
import { parseUiXml } from './xml.js';
import { pickUiElement, queryUiElements, inspectUiSelectorMatches, suggestUiSelector } from '@autoreels/contracts';
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


it('v2 falls back after zero matches and traces the chosen strategy without changing v1 behavior', () => {
  const nodes = parseUiXml(xml(
    '<node bounds="[0,0][360,640]" class="android.view.View" package="com.fixture">' +
    '<node bounds="[10,10][80,60]" text="Submit" class="android.widget.Button" resource-id="com.fixture:id/submit"/>' +
    '</node>',
  ), 360, 640, 0);
  const selector = {
    version: 2,
    strategies: [
      { all: [{ field: 'resourceId', op: 'EQ', value: 'missing' }] },
      { all: [{ field: 'resourceId', op: 'EQ', value: 'com.fixture:id/submit' }] },
    ],
  } as const;
  const report = inspectUiSelectorMatches(nodes, selector);
  expect(report).toMatchObject({
    strategyIndex: 2,
    totalStrategies: 2,
    attempts: [{ strategyIndex: 1, count: 0 }, { strategyIndex: 2, count: 1 }],
    ambiguous: false,
  });
  expect(report.nodes).toHaveLength(1);
  expect(queryUiElements(nodes, selector)).toEqual(report.nodes);
  expect(queryUiElements(nodes, suggestUiSelector(nodes[1]!))).toHaveLength(1);
});

it('v2 requires the matching ancestor under a bounded parent relation', () => {
  const nodes = parseUiXml(xml(
    '<node bounds="[0,0][360,640]" class="Root" resource-id="container">' +
    '<node bounds="[0,0][360,200]" class="Inner">' +
    '<node bounds="[10,10][80,60]" text="Go" class="Button"/>' +
    '</node></node>' +
    '<node bounds="[0,200][360,640]" class="Other">' +
    '<node bounds="[10,210][80,260]" text="Go" class="Button"/>' +
    '</node>',
  ), 360, 640, 0);
  const strategy = (maxDepth: number) => ({
    version: 2,
    strategies: [{
      all: [{ field: 'text', op: 'EQ', value: 'Go' }],
      ancestor: { all: [{ field: 'resourceId', op: 'EQ', value: 'container' }], maxDepth },
    }],
  });
  expect(inspectUiSelectorMatches(nodes, strategy(2)).nodes).toHaveLength(1);
  expect(inspectUiSelectorMatches(nodes, strategy(1)).nodes).toHaveLength(0);
  expect(inspectUiSelectorMatches(nodes, strategy(2)).nodes[0]!.parentId).toBe('element_1');
});

it('reports ambiguity without trying later fallback; zero matches across all remain zero', () => {
  const nodes = parseUiXml(xml(
    node('text="Hello" resource-id="id/a"') + node('text="Hello" resource-id="id/b"'),
  ), 360, 640, 0);
  const ambiguous = inspectUiSelectorMatches(nodes, {
    version: 2,
    strategies: [
      { all: [{ field: 'text', op: 'EQ', value: 'Hello' }] },
      { all: [{ field: 'resourceId', op: 'EQ', value: 'id/a' }] },
    ],
  });
  expect(ambiguous.nodes).toHaveLength(2);
  expect(ambiguous.ambiguous).toBe(true);
  expect(ambiguous.strategyIndex).toBe(1);
  expect(ambiguous.attempts).toEqual([{ strategyIndex: 1, count: 2 }]);
  const absent = inspectUiSelectorMatches(nodes, {
    version: 2,
    strategies: [
      { all: [{ field: 'text', op: 'EQ', value: 'missing' }] },
      { all: [{ field: 'resourceId', op: 'EQ', value: 'absent' }] },
    ],
  });
  expect(absent).toMatchObject({ strategyIndex: null, ambiguous: false });
  expect(absent.attempts).toHaveLength(2);
  expect(absent.nodes).toEqual([]);
});

it('rejects hostile, malformed or unbounded v2 selectors and never reads password text', () => {
  const nodes = parseUiXml(xml(
    node('text="secret" password="true" resource-id="password-field"') +
    node('text="Public"'),
  ), 360, 640, 0);
  const passwordQuery = inspectUiSelectorMatches(nodes, {
    version: 2,
    strategies: [{ all: [{ field: 'text', op: 'EQ', value: 'secret' }] }],
  });
  expect(passwordQuery.nodes).toEqual([]);
  const values: unknown[] = [
    { version: 2, strategies: [] },
    { version: 2, strategies: Array.from({ length: 6 }, () => ({ all: [{ field: 'text', op: 'EQ', value: 'x' }] })) },
    { version: 2, strategies: [{ all: [{ field: 'text', op: 'REGEX', value: '.*' }] }] },
    { version: 2, strategies: [{ all: [{ field: '__proto__', op: 'EQ', value: 'x' }] }] },
    { version: 2, strategies: [{ all: [{ field: 'text', op: 'EQ', value: 'x' }], ancestor: { all: [{ field: 'className', op: 'EQ', value: 'Root' }], maxDepth: 21 } }] },
    { version: 2, strategies: [{ all: [{ field: 'text', op: 'EQ', value: 'x' }] }], arbitraryCode: 'return true' },
    JSON.parse('{"version":2,"strategies":[{"all":[{"field":"text","op":"EQ","value":"x"}],"__proto__":{}}]}'),
  ];
  for (const value of values) expect(() => inspectUiSelectorMatches(nodes, value)).toThrow();
  const cycle = structuredClone(nodes);
  cycle[0]!.parentId = cycle[1]!.id;
  cycle[1]!.parentId = cycle[0]!.id;
  expect(() => inspectUiSelectorMatches(cycle, {
    version: 2,
    strategies: [{
      all: [{ field: 'resourceId', op: 'EQ', value: 'password-field' }],
      ancestor: { all: [{ field: 'className', op: 'EQ', value: 'nobody' }], maxDepth: 5 },
    }],
  })).toThrow('CYCLE');
  expect(() => inspectUiSelectorMatches([...nodes, ...nodes], {
    version: 1,
    all: [{ field: 'text', op: 'EQ', value: 'Public' }],
  })).toThrow('DUPLICATE');
});
