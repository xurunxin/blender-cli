import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PROCESS_INSPECTION_SCRIPT = `
$targetPath = [Environment]::GetEnvironmentVariable('APP_LIFECYCLE_TARGET_PATH')
if ([String]::IsNullOrWhiteSpace($targetPath)) { '[]'; exit 0 }
try { $targetPath = [IO.Path]::GetFullPath($targetPath) } catch { '[]'; exit 0 }
$matches = @(
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    ForEach-Object {
      $path = $_.ExecutablePath
      if ([String]::IsNullOrWhiteSpace($path)) { return }
      try { $resolvedPath = [IO.Path]::GetFullPath($path) } catch { return }
      if (-not [StringComparer]::OrdinalIgnoreCase.Equals($resolvedPath, $targetPath)) { return }
      $startedAt = $null
      try { if ($_.CreationDate) { $startedAt = $_.CreationDate.ToUniversalTime().ToString('o') } } catch { }
      [PSCustomObject]@{
        pid = [int]$_.ProcessId
        path = $resolvedPath
        startedAt = $startedAt
      }
    }
)
$matches | ConvertTo-Json -Compress
`.trim();

const GRACEFUL_CLOSE_SCRIPT = `
$targetPid = 0
try { $targetPid = [int][Environment]::GetEnvironmentVariable('APP_LIFECYCLE_PID') } catch { }
$expectedPath = [Environment]::GetEnvironmentVariable('APP_LIFECYCLE_EXPECTED_PATH')
$expectedStartedAt = [Environment]::GetEnvironmentVariable('APP_LIFECYCLE_EXPECTED_STARTED_AT')
$waitMs = 3000
try { $waitMs = [Math]::Max(0, [int][Environment]::GetEnvironmentVariable('APP_LIFECYCLE_WAIT_MS')) } catch { }
$result = [ordered]@{ requested = $false; closed = $false; status = 'still_running' }
try {
  $process = [Diagnostics.Process]::GetProcessById($targetPid)
  if ($process.HasExited) {
    $result.status = 'closed'
    $result.closed = $true
  } else {
    $native = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.ProcessId -eq $targetPid } |
      Select-Object -First 1
    $actualPath = $null
    $actualStartedAt = $null
    try {
      if ($native.ExecutablePath) { $actualPath = [IO.Path]::GetFullPath($native.ExecutablePath) }
      if ($native.CreationDate) { $actualStartedAt = $native.CreationDate.ToUniversalTime().ToString('o') }
    } catch { }
    $pathMatches = $actualPath -and $expectedPath -and [StringComparer]::OrdinalIgnoreCase.Equals($actualPath, [IO.Path]::GetFullPath($expectedPath))
    $timeMatches = $actualStartedAt -and $expectedStartedAt -and ([DateTime]::Parse($actualStartedAt).ToUniversalTime() -eq [DateTime]::Parse($expectedStartedAt).ToUniversalTime())
    if (-not ($pathMatches -and $timeMatches)) {
      $result.status = 'identity_mismatch'
      $result.reason = 'process_not_found_or_pid_reused'
    } else {
    $result.requested = [bool]$process.CloseMainWindow()
    if ($process.WaitForExit($waitMs)) {
      $result.status = 'closed'
      $result.closed = $true
    } elseif ($result.requested) {
      $result.status = 'pending_native_dialog'
    }
    }
  }
} catch {
  $result.status = 'still_running'
  $result.error = $_.Exception.Message
}
$result | ConvertTo-Json -Compress
`.trim();

function platformOf(options) {
  return options.platform ?? process.platform;
}

function pathApi(platform) {
  return platform === 'win32' ? path.win32 : path;
}

function normalizePath(value, platform = process.platform) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const api = pathApi(platform);
  try {
    const normalized = api.normalize(value);
    if (platform === 'win32') return normalized.replace(/[\\/]+$/, '').toLowerCase();
    return normalized;
  } catch {
    return value;
  }
}

function samePath(left, right, platform) {
  const a = normalizePath(left, platform);
  const b = normalizePath(right, platform);
  return Boolean(a && b && a === b);
}

