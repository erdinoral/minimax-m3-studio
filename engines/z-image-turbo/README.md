# Local album covers

Optional Windows C++/CUDA adapter using stable-diffusion.cpp. No Python or
Node.js is needed for inference. The app downloads the engine, CUDA 12 libraries,
Z-Image Turbo Q6_K, Qwen3-4B Q4_K_M text encoder and VAE only when requested.
Pinned release/revisions and sizes are in `local_cover.rs`. Download payload is
approximately 9 GB; allow additional space for runtime extraction and partial files.

## Use

1. Rebuild/restart the Studio service and UI (old EXEs do not include this adapter).
2. Settings → Covers → Download local cover engine.
3. When installation completes, choose Use local engine for covers.
4. Enable automatic covers in the same panel, or use a track's cover editor.

The image preset is 1024×1024, 8 diffusion steps, CFG 1.0 and CPU offloading.
It follows the upstream Turbo example, not the settings of the base model.
The prompt adds square album-art composition without lettering or logos.

Finished audio stays playable. Cover generation waits for local music jobs to
finish, stops the **owned** music process, releases the managed assistant and
runs one native image process. Music submissions and supervisor restarts share
a GPU handoff lock. External music processes are never killed; close them first.
The supervisor reloads the music engine after cover generation ends.

Settings expose download progress/cancellation and phase/elapsed time. A generation
can be cancelled and has a ten-minute limit. The latest engine diagnostics are in
the runtime data directory `cover-art/z-image-turbo/last-generation.log`.
Local failures never trigger cloud generation. Model files/images remain user data.

## Verification

Unit tests validate command arguments, prompt isolation, fresh install state and
provider persistence. A real GPU benchmark needs the optional downloads installed;
build/unit-test success alone is not a speed or image-quality measurement.

Upstream references:
- https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/z_image.md
- https://huggingface.co/leejet/Z-Image-Turbo-GGUF
- https://huggingface.co/Tongyi-MAI/Z-Image-Turbo
