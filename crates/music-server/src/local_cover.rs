//! Optional native album-art adapter. No Python runtime, no cloud fallback.
use std::{path::{Path, PathBuf}, sync::{Arc, atomic::{AtomicBool, Ordering}}, time::Instant};
use anyhow::{bail, Context, Result};
use serde::Serialize;
use tokio::sync::RwLock;
use crate::downloads::{Asset, AssetKind, Downloader};

pub const ENGINE_ID: &str = "z-image-turbo";
const fn model(id: &'static str, label: &'static str, url: &'static str, file: &'static str, bytes: u64) -> Asset {
    Asset { id, label, kind: AssetKind::Model, url, relative_path: file, bytes, unzip_into: None, marker: file, pick: &[], vram_gb: None, note: "Optional local cover weights; downloaded only on request." }
}
const fn runtime(id: &'static str, label: &'static str, url: &'static str, file: &'static str, marker: &'static str, bytes: u64) -> Asset {
    Asset { id, label, kind: AssetKind::Runtime, url, relative_path: file, bytes, unzip_into: Some("cuda"), marker, pick: &[], vram_gb: None, note: "Pinned stable-diffusion.cpp Windows CUDA 12 runtime." }
}
pub const ASSETS: &[Asset] = &[
    runtime("cover-runtime", "Native image engine", "https://github.com/leejet/stable-diffusion.cpp/releases/download/master-929-3f8527a/sd-master-3f8527a-bin-win-cuda12-x64.zip", "engine.zip", "sd-cli.exe", 337915440),
    runtime("cover-cuda", "Image engine CUDA libraries", "https://github.com/leejet/stable-diffusion.cpp/releases/download/master-929-3f8527a/cudart-sd-bin-win-cu12-x64.zip", "cuda.zip", "cublas64_12.dll", 563452046),
    model("cover-diffusion", "Z-Image Turbo Q6_K", "https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/c61c0e422dc8b541b7548cf33a4ef8302b0f8085/z_image_turbo-Q6_K.gguf", "models/z_image_turbo-Q6_K.gguf", 5263239104),
    model("cover-text", "Qwen3 4B text encoder Q4_K_M", "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf", "models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf", 2497281120),
    model("cover-vae", "Image VAE", "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/6fc90a3b1b653e935a0d175e260736de25b84df5/split_files/vae/ae.safetensors", "models/ae.safetensors", 335304388),
];

#[derive(Clone, Default, Serialize)]
pub struct RunStatus {
    pub phase: String,
    pub elapsed_seconds: f64,
    pub error: Option<String>,
}

pub struct LocalCover {
    pub downloader: Downloader,
    pub run: Arc<RwLock<RunStatus>>,
    pub installing: AtomicBool,
    cancel: AtomicBool,
}
impl LocalCover {
    pub fn new(root: &Path) -> Self {
        Self { downloader: Downloader::new(root.join("cover-art").join(ENGINE_ID)), run: Arc::new(RwLock::new(RunStatus::default())), installing: AtomicBool::new(false), cancel: AtomicBool::new(false) }
    }
    pub fn ready(&self) -> bool { ASSETS.iter().all(|a| self.downloader.is_installed(a)) }
    pub fn cancel(&self) { self.cancel.store(true, Ordering::SeqCst); self.downloader.cancel(); }
    pub fn begin(&self) { self.cancel.store(false, Ordering::SeqCst); }
    pub fn cancelled(&self) -> bool { self.cancel.load(Ordering::SeqCst) }
    pub async fn generate(&self, prompt: &str) -> Result<Vec<u8>> {
        if !self.ready() { bail!("Install Z-Image Turbo in Settings → Covers first"); }
        let started = Instant::now();
        *self.run.write().await = RunStatus { phase: "loading_and_generating".into(), ..Default::default() };
        let outcome = self.execute(prompt, started).await;
        *self.run.write().await = RunStatus {
            phase: if outcome.is_ok() { "completed" } else if self.cancel.load(Ordering::SeqCst) { "cancelled" } else { "failed" }.into(),
            elapsed_seconds: started.elapsed().as_secs_f64(), error: outcome.as_ref().err().map(ToString::to_string),
        };
        outcome
    }
    async fn execute(&self, prompt: &str, started: Instant) -> Result<Vec<u8>> {
        let runtime = self.downloader.runtime_dir("cuda");
        let executable = runtime.join("sd-cli.exe");
        let output: PathBuf = self.downloader.root().join(format!("cover-{}.png", uuid::Uuid::now_v7()));
        let log = std::fs::File::create(self.downloader.root().join("last-generation.log"))?;
        let mut command = tokio::process::Command::new(executable);
        command.current_dir(&runtime).kill_on_drop(true)
            .args(arguments(self.downloader.root(), prompt, &output))
            .stdout(log.try_clone()?).stderr(log);
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut child = command.spawn().context("start native cover engine")?;
        let result = loop {
            if self.cancel.load(Ordering::SeqCst) || started.elapsed().as_secs() > 600 {
                child.kill().await.ok();
                break Err(anyhow::anyhow!("Cover generation cancelled or exceeded ten minutes"));
            }
            if let Some(status) = child.try_wait()? {
                if !status.success() { break Err(anyhow::anyhow!("Native cover engine exited with {status}. See last-generation.log in the cover-art data directory")); }
                let bytes = tokio::fs::read(&output).await.context("native engine produced no image");
                break bytes.and_then(|bytes| {
                    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { bail!("Native engine returned an invalid PNG"); }
                    Ok(bytes)
                });
            }
            self.run.write().await.elapsed_seconds = started.elapsed().as_secs_f64();
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        };
        tokio::fs::remove_file(&output).await.ok();
        result
    }
}

fn arguments(root: &Path, prompt: &str, output: &Path) -> Vec<std::ffi::OsString> {
    let mut args = Vec::new();
    for (flag, value) in [("--diffusion-model", root.join(ASSETS[2].relative_path)), ("--llm", root.join(ASSETS[3].relative_path)), ("--vae", root.join(ASSETS[4].relative_path)), ("-o", output.to_path_buf())] {
        args.push(flag.into()); args.push(value.into_os_string());
    }
    args.extend(["-p".into(), prompt.into()]);
    args.extend(["--cfg-scale", "1.0", "--steps", "8", "-H", "1024", "-W", "1024", "--offload-to-cpu", "--diffusion-fa"].into_iter().map(Into::into));
    args
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn album_art_arguments_preserve_prompt_as_one_argument() {
        let args = arguments(Path::new("C:/models"), "album art; --steps 999", Path::new("C:/cover.png"));
        let values: Vec<_> = args.iter().map(|x| x.to_string_lossy()).collect();
        assert!(values.windows(2).any(|v| v == ["--steps", "8"]));
        assert!(values.windows(2).any(|v| v == ["-p", "album art; --steps 999"]));
        assert!(values.windows(2).any(|v| v == ["-W", "1024"]));
    }
    #[test]
    fn fresh_install_is_not_ready() {
        let root = std::env::temp_dir().join(uuid::Uuid::now_v7().to_string());
        assert!(!LocalCover::new(&root).ready());
    }
}
