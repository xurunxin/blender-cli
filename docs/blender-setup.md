# Blender setup

This CLI wraps the official Blender Lab MCP v1.0.0 project. It keeps the two official processes distinct:

```text
MCP client <-> blender-mcp over stdio <-> Blender extension over loopback TCP
```

Blender 5.1 or newer, `uv`, Git, and network access for the first setup are required. On Windows the CLI first checks the standard Blender Foundation installation folders, including `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Use `--app-path` and `--uv-path` when either program is elsewhere.

Run:

```powershell
blender-cli setup
blender-cli doctor
blender-cli app launch
```

`setup` checks out the official `v1.0.0` tag into the CLI's per-user state directory, creates an isolated Python environment, and installs the server with `mcp<2`. It builds the official extension with Blender's own extension builder and installs it into the `user_default` repository with `--no-prefs`. It does not enable the extension permanently or save Blender preferences. If an MCP extension is already installed, the CLI preserves it. A different installed version is reported as a conflict and is never overwritten, including with `--force`.

For an offline or audited source checkout, use:

```powershell
blender-cli setup --source X:\path\to\blender_mcp
```

The checkout must contain the official `addon/blender_mcp_addon/blender_manifest.toml` and `mcp/pyproject.toml` for version 1.0.0. Python dependencies still need to be available from the local `uv` cache or configured package index.

`launch` starts Blender and enables the extension only in that process. GUI mode uses a small bootstrap script to set the host and port in memory and start the nonblocking bridge. `--headless` uses the official Blender command:

```powershell
blender-cli app launch --headless --host localhost --port 9876
```

Both modes accept loopback hosts only. Blender remains running after the CLI exits. Logs are written below the CLI state directory in `logs/`.

The MCP client must launch the separate stdio server. Commands such as `blender-cli tools list` and `blender-cli tools call` start that server for one bounded MCP session using the isolated executable and these environment variables:

```text
BLENDER_MCP_HOST=localhost
BLENDER_MCP_PORT=9876
```

Without the isolated installation, the compatible on-demand command is:

```powershell
$env:BLENDER_MCP_HOST = 'localhost'
$env:BLENDER_MCP_PORT = '9876'
uvx --with 'mcp<2' --from 'git+https://projects.blender.org/lab/blender_mcp.git@v1.0.0#subdirectory=mcp' blender-mcp
```

The current official v1.0.0 server exposes the read-only scene tool named exactly `get_objects_summary`. A useful first request after Blender is listening is: “Call `get_objects_summary` and report the collection hierarchy and object names without changing the scene.”

The fresh-profile install path was exercised on Blender 5.2.1 with `BLENDER_USER_RESOURCES`, `BLENDER_USER_CONFIG`, `BLENDER_USER_SCRIPTS`, `BLENDER_USER_EXTENSIONS`, and `BLENDER_USER_DATAFILES` redirected to an empty temporary tree. Blender reported `STATUS Installed "mcp"`; the extension then started through `--addons bl_ext.user_default.mcp`, and the read-only `get_blendfile_summary_path_info` call returned an unsaved, clean startup file. No `userpref.blend` was created in that isolated profile. The CLI honors `BLENDER_USER_EXTENSIONS` during extension discovery so portable profiles use the same install and launch path.

If `doctor` says the bridge is not running, run `blender-cli app launch`; that status is informational because setup does not keep Blender open. If it reports an extension conflict, inspect the reported directory and decide whether to keep, relocate, or remove that installation yourself. The CLI will not replace it.

Official references:

- <https://www.blender.org/lab/mcp-server/>
- <https://projects.blender.org/lab/blender_mcp/src/tag/v1.0.0>
- <https://docs.blender.org/manual/en/latest/editors/preferences/extensions.html>
