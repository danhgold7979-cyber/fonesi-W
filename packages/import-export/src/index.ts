import { parse as parseCsv } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import readXlsx from 'read-excel-file/node';
import writeXlsx from 'write-excel-file/node';
import { assertJsonSafe, isSafeKey } from '@autoreels/contracts';
import type {
  ContentFormat,
  ContentImportDocument,
  ContentImportRecord,
  ContentExportDocument,
  ContentDownload,
  FieldDefinition,
  JsonValue,
  BulkContentRequest,
} from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import { validateXlsxArchive } from './zip-budget.js';
export { validateXlsxArchive } from './zip-budget.js';

const formatId = 'autoreels-content/1',
  maxBytes = 4 * 1024 * 1024;
const selectors = ['contentId', 'sourceId', 'relativePath', 'filename'] as const;
function fail(message: string): never {
  throw new DomainError('INVALID_CONTENT_FILE', message);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('Cần object dữ liệu.');
  return value as Record<string, unknown>;
}
function strict(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    fail('Có key không được hỗ trợ trong dữ liệu.');
}
function record(value: unknown): ContentImportRecord {
  const item = object(value);
  strict(item, [...selectors, 'fields', 'assetIds']);
  const fields = object(item.fields ?? {});
  if (Object.keys(fields).some((key) => !isSafeKey(key))) fail('Key trường dữ liệu không hợp lệ.');
  const result: ContentImportRecord = { fields: fields as Record<string, JsonValue> };
  for (const key of selectors)
    if (Object.hasOwn(item, key)) {
      if (typeof item[key] !== 'string' || !item[key].length)
        fail('Selector phải là chuỗi không rỗng: ' + key);
      result[key] = item[key];
    }
  if (Object.hasOwn(item, 'assetIds')) {
    if (!Array.isArray(item.assetIds) || item.assetIds.some((id) => typeof id !== 'string'))
      fail('assetIds phải là danh sách ID.');
    result.assetIds = item.assetIds as string[];
  }
  return result;
}
function jsonValue(cell: unknown): JsonValue {
  try {
    return JSON.parse(String(cell)) as JsonValue;
  } catch {
    return fail('Ô dữ liệu JSON không hợp lệ: ' + String(cell).slice(0, 80));
  }
}
function rawValue(cell: unknown, field: FieldDefinition): JsonValue {
  if (field.type === 'text' || field.type === 'url') {
    if (typeof cell !== 'string') return fail(field.key + ': cần ô văn bản.');
    return cell;
  }
  if (field.type === 'number') {
    if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
    if (
      typeof cell === 'string' &&
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(cell) &&
      Number.isFinite(Number(cell))
    )
      return Number(cell);
    return fail(field.key + ': số không hợp lệ.');
  }
  if (field.type === 'boolean') {
    if (cell === true || cell === 'true') return true;
    if (cell === false || cell === 'false') return false;
    return fail(field.key + ': dùng true hoặc false.');
  }
  return jsonValue(cell);
}
function table(rows: unknown[][], schema: FieldDefinition[]): ContentImportDocument {
  if (rows.length < 2 || rows.length > 1001) return fail('Cần 1–1000 nội dung mỗi lần nhập.');
  const headers = rows[0]!.map((value) => String(value ?? ''));
  if (
    !headers.length ||
    headers.length > 128 ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h)
  )
    fail('Headers trùng/rỗng hoặc quá 128 cột.');
  const canonical = headers.includes('$format'),
    definitions = new Map(schema.filter((f) => f.scope === 'row').map((f) => [f.key, f]));
  for (const h of headers)
    if (
      !['$format', 'assetIds', ...selectors].includes(h) &&
      !definitions.has(h.startsWith('field.') ? h.slice(6) : h)
    )
      fail('Cột không thuộc schema: ' + h);
  const conversions = new Set<string>(),
    records: ContentImportRecord[] = [];
  for (const [index, cells] of rows.slice(1).entries()) {
    if (cells.length > headers.length) fail('Dòng ' + (index + 2) + ': thừa cột.');
    const candidate: Record<string, unknown> = { fields: {} },
      fields = candidate.fields as Record<string, JsonValue>,
      errors: string[] = [];
    if (canonical && cells[headers.indexOf('$format')] !== formatId)
      fail('Version CSV/XLSX không được hỗ trợ.');
    for (const [i, header] of headers.entries()) {
      if (header === '$format') continue;
      const cell = cells[i];
      if (canonical && (cell === '' || cell === null || cell === undefined)) continue;
      if ((selectors as readonly string[]).includes(header)) {
        if (cell === '' || cell === null || cell === undefined) continue;
        candidate[header] = canonical ? jsonValue(cell) : cell;
        continue;
      }
      if (header === 'assetIds') {
        if (cell !== '' && cell !== null && cell !== undefined)
          candidate.assetIds = jsonValue(cell);
        continue;
      }
      const key = header.startsWith('field.') ? header.slice(6) : header,
        field = definitions.get(key)!;
      try {
        fields[key] = canonical ? jsonValue(cell) : rawValue(cell ?? '', field);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Ô dữ liệu không hợp lệ.');
      }
      if (!canonical && field.type !== 'text' && field.type !== 'url')
        conversions.add(key + ': chuyển ô sang ' + field.type + ' theo schema.');
    }
    const result = record(candidate);
    if (errors.length) result.errors = errors;
    records.push(result);
  }
  assertJsonSafe(records);
  return { records, conversions: [...conversions] };
}
export async function parseContentFile(
  format: ContentFormat,
  data: string,
  schema: FieldDefinition[],
): Promise<ContentImportDocument> {
  const buffer = format === 'XLSX' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8');
  if (!buffer.length || buffer.length > maxBytes)
    fail('File tối đa 4 MiB; chia dữ liệu thành nhiều lô.');
  try {
    if (format === 'JSON') {
      const parsed: unknown = JSON.parse(data);
      assertJsonSafe(parsed);
      const root = object(parsed);
      strict(root, ['format', 'version', 'processId', 'schema', 'rows']);
      if (
        root.format !== 'autoreels-content' ||
        root.version !== 1 ||
        !Array.isArray(root.rows) ||
        !root.rows.length ||
        root.rows.length > 1000
      )
        fail('JSON cần format autoreels-content, version 1 và 1–1000 rows.');
      if (root.processId !== undefined && typeof root.processId !== 'string')
        fail('processId không hợp lệ.');
      if (root.schema !== undefined && !Array.isArray(root.schema)) fail('schema không hợp lệ.');
      return {
        ...(typeof root.processId === 'string' ? { processId: root.processId } : {}),
        ...(Array.isArray(root.schema) ? { schema: root.schema as FieldDefinition[] } : {}),
        records: root.rows.map(record),
        conversions: [],
      };
    }
    if (format === 'CSV')
      return table(
        parseCsv(data, {
          bom: true,
          skip_empty_lines: true,
          max_record_size: maxBytes,
          on_record: (value: string[], context) => {
            if (context.records > 1001) fail('Tối đa 1000 nội dung mỗi lần nhập.');
            return value;
          },
        }) as string[][],
        schema,
      );
    validateXlsxArchive(buffer);
    const sheets = await readXlsx(buffer, { trim: false });
    if (sheets.length !== 1)
      fail('Chọn file có đúng một sheet dữ liệu; không tự bỏ các sheet còn lại.');
    return table(sheets[0]!.data, schema);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return fail('Không đọc được ' + format + ': kiểm tra cấu trúc, ô dữ liệu và định dạng file.');
  }
}
export async function exportContentFile(
  document: ContentExportDocument,
  format: ContentFormat,
): Promise<ContentDownload> {
  assertJsonSafe(document);
  if (document.rows.length > 1000) fail('Chọn tối đa 1000 nội dung mỗi lần xuất.');
  const filename = 'AutoReels-' + document.processId;
  if (format === 'JSON') {
    const data = JSON.stringify(document, null, 2);
    if (Buffer.byteLength(data) > maxBytes) fail('Dữ liệu xuất vượt 4 MiB; thu hẹp phạm vi.');
    return { filename: filename + '.json', mimeType: 'application/json', encoding: 'utf8', data };
  }
  const keys = document.schema.filter((f) => f.scope === 'row').map((f) => f.key);
  const rows: string[][] = [
    ['$format', 'contentId', 'assetIds', ...keys.map((key) => 'field.' + key)],
    ...document.rows.map((row) => [
      formatId,
      JSON.stringify(row.contentId),
      JSON.stringify(row.assetIds),
      ...keys.map((key) => (Object.hasOwn(row.fields, key) ? JSON.stringify(row.fields[key]) : '')),
    ]),
  ];
  if (rows[0]!.length > 128) fail('Tối đa 128 cột mỗi file.');
  if (format === 'CSV') {
    const data = stringify(rows, { bom: true, record_delimiter: '\r\n' });
    if (Buffer.byteLength(data) > maxBytes) fail('CSV xuất vượt 4 MiB; thu hẹp phạm vi.');
    return {
      filename: filename + '.csv',
      mimeType: 'text/csv;charset=utf-8',
      encoding: 'utf8',
      data,
    };
  }
  const buffer = await writeXlsx(
    rows.map((row) => row.map((value) => ({ type: String, value }))),
    { sheet: 'Content' },
  ).toBuffer();
  validateXlsxArchive(buffer);
  return {
    filename: filename + '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    encoding: 'base64',
    data: buffer.toString('base64'),
  };
}
export function bulkPatch(
  fields: Record<string, JsonValue>,
  request: BulkContentRequest,
): Record<string, JsonValue> {
  if (!isSafeKey(request.fieldKey)) fail('Field key không hợp lệ.');
  const next = structuredClone(fields),
    key = request.fieldKey;
  if (request.operation === 'REMOVE') {
    delete next[key];
    return next;
  }
  if (request.value === undefined) fail('Thiếu giá trị cho thao tác hàng loạt.');
  if (request.operation === 'SET') {
    next[key] = request.value;
    return next;
  }
  const before = next[key],
    value = request.value;
  if (typeof before === 'string' && typeof value === 'string')
    next[key] = request.operation === 'APPEND' ? before + value : value + before;
  else if (Array.isArray(before) && Array.isArray(value))
    next[key] = request.operation === 'APPEND' ? [...before, ...value] : [...value, ...before];
  else
    fail(
      'Append/prepend chỉ dùng cho văn bản hoặc danh sách cùng loại; trường đang thiếu cần set trước.',
    );
  return next;
}
