import { expect, it } from '@effect/vitest';
import { Effect } from 'effect';

const env = { ...Bun.env, COOKIE: '', AXIOM_TOKEN: '', GET_REWARDS_NOW: 'false', TZ: 'UTC' };

it.live('rejects missing authentication with a nonzero exit code', () => Effect.gen(function* () {
  const child = Bun.spawn([process.execPath, 'index.ts', '--once'], { env, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exit] = yield* Effect.promise(() => Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]));
  expect(exit).toBe(1);
  expect(stdout + stderr).toContain('COOKIE is required');
}).pipe(Effect.timeout('10 seconds')));

it.live('schedules without claiming at startup and handles SIGTERM', () => Effect.gen(function* () {
  const child = yield* Effect.acquireRelease(
    Effect.sync(() => Bun.spawn([process.execPath, 'index.ts'], {
      env: { ...env, COOKIE: 'fixture-cookie' }, stdout: 'pipe', stderr: 'pipe',
    })),
    process => Effect.promise(async () => {
      if (process.exitCode === null) process.kill('SIGKILL');
      await process.exited;
    }),
  );
  const output = yield* Effect.tryPromise(async () => {
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let output = '';
    try {
      while (!output.includes('Daily collection scheduled')) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Daemon exited before scheduling');
        output += decoder.decode(value, { stream: true });
      }
      return output;
    } finally {
      reader.releaseLock();
    }
  });
  expect(output).not.toContain('Collecting daily rewards');
  child.kill('SIGTERM');
  expect(yield* Effect.promise(() => child.exited)).toBe(130);
}).pipe(Effect.scoped, Effect.timeout('10 seconds')));
