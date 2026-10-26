"""Create a portable, verified snapshot of committed source, without older ZIPs."""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'AutoReels-Studio/'

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def create(output):
    # Archives may be untracked while packaging, but source changes must be committed.
    dirty = git('status', '--porcelain', '--untracked-files=all', '--', '.', ':!archives').decode()
    if dirty.strip():
        raise SystemExit('Commit source/docs changes before snapshotting HEAD. Archive files are excluded from this check.')
    revision = git('rev-parse', 'HEAD').decode().strip()
    branch = git('branch', '--show-current').decode().strip()
    committed_at = git('show', '-s', '--format=%cI', 'HEAD').decode().strip()
    raw = git('archive', '--format=zip', '--prefix=' + PREFIX, 'HEAD')
    files = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as source:
        for entry in source.infolist():
            if entry.is_dir():
                continue
            name = entry.filename.removeprefix(PREFIX)
            if name.startswith('archives/') and name.endswith(('.zip', '.sha256', '-receipt.json')):
                raise SystemExit('Recursive archive detected; verify committed .gitattributes export-ignore rules.')
            files[name] = source.read(entry)
    for required in ['AGENTS.md', 'README.md', 'docs/handoff/START_HERE.md',
                     'docs/handoff/RESUME_PROMPT.md', 'docs/source-plan/v2/execution-runbook.json']:
        if required not in files:
            raise SystemExit('Missing required handoff file: ' + required)
    snapshot = {'formatVersion': 1, 'repository': 'danhgold7979-cyber/fonesi-W',
                'sourceCommit': revision, 'sourceBranch': branch, 'sourceCommittedAt': committed_at,
                'scope': 'COMMITTED_SOURCE_SNAPSHOT_NOT_APPLICATION_ACCEPTANCE',
                'handoffEntrypoint': 'docs/handoff/START_HERE.md',
                'files': [{'path': name, 'bytes': len(data), 'sha256': sha256(data)}
                          for name, data in sorted(files.items())]}
    files['SNAPSHOT.json'] = (json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n').encode()
    files['SHA256SUMS'] = ''.join(sha256(data) + '  ' + name + '\n'
                                 for name, data in sorted(files.items())).encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(PREFIX + name, data)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise SystemExit('ZIP CRC verification failed')
        for item in snapshot['files']:
            if sha256(archive.read(PREFIX + item['path'])) != item['sha256']:
                raise SystemExit('Snapshot hash mismatch: ' + item['path'])
        sums = archive.read(PREFIX + 'SHA256SUMS').decode().splitlines()
        for line in sums:
            expected, name = line.split('  ', 1)
            if sha256(archive.read(PREFIX + name)) != expected:
                raise SystemExit('SHA256SUMS mismatch: ' + name)
    archive_hash = sha256(output.read_bytes())
    output.with_suffix(output.suffix + '.sha256').write_text(archive_hash + '  ' + output.name + '\n')
    receipt = {'scope': 'SNAPSHOT_ARCHIVE_VERIFICATION_ONLY', 'status': 'PASS',
               'archiveFilename': output.name, 'sourceCommit': revision, 'sourceBranch': branch,
               'zipBytes': output.stat().st_size, 'sha256': archive_hash,
               'sourceFilesVerified': len(snapshot['files']), 'checksumEntriesVerified': len(sums),
               'githubUpload': 'NOT_PERFORMED_BY_THIS_TOOL'}
    output.with_name(output.stem + '-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(receipt, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    create(parser.parse_args().output.resolve())
