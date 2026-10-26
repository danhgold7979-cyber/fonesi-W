import type { ContentAssetInfo, FieldDefinition, JsonValue } from '@autoreels/contracts';

function initial(type: FieldDefinition['type']): JsonValue {
  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'list':
    case 'file[]':
      return [];
    case 'datetime':
      return { instant: '', timezone: 'Asia/Ho_Chi_Minh' };
    case 'file':
      return { assetId: '' };
    case 'identity':
      return { identityId: '' };
    default:
      return '';
  }
}
function ValueInput({
  field,
  value,
  assets,
  label,
  change,
}: {
  field: FieldDefinition;
  value: JsonValue;
  assets: ContentAssetInfo[];
  label: string;
  change: (value: JsonValue) => void;
}) {
  if (field.type === 'boolean')
    return (
      <label className="boolean-input">
        <input
          aria-label={label}
          type="checkbox"
          checked={value === true}
          onChange={(e) => change(e.target.checked)}
        />{' '}
        Bật
      </label>
    );
  if (field.type === 'file') {
    const id =
      value && typeof value === 'object' && !Array.isArray(value)
        ? String(value.assetId ?? '')
        : '';
    const options = [...new Map(assets.map((a) => [a.id, a])).values()];
    return (
      <select aria-label={label} value={id} onChange={(e) => change({ assetId: e.target.value })}>
        <option value="">Chọn media đã quét</option>
        {id && !options.some((a) => a.id === id) && (
          <option value={id}>{id} · cần kiểm tra nguồn</option>
        )}
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.relativePath}
            {a.state === 'READY' ? '' : ' · ' + a.state}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'identity')
    return (
      <input
        aria-label={label}
        disabled
        value={
          value && typeof value === 'object' && !Array.isArray(value)
            ? String(value.identityId ?? '')
            : ''
        }
        placeholder="Cần tài khoản được xác minh trên điện thoại"
      />
    );
  if (field.type === 'datetime') {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return (
      <div className="datetime-input">
        <input
          aria-label={label + ' thời điểm'}
          value={String(data.instant ?? '')}
          placeholder="2026-10-27T08:00:00+07:00"
          onChange={(e) => change({ ...data, instant: e.target.value })}
        />
        <input
          aria-label={label + ' múi giờ'}
          value={String(data.timezone ?? '')}
          placeholder="Asia/Ho_Chi_Minh"
          onChange={(e) => change({ ...data, timezone: e.target.value })}
        />
      </div>
    );
  }
  if (field.type === 'list' || field.type === 'file[]') {
    const items = Array.isArray(value) ? value : [];
    const type = field.type === 'file[]' ? 'file' : (field.itemType ?? 'text');
    return (
      <div className="list-input">
        {items.map((item, index) => (
          <div className="list-input-row" key={index}>
            <span>{index + 1}.</span>
            <ValueInput
              field={{ ...field, type }}
              value={item}
              assets={assets}
              label={label + ' mục ' + (index + 1)}
              change={(next) => change(items.map((v, i) => (i === index ? next : v)))}
            />
            <button
              aria-label={'Đưa lên ' + label + ' mục ' + (index + 1)}
              disabled={index === 0}
              onClick={() => {
                const next = [...items];
                [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                change(next);
              }}
            >
              ↑
            </button>
            <button
              aria-label={'Xóa ' + label + ' mục ' + (index + 1)}
              onClick={() => change(items.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={() => change([...items, initial(type)])}>
          ＋ Thêm mục {field.label ?? field.key}
        </button>
      </div>
    );
  }
  if (field.type === 'text')
    return (
      <textarea
        rows={2}
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => change(e.target.value)}
      />
    );
  return (
    <input
      aria-label={label}
      type={field.type === 'number' ? 'number' : 'url'}
      step={field.type === 'number' ? 'any' : undefined}
      value={typeof value === 'string' || typeof value === 'number' ? value : ''}
      onChange={(e) => {
        if (field.type === 'number') {
          if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber))
            change(e.target.valueAsNumber);
          else change('');
        } else change(e.target.value);
      }}
    />
  );
}
export function ContentFields({
  schema,
  assets,
  json,
  change,
}: {
  schema: FieldDefinition[];
  assets: ContentAssetInfo[];
  json: string;
  change: (json: string) => void;
}) {
  let fields: Record<string, JsonValue> | null = null;
  try {
    const value: unknown = JSON.parse(json);
    if (value && typeof value === 'object' && !Array.isArray(value))
      fields = value as Record<string, JsonValue>;
  } catch {
    /* The advanced editor stays available to repair JSON. */
  }
  return (
    <>
      {fields ? (
        <div className="content-fields">
          {!schema.length && (
            <p className="muted">
              Workflow chưa khai báo trường dữ liệu. Bạn vẫn giữ được media đã quét.
            </p>
          )}
          {schema.map((field) => {
            const enabled = Object.hasOwn(fields!, field.key),
              label = field.label ?? field.key;
            function update(value: JsonValue): void {
              change(JSON.stringify({ ...fields, [field.key]: value }, null, 2));
            }
            return (
              <div className="content-field" key={field.key}>
                <div className="content-field-label">
                  <strong>
                    {label}
                    {field.required ? ' *' : ''}
                  </strong>
                  <small className="muted">{field.type}</small>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={'Dùng trường ' + field.key}
                      checked={enabled}
                      onChange={(e) => {
                        if (e.target.checked) update(initial(field.type));
                        else {
                          const next = { ...fields };
                          delete next[field.key];
                          change(JSON.stringify(next, null, 2));
                        }
                      }}
                    />{' '}
                    {enabled ? 'Có giá trị' : 'Chưa nhập'}
                  </label>
                </div>
                {field.description && <small className="muted">{field.description}</small>}
                {enabled && (
                  <ValueInput
                    field={field}
                    value={fields![field.key]!}
                    label={label}
                    assets={assets}
                    change={update}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p role="alert">JSON chưa hợp lệ; sửa trong phần nâng cao.</p>
      )}
      <details className="content-json">
        <summary>Nâng cao · dữ liệu JSON</summary>
        <textarea
          className="code-editor"
          aria-label="Dữ liệu nội dung JSON"
          value={json}
          onChange={(e) => change(e.target.value)}
        />
      </details>
    </>
  );
}
