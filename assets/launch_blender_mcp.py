"""Start the official Blender MCP bridge for this Blender process only."""

import os

import bpy


host = os.environ.get("BLENDER_CLI_MCP_HOST", "localhost")
port = int(os.environ.get("BLENDER_CLI_MCP_PORT", "9876"))

addon_key = next(
    (key for key in bpy.context.preferences.addons.keys() if key == "mcp" or key.endswith(".mcp")),
    None,
)
if addon_key is None:
    raise RuntimeError("Blender MCP extension is not enabled for this session")

preferences = bpy.context.preferences.addons[addon_key].preferences
preferences.host = host
preferences.port = port
preferences.use_autostart = False

result = bpy.ops.blmcp.server_start()
if "FINISHED" not in result:
    raise RuntimeError("Blender MCP bridge did not start: " + repr(result))

print("blender-cli: session MCP bridge started on {:s}:{:d}".format(host, port))
