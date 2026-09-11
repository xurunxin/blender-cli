import { closeSync, constants as fsConstants, openSync } from 'node:fs';
import {
  access,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const metadata = {
  id: 'blender-cli',
  bin: 'blender-cli',
  label: 'Blender',
  defaultPort: 9876,
  mcpNames: ['blender'],
};

const VERSION = '1.0.0';
const SOURCE_URL = 'https://projects.blender.org/lab/blender_mcp.git';
const SOURCE_REF = 'v1.0.0';
const SERVER_SPEC = `${SOURCE_URL}@${SOURCE_REF}#subdirectory=mcp`;
const ADDON_MODULE_DEFAULT = 'bl_ext.user_default.mcp';
const BOOTSTRAP_PATH = fileURLToPath(
  new URL('../assets/launch_blender_mcp.py', import.meta.url),
);

function codedError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

async function exists(target) {
  if (!target) return false;
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isFile(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

function isLoopbackHost(host) {
  const value = String(host).trim().toLowerCase();
  if (value === 'localhost' || value === '::1' || value === '[::1]') return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return false;
  return match.slice(1).every((part) => Number(part) <= 255) && Number(match[1]) === 127;
}

function checkedEndpoint(config, options = {}) {
  const host = String(options.host ?? config.host ?? 'localhost').trim();
  const port = Number(options.port ?? config.port ?? metadata.defaultPort);
  if (!isLoopbackHost(host)) {
    throw codedError(
      'NON_LOOPBACK_HOST',
      `Refusing to bind the Blender bridge to ${host}. Use localhost, 127.0.0.1, or ::1.`,
    );
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw codedError('INVALID_PORT', `Blender MCP port must be an integer from 1024 to 65535; got ${port}.`);
  }
  return { host, port };
}

function requireStateDir(config) {
  if (!config.stateDir || !path.isAbsolute(config.stateDir)) {
    throw codedError('INVALID_STATE_DIR', 'config.stateDir must be an absolute per-user directory.');
  }
  return path.resolve(config.stateDir);
}

async function findOnPath(name) {
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const result = await runCapture(command, [name], { timeout: 5000 });
    return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

async function resolveExecutable(explicit, candidates, pathName) {
  if (explicit) {
    if (path.isAbsolute(explicit) || explicit.includes('/') || explicit.includes('\\')) {
      return (await isFile(explicit)) ? path.resolve(explicit) : null;
    }
    return findOnPath(explicit);
  }
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return findOnPath(pathName);
}

function blenderCandidates() {
  if (process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
    const versions = ['5.2', '5.1', '5.0', '4.5', '4.4', '4.3', '4.2', '4.1', '4.0'];
    return roots.flatMap((root) => versions.map((version) =>
      path.join(root, 'Blender Foundation', `Blender ${version}`, 'blender.exe')));
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Blender.app/Contents/MacOS/Blender'];
  }
  return ['/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender'];
}

function uvCandidates() {
  if (process.platform === 'win32') {
    return [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Scripts', 'uv.exe'),
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.local', 'bin', 'uv.exe'),
    ].filter(Boolean);
  }
  return [path.join(os.homedir(), '.local', 'bin', 'uv'), '/usr/local/bin/uv', '/usr/bin/uv'];
}

function runtimePaths(stateDir) {
  const runtimeDir = path.join(stateDir, 'runtime', `blender-mcp-${VERSION}`);
  const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  return {
    runtimeDir,
    pythonPath: path.join(runtimeDir, binDir, process.platform === 'win32' ? 'python.exe' : 'python'),
    serverPath: path.join(runtimeDir, binDir, process.platform === 'win32' ? 'blender-mcp.exe' : 'blender-mcp'),
  };
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const maxOutput = options.maxOutput ?? 4 * 1024 * 1024;
    const timer = options.timeout
      ? setTimeout(() => child.kill(), options.timeout)
      : null;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxOutput) stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < maxOutput) stderr += chunk;
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr, code });
      reject(codedError(
        'COMMAND_FAILED',
        `${command} exited with ${code ?? signal}: ${(stderr || stdout).trim().slice(-2000)}`,
        { command, args, exitCode: code, signal },
      ));
    });
  });
}

function parseManifest(text) {
  const id = /^id\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
  const version = /^version\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
  return { id, version };
}

