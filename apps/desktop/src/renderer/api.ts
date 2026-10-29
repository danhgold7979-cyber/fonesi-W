import { createStudioApi } from '@autoreels/contracts';
import type { StudioApi, NativeStageReviewApi, NativeEffectReviewApi } from '@autoreels/contracts';

declare global {
  interface Window {
    studioApi?: StudioApi;
    studioStageReview?: NativeStageReviewApi;
    studioEffectReview?: NativeEffectReviewApi;
  }
}
/** This bridge is intentionally absent from the public loopback browser. */
export const nativeStageReview: NativeStageReviewApi | null = window.studioStageReview ?? null;
export const nativeEffectReview: NativeEffectReviewApi | null = window.studioEffectReview ?? null;
export const api: StudioApi =
  window.studioApi ??
  createStudioApi(async (command, input) => {
    const token = document.querySelector<HTMLMetaElement>('meta[name="studio-token"]')?.content;
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Studio-Token': token ?? '' },
      body: JSON.stringify({
        command,
        input,
        operationId: 'op_' + crypto.randomUUID().replaceAll('-', ''),
      }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      value?: unknown;
      error?: { code: string; message: string };
    };
    if (!response.ok || !result.ok)
      throw Object.assign(new Error(result.error?.message ?? 'Không thể kết nối host.'), {
        code: result.error?.code ?? 'CONNECTION_ERROR',
      });
    return result.value;
  });
