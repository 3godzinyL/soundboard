import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const state = {
  sounds: [],
  devices: [],
  selectedDevice: null,
  volume: 1.0,
  filter: '',
  urlInput: '',
  isImporting: false,
  playback: {
    isPlaying: false,
    soundId: null,
    soundName: null,
    positionMs: 0,
    durationMs: 0,
    progress01: 0,
    signalDbfs: -90,
    signalLevel01: 0
  }
};

let playbackTimer = null;

function formatMs(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatVolume(value) {
  const percent = Math.round((Number(value) || 0) * 100);
  return `${percent}%`;
}

function formatDb(value) {
  if (!Number.isFinite(value) || value <= -90) return '-∞ dBFS';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} dBFS`;
}

function dbMeterPercent(db) {
  const normalized = (Math.max(-60, Math.min(12, db)) + 60) / 72;
  return Math.round(normalized * 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function refreshState() {
  const [sounds, devices, selectedDevice, volume, playback] = await Promise.all([
    invoke('list_sounds'),
    invoke('list_output_devices'),
    invoke('get_selected_device'),
    invoke('get_volume'),
    invoke('get_playback_status')
  ]);

  state.sounds = sounds;
  state.devices = devices;
  state.selectedDevice = selectedDevice;
  state.volume = Number(volume ?? 1);
  state.playback = playback;
  render();
}

async function addSounds() {
  const selected = await open({
    multiple: true,
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'] }]
  });

  if (!selected || (Array.isArray(selected) && selected.length === 0)) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  state.sounds = await invoke('add_sounds', { paths });
  render();
}

async function importFromUrl() {
  const url = state.urlInput.trim();
  if (!url || state.isImporting) return;
  state.isImporting = true;
  render();

  try {
    state.sounds = await invoke('import_from_url', { url });
    state.urlInput = '';
    await refreshState();
  } catch (error) {
    alert(String(error));
    state.isImporting = false;
    render();
    return;
  }

  state.isImporting = false;
  render();
}

async function removeSound(id) {
  if (!confirm('Usunąć ten dźwięk z biblioteki?')) return;
  await invoke('remove_sound', { id });
  await refreshState();
}

async function playSound(id) {
  try {
    await invoke('play_sound', { id });
    await refreshState();
    startPlaybackPolling();
  } catch (error) {
    alert(`Nie udało się odtworzyć dźwięku: ${String(error)}`);
    await refreshState();
  }
}

async function stopPlayback() {
  await invoke('stop_playback');
  await refreshState();
}

async function onDeviceChange(deviceId) {
  try {
    state.selectedDevice = deviceId;
    await invoke('set_selected_device', { deviceId });
  } catch (error) {
    alert(`Nie udało się wybrać urządzenia: ${String(error)}`);
    await refreshState();
  }
}

async function onVolumeChange(value) {
  state.volume = Number(value);
  render();
  await invoke('set_volume', { volume: state.volume });
}

async function pollPlayback() {
  try {
    state.playback = await invoke('get_playback_status');
    updatePlaybackUi();
  } catch {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
}

function startPlaybackPolling() {
  if (playbackTimer) return;
  playbackTimer = setInterval(async () => {
    await pollPlayback();
    if (!state.playback?.isPlaying) {
      clearInterval(playbackTimer);
      playbackTimer = null;
      render();
    }
  }, 120);
}

function filteredSounds() {
  const query = state.filter.trim().toLowerCase();
  if (!query) return state.sounds;
  return state.sounds.filter((sound) =>
    [sound.name, sound.path, sound.extension]
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function currentSound() {
  return state.sounds.find((sound) => sound.id === state.playback.soundId) || null;
}

function render() {
  const sounds = filteredSounds();

  document.querySelector('#app').innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-block">
          <div class="brand-mark">SB</div>
          <div>
            <div class="brand">Soundboard Binder</div>
            <div class="subline">Desktop soundboard for routed voice chat</div>
          </div>
        </div>

        <section class="panel section-stack">
          <div class="section-title">Import</div>
          <button class="button button-primary" id="add-btn">Add local audio</button>
          <div class="field-block">
            <label class="field-label" for="url-input">Import from URL</label>
            <input
              id="url-input"
              class="input"
              placeholder="YouTube / Shorts / TikTok"
              value="${escapeHtml(state.urlInput)}"
            />
          </div>
          <button class="button button-secondary" id="url-btn" ${state.isImporting ? 'disabled' : ''}>
            ${state.isImporting ? 'Importing…' : 'Fetch audio'}
          </button>
          <div class="micro-note">Requires <code>yt-dlp</code> and <code>ffmpeg</code> in PATH for URL imports.</div>
        </section>

        <section class="panel section-stack">
          <div class="section-title">Routing</div>
          <div class="field-block">
            <label class="field-label" for="device-select">Output device</label>
            <select class="input" id="device-select" ${state.devices.length === 0 ? 'disabled' : ''}>
              ${state.devices.length === 0 ? '<option>Brak urządzeń audio</option>' : ''}
              ${state.devices.map((device) => `
                <option value="${escapeHtml(device.id)}" ${device.id === state.selectedDevice ? 'selected' : ''}>
                  ${escapeHtml(device.name)}
                </option>
              `).join('')}
            </select>
          </div>
          <button class="button button-ghost" id="refresh-btn">Refresh devices</button>
        </section>

        <section class="panel section-stack turbo-panel">
          <div class="section-head">
            <div>
              <div class="section-title">Gain</div>
              <div class="section-caption">Turbo range up to 600%</div>
            </div>
            <div class="gain-pill">${formatVolume(state.volume)}</div>
          </div>
          <input id="volume-range" class="range" type="range" min="0" max="6" step="0.01" value="${state.volume}" />
          <div class="range-scale"><span>0%</span><span>300%</span><span>600%</span></div>
          <button class="button button-danger" id="stop-btn">Stop playback</button>
        </section>
      </aside>

      <main class="content">
        <header class="topbar">
          <div>
            <div class="eyebrow">Library</div>
            <h1>Saved sounds</h1>
          </div>
          <div class="top-actions">
            <input id="search-input" class="input search-input" placeholder="Search sounds" value="${escapeHtml(state.filter)}" />
            <div class="stat-chip">${state.sounds.length} items</div>
          </div>
        </header>

        <section class="hero ${state.playback.isPlaying ? 'hero-live' : ''}">
          <div class="hero-main">
            <div>
              <div class="hero-label">Now playing</div>
              <div class="hero-title">${escapeHtml(state.playback.isPlaying ? state.playback.soundName || 'Unknown' : 'No active playback')}</div>
              <div class="hero-meta">${state.playback.isPlaying ? `${formatMs(state.playback.positionMs)} / ${formatMs(state.playback.durationMs)}` : 'Start playback to monitor progress and signal level.'}</div>
            </div>
            <div class="signal-box">
              <div class="signal-label">Signal</div>
              <div class="signal-db">${formatDb(state.playback.signalDbfs)}</div>
              <div class="signal-meter"><div class="signal-meter-fill" style="width:${dbMeterPercent(state.playback.signalDbfs)}%"></div></div>
            </div>
          </div>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((state.playback.progress01 || 0) * 100)}%"></div></div>
          </div>
        </section>

        ${sounds.length === 0 ? `
          <section class="empty-state">
            <div class="empty-icon">♪</div>
            <div class="empty-title">Your library is empty</div>
            <div class="empty-copy">Add local files or pull audio straight from a supported link.</div>
          </section>
        ` : `
          <section class="card-grid">
            ${sounds.map((sound) => {
              const isLive = state.playback.isPlaying && state.playback.soundId === sound.id;
              return `
                <article class="sound-card ${isLive ? 'sound-card-live' : ''}">
                  <div class="sound-card-head">
                    <div>
                      <div class="sound-title-row">
                        <h3>${escapeHtml(sound.name)}</h3>
                        ${isLive ? '<span class="live-chip">LIVE</span>' : ''}
                      </div>
                      <div class="sound-path">${escapeHtml(sound.path)}</div>
                    </div>
                  </div>
                  <div class="tag-row">
                    <span class="tag">${escapeHtml(sound.extension.toUpperCase())}</span>
                    <span class="tag">${escapeHtml(sound.fileSizeText)}</span>
                    <span class="tag">${escapeHtml(sound.durationText)}</span>
                    <span class="tag">${escapeHtml(sound.sourceKind)}</span>
                  </div>
                  ${isLive ? `
                    <div class="mini-line"><span>${formatMs(state.playback.positionMs)}</span><span>${formatMs(state.playback.durationMs)}</span></div>
                    <div class="mini-track"><div class="mini-fill" style="width:${Math.round((state.playback.progress01 || 0) * 100)}%"></div></div>
                  ` : ''}
                  <div class="card-actions">
                    <button class="button button-primary play-btn" data-id="${escapeHtml(sound.id)}">Play</button>
                    <button class="button button-ghost remove-btn" data-id="${escapeHtml(sound.id)}">Remove</button>
                  </div>
                </article>
              `;
            }).join('')}
          </section>
        `}
      </main>
    </div>
  `;

  document.getElementById('add-btn')?.addEventListener('click', addSounds);
  document.getElementById('url-btn')?.addEventListener('click', importFromUrl);
  document.getElementById('refresh-btn')?.addEventListener('click', refreshState);
  document.getElementById('stop-btn')?.addEventListener('click', stopPlayback);
  document.getElementById('device-select')?.addEventListener('change', (e) => onDeviceChange(e.target.value));
  document.getElementById('volume-range')?.addEventListener('input', (e) => onVolumeChange(e.target.value));
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    state.filter = e.target.value;
    render();
  });
  document.getElementById('url-input')?.addEventListener('input', (e) => {
    state.urlInput = e.target.value;
  });
  document.getElementById('url-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') importFromUrl();
  });

  document.querySelectorAll('.play-btn').forEach((button) => {
    button.addEventListener('click', () => playSound(button.dataset.id));
  });

  document.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', () => removeSound(button.dataset.id));
  });
}

