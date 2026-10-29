import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { FieldDefinition, JobSnapshot, WorkflowBundle } from '@autoreels/contracts';
import { deriveFrozenUnicodeTextPlan } from './unicode-compose.js';

function fixture(): JobSnapshot {
  const inputs: FieldDefinition[] = [
    { key: 'caption', scope: 'row', type: 'text', required: true },
    { key: 'comment', scope: 'row', type: 'text', required: false },
    { key: 'pageUrl', scope: 'process', type: 'url', required: true },
    { key: 'media', scope: 'row', type: 'file', required: false },
  ];
  const bundle: WorkflowBundle = {
    format: 'autoreels-workflow', schemaVersion: 2,
    workflow: { id: 'workflow_unicode', appId: 'fb', name: 'Unicode compose', kind: 'main' },
    mainGraphId: 'graph_unicode', graphs: [],
    inputs, outputs: [], dependencies: [],
  };
  return {
    workflowVersionId: 'version_unicode',
    workflowHash: 'a'.repeat(64), bundle,
    contentId: 'content_unicode',
    fields: {
      caption: 'Tiếng Việt có dấu, emoji 👨‍👩‍👧‍👦 và dòng 1\r\ndòng 2.',
      comment: 'e\u0301 / 👋🏽\nĐã lưu đúng Unicode',
      media: { assetId: 'asset_unicode' },
    },
    processFields: { pageUrl: 'https://example.com/đường-dẫn?q=%20' },
    assetIds: ['asset_unicode'], targetId: null, networkProfileId: null,
  };
}

