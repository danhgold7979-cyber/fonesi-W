import { describe, expect, it } from 'vitest';
import {
  assessOwnedCleanupReadback,
  type OwnedRemoteStatReadback,
  type OwnedMediaStoreReadback,
} from './owned-cleanup-reconcile.js';

function fixture() {
  const nonce = 'b'.repeat(32);
  const jobId = 'job_owned_readback_fixture';
  const ordinal = 0;
  const extension = '.mp4';
  const expectedBytes = 54321;
  const displayName = 'asset-000-' + nonce + extension;
  const relativePath = 'Download/AutoReelsStudio/job-' + jobId + '/';
  const remotePath = '/sdcard/' + relativePath + displayName;
  const remote: OwnedRemoteStatReadback = {
    status: 'REMOTE_ABSENT_OBSERVED',
    remotePath, observedBytes: null, matchesExpectedBytes: false,
    canDelete: false, canMarkClean: false,
  };
  const mediaStore: OwnedMediaStoreReadback = { status: 'NOT_INDEXED' };
  return { jobId, ordinal, nonce, extension, expectedBytes,
    remote, mediaStore, remotePath, displayName, relativePath };
}
const assess = (v: ReturnType<typeof fixture>) => assessOwnedCleanupReadback(v);
const noRights = {
  canDelete: false, canMarkClean: false,
  canRetry: false, canDispatch: false,
};

