import { crc32, inflateRawSync } from 'node:zlib';
import { DomainError } from '@autoreels/domain';

const maxFile = 4 * 1024 * 1024,
  maxEntry = 16 * 1024 * 1024,
  maxExpanded = 32 * 1024 * 1024;
function reject(message: string): never {
  throw new DomainError('INVALID_XLSX_ARCHIVE', message);
}
/** Validates actual ZIP output before giving bytes to an XLSX document parser. Never extracts files. */
export function validateXlsxArchive(data: Buffer): void {
  if (data.length < 22 || data.length > maxFile) reject('XLSX tối đa 4 MiB và phải là ZIP hợp lệ.');
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50 && i + 22 + data.readUInt16LE(i + 20) === data.length) {
      end = i;
      break;
    }
  }
  if (end < 0) reject('Không tìm thấy ZIP directory.');
  const count = data.readUInt16LE(end + 10),
    start = data.readUInt32LE(end + 16),
    size = data.readUInt32LE(end + 12);
  if (
    data.readUInt16LE(end + 4) ||
    data.readUInt16LE(end + 6) ||
    count !== data.readUInt16LE(end + 8) ||
    !count ||
    count > 256 ||
    start + size !== end
  )
    reject('ZIP64/multi-disk hoặc quá 256 entries chưa được hỗ trợ.');
  let cursor = start,
    expanded = 0,
    cells = 0,
    rows = 0;
  const names = new Set<string>(),
    ranges: { start: number; end: number }[] = [];
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50)
      reject('ZIP central header không hợp lệ.');
    const flags = data.readUInt16LE(cursor + 8),
      method = data.readUInt16LE(cursor + 10),
      crc = data.readUInt32LE(cursor + 16),
      compressed = data.readUInt32LE(cursor + 20),
      uncompressed = data.readUInt32LE(cursor + 24);
    const nameSize = data.readUInt16LE(cursor + 28),
      extra = data.readUInt16LE(cursor + 30),
      comment = data.readUInt16LE(cursor + 32),
      local = data.readUInt32LE(cursor + 42),
      next = cursor + 46 + nameSize + extra + comment;
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      data.readUInt16LE(cursor + 34) ||
      next > end ||
      local + 30 > start ||
      uncompressed > maxEntry ||
      expanded + uncompressed > maxExpanded
    )
      reject('ZIP encrypted/method/size vượt budget.');
    const checkExtra = (begin: number, length: number): void => {
      let offset = begin;
      while (offset < begin + length) {
        if (offset + 4 > begin + length) reject('ZIP extra field malformed.');
        const type = data.readUInt16LE(offset),
          bytes = data.readUInt16LE(offset + 2);
        if (type === 1 || offset + 4 + bytes > begin + length)
          reject('ZIP64/extra field không hỗ trợ.');
        offset += 4 + bytes;
      }
    };
    checkExtra(cursor + 46 + nameSize, extra);
    const nameBytes = data.subarray(cursor + 46, cursor + 46 + nameSize),
      name = nameBytes.toString('utf8');
    if (
      !name ||
      name.includes('\0') ||
      name.includes('\\') ||
      name.startsWith('/') ||
      /^[A-Za-z]:/.test(name) ||
      name.split('/').includes('..') ||
      names.has(name)
    )
      reject('ZIP path trùng hoặc không hợp lệ.');
    names.add(name);
    if (
      data.readUInt32LE(local) !== 0x04034b50 ||
      data.readUInt16LE(local + 6) !== flags ||
      data.readUInt16LE(local + 8) !== method
    )
      reject('ZIP local/central header không khớp.');
    const localName = data.readUInt16LE(local + 26),
      localExtra = data.readUInt16LE(local + 28),
      begin = local + 30 + localName + localExtra,
      finish = begin + compressed;
    if (finish > start || !data.subarray(local + 30, local + 30 + localName).equals(nameBytes))
      reject('ZIP data bounds/name không khớp.');
    checkExtra(local + 30 + localName, localExtra);
    if (
      !(flags & 8) &&
      (data.readUInt32LE(local + 14) !== crc ||
        data.readUInt32LE(local + 18) !== compressed ||
        data.readUInt32LE(local + 22) !== uncompressed)
    )
      reject('ZIP local size/CRC không khớp central directory.');
    if (ranges.some((range) => local < range.end && finish > range.start))
      reject('ZIP entries overlap.');
    ranges.push({ start: local, end: finish });
    let output: Buffer;
    try {
      output =
        method === 0
          ? data.subarray(begin, finish)
          : inflateRawSync(data.subarray(begin, finish), {
              maxOutputLength: Math.max(1, Math.min(maxEntry, maxExpanded - expanded)),
            });
    } catch {
      reject('ZIP không giải nén được hoặc vượt budget.');
    }
    if (output.length !== uncompressed || output.length > maxEntry || crc32(output) !== crc)
      reject('ZIP size/CRC không khớp.');
    expanded += output.length;
    if (name.endsWith('.xml')) {
      if (output.includes(0)) reject('XML encoding chưa được hỗ trợ.');
      const xml = output.toString('utf8');
      let depth = 0;
      for (const tag of xml.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {
        if (tag[0].startsWith('</')) depth--;
        else if (!tag[0].endsWith('/>')) depth++;
        if (depth > 128) reject('XML nesting vượt budget.');
      }
      if (/<!DOCTYPE|<!ENTITY|<(?:[A-Za-z_][\w.-]*:)?f(?=[\s/>])/i.test(xml))
        reject('XLSX chứa formula/DTD/entity; chỉ nhập giá trị tĩnh.');
      cells += (xml.match(/<(?:[A-Za-z_][\w.-]*:)?c(?=[\s/>])/g) ?? []).length;
      rows += (xml.match(/<(?:[A-Za-z_][\w.-]*:)?row(?=[\s/>])/g) ?? []).length;
      if (cells > 100000 || rows > 1001)
        reject('XLSX vượt budget cells/rows; chia file thành các lô tối đa 1000 nội dung.');
    }
    cursor = next;
  }
  if (cursor !== end || !names.has('[Content_Types].xml') || !names.has('xl/workbook.xml'))
    reject('Không phải XLSX workbook hợp lệ.');
}
