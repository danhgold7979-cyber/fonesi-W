import { idSchema } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';

/** Shared by owned SEND, RECV, MediaStore and the future cleanup guard. */
export const ownedStageExtensions: ReadonlySet<string> = new Set([
  '.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
]);

export interface OwnedStageIdentity {
  jobId: string;
  ordinal: number;
  nonce: string;
  extension: string;
}
export interface OwnedStageLocation {
  remotePath: string;
  remoteDirectory: string;
  displayName: string;
  relativePath: string;
}

/** Build a canonical owned path from structured identity, never an arbitrary path. */
export function ownedStageLocation(input: OwnedStageIdentity): OwnedStageLocation {
  if (!idSchema.safeParse(input.jobId).success ||
      !Number.isSafeInteger(input.ordinal) || input.ordinal < 0 || input.ordinal >= 32 ||
      typeof input.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(input.nonce) ||
      typeof input.extension !== 'string' || !ownedStageExtensions.has(input.extension))
    throw new DomainError('OWNED_STAGE_IDENTITY_INVALID', 'Owned stage identity is not canonical.');
  const remoteDirectory = '/sdcard/Download/AutoReelsStudio/job-' + input.jobId;
  const displayName = 'asset-' + String(input.ordinal).padStart(3, '0') +
    '-' + input.nonce + input.extension;
  return {
    remotePath: remoteDirectory + '/' + displayName,
    remoteDirectory,
    displayName,
    relativePath: 'Download/AutoReelsStudio/job-' + input.jobId + '/',
  };
}

/** Every future cleanup path MUST equal the immutable ledger's owned target. */
export function assertOwnedStageLocation(
  input: OwnedStageIdentity & { remotePath: string },
): OwnedStageLocation {
  const location = ownedStageLocation(input);
  if (input.remotePath !== location.remotePath)
    throw new DomainError('OWNED_STAGE_PATH_MISMATCH', 'Remote path does not match durable owner.');
  return location;
}
