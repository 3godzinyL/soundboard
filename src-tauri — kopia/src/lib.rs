use cpal::traits::{DeviceTrait, HostTrait};
use rodio::stream::{play as rodio_play, DeviceSinkBuilder, MixerDeviceSink};
use rodio::{Decoder, Player, Source};
use serde::{Deserialize, Serialize};
use std::f32;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::Instant;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SoundItem {
    id: String,
    name: String,
    path: String,
    extension: String,
    file_size: u64,
    duration_ms: u64,
    #[serde(default)]
    meter_profile: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
struct SoundDto {
    id: String,
    name: String,
    path: String,
    extension: String,
    file_size: u64,
    duration_ms: u64,
    #[serde(rename = "fileSizeText")]
    file_size_text: String,
    #[serde(rename = "durationText")]
    duration_text: String,
    #[serde(rename = "sourceKind")]
    source_kind: String,
}

#[derive(Debug, Clone, Serialize)]
struct DeviceDto {
    id: String,
    name: String,
}

#[derive(Debug, Clone, Serialize)]
struct PlaybackStatusDto {
    #[serde(rename = "isPlaying")]
    is_playing: bool,
    #[serde(rename = "soundId")]
    sound_id: Option<String>,
    #[serde(rename = "soundName")]
    sound_name: Option<String>,
    #[serde(rename = "positionMs")]
    position_ms: u64,
    #[serde(rename = "durationMs")]
    duration_ms: u64,
    #[serde(rename = "progress01")]
    progress_01: f32,
    #[serde(rename = "signalDbfs")]
    signal_dbfs: f32,
    #[serde(rename = "signalLevel01")]
    signal_level_01: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct PersistedState {
    sounds: Vec<SoundItem>,
    selected_device: Option<String>,
    volume: f32,
}

struct ActivePlayback {
    _sink: MixerDeviceSink,
    player: Player,
    sound_id: String,
    sound_name: String,
    duration_ms: u64,
    started_at: Instant,
    meter_profile: Vec<u8>,
}

struct AppState {
    sounds: Vec<SoundItem>,
    selected_device: Option<String>,
    volume: f32,
    next_id: u64,
    playback: Option<ActivePlayback>,
}

impl AppState {
    fn load() -> Self {
        let persisted = load_persisted_state().ok();
        let mut sounds = persisted
            .as_ref()
            .map(|p| p.sounds.clone())
            .unwrap_or_default();

        for sound in &mut sounds {
            if (sound.duration_ms == 0 || sound.meter_profile.is_empty()) && Path::new(&sound.path).exists() {
                if let Ok((duration_ms, meter_profile)) = analyze_audio_file(Path::new(&sound.path)) {
                    sound.duration_ms = duration_ms;
                    sound.meter_profile = meter_profile;
                }
            }
        }

        let next_id = sounds
            .iter()
            .filter_map(|s| s.id.parse::<u64>().ok())
            .max()
            .unwrap_or(0)
            + 1;

        Self {
            sounds,
            selected_device: persisted.as_ref().and_then(|p| p.selected_device.clone()),
            volume: persisted.map(|p| clamp_volume(p.volume)).unwrap_or(1.0),
            next_id,
            playback: None,
        }
    }

    fn persist(&self) -> Result<(), String> {
        let persisted = PersistedState {
            sounds: self.sounds.clone(),
            selected_device: self.selected_device.clone(),
            volume: self.volume,
        };

        let path = config_file_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Nie udało się utworzyć katalogu config: {e}"))?;
        }

        let json = serde_json::to_string_pretty(&persisted)
            .map_err(|e| format!("Nie udało się zapisać JSON: {e}"))?;
        fs::write(path, json).map_err(|e| format!("Nie udało się zapisać configu: {e}"))?;
        Ok(())
    }

    fn playback_status(&mut self) -> PlaybackStatusDto {
        if let Some(playback) = &self.playback {
            let elapsed = playback.started_at.elapsed().as_millis() as u64;
            if elapsed >= playback.duration_ms && playback.duration_ms > 0 {
                self.playback = None;
            }
        }

        if let Some(playback) = &self.playback {
            let position_ms = playback.started_at.elapsed().as_millis() as u64;
            let position_ms = position_ms.min(playback.duration_ms);
            let progress_01 = if playback.duration_ms == 0 {
                0.0
            } else {
                (position_ms as f32 / playback.duration_ms as f32).clamp(0.0, 1.0)
            };
            let signal_level_01 = level_for_position(&playback.meter_profile, position_ms) * self.volume;
            let signal_dbfs = dbfs_from_level(signal_level_01);

            PlaybackStatusDto {
                is_playing: true,
                sound_id: Some(playback.sound_id.clone()),
                sound_name: Some(playback.sound_name.clone()),
                position_ms,
                duration_ms: playback.duration_ms,
                progress_01,
                signal_dbfs,
                signal_level_01: signal_level_01.clamp(0.0, 6.0),
            }
        } else {
            PlaybackStatusDto {
                is_playing: false,
                sound_id: None,
                sound_name: None,
                position_ms: 0,
                duration_ms: 0,
                progress_01: 0.0,
                signal_dbfs: -90.0,
                signal_level_01: 0.0,
            }
        }
    }
}

fn load_persisted_state() -> Result<PersistedState, String> {
    let path = config_file_path()?;
    if !path.exists() {
        return Err("Brak poprzedniego configu".into());
    }
    let text = fs::read_to_string(path).map_err(|e| format!("Błąd odczytu configu: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("Błąd parsowania configu: {e}"))
}

fn config_file_path() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or_else(|| "Brak katalogu konfiguracyjnego".to_string())?;
    Ok(base.join("soundboard-binder").join("state.json"))
}

fn library_dir() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| "Brak katalogu danych aplikacji".to_string())?;
    let dir = base.join("soundboard-binder").join("library");
    fs::create_dir_all(&dir).map_err(|e| format!("Nie udało się utworzyć katalogu biblioteki: {e}"))?;
    Ok(dir)
}

