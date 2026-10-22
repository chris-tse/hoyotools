import { Cron, Effect, Schedule } from 'effect';

export const dailyCron = (timeZone: string) => Cron.parse('0 11 * * *', timeZone);

export function runSchedule<A, R>(pass: Effect.Effect<A, never, R>, cron: Cron.Cron, immediate: boolean) {
  const schedule = Schedule.cron(cron);
  return immediate ? Effect.repeat(pass, schedule) : Effect.schedule(pass, schedule);
}