function updatePlaybackUi() {
  const hero = document.querySelector('.hero');
  if (!hero) {
    render();
    return;
  }

  const title = document.querySelector('.hero-title');
  const meta = document.querySelector('.hero-meta');
  const progressFill = document.querySelector('.progress-fill');
  const signalDb = document.querySelector('.signal-db');
  const signalFill = document.querySelector('.signal-meter-fill');

  hero.classList.toggle('hero-live', !!state.playback.isPlaying);
  if (title) title.textContent = state.playback.isPlaying ? (state.playback.soundName || 'Unknown') : 'No active playback';
  if (meta) meta.textContent = state.playback.isPlaying
    ? `${formatMs(state.playback.positionMs)} / ${formatMs(state.playback.durationMs)}`
    : 'Start playback to monitor progress and signal level.';
  if (progressFill) progressFill.style.width = `${Math.round((state.playback.progress01 || 0) * 100)}%`;
  if (signalDb) signalDb.textContent = formatDb(state.playback.signalDbfs);
  if (signalFill) signalFill.style.width = `${dbMeterPercent(state.playback.signalDbfs)}%`;

  const currentLiveCard = document.querySelector('.sound-card-live');
  const shouldLiveId = state.playback.isPlaying ? state.playback.soundId : null;
  if (!currentLiveCard || currentLiveCard.querySelector('.play-btn')?.dataset.id !== shouldLiveId) {
    render();
    return;
  }

  const miniLine = currentLiveCard.querySelector('.mini-line');
  const miniFill = currentLiveCard.querySelector('.mini-fill');
  if (miniLine) miniLine.innerHTML = `<span>${formatMs(state.playback.positionMs)}</span><span>${formatMs(state.playback.durationMs)}</span>`;
  if (miniFill) miniFill.style.width = `${Math.round((state.playback.progress01 || 0) * 100)}%`;
}

refreshState()
  .then(startPlaybackPolling)
  .catch((error) => {
    document.querySelector('#app').innerHTML = `<div class="boot-error">Startup error: ${escapeHtml(error)}</div>`;
  });