function processRecord(value, headless = false) {
  if (!value || typeof value !== 'object') return null;
  const pid = Number(value.pid ?? value.ProcessId ?? value.processId);
  const executablePath = value.path ?? value.executablePath ?? value.ExecutablePath;
  const startedAt = value.startedAt
    ?? value.startTime
    ?? value.creationTime
    ?? value.createdAt
    ?? value.CreationDate;
  const record = {
    ...(Number.isSafeInteger(pid) && pid > 0 ? { pid } : {}),
    ...(typeof executablePath === 'string' && executablePath ? { path: executablePath } : {}),
    ...(startedAt ? { startedAt: String(startedAt) } : {}),
    ...(headless ? { headless: true } : {}),
  };
  return Object.keys(record).length ? record : null;
}

function parsePowerShellJson(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function inspectProcesses(targetPath, config, metadata, options) {
  const injected = options.processInspector
    ?? options.inspectProcesses
    ?? options.inspectProcess
    ?? options.listProcesses;
  if (typeof injected === 'function') {
    const result = await injected(targetPath, {
      config,
      metadata,
      headless: Boolean(options.headless),
      options,
    });
    const values = Array.isArray(result) ? result : result?.records ?? result?.processes ?? [];
    return values.map(value => processRecord(value, options.headless)).filter(Boolean);
  }

  if (platformOf(options) !== 'win32') {
    const error = new Error('Application process inspection is only supported on Windows.');
    error.code = 'UNSUPPORTED_PLATFORM';
    throw error;
  }

  const env = {
    ...process.env,
    APP_LIFECYCLE_TARGET_PATH: targetPath,
  };
  const { stdout } = await execFileAsync(
    'pwsh.exe',
    ['-NoProfile', '-NonInteractive', '-Command', PROCESS_INSPECTION_SCRIPT],
    {
      env,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      timeout: Math.max(1, boundedTimeout(options.processTimeoutMs, 5000)),
    },
  );
  return parsePowerShellJson(stdout)
    .map(value => processRecord(value, options.headless))
    .filter(Boolean);
}

function resolveTargetPath(config = {}, metadata = {}, options = {}) {
  const platform = platformOf(options);
  const configured = options.appPath ?? config.appPath ?? metadata.appPath;
  if (typeof configured !== 'string' || configured.length === 0) return null;
  if (!options.headless) return configured;

  const explicitHeadless = options.headlessPath ?? metadata.headlessPath;
  if (explicitHeadless) return explicitHeadless;

  const api = pathApi(platform);
  const baseName = api.basename(configured).toLowerCase();
  if (baseName === 'houdini.exe' || baseName === 'houdini') {
    return api.join(api.dirname(configured), platform === 'win32' ? 'hython.exe' : 'hython');
  }
  return configured;
}

function diagnostic(code, message, details) {
  return { code, message, ...(details === undefined ? {} : { details }) };
}

function boundedTimeout(value, fallback, maximum = 30000) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(0, number)) : fallback;
}

function baseRecord(options = {}) {
  return options.headless ? { headless: true } : {};
}

function recordWithOwnership(ownership, fields = {}) {
  return { ownership, ...fields };
}

function matchingRecords(records, targetPath, platform, pid) {
  return records.filter(record =>
    (!pid || record.pid === pid) && samePath(record.path, targetPath, platform));
}

async function processProbe(targetPath, config, metadata, options) {
  try {
    const records = await inspectProcesses(targetPath, config, metadata, options);
    return { records, error: null };
  } catch (error) {
    return { records: [], error };
  }
}

async function captureLaunchedProcess(targetPath, launchPid, config, metadata, options) {
  const timeoutMs = boundedTimeout(options.captureTimeoutMs, 1500, 30000);
  const intervalMs = Math.max(1, boundedTimeout(options.captureIntervalMs, 75, 5000));
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  do {
    const probe = await processProbe(targetPath, config, metadata, options);
    lastError = probe.error;
    if (probe.error) return { record: null, error: probe.error };
    const match = matchingRecords(probe.records, targetPath, platformOf(options), launchPid)
      .find(record => record.startedAt);
    if (match) return { record: match, error: null };
    if (timeoutMs === 0 || Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())));
  } while (Date.now() <= deadline);
  return { record: null, error: lastError };
}

