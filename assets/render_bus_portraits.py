"""Render the inspector images from the fleet GLB. Run with blender -b -t 4 -P assets/render_bus_portraits.py."""
from pathlib import Path

import bpy
from mathutils import Vector


def point_at(obj, position):
    obj.rotation_euler = (Vector(position) - obj.location).to_track_quat("-Z", "Y").to_euler()


def srgb_to_linear(value):
    value /= 255
    return value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4


bpy.ops.wm.read_factory_settings(use_empty=True)
assets = Path("apps/web/public/models").resolve()
bpy.ops.import_scene.gltf(filepath=str(assets / "sp-standard-bus.glb"))
paint = bpy.data.materials["Livery"].node_tree.nodes.get("Principled BSDF")
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.016))
bpy.context.object.is_shadow_catcher = True

bpy.ops.object.camera_add(location=(11, -10, 6.4))
camera = bpy.context.object
point_at(camera, (0, 0, 1.50))
camera.data.type = "ORTHO"
camera.data.ortho_scale = 12.8

for name, position, power, size in [
    ("Key", (3, -4, 10), 1550, 8),
    ("Fill", (2, 7, 6), 1100, 7),
    ("Rim", (-6, -2, 5), 760, 6),
]:
    bpy.ops.object.light_add(type="AREA", location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.size = size
    point_at(light, (0, 0, 1))

scene = bpy.context.scene
scene.world = bpy.data.worlds.new("Studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.44
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x = 720
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 87
scene.view_settings.view_transform = "AgX"

# The same body color variants used by the map. LIVE and REPLAY share the
# illustrative GPS-marker livery because those observations provide no photo.
for color in ("138455", "19639f", "bd463f", "268b6c"):
    rgb = tuple(srgb_to_linear(int(color[index:index + 2], 16)) for index in (0, 2, 4))
    paint.inputs["Base Color"].default_value = (*rgb, 1)
    scene.render.filepath = str(assets / f"bus-portrait-{color}.webp")
    bpy.ops.render.render(write_still=True)
