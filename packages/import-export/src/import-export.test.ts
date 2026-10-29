import { describe, expect, it } from 'vitest';
import { crc32, deflateRawSync } from 'node:zlib';
import type { ContentExportDocument } from '@autoreels/contracts';
import { bulkPatch, exportContentFile, parseContentFile, validateXlsxArchive } from './index.js';

const document: ContentExportDocument = {
  format: 'autoreels-content',
  version: 1,
  processId: 'process_1',
  schema: [
    { key: 'caption', type: 'text', scope: 'row', required: true },
    { key: 'count', type: 'number', scope: 'row', required: false },
    { key: 'enabled', type: 'boolean', scope: 'row', required: false },
    { key: 'comments', type: 'list', itemType: 'text', scope: 'row', required: false },
    { key: 'files', type: 'file[]', scope: 'row', required: false },
  ],
  rows: [
    {
      contentId: 'content_1',
      fields: {
        caption: '=HYPERLINK("https://invalid", "tiếng Việt")\nline 2',
        count: 0,
        enabled: false,
        comments: ['one\nmultiline', 'two'],
        files: [{ assetId: 'asset_b' }, { assetId: 'asset_a' }],
      },
      assetIds: ['asset_b', 'asset_a'],
    },
    { contentId: 'content_2', fields: { caption: '', comments: [] }, assetIds: [] },
  ],
};
function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const filename = Buffer.from(name),
      data = Buffer.from(value),
      compressed = deflateRawSync(data),
      local = Buffer.alloc(30),
      header = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    header.writeUInt32LE(0x02014b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(crc32(data), 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(filename.length, 28);
    header.writeUInt32LE(offset, 42);
    locals.push(local, filename, compressed);
    central.push(header, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
describe('typed content formats', () => {
  for (const format of ['JSON', 'CSV', 'XLSX'] as const)
    it(
      format + ' round-trips actual bytes, typed values, multiline/order and missing versus empty',
      async () => {
        const exported = await exportContentFile(document, format);
        expect(exported.filename.endsWith('.' + format.toLowerCase())).toBe(true);
        const parsed = await parseContentFile(format, exported.data, document.schema);
        expect(parsed.records).toEqual(document.rows);
        if (format === 'JSON') expect(parsed.schema).toEqual(document.schema);
        if (format === 'XLSX')
          expect(Buffer.from(exported.data, 'base64').subarray(0, 2).toString()).toBe('PK');
        if (format === 'CSV') expect(exported.data.startsWith('\uFEFF')).toBe(true);
      },
    );
  it('parses ordinary CSV with BOM/quotes/newlines and explicit typed conversion, preserving text formula literals', async () => {
    const input =
      '\uFEFFcontentId,caption,count,enabled,comments\r\ncontent_1,"tiếng Việt\nnext",0,false,"[""one\\nmultiline"",""two""]"\r\n';
    const parsed = await parseContentFile('CSV', input, document.schema);
    expect(parsed.records[0]?.fields).toEqual({
      caption: 'tiếng Việt\nnext',
      count: 0,
      enabled: false,
      comments: ['one\nmultiline', 'two'],
    });
    expect(parsed.conversions).toHaveLength(3);
  });
  it('reports bad raw cells without coercing empty to zero and rejects malformed/unsafe/schema-unknown input', async () => {
    const parsed = await parseContentFile('CSV', 'contentId,count\ncontent_1,\n', document.schema);
    expect(parsed.records[0]?.errors?.[0]).toContain('số không hợp lệ');
    for (const [format, input] of [
      ['JSON', '{"format":"autoreels-content","version":1,"rows":[{"fields":{"__proto__":1}}]}'],
      ['CSV', 'caption,caption\na,b'],
      ['CSV', 'unknown\na'],
      ['CSV', 'caption\n"unterminated'],
    ] as const)
      await expect(parseContentFile(format, input, document.schema)).rejects.toThrow();
  });
  it('keeps append/prepend list items atomic and rejects unsupported bulk combinations', () => {
    const selection = [{ id: 'content_1', revision: 0 }];
    expect(
      bulkPatch(
        { comments: ['one\nmultiline'] },
        { selection, fieldKey: 'comments', operation: 'APPEND', value: ['two'] },
      ),
    ).toEqual({ comments: ['one\nmultiline', 'two'] });
    expect(bulkPatch({ count: 0 }, { selection, fieldKey: 'count', operation: 'REMOVE' })).toEqual(
      {},
    );
    expect(() =>
      bulkPatch({ count: 0 }, { selection, fieldKey: 'count', operation: 'APPEND', value: 1 }),
    ).toThrow('Append');
  });
});
describe('XLSX resource and formula gate', () => {
  const base = { '[Content_Types].xml': '<Types/>', 'xl/workbook.xml': '<workbook/>' };
  it('rejects formulas, DTD/entities, deep XML and excessive cells before spreadsheet parsing', () => {
    for (const xml of [
      '<worksheet><c><f>1+1</f><v>2</v></c></worksheet>',
      '<!DOCTYPE x [<!ENTITY a "x">]><x/>',
      '<a>'.repeat(129) + '</a>'.repeat(129),
      '<c/>'.repeat(100001),
    ])
      expect(() =>
        validateXlsxArchive(zip({ ...base, 'xl/worksheets/sheet1.xml': xml })),
      ).toThrow();
  });
  it('rejects actual inflate bombs, altered local sizes/CRC, path escapes and duplicate directory data', () => {
    expect(() =>
      validateXlsxArchive(zip({ ...base, 'xl/huge.xml': 'x'.repeat(16 * 1024 * 1024 + 1) })),
    ).toThrow('budget');
    expect(() => validateXlsxArchive(zip({ ...base, '../escape': 'x' }))).toThrow('path');
    const invalid = zip(base);
    invalid.writeUInt32LE(123, 14);
    expect(() => validateXlsxArchive(invalid)).toThrow('CRC');
    expect(() => validateXlsxArchive(Buffer.from('not a zip'))).toThrow();
    const overflow = zip(base);
    const end = overflow.length - 22;
    overflow.writeUInt32LE(0xffffffff, end + 16);
    expect(() => validateXlsxArchive(overflow)).toThrow();
  });
});
