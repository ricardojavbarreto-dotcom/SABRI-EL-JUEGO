"""Import the verified GLBs into separate editable Blender projects."""

import argparse
import json
from pathlib import Path
import sys

import bpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Replace existing prototype .blend files")
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(arguments)

    package = Path(__file__).resolve().parent
    manifest = json.loads((package / "data" / "assets.json").read_text(encoding="utf-8"))
    destination = package / "source_3d" / "blender"
    inputs = [package / "public" / asset["file"] for asset in manifest["assets"]]
    outputs = [destination / (asset.stem + ".blend") for asset in inputs]

    for glb, blend in zip(inputs, outputs, strict=True):
        if not glb.is_file():
            raise FileNotFoundError(glb)
        if blend.exists() and not args.force:
            raise FileExistsError(f"{blend} already exists. Use --force to replace it.")

    destination.mkdir(parents=True, exist_ok=True)
    for asset, glb, blend in zip(manifest["assets"], inputs, outputs, strict=True):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.scale_length = 1
        scene["sabri_asset_id"] = asset["id"]
        scene["sabri_asset_version"] = asset["version"]
        scene["sabri_source_glb"] = asset["file"]
        result = bpy.ops.import_scene.gltf(filepath=str(glb))
        if "FINISHED" not in result:
            raise RuntimeError(f"Blender failed to import {glb}")
        if bpy.data.objects.get(asset["root"]) is None:
            raise RuntimeError(f"Missing root in {glb}")
        for name in asset["anchors"]:
            if bpy.data.objects.get(name) is None:
                raise RuntimeError(f"Missing anchor {name} in {glb}")
        for action in bpy.data.actions:
            action.use_fake_user = True
        for name in asset["animations"]:
            if not any(action.name == name or action.name.startswith(name + " ") for action in bpy.data.actions):
                raise RuntimeError(f"Missing imported action {name} in {glb}")
        scene.frame_set(1)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        print(f"Saved {blend}", flush=True)


if __name__ == "__main__":
    main()
