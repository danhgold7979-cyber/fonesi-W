import { describe, expect, it } from 'vitest';
import { spreadJobs } from './spread.js';

const job = (id: string, deviceId = 'phone_a', scheduledUtc = '2030-01-01T16:30:00Z') => ({
  id,
  deviceId,
  scheduledUtc,
  priority: 0,
  timezone: 'Asia/Ho_Chi_Minh',
});
describe('explicit per-device spread', () => {
  it('is deterministic for the same seed and stable IDs, stays within gaps and reports local midnight crossing', () => {
    const jobs = Array.from({ length: 30 }, (_, index) =>
      job('job_' + String(index).padStart(2, '0')),
    );
    const proposal = spreadJobs(jobs, 60, 120, 12345);
    expect(spreadJobs([...jobs].reverse(), 60, 120, 12345)).toEqual(proposal);
    expect(spreadJobs(jobs, 60, 120, 98765)).not.toEqual(proposal);
    expect(Date.parse(proposal[0]!.proposedUtc)).toBe(Date.parse(jobs[0]!.scheduledUtc));
    for (let index = 1; index < proposal.length; index++) {
      const minutes =
        (Date.parse(proposal[index]!.proposedUtc) - Date.parse(proposal[index - 1]!.proposedUtc)) /
        60000;
      expect(minutes).toBeGreaterThanOrEqual(60);
      expect(minutes).toBeLessThanOrEqual(120);
      expect(proposal[index]!.gapMinutes).toBe(minutes);
      expect(proposal[index]!.crossesLocalDay).toBe(true);
    }
  });
  it('keeps independent device anchors and never pulls an already later job earlier', () => {
    const jobs = [
      job('a'),
      job('b'),
      job('c', 'phone_b'),
      job('d', 'phone_a', '2030-01-10T00:00:00Z'),
    ];
    const proposal = spreadJobs(jobs, 90, 90, 1);
    expect(Date.parse(proposal.find((p) => p.jobId === 'b')!.proposedUtc)).toBe(
      Date.parse(jobs[0]!.scheduledUtc) + 90 * 60000,
    );
    for (const id of ['a', 'c', 'd'])
      expect(Date.parse(proposal.find((p) => p.jobId === id)!.proposedUtc)).toBe(
        Date.parse(jobs.find((j) => j.id === id)!.scheduledUtc),
      );
    expect(jobs[1]!.scheduledUtc).toBe(jobs[0]!.scheduledUtc);
  });
  it('rejects invalid ranges, duplicate scope and handles UTC spacing across DST', () => {
    expect(() => spreadJobs([job('a')], 120, 60, 1)).toThrow('60–120');
    expect(() => spreadJobs([job('a')], 59, 120, 1)).toThrow();
    expect(() => spreadJobs([job('a'), job('a')], 60, 120, 1)).toThrow('trùng');
    const slots = spreadJobs(
      ['a', 'b'].map((id) => ({
        ...job(id, 'phone_a', '2030-03-10T06:30:00Z'),
        timezone: 'America/New_York',
      })),
      60,
      60,
      1,
    );
    expect(Date.parse(slots[1]!.proposedUtc) - Date.parse(slots[0]!.proposedUtc)).toBe(3600000);
  });
});
