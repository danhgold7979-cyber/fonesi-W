"""Package review documents and preview helpers; never publish or package an app."""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs/source-plan/v2'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def package(destination):
    manifest_path = PLAN / 'DELIVERY_MANIFEST.json'
    report_path = PLAN / 'evidence/delivery-check.json'
    manifest = json.loads(manifest_path.read_text())
    manifest.pop('files', None)
    runbook = json.loads((PLAN / 'execution-runbook.json').read_text())
    preview_report = json.loads((ROOT / 'docs/previews/evidence/compact-preview-check.json').read_text())
    assert preview_report['status'] == 'PASS'
    manifest.update(status='DETAILED_EXECUTION_PLAN_AND_COMPACT_REVIEW_AVAILABLE',
                    executionPlanVersion=runbook['executionPlanVersion'],
                    executionPlan='docs/source-plan/v2/16_MASTER_EXECUTION_PLAN.md',
                    stepRunbook='docs/source-plan/v2/17_STEP_RUNBOOK.md',
                    plannedTaskCount=runbook['taskCount'],
                    plannedScenarioCount=sum(len(s['testScenarios']) for s in runbook['steps']),
                    previewChecksPassed=len(preview_report['checks']))
    paths = [ROOT / p for p in ['README.md', 'AGENTS.md', '.gitignore']]
    paths += list((ROOT / 'docs').rglob('*')) + list((ROOT / 'tools/preview').rglob('*'))
    paths = sorted({p for p in paths if p.is_file() and not p.is_symlink()
                    and p not in {manifest_path, report_path} and '__pycache__' not in p.parts
                    and p.suffix not in {'.pyc', '.pyo'}})
    manifest['files'] = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size,
                          'sha256': digest(p.read_bytes())} for p in paths]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / 'AutoReels-Full-Execution-Plan-V2.1.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in paths + [manifest_path]:
            z.write(p, str(p.relative_to(ROOT)))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for item in manifest['files']:
            assert digest(z.read(item['path'])) == item['sha256']
        members = len(z.namelist())
    report = {'scope': 'DELIVERY_ARCHIVE_ONLY_NOT_PRODUCTION_APP', 'status': 'PASS',
              'archiveFilename': archive.name, 'membersVerified': members,
              'zipBytes': archive.stat().st_size, 'sha256': digest(archive.read_bytes())}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    shutil.copy2(PLAN / '16_MASTER_EXECUTION_PLAN.md', destination / 'AutoReels-Master-Execution-Plan.md')
    shutil.copy2(PLAN / '17_STEP_RUNBOOK.md', destination / 'AutoReels-125-Step-Runbook.md')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=ROOT.parent / 'deliverables')
    package(parser.parse_args().destination.resolve())
