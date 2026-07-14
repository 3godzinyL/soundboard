# Soundboard Binder

Desktop soundboard for Windows built with Tauri and Rust.

## Features
- polished desktop UI
- local audio library
- output device selection
- gain up to 600%
- playback progress with active track status
- estimated signal meter in dBFS during playback
- URL import for YouTube / Shorts / TikTok via `yt-dlp`
- persistent library and settings storage

## Requirements
- Node.js 20+
- Rust stable
- Windows WebView2 Runtime
- `yt-dlp` + `ffmpeg` in PATH if you want URL import

## Run in development
```bash
npm install
npm run tauri dev
```

## Build
```bash
npm install
npm run tauri build
```

## URL import
The app uses `yt-dlp` to fetch audio from supported links and stores downloaded files inside the local application library.

Recommended setup on Windows:
1. install `yt-dlp`
2. install `ffmpeg`
3. make sure both commands are available in `PATH`

## Audio routing
To route soundboard playback into voice chat, choose your virtual cable as the app output device and select the matching cable output as the microphone/input device in Discord or another chat app.

## Stored data
Settings and library metadata are stored in the user profile config directory. Imported audio files are stored in the user local app data directory under `soundboard-binder/library`.
