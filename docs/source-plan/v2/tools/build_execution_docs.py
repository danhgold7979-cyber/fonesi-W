"""Render the authored execution runbook and registry matrices as review documents."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(name):
    return json.loads((ROOT / name).read_text())

def cell(value):
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    return str(value).replace('|', '\\|').replace('\n', '<br>')

def table(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '|' + '|'.join(['---'] * len(headers)) + '|'] +
                     ['| ' + ' | '.join(cell(v) for v in row) + ' |' for row in rows])

def main():
    plan = read('implementation-plan.json')
    runbook = read('execution-runbook.json')
    by_id = {s['stepId']: s for s in runbook['steps']}
    text = ['# Runbook triển khai 125 bước', '',
            'Baseline V2.1 · execution plan 1.0 · 15 phase / 125 bước / 375 đầu việc / 250 tình huống dự kiến.', '',
            'Đây là công việc và tests cần thực hiện, **không phải kết quả đã chạy**. Xem [kế hoạch tổng thể](16_MASTER_EXECUTION_PLAN.md) và [các điểm chưa được chứng minh](18_READINESS_AND_RISKS.md).', '',
            'Đường dẫn đầu ra là dự kiến, được cụ thể hóa trong increment. Phụ thuộc dưới đây là điều kiện triển khai từng bước; điều kiện nghiệm thu toàn phase vẫn ở master plan. Mọi bước production hiện PLANNED.', '']
    for phase in plan['phases']:
        text.extend([f"## {phase['id']} — {phase['title']}", '',
                     'Gate toàn phase: ' + (', '.join(phase['dependsOn']) or 'Không có phase trước') + '.', ''])
        for original in phase['steps']:
            s = by_id[original['id']]
            text.extend([f"### {s['stepId']} — {s['title']}", '',
                         f"Trạng thái: {s['status']} · Test nghiệm thu: `{s['acceptanceTestId']}`.", '',
                         'Tiền đề triển khai: ' + (', '.join(s['dependsOn']) or 'Nguồn đầu vào đã được cung cấp') + '.', '',
                         'Đầu ra dự kiến: ' + ', '.join(f'`{p}`' for p in s['plannedDeliverables']) + '.', ''])
            text.extend([f"{i}. **{task['id']}** — {task['description']}" for i, task in enumerate(s['tasks'], 1)])
            text.extend(['', 'Tình huống phải kiểm tra:', ''])
            text.extend(['- ' + scenario for scenario in s['testScenarios']])
            text.extend(['', '**Nghiệm thu:** ' + s['acceptance'], '',
                         '**Môi trường:** `' + s['acceptanceEnvironment'] + '`. Phone cần cho nghiệm thu: ' + ('Có.' if s['hardwareAcceptanceRequired'] else 'Chưa cần; host behavior vẫn phải kiểm theo target.'), '',
                         '**Evidence:** `' + s['evidenceDirectory'] + '` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.', ''])
    (ROOT / '17_STEP_RUNBOOK.md').write_text('\n'.join(text))
    actions = read('ui-actions.json')
    (ROOT / 'UI_ACTION_MATRIX.md').write_text('# Ma trận 124 lệnh UI\n\nFeature IDs lấy từ reference; phân loại và bước triển khai là thiết kế production. UI_ONLY có thể thay đổi draft local; persistence qua save ACK riêng. Số dòng không phải số tính năng đã nghiệm thu.\n\n' + table(
        ['ID', 'Lệnh', 'Nhãn', 'Loại', 'Owner', 'Bước', 'Test'],
        [[r['id'], '`' + r['action'] + '`', r['label'], r['classification'], r['ownerPhase'], ', '.join(r['plannedSteps']), r['testId']] for r in actions]) + '\n')
    fields = read('ui-fields.json')
    (ROOT / 'UI_FIELD_MATRIX.md').write_text('# Kiểm kê 110 field signatures\n\nChữ ký khảo sát có thể được dùng lại ở nhiều modal. `contextVariants` trong JSON quy định owner/meaning riêng; options của reference không tự trở thành options production. Toàn bộ runtime fields vẫn PLANNED.\n\n' + table(
        ['ID', 'DOM / binding', 'Input', 'Owner', 'Bước', 'Context variants'],
        [[r['id'], r['domId'] or json.dumps(r['binding'], ensure_ascii=False), r['tag'] + '/' + r['inputType'], r['ownerPhase'], ', '.join(r['plannedSteps']), '; '.join(v['context'] + ': ' + v['ownerPhase'] for v in r.get('contextVariants', []))] for r in fields]) + '\n')
    events = read('ui-delegates.json')
    (ROOT / 'UI_EVENT_MATRIX.md').write_text('# Gesture, delegation và keyboard\n\nInteractions ngoài action dispatcher, có bước triển khai cụ thể và test IDs; chưa phải tests đã chạy.\n\n' + table(
        ['ID', 'Binding', 'Hành vi', 'Owner', 'Bước', 'Test'],
        [[r['id'], r['binding'], r['behavior'], r['ownerPhase'], ', '.join(r['plannedSteps']), r['testId']] for r in events]) + '\n')
    print('Rendered 125-step runbook and command/field/event matrices')

if __name__ == '__main__':
    main()
