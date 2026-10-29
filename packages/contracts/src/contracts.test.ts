import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SEED_APPS,
  NODE_DEFINITIONS,
  appDefinitionSchema,
  assertJsonSafe,
  validateWorkflowShape,
  validateTypedValues,
  scheduleProfileSchema,
  requestSchema,
} from './index.js';
import type { WorkflowBundle, FieldDefinition } from './index.js';

const example = (): WorkflowBundle =>
  JSON.parse(
    readFileSync(
      new URL(
        '../../../docs/source-plan/v2/schemas/minimal-workflow.example.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as WorkflowBundle;
describe('workflow boundary', () => {
  it('accepts the reference wire format and a custom app without certifying it', () => {
    const b = example();
    b.workflow.appId = 'custom_app';
    expect(validateWorkflowShape(b).ok).toBe(true);
    expect(NODE_DEFINITIONS).toHaveLength(40);
    expect(SEED_APPS.every((a) => a.certification === 'NOT_RUN')).toBe(true);
  });
  it.each([
    [
      'unknown config',
      (b: WorkflowBundle) => {
        b.graphs[0]!.nodes[0]!.config.executeShell = 'whoami';
      },
    ],
    [
      'nonfinite geometry',
      (b: WorkflowBundle) => {
        b.graphs[0]!.nodes[0]!.x = Infinity;
      },
    ],
    [
      'reserved key',
      (b: WorkflowBundle) => {
        b.inputs.push({ key: '__proto__', type: 'text', scope: 'row', required: false });
      },
    ],
    [
      'unknown port',
      (b: WorkflowBundle) => {
        Reflect.set(b.graphs[0]!.edges[0]!, 'port', 'arbitrary');
      },
    ],
    [
      'unknown node',
      (b: WorkflowBundle) => {
        Reflect.set(b.graphs[0]!.nodes[0]!, 'type', 'shell');
      },
    ],
    [
      'unknown root',
      (b: WorkflowBundle) => {
        Reflect.set(b, 'commands', ['rm']);
      },
    ],
  ])('rejects %s before mutation', (_label, change) => {
    const b = example();
    change(b);
    expect(validateWorkflowShape(b).ok).toBe(false);
  });
  it('rejects pollution, accessors, cyclic and class values', () => {
    expect(() => assertJsonSafe(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
    expect(() =>
      assertJsonSafe(
        Object.defineProperty({}, 'get', {
          get: () => {
            throw Error('must not execute');
          },
        }),
      ),
    ).toThrow('accessor');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertJsonSafe(cyclic)).toThrow('Cyclic');
    expect(() => assertJsonSafe(new Date())).toThrow('Non-plain');
    expect(() => assertJsonSafe(new Array(3))).toThrow('Sparse');
  });
  it('enforces depth and entry budgets', () => {
    expect(() =>
      assertJsonSafe({ a: { b: {} } }, { depth: 1, entries: 10, stringLength: 10 }),
    ).toThrow();
    expect(() => assertJsonSafe([1, 2, 3], { depth: 4, entries: 2, stringLength: 10 })).toThrow();
  });
});
describe('typed data', () => {
  const fields: FieldDefinition[] = [
    { key: 'count', type: 'number', scope: 'row', required: true },
    { key: 'enabled', type: 'boolean', scope: 'row', required: true },
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'assets', type: 'file[]', scope: 'row', required: true },
    { key: 'comments', type: 'list', itemType: 'text', scope: 'row', required: true },
  ];
  it('preserves zero, false, empty text, empty list and ordered assets', () => {
    expect(
      validateTypedValues(fields, {
        count: 0,
        enabled: false,
        caption: '',
        assets: [{ assetId: 'b' }, { assetId: 'a' }],
        comments: [],
      }),
    ).toEqual([]);
  });
  it('distinguishes missing from empty and rejects string-coercion', () => {
    expect(
      validateTypedValues(fields, { count: '0', enabled: 'false' }).map((i) => i.code),
    ).toContain('TYPE_MISMATCH');
    expect(validateTypedValues(fields, {}).filter((i) => i.code === 'REQUIRED')).toHaveLength(5);
  });
  it('rejects writing output fields in a row context', () => {
    expect(
      validateTypedValues(
        [{ key: 'postId', type: 'text', scope: 'output', required: false }],
        { postId: 'fake' },
        'row',
      ),
    ).toHaveLength(1);
  });
  it('validates safe asset refs, protocols and dates', () => {
    expect(
      validateTypedValues([{ key: 'asset', type: 'file', scope: 'row', required: true }], {
        asset: '/etc/passwd',
      }),
    ).toHaveLength(1);
    expect(
      validateTypedValues([{ key: 'link', type: 'url', scope: 'row', required: true }], {
        link: 'javascript:alert(1)',
      }),
    ).toHaveLength(1);
    expect(
      validateTypedValues([{ key: 'when', type: 'datetime', scope: 'row', required: true }], {
        when: { instant: '2026-02-30T00:00:00Z', timezone: 'Asia/Ho_Chi_Minh' },
      }),
    ).toHaveLength(1);
  });
});
describe('app/process request contracts', () => {
  it('supports arbitrary Android packages but rejects duplicate packages and unknown keys', () => {
    const app = {
      id: 'custom',
      name: 'Custom',
      packages: ['com.example.app'],
      targetKinds: ['custom'],
      mediaKinds: ['text'],
      certification: 'NOT_RUN',
    };
    expect(appDefinitionSchema.safeParse(app).success).toBe(true);
    expect(
      appDefinitionSchema.safeParse({ ...app, packages: ['com.example.app', 'com.example.app'] })
        .success,
    ).toBe(false);
    expect(appDefinitionSchema.safeParse({ ...app, password: 'secret' }).success).toBe(false);
  });
  it.each(['2026-02-30', '2026-13-01'])('rejects invalid calendar date %s', (startDate) => {
    expect(
      scheduleProfileSchema.safeParse({
        timezone: 'Asia/Ho_Chi_Minh',
        startDate,
        slots: ['08:00'],
        weekdays: [1],
        overduePolicy: 'NEXT_FUTURE_SLOT',
        jitterMinutes: 0,
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate slots, empty weekdays and out-of-range time', () => {
    const base = {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: '2026-10-26',
      slots: ['08:00'],
      weekdays: [1],
      overduePolicy: 'NEXT_FUTURE_SLOT',
      jitterMinutes: 0,
    };
    for (const patch of [
      { slots: ['24:00'] },
      { slots: ['08:00', '08:00'] },
      { weekdays: [] },
      { timezone: 'unknown' },
    ])
      expect(scheduleProfileSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it('does not accept shell/path commands through a request envelope', () => {
    expect(requestSchema.safeParse({ operationId: 'op_1', expectedRevision: 0 }).success).toBe(
      true,
    );
    expect(requestSchema.safeParse({ operationId: 'op_1', shell: 'whoami' }).success).toBe(false);
  });
});
