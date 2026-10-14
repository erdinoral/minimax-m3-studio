export interface StageClock { stage: string; done: number; at: number }

/** The stage's counter and, once it has moved, the time its remaining steps take at the pace so far. */
export function stageDetail(detail: string, stage: string, clock: { current: StageClock | null }, now = Date.now()): string {
  const [doneText, totalText] = detail.split('/');
  const done = Number(doneText);
  const total = Number(totalText);
  if (!detail || !Number.isFinite(done)) return '';
  if (clock.current?.stage !== stage || done < clock.current.done) clock.current = { stage, done, at: now };
  if (!totalText || !Number.isFinite(total)) return String(done);
  const moved = done - clock.current.done;
  if (moved <= 0 || done >= total) return `${done}/${total}`;
  const left = Math.round(((now - clock.current.at) / moved) * (total - done) / 1000);
  return `${done}/${total} · ~${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}