async function validateSource(sourceDir) {
  const manifestPath = path.join(sourceDir, 'addon', 'blender_mcp_addon', 'blender_manifest.toml');
  const pyprojectPath = path.join(sourceDir, 'mcp', 'pyproject.toml');
  if (!(await isFile(manifestPath)) || !(await isFile(pyprojectPath))) {
    throw codedError(
      'INVALID_SOURCE',
      `${sourceDir} is not a Blender lab blender_mcp checkout (addon manifest or mcp/pyproject.toml is missing).`,
    );
  }
  const manifest = parseManifest(await readFile(manifestPath, 'utf8'));
  if (manifest.id !== 'mcp' || manifest.version !== VERSION) {
    throw codedError(
      'SOURCE_VERSION_MISMATCH',
      `Expected Blender MCP ${VERSION}, found id=${manifest.id ?? '?'} version=${manifest.version ?? '?'}.`,
    );
  }
  return { manifestPath, pyprojectPath };
}

async function extensionRoots() {
  const roots = [];
  if (process.platform === 'win32' && process.env.APPDATA) {
    roots.push(path.join(process.env.APPDATA, 'Blender Foundation', 'Blender'));
  } else if (process.platform === 'darwin') {
    roots.push(path.join(os.homedir(), 'Library', 'Application Support', 'Blender'));
  } else {
    roots.push(path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'blender'));
  }
  return roots;
}

async function inspectExtension(pluginPath) {
  const manifestPath = path.join(pluginPath, 'blender_manifest.toml');
  if (!(await isFile(manifestPath))) return null;
  const manifest = parseManifest(await readFile(manifestPath, 'utf8'));
  if (manifest.id !== 'mcp') return null;
  const repoId = path.basename(path.dirname(pluginPath));
  return {
    path: pluginPath,
    version: manifest.version,
    addonModule: `bl_ext.${repoId}.mcp`,
  };
}