fn clamp_volume(v: f32) -> f32 {
    v.clamp(0.0, 6.0)
}

fn file_name_for_path(path: &Path) -> String {
    path.file_name()
        .and_then(|x| x.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn extension_for_path(path: &Path) -> String {
    path.extension()
        .and_then(|x| x.to_str())
        .unwrap_or("?")
        .to_lowercase()
}

fn file_size_text(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let b = bytes as f64;
    if b >= GB {
        format!("{:.2} GB", b / GB)
    } else if b >= MB {
        format!("{:.2} MB", b / MB)
    } else if b >= KB {
        format!("{:.1} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

fn format_duration(ms: u64) -> String {
    let total_seconds = ms / 1000;
    let minutes = total_seconds / 60;
    let seconds = total_seconds % 60;
    format!("{minutes:02}:{seconds:02}")
}

fn dbfs_from_level(level: f32) -> f32 {
    if level <= 0.000_01 {
        -90.0
    } else {
        (20.0 * level.log10()).clamp(-90.0, 15.6)
    }
}

fn level_for_position(profile: &[u8], position_ms: u64) -> f32 {
    if profile.is_empty() {
        return 0.0;
    }
    let chunk_index = ((position_ms / 100) as usize).min(profile.len().saturating_sub(1));
    profile[chunk_index] as f32 / 255.0
}

fn analyze_audio_file(path: &Path) -> Result<(u64, Vec<u8>), String> {
    let file = File::open(path).map_err(|e| format!("Nie udało się otworzyć pliku do analizy: {e}"))?;
    let decoder = Decoder::try_from(BufReader::new(file))
        .map_err(|e| format!("Nie udało się zdekodować pliku: {e}"))?;

    let channels = usize::from(decoder.channels().get().max(1));
    let sample_rate = decoder.sample_rate().get().max(1) as usize;
    let samples_per_chunk = ((sample_rate * channels) / 10).max(channels);
    let total_duration = decoder.total_duration().map(|d| d.as_millis() as u64);

    let mut meter_profile = Vec::new();
    let mut sum_sq = 0.0f64;
    let mut count = 0usize;
    let mut total_samples = 0usize;

    for sample in decoder {
        let s = sample.abs().min(1.25) as f64;
        sum_sq += s * s;
        count += 1;
        total_samples += 1;

        if count >= samples_per_chunk {
            let rms = (sum_sq / count as f64).sqrt().clamp(0.0, 1.0);
            meter_profile.push((rms * 255.0).round() as u8);
            sum_sq = 0.0;
            count = 0;
        }
    }

    if count > 0 {
        let rms = (sum_sq / count as f64).sqrt().clamp(0.0, 1.0);
        meter_profile.push((rms * 255.0).round() as u8);
    }

    let duration_ms = total_duration.unwrap_or_else(|| {
        ((total_samples as f64 / (sample_rate * channels) as f64) * 1000.0).round() as u64
    });

    Ok((duration_ms, meter_profile))
}

fn to_sound_dto(item: &SoundItem) -> SoundDto {
    let source_kind = if item.path.contains("soundboard-binder") {
        "library"
    } else {
        "file"
    };

    SoundDto {
        id: item.id.clone(),
        name: item.name.clone(),
        path: item.path.clone(),
        extension: item.extension.clone(),
        file_size: item.file_size,
        duration_ms: item.duration_ms,
        file_size_text: file_size_text(item.file_size),
        duration_text: format_duration(item.duration_ms),
        source_kind: source_kind.to_string(),
    }
}

fn list_output_devices_impl() -> Result<Vec<DeviceDto>, String> {
    let host = cpal::default_host();
    let devices = host
        .output_devices()
        .map_err(|e| format!("Nie udało się pobrać output devices: {e}"))?;

    let mut result = Vec::new();
    for device in devices {
        let name = device.name().unwrap_or_else(|_| "Unknown device".to_string());
        result.push(DeviceDto {
            id: name.clone(),
            name,
        });
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

fn find_output_device(device_name: Option<&str>) -> Result<cpal::Device, String> {
    let host = cpal::default_host();

    if let Some(device_name) = device_name {
        let devices = host
            .output_devices()
            .map_err(|e| format!("Nie udało się pobrać output devices: {e}"))?;

        for device in devices {
            let current_name = device.name().unwrap_or_default();
            if current_name == device_name {
                return Ok(device);
            }
        }

        Err(format!("Nie znaleziono urządzenia: {device_name}"))
    } else {
        host.default_output_device()
            .ok_or_else(|| "Brak domyślnego urządzenia wyjściowego".to_string())
    }
}

fn add_sound_path(app: &mut AppState, path: PathBuf) -> Result<(), String> {
    if !path.exists() || !path.is_file() {
        return Err("Plik nie istnieje albo nie jest plikiem audio".into());
    }

    let normalized = path.to_string_lossy().to_string();
    if app.sounds.iter().any(|s| s.path == normalized) {
        return Ok(());
    }

    let (duration_ms, meter_profile) = analyze_audio_file(&path)?;
    let file_size = path.metadata().map(|m| m.len()).unwrap_or(0);
    let item = SoundItem {
        id: app.next_id.to_string(),
        name: file_name_for_path(&path),
        path: normalized,
        extension: extension_for_path(&path),
        file_size,
        duration_ms,
        meter_profile,
    };
    app.next_id += 1;
    app.sounds.push(item);
    Ok(())
}

fn download_audio_to_library(url: &str) -> Result<PathBuf, String> {
    let library = library_dir()?;
    let template = library.join("%(title).120B [%(id)s].%(ext)s");
    let output_template = template.to_string_lossy().to_string();

    let output = Command::new("yt-dlp")
        .args([
            "--no-playlist",
            "--windows-filenames",
            "--no-warnings",
            "--print",
            "after_move:filepath",
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "-o",
            &output_template,
            url,
        ])
        .output()
        .map_err(|e| {
            format!(
                "Nie udało się uruchomić yt-dlp. Zainstaluj yt-dlp i ffmpeg, a potem dodaj je do PATH. Szczegóły: {e}"
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let details = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        return Err(format!("Import z linku nie powiódł się: {details}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let final_path = stdout
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .map(|line| PathBuf::from(line.trim()))
        .filter(|path| path.exists())
        .ok_or_else(|| "yt-dlp nie zwrócił finalnej ścieżki pliku".to_string())?;

    Ok(final_path)
}

#[tauri::command]
fn list_sounds(state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<SoundDto>, String> {
    let app = state.lock().map_err(|_| "State lock error".to_string())?;
    Ok(app.sounds.iter().map(to_sound_dto).collect())
}

#[tauri::command]
fn add_sounds(paths: Vec<String>, state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<SoundDto>, String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;

    for raw in paths {
        let path = PathBuf::from(&raw);
        let _ = add_sound_path(&mut app, path);
    }

    app.persist()?;
    Ok(app.sounds.iter().map(to_sound_dto).collect())
}

#[tauri::command]
fn import_from_url(url: String, state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<SoundDto>, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Wklej link do YouTube, Shorts albo TikToka".into());
    }

    let downloaded = download_audio_to_library(trimmed)?;
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    add_sound_path(&mut app, downloaded)?;
    app.persist()?;
    Ok(app.sounds.iter().map(to_sound_dto).collect())
}

#[tauri::command]
fn remove_sound(id: String, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    app.sounds.retain(|s| s.id != id);
    if app.playback.as_ref().map(|p| p.sound_id.as_str()) == Some(id.as_str()) {
        app.playback = None;
    }
    app.persist()
}

#[tauri::command]
fn list_output_devices() -> Result<Vec<DeviceDto>, String> {
    list_output_devices_impl()
}

#[tauri::command]
fn set_selected_device(device_id: String, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let devices = list_output_devices_impl()?;
    if !devices.iter().any(|d| d.id == device_id) {
        return Err("Wybrane urządzenie już nie istnieje".into());
    }

    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    app.selected_device = Some(device_id);
    app.persist()
}

#[tauri::command]
fn get_selected_device(state: tauri::State<'_, Mutex<AppState>>) -> Result<Option<String>, String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    if app.selected_device.is_none() {
        app.selected_device = list_output_devices_impl()?.into_iter().next().map(|d| d.id);
    }
    Ok(app.selected_device.clone())
}

#[tauri::command]
fn set_volume(volume: f32, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    app.volume = clamp_volume(volume);
    if let Some(playback) = &app.playback {
        playback.player.set_volume(app.volume);
    }
    app.persist()
}

#[tauri::command]
fn get_volume(state: tauri::State<'_, Mutex<AppState>>) -> Result<f32, String> {
    let app = state.lock().map_err(|_| "State lock error".to_string())?;
    Ok(app.volume)
}

#[tauri::command]
fn stop_playback(state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    app.playback = None;
    Ok(())
}

#[tauri::command]
fn play_sound(id: String, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;

    let sound_index = app
        .sounds
        .iter()
        .position(|s| s.id == id)
        .ok_or_else(|| "Nie znaleziono dźwięku".to_string())?;

    let needs_analysis = app.sounds[sound_index].duration_ms == 0 || app.sounds[sound_index].meter_profile.is_empty();
    if needs_analysis {
        let path = PathBuf::from(&app.sounds[sound_index].path);
        let (duration_ms, meter_profile) = analyze_audio_file(&path)?;
        app.sounds[sound_index].duration_ms = duration_ms;
        app.sounds[sound_index].meter_profile = meter_profile;
        let _ = app.persist();
    }

    let sound = app.sounds[sound_index].clone();
    let device = find_output_device(app.selected_device.as_deref())?;
    let file = File::open(&sound.path).map_err(|e| format!("Nie udało się otworzyć pliku: {e}"))?;
    let reader = BufReader::new(file);

    app.playback = None;

    let mut sink = DeviceSinkBuilder::default()
        .with_device(device)
        .open_stream()
        .map_err(|e| format!("Nie udało się otworzyć output stream: {e}"))?;
    sink.log_on_drop(false);

    let player = rodio_play(sink.mixer(), reader).map_err(|e| format!("Nie udało się odtworzyć pliku: {e}"))?;
    player.set_volume(app.volume);

    app.playback = Some(ActivePlayback {
        _sink: sink,
        player,
        sound_id: sound.id,
        sound_name: sound.name,
        duration_ms: sound.duration_ms,
        started_at: Instant::now(),
        meter_profile: sound.meter_profile,
    });

    Ok(())
}

#[tauri::command]
fn get_playback_status(state: tauri::State<'_, Mutex<AppState>>) -> Result<PlaybackStatusDto, String> {
    let mut app = state.lock().map_err(|_| "State lock error".to_string())?;
    Ok(app.playback_status())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(AppState::load()))
        .invoke_handler(tauri::generate_handler![
            list_sounds,
            add_sounds,
            import_from_url,
            remove_sound,
            list_output_devices,
            set_selected_device,
            get_selected_device,
            set_volume,
            get_volume,
            play_sound,
            stop_playback,
            get_playback_status
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Soundboard Binder");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
