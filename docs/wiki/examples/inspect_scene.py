"""Read-only Blender inventory. Syntax checked only; review before running via live MCP.

No file writes, operators, scene mutation or automatic execution by wiki commands.
"""
import json
import bpy

scene = bpy.context.scene
objects = list(scene.objects)
active = bpy.context.view_layer.objects.active
payload = {
    "blender_version": bpy.app.version_string,
    "mode": bpy.context.mode,
    "file_path": bpy.data.filepath,
    "is_dirty": bpy.data.is_dirty,
    "scene": scene.name,
    "camera": scene.camera.name if scene.camera else None,
    "render_engine": scene.render.engine,
    "frame_range": [scene.frame_start, scene.frame_end],
    "fps": scene.render.fps,
    "fps_base": scene.render.fps_base,
    "active_object": active.name if active else None,
    "object_count": len(objects),
    "objects": [{"name": obj.name, "type": obj.type} for obj in objects[:30]],
    "objects_truncated": len(objects) > 30,
}
print(json.dumps(payload, ensure_ascii=False))
