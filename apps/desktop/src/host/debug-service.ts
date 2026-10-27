import { assertJsonSafe, validateWorkflowShape } from '@autoreels/contracts';
import type { ApiCommand } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import { TraceDebugSession, validateBundle } from '@autoreels/workflow-engine';
import { debugSchemas } from './service.js';

/** Debug controls never wait behind a paused run in the serialized SQLite worker. */
export class HostDebugService {
  private sessions = new Map<string, TraceDebugSession>();
  private timer = setInterval(() => this.expire(), 30000).unref();
  private closed = false;
  handles(command: ApiCommand): boolean {
    return Object.hasOwn(debugSchemas, command);
  }
  async request(command: ApiCommand, input: unknown): Promise<unknown> {
    assertJsonSafe(input);
    if (this.closed) throw new DomainError('DEBUG_CLOSED', 'Debug service đã đóng.');
    this.expire();
    if (command === 'startDebug') {
      const p = debugSchemas.startDebug.parse(input),
        shape = validateWorkflowShape(p.bundle);
      if (!shape.ok) throw new DomainError('INVALID_WORKFLOW', shape.issues[0]!.message);
      const issues = validateBundle(shape.value);
      if (issues.length) throw new DomainError('INVALID_WORKFLOW', issues[0]!.message);
      if ([...this.sessions.values()].filter((s) => !s.finished).length >= 4)
        throw new DomainError('DEBUG_BUSY', 'Tối đa 4 phiên debug hoạt động; dừng phiên cũ trước.');
      if (this.sessions.size >= 16) {
        const oldest = [...this.sessions.values()].find((s) => s.finished);
        if (oldest) this.sessions.delete(oldest.id);
      }
      const session = new TraceDebugSession(shape.value, p.row);
      this.sessions.set(session.id, session);
      return session.snapshot;
    }
    if (command !== 'controlDebug' && command !== 'debugSnapshot')
      throw new DomainError('DEBUG_COMMAND', 'Lệnh không thuộc debug service.');
    const p = debugSchemas.debugSnapshot.parse(
      command === 'controlDebug' ? { id: debugSchemas.controlDebug.parse(input).id } : input,
    );
    const session = this.sessions.get(p.id);
    if (!session)
      throw new DomainError('DEBUG_NOT_FOUND', 'Phiên debug không tồn tại hoặc đã hết hạn.');
    if (command === 'controlDebug') {
      const control = debugSchemas.controlDebug.parse(input);
      try {
        return session.control(control.action);
      } catch (error) {
        throw new DomainError(
          'DEBUG_STATE',
          error instanceof Error ? error.message : 'Thao tác debug không hợp lệ.',
        );
      }
    }
    return session.snapshot;
  }
  private expire(): void {
    for (const [id, session] of this.sessions)
      if (Date.now() - session.createdAt > 30 * 60 * 1000) {
        void session.close();
        this.sessions.delete(id);
      }
  }
  async close(): Promise<void> {
    this.closed = true;
    clearInterval(this.timer);
    await Promise.all([...this.sessions.values()].map((session) => session.close()));
    this.sessions.clear();
  }
}