async function findInstalledExtensions(config = {}) {
  const found = [];
  const addFound = (inspected) => {
    if (inspected && !found.some((item) => item.path === inspected.path)) found.push(inspected);
  };
  if (config.pluginPath) {
    const inspected = await inspectExtension(path.resolve(config.pluginPath));
    addFound(inspected);
  }
  // Blender documents this as the direct user-extension directory. Honoring it
  // keeps setup and discovery aligned for portable or deliberately isolated profiles.
  if (process.env.BLENDER_USER_EXTENSIONS) {
    const customRoot = path.resolve(process.env.BLENDER_USER_EXTENSIONS);
    let repos;
    try {
      repos = await readdir(customRoot, { withFileTypes: true });
    } catch {
      repos = [];
    }
    for (const repo of repos) {
      if (!repo.isDirectory()) continue;
      addFound(await inspectExtension(path.join(customRoot, repo.name, 'mcp')));
    }
  }
  const standardRoots = process.env.BLENDER_USER_EXTENSIONS ? [] : await extensionRoots();
  for (const root of standardRoots) {
    let versions;
    try {
      versions = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const version of versions) {
      if (!version.isDirectory()) continue;
      const extensionsDir = path.join(root, version.name, 'extensions');
      let repos;
      try {
        repos = await readdir(extensionsDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const repo of repos) {
        if (!repo.isDirectory()) continue;
        const candidate = path.join(extensionsDir, repo.name, 'mcp');
        addFound(await inspectExtension(candidate));
      }
    }
  }
  return found;
}

function socketHost(host) {
  return host === 'localhost' ? '127.0.0.1' : host.replace(/^\[|\]$/g, '');
}

function canConnect(host, port, timeout = 400) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: socketHost(host), port });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForBridge(child, host, port, timeout) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await canConnect(host, port, 300)) return;
    if (child.exitCode !== null) {
      throw codedError('BLENDER_EXITED', `Blender exited with code ${child.exitCode} before its MCP bridge started.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw codedError(
    'BRIDGE_TIMEOUT',
    `Blender process ${child.pid} did not open ${host}:${port} within ${timeout} ms. Check its log.`,
    { pid: child.pid },
  );
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function acquireSetupLock(stateDir) {
  const lockPath = path.join(stateDir, 'setup.lock');
  await mkdir(stateDir, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      return { handle, lockPath };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try {
        owner = JSON.parse(await readFile(lockPath, 'utf8'));
      } catch {
        owner = null;
      }
      if (isProcessAlive(owner?.pid)) {
        throw codedError('SETUP_BUSY', `Another blender-cli setup is running with PID ${owner.pid}.`, {
          details: { lockPath, pid: owner.pid },
        });
      }
      await rm(lockPath, { force: true });
    }
  }
  throw codedError('SETUP_BUSY', `Could not acquire setup lock ${lockPath}.`);
}

export async function doctor(config, options = {}) {
  const checks = [];
  let stateDir;
  try {
    stateDir = requireStateDir(config);
    checks.push({ name: 'State directory', ok: true, detail: stateDir });
  } catch (error) {
    checks.push({ name: 'State directory', ok: false, detail: error.message });
  }

  let endpoint;
  try {
    endpoint = checkedEndpoint(config, options);
    checks.push({ name: 'Loopback endpoint', ok: true, detail: `${endpoint.host}:${endpoint.port}` });
  } catch (error) {
    checks.push({ name: 'Loopback endpoint', ok: false, detail: error.message });
  }

  const appPath = await resolveExecutable(
    options.appPath ?? config.appPath,
    blenderCandidates(),
    process.platform === 'win32' ? 'blender.exe' : 'blender',
  );
  checks.push({
    name: 'Blender executable',
    ok: Boolean(appPath),
    detail: appPath ?? 'Blender was not found. Install Blender 5.1+ or pass --app-path.',
  });

  const paths = stateDir ? runtimePaths(stateDir) : {};
  const serverPath = options.serverPath ?? config.serverPath ?? paths.serverPath;
  const serverReady = await isFile(serverPath);
  checks.push({
    name: 'Pinned MCP server',
    ok: serverReady,
    detail: serverReady ? serverPath : 'Run `blender-cli setup` to install Blender MCP v1.0.0 in the CLI state directory.',
  });

  const uvPath = await resolveExecutable(options.uvPath ?? config.uvPath, uvCandidates(), process.platform === 'win32' ? 'uv.exe' : 'uv');
  checks.push({
    name: 'uv installer',
    ok: Boolean(uvPath),
    detail: uvPath ?? 'uv was not found. Install it from https://docs.astral.sh/uv/ or pass --uv-path.',
    required: !serverReady,
  });

  const installed = await findInstalledExtensions(config);
  const plugin = installed.find((item) => item.version === VERSION);
  checks.push({
    name: 'Blender MCP extension',
    ok: Boolean(plugin),
    detail: plugin
      ? `${plugin.path} (v${plugin.version}; preserved in place)`
      : installed.length
        ? `Found a different MCP extension version (${installed.map((item) => item.version ?? '?').join(', ')}). Setup will not overwrite it.`
        : 'Run `blender-cli setup` to build and install the official v1.0.0 extension.',
  });

  let running = false;
  if (endpoint) running = await canConnect(endpoint.host, endpoint.port);
  checks.push({
    name: 'Blender bridge',
    ok: running,
    detail: running
      ? `Listening on ${endpoint.host}:${endpoint.port}`
      : 'Not running. Start it with `blender-cli app launch`; the stdio MCP process is separate.',
    required: false,
  });

  const requiredChecks = checks.filter((check) => check.required !== false);
  return {
    ok: requiredChecks.every((check) => check.ok),
    running,
    checks,
    appPath,
    serverPath: serverReady ? serverPath : null,
    pluginPath: plugin?.path ?? null,
  };
}

export async function setup(config, options = {}) {
  const stateDir = requireStateDir(config);
  const { host, port } = checkedEndpoint(config, options);
  const appPath = await resolveExecutable(
    options.appPath ?? config.appPath,
    blenderCandidates(),
    process.platform === 'win32' ? 'blender.exe' : 'blender',
  );
  const uvPath = await resolveExecutable(
    options.uvPath ?? config.uvPath,
    uvCandidates(),
    process.platform === 'win32' ? 'uv.exe' : 'uv',
  );
  const ownedSourceDir = path.join(stateDir, 'vendor', `blender_mcp-${VERSION}`);
  const sourceOverride = options.source ?? config.source;
  const sourceDir = path.resolve(sourceOverride ?? ownedSourceDir);
  const sourceIsOwned = sourceDir === path.resolve(ownedSourceDir);
  const { runtimeDir, pythonPath, serverPath: defaultServerPath } = runtimePaths(stateDir);
  const serverOverride = options.serverPath ?? config.serverPath;
  const serverPath = path.resolve(serverOverride ?? defaultServerPath);
  const archivePath = path.join(stateDir, 'extensions', `mcp-${VERSION}.zip`);
  const plan = [
    `Acquire official ${SOURCE_REF} source at ${sourceDir}`,
    `Install MCP server with mcp<2 into ${runtimeDir}`,
    `Build ${archivePath}`,
    'Install the extension in user_default without enabling it or saving Blender preferences',
  ];
  const merged = {
    ...config,
    stateDir,
    appPath: appPath ?? options.appPath ?? config.appPath,
    uvPath: uvPath ?? options.uvPath ?? config.uvPath,
    serverPath,
    source: sourceDir,
    host,
    port,
    version: VERSION,
  };

  if (options.dryRun) return { config: merged, changed: false, dryRun: true, plan };
  if (!appPath) {
    throw codedError('BLENDER_NOT_FOUND', 'Blender was not found. Install Blender 5.1+ or pass --app-path.');
  }
  if (!uvPath) {
    throw codedError('UV_NOT_FOUND', 'uv was not found. Install it from https://docs.astral.sh/uv/ or pass --uv-path.');
  }

  const setupLock = await acquireSetupLock(stateDir);
  try {
  await mkdir(path.dirname(sourceDir), { recursive: true });
  let sourceCreated = false;
  if (!(await exists(sourceDir))) {
    if (!sourceIsOwned) {
      throw codedError('SOURCE_NOT_FOUND', `Offline source checkout does not exist: ${sourceDir}`);
    }
    const partial = `${sourceDir}.partial-${process.pid}`;
    await rm(partial, { recursive: true, force: true });
    try {
      await runCapture('git', ['clone', '--depth', '1', '--branch', SOURCE_REF, SOURCE_URL, partial], { timeout: options.timeout ?? 180000 });
      await validateSource(partial);
      await rename(partial, sourceDir);
      sourceCreated = true;
    } catch (error) {
      await rm(partial, { recursive: true, force: true });
      throw error;
    }
  }
  await validateSource(sourceDir);

  let serverInstalled = false;
  if (serverOverride && !(await isFile(serverPath))) {
    throw codedError('SERVER_NOT_FOUND', `Configured MCP server executable does not exist: ${serverPath}`);
  }
  if (!serverOverride && (options.force || !(await isFile(serverPath)))) {
    await mkdir(path.dirname(runtimeDir), { recursive: true });
    const venvArgs = ['venv'];
    if (options.force || await exists(runtimeDir)) venvArgs.push('--clear');
    venvArgs.push(runtimeDir);
    await runCapture(uvPath, venvArgs, { timeout: options.timeout ?? 180000 });
    await runCapture(
      uvPath,
      ['pip', 'install', '--python', pythonPath, 'mcp<2', path.join(sourceDir, 'mcp')],
      { timeout: options.timeout ?? 300000 },
    );
    if (!(await isFile(serverPath))) {
      throw codedError('SERVER_INSTALL_FAILED', `uv completed but did not create ${serverPath}.`);
    }
    serverInstalled = true;
  }

  await mkdir(path.dirname(archivePath), { recursive: true });
  let archiveBuilt = false;
  if (options.force || !(await isFile(archivePath))) {
    await runCapture(appPath, [
      '--background',
      '--factory-startup',
      '--command', 'extension', 'build',
      `--source-dir=${path.join(sourceDir, 'addon', 'blender_mcp_addon')}`,
      `--output-filepath=${archivePath}`,
    ], { timeout: options.timeout ?? 180000 });
    if (!(await isFile(archivePath))) {
      throw codedError('EXTENSION_BUILD_FAILED', `Blender did not create ${archivePath}.`);
    }
    archiveBuilt = true;
  }

  const installedBefore = await findInstalledExtensions(config);
  let plugin = installedBefore.find((item) => item.version === VERSION);
  const conflicts = installedBefore.filter((item) => item.version !== VERSION);
  if (!plugin && conflicts.length) {
    throw codedError(
      'EXTENSION_CONFLICT',
      `An MCP extension already exists at ${conflicts[0].path} (version ${conflicts[0].version ?? 'unknown'}). It was preserved; remove or relocate it manually before setup.`,
      { pluginPath: conflicts[0].path },
    );
  }

  let extensionInstalled = false;
  if (!plugin) {
    await runCapture(appPath, [
      '--online-mode',
      '--background',
      '--factory-startup',
      '--command', 'extension', 'install-file',
      archivePath,
      '--repo', 'user_default',
      '--no-prefs',
    ], { timeout: options.timeout ?? 180000 });
    extensionInstalled = true;
    plugin = (await findInstalledExtensions(config)).find((item) => item.version === VERSION);
    if (!plugin) {
      throw codedError('EXTENSION_INSTALL_FAILED', 'Blender reported success, but the installed MCP extension could not be located.');
    }
  }

  merged.appPath = appPath;
  merged.uvPath = uvPath;
  merged.pluginPath = plugin.path;
  merged.addonModule = plugin.addonModule;
  return {
    config: merged,
    changed: sourceCreated || serverInstalled || archiveBuilt || extensionInstalled,
    actions: { sourceCreated, serverInstalled, archiveBuilt, extensionInstalled },
    plan,
  };
  } finally {
    await setupLock.handle.close();
    await rm(setupLock.lockPath, { force: true });
  }
}

export async function launch(config, options = {}) {
  const stateDir = requireStateDir(config);
  const { host, port } = checkedEndpoint(config, options);
  const appPath = await resolveExecutable(
    options.appPath ?? config.appPath,
    blenderCandidates(),
    process.platform === 'win32' ? 'blender.exe' : 'blender',
  );
  if (!appPath) throw codedError('BLENDER_NOT_FOUND', 'Blender was not found. Run setup or pass --app-path.');
  const headless = Boolean(options.headless);
  const discoveredPlugin = (await findInstalledExtensions(config)).find((item) => item.version === VERSION);
  const addonModule = config.addonModule ?? discoveredPlugin?.addonModule ?? ADDON_MODULE_DEFAULT;
  const args = ['--online-mode'];
  if (headless) {
    args.push('--background', '--addons', addonModule, '--command', 'blender_mcp', '--host', host, '--port', String(port));
  } else {
    args.push('--addons', addonModule, '--python', BOOTSTRAP_PATH);
  }
  if (options.dryRun) {
    return {
      pid: null,
      dryRun: true,
      appPath,
      args,
      host,
      port,
      headless,
      bridge: 'Blender TCP add-on bridge',
      mcpProcess: 'separate; use `blender-cli tools ...` from the MCP client',
    };
  }
  if (!(await isFile(BOOTSTRAP_PATH))) {
    throw codedError('BOOTSTRAP_NOT_FOUND', `Session bootstrap is missing: ${BOOTSTRAP_PATH}`);
  }
  const plugin = discoveredPlugin;
  if (!plugin) throw codedError('EXTENSION_NOT_FOUND', 'Official Blender MCP v1.0.0 is not installed. Run setup first.');
  if (await canConnect(host, port)) {
    throw codedError('PORT_IN_USE', `${host}:${port} is already accepting connections; refusing to launch a second bridge.`);
  }

  const logsDir = path.join(stateDir, 'logs');
  await mkdir(logsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(logsDir, `blender-${timestamp}.log`);
  const logFd = openSync(logPath, 'a');
  const env = {
    ...process.env,
    BLENDER_CLI_MCP_HOST: host,
    BLENDER_CLI_MCP_PORT: String(port),
  };
  const child = spawn(appPath, args, {
    cwd: stateDir,
    env,
    shell: false,
    windowsHide: true,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  const spawnError = await new Promise((resolve) => {
    child.once('error', resolve);
    child.once('spawn', () => resolve(null));
  });
  if (spawnError) {
    closeSync(logFd);
    throw codedError('BLENDER_LAUNCH_FAILED', `Could not launch Blender: ${spawnError.message}`);
  }
  closeSync(logFd);
  child.unref();
  try {
    await waitForBridge(child, host, port, Number(options.timeout ?? 15000));
  } catch (error) {
    error.logPath = logPath;
    error.details = { ...(error.details ?? {}), pid: child.pid, logPath };
    throw error;
  }
  return {
    pid: child.pid,
    appPath,
    args,
    host,
    port,
    headless,
    logPath,
    bridge: 'Blender TCP add-on bridge',
    mcpProcess: 'separate; use `blender-cli tools ...` to start it on demand',
  };
}

export async function server(config) {
  const stateDir = requireStateDir(config);
  const { host, port } = checkedEndpoint(config);
  const installedPath = config.serverPath ?? runtimePaths(stateDir).serverPath;
  if (await isFile(installedPath)) {
    return {
      command: installedPath,
      args: [],
      env: { BLENDER_MCP_HOST: host, BLENDER_MCP_PORT: String(port) },
      cwd: stateDir,
    };
  }
  throw codedError(
    'MCP_NOT_FOUND',
    `Pinned Blender MCP server is not installed at ${installedPath}. Run \`blender-cli setup\` first.`,
    { details: { serverPath: installedPath, version: VERSION } },
  );
}