describe('S096.2 exact frozen Unicode value plan (never a verified typing method)', () => {
  it('preserves Vietnamese, ZWJ emoji, combining marks and line endings exactly', () => {
    const snapshot = fixture(), before = JSON.stringify(snapshot);
    const result = deriveFrozenUnicodeTextPlan(snapshot);
    expect(result.summary).toMatchObject({
      scope: 'FROZEN_UNICODE_NOT_ANDROID_INPUT',
      status: 'EXACT_FROZEN_TEXT_METHOD_UNVERIFIED',
      blockers: [], canType: false, canDispatch: false,
    });
    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => [entry.ordinal, entry.scope, entry.kind]))
      .toEqual([[0, 'row', 'TEXT'], [1, 'row', 'TEXT'], [2, 'process', 'URL']]);
    const raw = String(snapshot.fields.caption);
    expect(result.entries[0]!.value).toBe(raw);
    expect(result.entries[0]!.lineEndings).toBe('CRLF');
    expect(result.entries[0]!.isNfc).toBe(true);
    expect(result.entries[0]!.utf8Hash).toBe(
      createHash('sha256').update(Buffer.from(raw, 'utf8')).digest('hex'));
    expect(result.entries[0]!.utf8Bytes).toBe(Buffer.byteLength(raw, 'utf8'));
    expect(result.entries[1]!.isNfc).toBe(false);
    expect(result.entries[1]!.lineEndings).toBe('LF');
    expect(result.entries[1]!.value).toBe(String(snapshot.fields.comment));
    expect(result.entries[2]!.value).toBe(snapshot.processFields!.pageUrl);
    expect(JSON.stringify(snapshot)).toBe(before);
    const redacted = JSON.stringify(result.summary);
    for (const secret of [
      'caption', 'comment', 'pageUrl', 'Tiếng Việt', 'e\\u0301',
      'https://example.com', result.entries[0]!.utf8Hash,
      'asset_unicode',
    ]) expect(redacted).not.toContain(secret);
  });

  const cases: {
    label: string;
    edit: (snapshot: JobSnapshot) => void;
    blocker: string;
  }[] = [
    {
      label: 'isolated high surrogate',
      edit: (s) => { s.fields.caption = 'broken \ud800'; },
      blocker: 'UNSAFE_UNICODE',
    },
    {
      label: 'isolated low surrogate',
      edit: (s) => { s.fields.caption = 'broken \udc00'; },
      blocker: 'UNSAFE_UNICODE',
    },
    {
      label: 'embedded NUL',
      edit: (s) => { s.fields.caption = 'safe\u0000unsafe'; },
      blocker: 'UNSAFE_UNICODE',
    },
    {
      label: 'bidi override',
      edit: (s) => { s.fields.caption = 'status\u202ereversed'; },
      blocker: 'UNSAFE_UNICODE',
    },
    {
      label: 'bare carriage return',
      edit: (s) => { s.fields.caption = 'a\rb'; },
      blocker: 'UNSAFE_UNICODE',
    },
    {
      label: 'oversized UTF-8 with multibyte Unicode',
      edit: (s) => { s.fields.caption = '🧵'.repeat(12000); },
      blocker: 'TEXT_TOO_LARGE',
    },
    {
      label: 'missing required caption',
      edit: (s) => { delete s.fields.caption; },
      blocker: 'REQUIRED_VALUE_MISSING',
    },
    {
      label: 'empty required text',
      edit: (s) => { s.fields.caption = ''; },
      blocker: 'REQUIRED_VALUE_MISSING',
    },
    {
      label: 'text field provided as JSON number',
      edit: (s) => { s.fields.caption = 42; },
      blocker: 'VALUE_NOT_TEXT',
    },
    {
      label: 'undisclosed additional field',
      edit: (s) => { s.fields.hiddenCaption = 'never type'; },
      blocker: 'UNDECLARED_VALUE',
    },
    {
      label: 'process field incorrectly read from row values',
      edit: (s) => {
        s.fields.pageUrl = s.processFields!.pageUrl!;
        s.processFields = {};
      },
      blocker: 'REQUIRED_VALUE_MISSING',
    },
    {
      label: 'URL protocol is not http(s)',
      edit: (s) => { s.processFields!.pageUrl = 'javascript:alert(1)'; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'URL contains private basic-auth credentials',
      edit: (s) => { s.processFields!.pageUrl = 'https://user:pass@example.com'; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'URL contains an embedded tab ignored by the URL parser',
      edit: (s) => { s.processFields!.pageUrl = 'https://example.com/a\tb'; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'URL contains an embedded LF ignored by the URL parser',
      edit: (s) => { s.processFields!.pageUrl = 'https://example.com/a\nb'; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'URL contains an embedded CRLF ignored by the URL parser',
      edit: (s) => { s.processFields!.pageUrl = 'https://example.com/a\r\nb'; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'URL has leading whitespace that would be trimmed by the parser',
      edit: (s) => { s.processFields!.pageUrl = ' https://example.com/path'; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'URL has trailing whitespace that would be trimmed by the parser',
      edit: (s) => { s.processFields!.pageUrl = 'https://example.com/path '; },
      blocker: 'URL_UNSAFE',
    },
    {
      label: 'duplicate declared row field',
      edit: (s) => { s.bundle.inputs.push({ ...s.bundle.inputs[0]! }); },
      blocker: 'DECLARATION_INVALID',
    },
    {
      label: 'unsafe declaration key',
      edit: (s) => { s.bundle.inputs[0]!.key = '__proto__'; },
      blocker: 'DECLARATION_INVALID',
    },
    {
      label: 'too many declarations',
      edit: (s) => {
        s.bundle.inputs = Array.from({ length: 257 }, (_, i) => ({
          key: 'field' + i, scope: 'row' as const, type: 'text' as const, required: false,
        }));
      },
      blocker: 'DECLARATION_INVALID',
    },
  ];
  for (const { label, edit, blocker } of cases) {
    it('fails closed for ' + label, () => {
      const snapshot = fixture();
      edit(snapshot);
      const result = deriveFrozenUnicodeTextPlan(snapshot);
      expect(result.summary.status).toBe('BLOCKED');
      expect(result.summary.blockers).toContain(blocker);
      expect(result.entries).toHaveLength(0);
      expect(result.summary.canType).toBe(false);
      expect(result.summary.canDispatch).toBe(false);
    });
  }
  it('makes no false typing eligibility for text-only job with no fields', () => {
    const snapshot = fixture();
    snapshot.fields = { media: { assetId: 'asset_unicode' } };
    snapshot.processFields = {};
    snapshot.bundle.inputs = [
      { key: 'media', scope: 'row', type: 'file', required: true },
    ];
    const result = deriveFrozenUnicodeTextPlan(snapshot);
    expect(result.summary).toMatchObject({
      status: 'NO_TEXT_FIELDS', blockers: [], fields: [],
      canType: false, canDispatch: false,
    });
    expect(result.entries).toHaveLength(0);
  });
  it('never creates a value by reading mutable or undeclared process context', () => {
    const snapshot = fixture();
    delete snapshot.fields.caption;
    snapshot.processFields!.caption = 'mutable process text is not frozen row data';
    const report = deriveFrozenUnicodeTextPlan(snapshot);
    expect(report.summary.blockers).toContain('REQUIRED_VALUE_MISSING');
    expect(report.summary.blockers).toContain('UNDECLARED_VALUE');
    expect(report.entries).toEqual([]);
  });
});
