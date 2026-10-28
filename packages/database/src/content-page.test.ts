import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessDefinition, ContentItem } from '@autoreels/contracts';
import { StudioDatabase } from './index.js';

let root: string;
let db: StudioDatabase;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'autoreels-content-page-'));
  db = new StudioDatabase(join(root, 'data.sqlite'));
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});
function process(id: string): ProcessDefinition {
  const draft = db.createWorkflow('fb', 'Paged ' + id);
  const value: ProcessDefinition = {
    id,
    name: id,
    appId: 'fb',
    workflowId: draft.workflowId,
    workflowVersionId: null,
    deviceId: null,
    accountId: null,
    targetId: null,
    revision: 0,
    archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: '2026-10-26',
      slots: ['08:00'],
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy: 'NEXT_FUTURE_SLOT',
      jitterMinutes: 0,
    },
  };
  return db.saveProcess(value, null);
}
function add(processId: string, n: number, caption = 'caption_' + n): ContentItem {
  return db.saveContent({
    id: processId + '_content_' + n,
    processId,
    revision: 0,
    fields: { caption, count: n, enabled: n % 2 === 0 },
    assetIds: [],
    ignored: false,
  }, null);
}
describe('P06 scoped SQLite content paging', () => {
  it('traverses 1000+ content rows with stable IDs, exact counts, Process isolation and no hidden truncation', () => {
    process('process_one');
    process('process_two');
    for (let i = 0; i < 1003; i++) add('process_one', i);
    for (let i = 0; i < 13; i++) add('process_two', i);
    const ids: string[] = [];
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
      const page = db.listContentPage({
        processId: 'process_one',
        limit: 125,
        ...(cursor ? { cursor } : {}),
      });
      expect(page.total).toBe(1003);
      expect(page.items.length).toBeLessThanOrEqual(125);
      expect(page.items.every((r) => r.processId === 'process_one')).toBe(true);
      ids.push(...page.items.map((r) => r.id));
      if (!page.hasMore) {
        expect(page.nextCursor).toBeNull();
        break;
      }
      expect(page.nextCursor).not.toBeNull();
      cursor = page.nextCursor!;
    }
    expect(ids).toHaveLength(1003);
    expect(new Set(ids).size).toBe(1003);
    expect(ids[0]).toBe('process_one_content_0');
    expect(ids.at(-1)).toBe('process_one_content_1002');
    expect(db.listContentPage({ processId: 'process_two', limit: 30 })).toMatchObject({
      total: 13, hasMore: false,
    });
  });
  it('serves ordered asset IDs in one bounded page and invalidates cursor after content and asset edits', () => {
    process('process_media');
    for (const id of ['asset_1', 'asset_2']) db.registerAsset({
      id,
      sourceRef: 'source',
      relativePath: id + '.png',
      hash: 'a'.repeat(64),
      kind: 'image',
      bytes: 1,
      mtimeMs: 1,
    });
    const first = add('process_media', 1);
    db.saveContent({ ...first, assetIds: ['asset_2', 'asset_1'] }, first.revision);
    add('process_media', 2);
    add('process_media', 3);
    const page = db.listContentPage({ processId: 'process_media', limit: 1 });
    expect(page.items[0]!.assetIds).toEqual(['asset_2', 'asset_1']);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTypeOf('string');
    db.saveContent({ ...page.items[0]!, assetIds: ['asset_1', 'asset_2'] }, page.items[0]!.revision);
    expect(() => db.listContentPage({
      processId: 'process_media', limit: 1, cursor: page.nextCursor!,
    })).toThrow('thay đổi');
    expect(db.listContentPage({ processId: 'process_media', limit: 3 }).items[0]!.assetIds).toEqual(
      ['asset_1', 'asset_2'],
    );
  });
  it('rejects bad/mismatched/stale cursors across Process, search and restart', () => {
    process('process_a');
    process('process_b');
    add('process_a', 1, 'Alpha % literal');
    add('process_a', 2, 'Beta keyword');
    add('process_a', 3, 'Gamma keyword');
    add('process_b', 1, 'Private other process');
    const first = db.listContentPage({ processId: 'process_a', limit: 1 });
    expect(() => db.listContentPage({
      processId: 'process_b', limit: 1, cursor: first.nextCursor!,
    })).toThrow('Process');
    expect(() => db.listContentPage({
      processId: 'process_a', search: 'keyword', limit: 1, cursor: first.nextCursor!,
    })).toThrow('bộ lọc');
    for (const cursor of ['!', 'e30', 'A'.repeat(4100)]) {
      expect(() => db.listContentPage({ processId: 'process_a', cursor })).toThrow();
    }
    expect(() => db.listContentPage({ processId: 'process_a', limit: 0 })).toThrow('Limit');
    expect(() => db.listContentPage({ processId: 'process_a', limit: 251 })).toThrow('Limit');
    const expected = db.listContentPage({ processId: 'process_a', search: 'keyword' });
    expect(expected.total).toBe(2);
    expect(expected.items.map((r) => r.id)).toEqual([
      'process_a_content_2', 'process_a_content_3',
    ]);
    expect(db.listContentPage({ processId: 'process_a', search: '%' }).total).toBe(1);
    db.close();
    db = new StudioDatabase(join(root, 'data.sqlite'));
    expect(db.listContentPage({
      processId: 'process_a', cursor: first.nextCursor!, limit: 1,
    }).items[0]!.id).toBe('process_a_content_2');
    const row = db.listContent('process_a')[1]!;
    db.saveContent({ ...row, fields: { ...row.fields, caption: 'Changed' } }, row.revision);
    expect(() => db.listContentPage({
      processId: 'process_a', cursor: first.nextCursor!, limit: 1,
    })).toThrow('thay đổi');
  });
  it('counts ignored rows explicitly without changing historical content files or records', () => {
    process('process_ignore');
    add('process_ignore', 1);
    const ignored = add('process_ignore', 2);
    db.ignoreContent(ignored.id, ignored.revision);
    expect(db.listContentPage({ processId: 'process_ignore' }).total).toBe(1);
    const all = db.listContentPage({ processId: 'process_ignore', includeIgnored: true });
    expect(all.total).toBe(2);
    expect(all.items.find((r) => r.id === ignored.id)?.ignored).toBe(true);
  });
});
