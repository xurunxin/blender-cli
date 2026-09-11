# Validation — 2026-09-11

Platform: Windows, Node.js 24.20.0, Blender 5.2. Official Blender lab MCP v1.0.0.

- `setup` fetched official versioned source, installed an isolated Python MCP runtime and built the extension archive. The existing official v1.0.0 application extension was detected and preserved. A second setup returned `changed: false`.
- `app launch` started Blender with the official extension and session bootstrap. Loopback bridge `127.0.0.1:9876` became reachable, and the CLI exited while the GUI remained running.
- `tools list` discovered 26 tools through a short-lived MCP client session.
- `tools inspect get_blendfile_summary_path_info` returned its actual schema.
- `tools call get_blendfile_summary_path_info` returned `status: ok`, empty filepath, `is_saved: false`, and `is_dirty: false` from the running Blender scene.
- Fresh-profile acceptance used the actual CLI adapter with official Blender user-resource environment overrides. Setup installed the extension into an empty isolated extension directory, headless launch opened a separate loopback port, and a live read-only path summary succeeded. Repeated setup returned `changed: false`; no user preference file was created. The exact test-owned process and profile directory were removed afterward; the user's normal GUI instance was preserved.
- Automated checks cover adapter dry-run/read-only behavior, missing initialization, loopback validation, and the common MCP lifecycle, process cleanup, skill installer, and targeted configuration migration.

No scene was modified for acceptance. GUI and headless startup, an existing profile and an empty isolated extension profile were exercised. macOS/Linux execution, rendering and file-editing operations require their own target acceptance.