function launchFields(result, targetPath, options) {
  const executablePath = result?.command ?? result?.appPath ?? targetPath;
  const fields = {
    ...baseRecord(options),
    ...(typeof executablePath === 'string' && executablePath ? { path: executablePath } : {}),
    ...(result?.logPath ? { logPath: result.logPath } : {}),
  };
  const pid = Number(result?.pid);
  if (Number.isSafeInteger(pid) && pid > 0) fields.pid = pid;
  return fields;
}

/**
 * Ensure the application's native process exists and return ownership metadata.
 * The application bridge is deliberately outside this helper; adapters.launch only
 * starts the application and the daemon owns MCP connection reuse separately.
 */
export async function ensureApplication(config = {}, metadata = {}, options = {}, adapters = {}) {
  const targetPath = resolveTargetPath(config, metadata, options);
  const effectiveConfig = options.appPath ? { ...config, appPath: options.appPath } : config;
  const common = {
    ...baseRecord(options),
    ...(targetPath ? { path: targetPath } : {}),
  };

  if (!targetPath) {
    let doctor;
    try { doctor = await adapters.doctor?.(effectiveConfig, options); } catch (error) {
      doctor = { ok: false, error: error.message, code: error.code };
    }
    return recordWithOwnership('unmanaged', {
      ...common,
      diagnostic: diagnostic(
        'APP_PATH_MISSING',
        'No application path is configured. Run setup or pass an explicit app path.',
        doctor,
      ),
    });
  }

  const probe = await processProbe(targetPath, effectiveConfig, metadata, options);
  if (probe.error) {
    return recordWithOwnership('unmanaged', {
      ...common,
      diagnostic: diagnostic(
        probe.error.code === 'UNSUPPORTED_PLATFORM' ? 'UNSUPPORTED_PLATFORM' : 'PROCESS_INSPECTION_FAILED',
        probe.error.message,
      ),
    });
  }

  const existing = matchingRecords(probe.records, targetPath, platformOf(options))[0];
  if (existing) {
    return recordWithOwnership('reused', {
      ...existing,
      headless: Boolean(options.headless),
    });
  }

  if (typeof adapters.launch !== 'function') {
    return recordWithOwnership('unmanaged', {
      ...common,
      diagnostic: diagnostic('LAUNCH_UNAVAILABLE', 'No application launch adapter was provided.'),
    });
  }

  const launched = await adapters.launch(effectiveConfig, options);
  const launchResult = launchFields(launched, targetPath, options);
  if (!launchResult.pid) {
    return recordWithOwnership('unmanaged', {
      ...launchResult,
      diagnostic: diagnostic('PROCESS_IDENTITY_UNAVAILABLE', 'The launch adapter did not return a process id.'),
    });
  }

  const launchPath = launchResult.path;
  const captured = await captureLaunchedProcess(launchPath, launchResult.pid, effectiveConfig, metadata, options);
  if (!captured.record) {
    return recordWithOwnership('unmanaged', {
      ...launchResult,
      diagnostic: diagnostic(
        captured.error?.code === 'UNSUPPORTED_PLATFORM' ? 'UNSUPPORTED_PLATFORM' : 'PROCESS_IDENTITY_MISMATCH',
        captured.error?.message || 'The launched process could not be matched by pid, executable path, and creation time.',
      ),
    });
  }

  return recordWithOwnership('launched', {
    ...captured.record,
    headless: Boolean(launched?.headless ?? options.headless),
    ...(launched?.logPath ? { logPath: launched.logPath } : {}),
  });
}

/**
 * Read-only process inventory for the configured executable. No bridge or socket
 * probe is performed because some applications allow only one active client.
 */