describe('S102.2 owned ADB STAT + MediaStore readback is not cleanup permission', () => {
  it('reports paired remote absence and NOT_INDEXED as an uncertified candidate only', () => {
    const v = fixture();
    const before = JSON.stringify(v);
    const result = assess(v);
    expect(result).toEqual({
      scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
      status: 'ABSENCE_CANDIDATE_UNCERTIFIED',
      remote: 'ABSENT', mediaStore: 'NOT_INDEXED',
      blockers: ['PROVIDER_AND_CLEANUP_UNCERTIFIED'], ...noRights,
    });
    const redacted = JSON.stringify(result);
    for (const secret of [v.jobId, v.nonce, v.remotePath, v.displayName,
      v.relativePath]) expect(redacted).not.toContain(secret);
    expect(JSON.stringify(v)).toBe(before);
  });

  it('keeps a remote file present even when MediaStore is not indexed', () => {
    const v = fixture();
    v.remote = {
      status: 'REMOTE_PRESENT_OBSERVED',
      remotePath: v.remotePath, observedBytes: v.expectedBytes,
      matchesExpectedBytes: true, canDelete: false, canMarkClean: false,
    };
    expect(assess(v)).toEqual({
      scope: 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED',
      status: 'REMOTE_PRESENT_REVIEW', remote: 'PRESENT', mediaStore: 'NOT_INDEXED',
      blockers: ['REMOTE_STILL_PRESENT', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
      ...noRights,
    });
  });

  it('does not infer full removal if MediaStore still has an exact owned row', () => {
    const v = fixture();
    v.mediaStore = {
      status: 'INDEXED_EXACT', rowId: '42',
      displayName: v.displayName, relativePath: v.relativePath,
      mimeType: 'video/mp4', bytes: v.expectedBytes,
    };
    expect(assess(v)).toMatchObject({
      status: 'MEDIASTORE_PRESENT_REVIEW',
      remote: 'ABSENT', mediaStore: 'INDEXED_EXACT',
      blockers: ['MEDIASTORE_STILL_INDEXED', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
      ...noRights,
    });
  });

  it('blocks ambiguous or unsupported MediaStore result from claiming cleanup', () => {
    for (const status of ['AMBIGUOUS', 'UNSUPPORTED'] as const) {
      const v = fixture();
      v.mediaStore = { status };
      expect(assess(v)).toMatchObject({
        status: 'UNSUPPORTED_REVIEW', mediaStore: status, remote: 'ABSENT',
        blockers: ['MEDIASTORE_UNSUPPORTED_OR_AMBIGUOUS',
          'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
        ...noRights,
      });
    }
  });

  it('rejects wrong-size, forged absence and noncanonical remote readback', () => {
    const cases: Array<(v: ReturnType<typeof fixture>) => void> = [
      v => { v.remote = { ...v.remote, remotePath: '/sdcard/DCIM/Camera/other.mp4' }; },
      v => { v.remote = { ...v.remote, remotePath: v.remotePath + '/../other.mp4' }; },
      v => { v.remote = { ...v.remote, status: 'REMOTE_PRESENT_OBSERVED',
        observedBytes: v.expectedBytes + 1, matchesExpectedBytes: false }; },
      v => { v.remote = { ...v.remote, status: 'REMOTE_ABSENT_OBSERVED',
        observedBytes: 0, matchesExpectedBytes: false }; },
      v => { v.remote = { ...v.remote, matchesExpectedBytes: true }; },
      v => { v.remote = { ...v.remote, canDelete: true as never }; },
      v => { v.remote = { ...v.remote, canMarkClean: true as never }; },
      v => { v.remote = { ...v.remote, status: 'REMOTE_DELETED_SUCCESS' as never }; },
    ];
    for (const mutate of cases) {
      const v = fixture(); mutate(v);
      const first = assess(v);
      expect(first).toMatchObject({
        status: 'BLOCKED', blockers: expect.arrayContaining([
          'PROVIDER_AND_CLEANUP_UNCERTIFIED',
        ]),
        ...noRights,
      });
      expect(first.blockers.some(code =>
        code === 'REMOTE_STAT_INVALID' || code === 'REMOTE_BYTES_MISMATCH')).toBe(true);
      expect(JSON.stringify(first)).not.toContain(v.remotePath);
    }
  });

  it('rejects forged MediaStore INDEXED_EXACT or NOT_INDEXED claims', () => {
    const cases: Array<(v: ReturnType<typeof fixture>) => void> = [
      v => { v.mediaStore = { status: 'INDEXED_EXACT', rowId: 'x',
        displayName: v.displayName, relativePath: v.relativePath,
        mimeType: 'video/mp4', bytes: v.expectedBytes }; },
      v => { v.mediaStore = { status: 'INDEXED_EXACT', rowId: '23',
        displayName: v.displayName, relativePath: 'Download/other/',
        mimeType: 'video/mp4', bytes: v.expectedBytes }; },
      v => { v.mediaStore = { status: 'INDEXED_EXACT', rowId: '23',
        displayName: v.displayName + '.jpg', relativePath: v.relativePath,
        mimeType: 'video/mp4', bytes: v.expectedBytes }; },
      v => { v.mediaStore = { status: 'INDEXED_EXACT', rowId: '23',
        displayName: v.displayName, relativePath: v.relativePath,
        mimeType: 'image/jpeg', bytes: v.expectedBytes }; },
      v => { v.mediaStore = { status: 'INDEXED_EXACT', rowId: '23',
        displayName: v.displayName, relativePath: v.relativePath,
        mimeType: 'video/mp4', bytes: 1000 }; },
      v => { v.mediaStore = { status: 'NOT_INDEXED', rowId: '23' } as never; },
      v => { v.mediaStore = { status: 'ROW_REMOVED_CONFIRMED' } as never; },
    ];
    for (const mutate of cases) {
      const v = fixture(); mutate(v);
      expect(assess(v)).toMatchObject({
        status: 'BLOCKED',
        blockers: ['MEDIASTORE_READBACK_INVALID', 'PROVIDER_AND_CLEANUP_UNCERTIFIED'],
        ...noRights,
      });
    }
  });

  it('rejects malformed frozen owned identity and any missing observation', () => {
    const cases: Array<(v: ReturnType<typeof fixture>) => void> = [
      v => { v.nonce = '../other'; },
      v => { v.extension = '.apk'; },
      v => { v.ordinal = -1; },
      v => { v.jobId = 'job_invalid/../foo'; },
      v => { v.expectedBytes = 0; },
      v => { v.remote = null as never; },
      v => { v.mediaStore = null as never; },
    ];
    for (const mutate of cases) {
      const v = fixture(); mutate(v);
      const result = assess(v);
      expect(result).toMatchObject({
        status: 'BLOCKED', blockers: expect.arrayContaining([
          'PROVIDER_AND_CLEANUP_UNCERTIFIED',
        ]), ...noRights,
      });
    }
  });
});
