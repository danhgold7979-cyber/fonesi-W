import type { JobDefinition, ScheduledJobSummary } from '@autoreels/contracts';
import { calendarDay, type CalendarRange } from './calendar.js';

export function ScheduleCalendar(props: {
  range: CalendarRange;
  jobs: ScheduledJobSummary[];
  timezone: string;
  cardsPerDay: number;
  hasMore: boolean;
  selection: Set<string>;
  toggle: (id: string, checked: boolean) => void;
  open: (job: ScheduledJobSummary) => void;
  showDay: (day: string) => void;
  labels: Record<JobDefinition['state'], string>;
}) {
  const groups = new Map<string, ScheduledJobSummary[]>();
  for (const job of props.jobs) {
    const day = calendarDay(job.scheduledUtc, props.timezone),
      list = groups.get(day) ?? [];
    list.push(job);
    groups.set(day, list);
  }
  return (
    <div className="calendar-scroll">
      <div className="calendar-grid" aria-label="Lịch công việc theo ngày">
        {['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'].map(
          (label) => (
            <strong key={label}>{label}</strong>
          ),
        )}
        {Array.from({ length: props.range.leadingDays }, (_, index) => (
          <div key={'blank_' + index} aria-hidden="true" />
        ))}
        {props.range.days.map((day) => {
          const jobs = groups.get(day) ?? [];
          return (
            <section className="calendar-cell" key={day} aria-label={'Lịch ngày ' + day}>
              <div className="calendar-day-heading">
                <strong>
                  {day.slice(8)}/{day.slice(5, 7)}/{day.slice(0, 4)}
                </strong>
                <small>{jobs.length} đã tải</small>
              </div>
              {!jobs.length && (
                <p className="muted">
                  {props.hasMore ? 'Chưa có trong dữ liệu đã tải.' : 'Không có công việc.'}
                </p>
              )}
              {jobs.slice(0, props.cardsPerDay).map((job) => (
                <article className="calendar-job surface" key={job.id}>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={'Chọn lịch ' + job.id}
                      checked={props.selection.has(job.id)}
                      disabled={job.state !== 'SCHEDULED'}
                      onChange={(e) => props.toggle(job.id, e.target.checked)}
                    />{' '}
                    <strong>
                      {new Date(job.scheduledUtc).toLocaleTimeString('vi-VN', {
                        timeZone: props.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                  </label>
                  <span title={job.processName}>{job.processName}</span>
                  <small title={job.deviceName}>{job.deviceName}</small>
                  <small title={'Múi giờ công việc: ' + job.timezone}>
                    {props.labels[job.state]} · {job.timezone}
                  </small>
                  <button
                    disabled={job.state !== 'SCHEDULED'}
                    aria-label={'Sửa lịch ' + job.id}
                    onClick={() => props.open(job)}
                  >
                    Sửa lịch
                  </button>
                </article>
              ))}
              {jobs.length > props.cardsPerDay && (
                <p>
                  {jobs.length - props.cardsPerDay} công việc khác đã tải.{' '}
                  <button onClick={() => props.showDay(day)}>Xem ngày {day}</button>
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