export async function inspectApplication(config = {}, metadata = {}, options = {}) {
  const targetPath = resolveTargetPath(config, metadata, options);
  const common = {
    path: targetPath,
    headless: Boolean(options.headless),
    records: [],
  };
  if (!targetPath) {
    return {
      ...common,
      diagnostic: diagnostic('APP_PATH_MISSING', 'No application path is configured. Run setup or pass an explicit app path.'),
    };
  }
  const probe = await processProbe(targetPath, config, metadata, options);
  if (probe.error) {
    return {
      ...common,
      diagnostic: diagnostic(
        probe.error.code === 'UNSUPPORTED_PLATFORM' ? 'UNSUPPORTED_PLATFORM' : 'PROCESS_INSPECTION_FAILED',
        probe.error.message,
      ),
    };
  }
  return {
    ...common,
    records: matchingRecords(probe.records, targetPath, platformOf(options)).map(record => ({
      ownership: 'unmanaged',
      ...record,
      headless: Boolean(options.headless),
    })),
  };
}

function sameStartTime(left, right) {
  if (!left || !right) return false;
  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) return leftDate === rightDate;
  return String(left) === String(right);
}

function identityMatches(current, expected, platform) {
  return Boolean(
    current?.pid && expected?.pid && current.pid === expected.pid
      && samePath(current.path, expected.path, platform)
      && sameStartTime(current.startedAt, expected.startedAt),
  );
}

async function requestWindowsClose(record, options) {
  const waitMs = boundedTimeout(options.closeTimeoutMs ?? options.timeout, 3000, 30000);
  const env = {
    ...process.env,
    APP_LIFECYCLE_PID: String(record.pid),
    APP_LIFECYCLE_WAIT_MS: String(waitMs),
    APP_LIFECYCLE_EXPECTED_PATH: String(record.path ?? ''),
    APP_LIFECYCLE_EXPECTED_STARTED_AT: String(record.startedAt ?? ''),
  };
  const { stdout } = await execFileAsync(
    'pwsh.exe',
    ['-NoProfile', '-NonInteractive', '-Command', GRACEFUL_CLOSE_SCRIPT],
    {
      env,
      windowsHide: true,
      maxBuffer: 256 * 1024,
      timeout: Math.max(1, boundedTimeout(options.processTimeoutMs, 5000)),
    },
  );
  return JSON.parse(String(stdout).trim());
}

function closeResult(record, status, extra = {}) {
  return { ...record, status, state: status, ...extra };
}

/**
 * Request a safe native GUI close for a process launched by this helper.
 * Reused, unmanaged, headless, PID-reused, and unsupported processes are retained.
 */
export async function closeOwnedApplication(record, options = {}) {
  if (!record || record.ownership !== 'launched') {
    return closeResult(record ?? {}, 'retained', { reason: 'not_owned' });
  }

  if (platformOf(options) !== 'win32') {
    return closeResult(record, 'retained', {
      reason: 'unsupported_platform',
      message: 'Safe native application close is only implemented on Windows.',
    });
  }

  const probe = await processProbe(record.path, {}, {}, options);
  const current = matchingRecords(probe.records, record.path, platformOf(options), record.pid)[0];
  if (probe.error || !identityMatches(current, record, platformOf(options))) {
    return closeResult(record, 'retained', {
      reason: probe.error?.code === 'UNSUPPORTED_PLATFORM' ? 'unsupported_platform' : 'process_not_found_or_pid_reused',
      ...(probe.error ? { message: probe.error.message } : {}),
    });
  }

  if (record.headless) {
    return closeResult(record, 'retained', {
      reason: 'headless_graceful_close_unsupported',
      message: 'Headless applications have no generic safe native close; close this process with its application-specific controls.',
    });
  }

  const injected = options.requestClose ?? options.requestGracefulClose;
  try {
    const result = typeof injected === 'function'
      ? await injected(record, current, options)
      : await requestWindowsClose(record, options);
    const normalized = typeof result === 'string' ? { status: result } : result ?? {};
    const status = ['closed', 'pending_native_dialog', 'still_running'].includes(normalized.status)
      ? normalized.status
      : normalized.closed ? 'closed' : normalized.requested ? 'pending_native_dialog' : 'still_running';
    if (normalized.status === 'identity_mismatch') {
      return closeResult(record, 'retained', { reason: 'process_not_found_or_pid_reused' });
    }
    return closeResult(record, status, normalized.reason ? { reason: normalized.reason } : {});
  } catch (error) {
    return closeResult(record, 'still_running', {
      reason: 'graceful_close_failed',
      message: error.message,
    });
  }
}
