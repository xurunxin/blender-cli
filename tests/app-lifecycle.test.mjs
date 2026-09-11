import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureApplication, inspectApplication, closeOwnedApplication } from '../src/app-lifecycle.mjs';

const metadata = { id: 'test-cli', label: 'Test application' };
const appPath = 'C:\\Apps\\TestApp\\test.exe';
const startedAt = '2026-09-11T01:02:03.0000000Z';

test('reuses an already-running exact application without launching', async () => {
  let launches = 0;
  const result = await ensureApplication(
    { appPath },
    metadata,
    {
      platform: 'win32',
      processInspector: async target => [{ pid: 41, path: target.toLowerCase(), startedAt }],
    },
    { launch: async () => { launches += 1; return { pid: 99, command: appPath }; } },
  );

  assert.equal(launches, 0);
  assert.deepEqual(result, {
    ownership: 'reused',
    pid: 41,
    path: appPath.toLowerCase(),
    startedAt,
    headless: false,
  });
});

test('captures only the exact launched pid, path, and creation time', async () => {
  let inspection = 0;
  const result = await ensureApplication(
    { appPath },
    metadata,
    {
      platform: 'win32',
      captureTimeoutMs: 0,
      processInspector: async target => {
        inspection += 1;
        return inspection === 1
          ? []
          : [{ pid: 55, path: target, startedAt }];
      },
    },
    { launch: async () => ({ pid: 54, command: appPath, logPath: 'test.log' }) },
  );

  assert.equal(inspection, 2);
  assert.equal(result.ownership, 'unmanaged');
  assert.equal(result.pid, 54);
  assert.equal(result.diagnostic.code, 'PROCESS_IDENTITY_MISMATCH');
  assert.equal(result.startedAt, undefined);
});

test('inspect is read-only and detects Houdini hython for headless mode', async () => {
  let inspectedPath;
  const result = await inspectApplication(
    { appPath: 'C:\\Program Files\\Side Effects Software\\Houdini 20.5\\bin\\houdini.exe' },
    metadata,
    {
      platform: 'win32',
      headless: true,
      processInspector: async target => {
        inspectedPath = target;
        return [{ pid: 73, path: target, startedAt }];
      },
    },
  );

  assert.equal(inspectedPath, 'C:\\Program Files\\Side Effects Software\\Houdini 20.5\\bin\\hython.exe');
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].ownership, 'unmanaged');
  assert.equal(result.records[0].headless, true);
});

test('refuses to close reused or unmanaged records', async () => {
  let inspected = false;
  const result = await closeOwnedApplication(
    { ownership: 'reused', pid: 41, path: appPath, startedAt },
    {
      platform: 'win32',
      processInspector: async () => { inspected = true; return []; },
    },
  );

  assert.equal(inspected, false);
  assert.equal(result.status, 'retained');
  assert.equal(result.reason, 'not_owned');
});

test('rejects PID reuse when path or creation time no longer matches', async () => {
  const result = await closeOwnedApplication(
    { ownership: 'launched', pid: 41, path: appPath, startedAt },
    {
      platform: 'win32',
      processInspector: async () => [{ pid: 41, path: appPath, startedAt: '2026-09-11T01:02:04.0000000Z' }],
      requestClose: async () => 'closed',
    },
  );

  assert.equal(result.status, 'retained');
  assert.equal(result.reason, 'process_not_found_or_pid_reused');
});

test('reports a native dialog when graceful GUI close remains pending', async () => {
  let requested = false;
  const result = await closeOwnedApplication(
    { ownership: 'launched', pid: 41, path: appPath, startedAt },
    {
      platform: 'win32',
      processInspector: async () => [{ pid: 41, path: appPath, startedAt }],
      requestClose: async () => { requested = true; return { status: 'pending_native_dialog' }; },
    },
  );

  assert.equal(requested, true);
  assert.equal(result.status, 'pending_native_dialog');
});

test('retains headless processes because there is no generic safe native close', async () => {
  const result = await closeOwnedApplication(
    { ownership: 'launched', pid: 41, path: appPath, startedAt, headless: true },
    {
      platform: 'win32',
      processInspector: async () => [{ pid: 41, path: appPath, startedAt }],
      requestClose: async () => { throw new Error('must not be called'); },
    },
  );

  assert.equal(result.status, 'retained');
  assert.equal(result.reason, 'headless_graceful_close_unsupported');
});
