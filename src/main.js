import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const state = {
  sounds: [],
  inputDevices: [],
  selectedInputDevice: null,
  microphoneGain: 1.0,
  nativeAudio: {
    available: false,
    ready: false,
    state: 'starting',
    protocolVersion: 0,
    enginePid: 0,
    microphoneLevel01: 0,
    mixedLevel01: 0,
    underruns: 0,
    error: null,
    runtime: 'C++ / WASAPI'
  },
  virtualAudio: {
    installed: false,
    ready: false,
    installerAttempted: false,
    restartRequired: false,
    error: null,
    vendor: 'VB-Audio / VB-CABLE Pack45',
    renderDeviceName: null,
    microphoneName: null
  },
  microphoneNameInput: 'Soundboard Binder Microphone',
  microphoneNameDirty: false,
  isInstallingDriver: false,
  isRenamingMicrophone: false,
  isRestartingEngine: false,
  volume: 1.0,
  soundOverdrive: 1.0,
  monitorGain: 0.0,
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
// Which sound id the current DOM was structurally built for (null = idle, no
// live card). The 140 ms poll only needs a full re-render when this identity
// changes; otherwise it patches values in place.
let renderedLiveId = null;

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

function formatMultiplier(value) {
  return `×${(Number(value) || 1).toFixed(1)}`;
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
  const [sounds, inputDevices, selectedInputDevice, microphoneGain, volume, soundOverdrive, monitorGain, playback, virtualAudio, nativeAudio] = await Promise.all([
    invoke('list_sounds'),
    invoke('list_input_devices'),
    invoke('get_selected_input_device'),
    invoke('get_microphone_gain'),
    invoke('get_volume'),
    invoke('get_sound_overdrive'),
    invoke('get_monitor_gain'),
    invoke('get_playback_status'),
    invoke('get_virtual_audio_status'),
    invoke('get_native_audio_status')
  ]);

  state.sounds = sounds;
  state.inputDevices = inputDevices;
  state.selectedInputDevice = selectedInputDevice;
  state.microphoneGain = Number(microphoneGain ?? 1);
  state.volume = Number(volume ?? 1);
  state.soundOverdrive = Number(soundOverdrive ?? 1);
  state.monitorGain = Number(monitorGain ?? 0);
  state.playback = playback;
  state.virtualAudio = virtualAudio;
  state.nativeAudio = nativeAudio;
  if (!state.microphoneNameDirty) {
    state.microphoneNameInput = virtualAudio.microphoneName || 'Soundboard Binder Microphone';
  }
  render();
}

async function installVirtualAudioDriver() {
  if (state.isInstallingDriver) return;
  state.isInstallingDriver = true;
  render();
  try {
    await invoke('install_virtual_audio_driver');
  } catch (error) {
    alert(`Instalacja sterownika nie powiodła się: ${String(error)}`);
  } finally {
    state.isInstallingDriver = false;
    await refreshState();
  }
}

async function renameVirtualMicrophone() {
  const name = state.microphoneNameInput.trim();
  if (!name || state.isRenamingMicrophone) return;
  state.isRenamingMicrophone = true;
  render();
  try {
    await invoke('rename_virtual_microphone', { name });
    await new Promise((resolve) => setTimeout(resolve, 500));
    state.microphoneNameDirty = false;
    await refreshState();
  } catch (error) {
    alert(`Nie udało się zmienić nazwy mikrofonu: ${String(error)}`);
    state.isRenamingMicrophone = false;
    render();
    return;
  }
  state.isRenamingMicrophone = false;
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

async function onInputDeviceChange(deviceId) {
  try {
    state.selectedInputDevice = deviceId;
    await invoke('set_selected_input_device', { deviceId });
    await refreshState();
  } catch (error) {
    alert(`Nie udało się wybrać mikrofonu: ${String(error)}`);
    await refreshState();
  }
}

async function onMicrophoneGainChange(value) {
  state.microphoneGain = Number(value);
  const pill = document.querySelector('.microphone-gain-pill');
  if (pill) pill.textContent = formatVolume(state.microphoneGain);
  await invoke('set_microphone_gain', { gain: state.microphoneGain });
}

async function restartNativeAudioEngine() {
  if (state.isRestartingEngine) return;
  state.isRestartingEngine = true;
  render();
  try {
    await invoke('restart_native_audio_engine');
    await new Promise((resolve) => setTimeout(resolve, 350));
  } catch (error) {
    alert(`Nie udało się uruchomić C++ audio engine: ${String(error)}`);
  } finally {
    state.isRestartingEngine = false;
    await refreshState();
  }
}

async function onVolumeChange(value) {
  state.volume = Number(value);
  const pill = document.querySelector('.sound-gain-pill');
  if (pill) pill.textContent = formatVolume(state.volume);
  await invoke('set_volume', { volume: state.volume });
}

async function onSoundOverdriveChange(value) {
  state.soundOverdrive = Number(value);
  const pill = document.querySelector('.sound-overdrive-pill');
  if (pill) pill.textContent = formatMultiplier(state.soundOverdrive);
  await invoke('set_sound_overdrive', { overdrive: state.soundOverdrive });
}

async function onMonitorGainChange(value) {
  state.monitorGain = Number(value);
  const pill = document.querySelector('.monitor-gain-pill');
  if (pill) pill.textContent = formatVolume(state.monitorGain);
  await invoke('set_monitor_gain', { gain: state.monitorGain });
}

async function pollPlayback() {
  try {
    const previousEngineState = `${state.nativeAudio.ready}:${state.nativeAudio.state}:${state.nativeAudio.error || ''}`;
    [state.playback, state.nativeAudio] = await Promise.all([
      invoke('get_playback_status'),
      invoke('get_native_audio_status')
    ]);
    const nextEngineState = `${state.nativeAudio.ready}:${state.nativeAudio.state}:${state.nativeAudio.error || ''}`;
    if (previousEngineState !== nextEngineState) {
      render();
      return;
    }
    updatePlaybackUi();
    updateNativeAudioUi();
  } catch {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
}

function startPlaybackPolling() {
  if (playbackTimer) return;
  playbackTimer = setInterval(async () => {
    await pollPlayback();
  }, 140);
}

function levelPercent(level) {
  return Math.round(Math.max(0, Math.min(1, Number(level) || 0)) * 100);
}

function updateNativeAudioUi() {
  const microphoneFill = document.querySelector('.microphone-meter-fill');
  const mixedFill = document.querySelector('.mixed-meter-fill');
  const microphoneValue = document.querySelector('.microphone-meter-value');
  const mixedValue = document.querySelector('.mixed-meter-value');
  if (microphoneFill) microphoneFill.style.width = `${levelPercent(state.nativeAudio.microphoneLevel01)}%`;
  if (mixedFill) mixedFill.style.width = `${levelPercent(state.nativeAudio.mixedLevel01)}%`;
  if (microphoneValue) microphoneValue.textContent = `${levelPercent(state.nativeAudio.microphoneLevel01)}%`;
  if (mixedValue) mixedValue.textContent = `${levelPercent(state.nativeAudio.mixedLevel01)}%`;
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

function criticalAlert() {
  const na = state.nativeAudio;
  const va = state.virtualAudio;
  if (va.restartRequired) {
    return 'Sterownik audio zainstalowany — zrestartuj Windows, aby aktywować wirtualny mikrofon.';
  }
  if (va.error) {
    return `Sterownik audio: ${va.error}`;
  }
  if (na.state === 'error') {
    return na.error ? `Silnik audio: ${na.error}` : 'Silnik audio nie wystartował — kliknij „Restart audio engine".';
  }
  return null;
}

function render() {
  const sounds = filteredSounds();
  const alert = criticalAlert();

  document.querySelector('#app').innerHTML = `
    ${alert ? `<div class="top-alert" role="alert">⚠️ ${escapeHtml(alert)}</div>` : ''}
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

        <section class="panel section-stack engine-panel ${state.nativeAudio.ready ? 'engine-ready' : 'engine-waiting'}">
          <div class="section-head">
            <div>
              <div class="section-title">Native audio engine</div>
              <div class="section-caption">Real microphone + soundboard, mixed in real time</div>
            </div>
            <span class="driver-status ${state.nativeAudio.ready ? 'is-ready' : 'is-waiting'}">
              ${state.nativeAudio.ready ? 'LIVE' : state.nativeAudio.state.toUpperCase()}
            </span>
          </div>
          <div class="field-block">
            <label class="field-label" for="physical-microphone">Your real microphone</label>
            <select id="physical-microphone" class="input" ${state.inputDevices.length === 0 ? 'disabled' : ''}>
              ${state.inputDevices.length === 0
                ? '<option value="">No physical microphone found</option>'
                : state.inputDevices.map((device) => `
                    <option value="${escapeHtml(device.id)}" ${device.id === state.selectedInputDevice ? 'selected' : ''}>
                      ${escapeHtml(device.name)}
                    </option>
                  `).join('')}
            </select>
          </div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Microphone gain</div>
              <div class="section-caption">Voice level before mixing</div>
            </div>
            <div class="gain-pill microphone-gain-pill">${formatVolume(state.microphoneGain)}</div>
          </div>
          <input id="microphone-gain-range" class="range" type="range" min="0" max="3" step="0.01" value="${state.microphoneGain}" />
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Soundboard gain</div>
              <div class="section-caption">Bind booster · turbo up to 600%</div>
            </div>
            <div class="gain-pill sound-gain-pill">${formatVolume(state.volume)}</div>
          </div>
          <input id="volume-range" class="range" type="range" min="0" max="6" step="0.01" value="${state.volume}" />
          <div class="range-scale"><span>0%</span><span>300%</span><span>600%</span></div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Overdrive</div>
              <div class="section-caption">Multiply the soundboard past 600% — expect grit</div>
            </div>
            <div class="gain-pill sound-overdrive-pill">${formatMultiplier(state.soundOverdrive)}</div>
          </div>
          <input id="overdrive-range" class="range" type="range" min="1" max="4" step="0.05" value="${state.soundOverdrive}" />
          <div class="range-scale"><span>×1</span><span>×2.5</span><span>×4</span></div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Monitor</div>
              <div class="section-caption">Hear the bind on your own speakers · 0% = off</div>
            </div>
            <div class="gain-pill monitor-gain-pill">${formatVolume(state.monitorGain)}</div>
          </div>
          <input id="monitor-range" class="range" type="range" min="0" max="2" step="0.01" value="${state.monitorGain}" />
          <div class="range-scale"><span>0%</span><span>100%</span><span>200%</span></div>
          <div class="native-meters">
            <div class="native-meter-row">
              <div class="native-meter-label"><span>MIC</span><strong class="microphone-meter-value">${levelPercent(state.nativeAudio.microphoneLevel01)}%</strong></div>
              <div class="signal-meter"><div class="signal-meter-fill microphone-meter-fill" style="width:${levelPercent(state.nativeAudio.microphoneLevel01)}%"></div></div>
            </div>
            <div class="native-meter-row">
              <div class="native-meter-label"><span>FINAL MIX</span><strong class="mixed-meter-value">${levelPercent(state.nativeAudio.mixedLevel01)}%</strong></div>
              <div class="signal-meter"><div class="signal-meter-fill mixed-meter-fill" style="width:${levelPercent(state.nativeAudio.mixedLevel01)}%"></div></div>
            </div>
          </div>
          ${state.nativeAudio.error ? `<div class="driver-message engine-error">${escapeHtml(state.nativeAudio.error)}</div>` : ''}
          <div class="engine-meta">
            <span>${escapeHtml(state.nativeAudio.runtime)} · IPC v${state.nativeAudio.protocolVersion || '—'}</span>
            <span>PID ${state.nativeAudio.enginePid || '—'}</span>
            <span>XRUN ${state.nativeAudio.underruns || 0}</span>
          </div>
          <button class="button button-danger" id="stop-btn">Stop playback</button>
          <button class="button button-ghost" id="restart-engine-btn" ${state.isRestartingEngine ? 'disabled' : ''}>
            ${state.isRestartingEngine ? 'Restarting…' : 'Restart audio engine'}
          </button>
        </section>

        <section class="panel section-stack driver-panel ${state.virtualAudio.ready ? 'driver-ready' : 'driver-waiting'}">
          <div class="section-head">
            <div>
              <div class="section-title">Virtual microphone</div>
              <div class="section-caption">Managed entirely by Soundboard Binder</div>
            </div>
            <span class="driver-status ${state.virtualAudio.ready ? 'is-ready' : 'is-waiting'}">
              ${state.virtualAudio.ready ? 'READY' : 'SETUP'}
            </span>
          </div>
          ${state.virtualAudio.ready ? `
            <div class="managed-route">
              <span>App output</span>
              <strong>${escapeHtml(state.virtualAudio.renderDeviceName || 'Managed cable')}</strong>
            </div>
            <div class="field-block">
              <label class="field-label" for="microphone-name">System microphone name</label>
              <input
                id="microphone-name"
                class="input"
                maxlength="80"
                value="${escapeHtml(state.microphoneNameInput)}"
              />
            </div>
            <button class="button button-secondary" id="rename-microphone-btn" ${state.isRenamingMicrophone ? 'disabled' : ''}>
              ${state.isRenamingMicrophone ? 'Changing name…' : 'Apply microphone name'}
            </button>
            <div class="micro-note">Windows applications receive your voice and every bind through <strong>${escapeHtml(state.virtualAudio.microphoneName || state.microphoneNameInput)}</strong>.</div>
          ` : `
            <div class="driver-message">
              ${state.virtualAudio.error
                ? escapeHtml(state.virtualAudio.error)
                : state.virtualAudio.restartRequired
                  ? 'Driver installed. Restart Windows once to activate the virtual microphone.'
                  : 'The signed audio driver is not active yet.'}
            </div>
            <button class="button button-secondary" id="install-driver-btn" ${state.isInstallingDriver ? 'disabled' : ''}>
              ${state.isInstallingDriver ? 'Installing…' : 'Install signed driver'}
            </button>
          `}
          <div class="driver-vendor">
            Driver layer: ${escapeHtml(state.virtualAudio.vendor)} · donationware ·
            <a href="https://vb-audio.com/Cable/" target="_blank" rel="noreferrer">vb-audio.com</a>
          </div>
        </section>

        <section class="panel section-stack guide-panel">
          <div class="section-head">
            <div>
              <div class="section-title">Hear binds in Discord</div>
              <div class="section-caption">One-time setup inside the app you talk in</div>
            </div>
          </div>
          <ol class="guide-steps">
            <li>Open its voice settings — in Discord that's <strong>User Settings → Voice &amp; Video</strong>.</li>
            <li>Set <strong>Input Device</strong> to <code>Default</code> or <code>${escapeHtml(state.virtualAudio.microphoneName || state.microphoneNameInput)}</code>.</li>
            <li>Turn <strong>off</strong> Noise Suppression / Krisp, Echo Cancellation and Automatic Gain Control — they treat binds as background noise and mute them.</li>
            <li>If binds still cut out, lower the input-sensitivity threshold.</li>
          </ol>
          <div class="guide-warning">
            Pinning your physical microphone there sends only your voice — binds live only on the virtual mic, so pick <code>Default</code> or the name above.
          </div>
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
  document.getElementById('install-driver-btn')?.addEventListener('click', installVirtualAudioDriver);
  document.getElementById('rename-microphone-btn')?.addEventListener('click', renameVirtualMicrophone);
  document.getElementById('restart-engine-btn')?.addEventListener('click', restartNativeAudioEngine);
  document.getElementById('physical-microphone')?.addEventListener('change', (e) => onInputDeviceChange(e.target.value));
  document.getElementById('microphone-gain-range')?.addEventListener('input', (e) => onMicrophoneGainChange(e.target.value));
  document.getElementById('stop-btn')?.addEventListener('click', stopPlayback);
  document.getElementById('volume-range')?.addEventListener('input', (e) => onVolumeChange(e.target.value));
  document.getElementById('overdrive-range')?.addEventListener('input', (e) => onSoundOverdriveChange(e.target.value));
  document.getElementById('monitor-range')?.addEventListener('input', (e) => onMonitorGainChange(e.target.value));
  document.getElementById('microphone-name')?.addEventListener('input', (e) => {
    state.microphoneNameInput = e.target.value;
    state.microphoneNameDirty = true;
  });
  document.getElementById('microphone-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renameVirtualMicrophone();
  });
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

  renderedLiveId = state.playback.isPlaying ? state.playback.soundId : null;
}

function updatePlaybackUi() {
  const hero = document.querySelector('.hero');
  const shouldLiveId = state.playback.isPlaying ? state.playback.soundId : null;

  // Only rebuild the DOM when the live-card structure actually changes (a sound
  // starts, stops, or a different one becomes live). A full render on every
  // 140 ms poll would tear down and recreate every card, restarting their hover
  // transition — the card under the cursor would jitter/bounce forever.
  if (!hero || shouldLiveId !== renderedLiveId) {
    render();
    return;
  }

  const title = document.querySelector('.hero-title');
  const meta = document.querySelector('.hero-meta');
  const progressFill = document.querySelector('.progress-fill');
  const signalDb = document.querySelector('.signal-db');
  const signalFill = document.querySelector('.signal-box .signal-meter-fill');

  hero.classList.toggle('hero-live', !!state.playback.isPlaying);
  if (title) title.textContent = state.playback.isPlaying ? (state.playback.soundName || 'Unknown') : 'No active playback';
  if (meta) meta.textContent = state.playback.isPlaying
    ? `${formatMs(state.playback.positionMs)} / ${formatMs(state.playback.durationMs)}`
    : 'Start playback to monitor progress and signal level.';
  if (progressFill) progressFill.style.width = `${Math.round((state.playback.progress01 || 0) * 100)}%`;
  if (signalDb) signalDb.textContent = formatDb(state.playback.signalDbfs);
  if (signalFill) signalFill.style.width = `${dbMeterPercent(state.playback.signalDbfs)}%`;

  if (shouldLiveId) {
    const currentLiveCard = document.querySelector('.sound-card-live');
    const miniLine = currentLiveCard?.querySelector('.mini-line');
    const miniFill = currentLiveCard?.querySelector('.mini-fill');
    if (miniLine) miniLine.innerHTML = `<span>${formatMs(state.playback.positionMs)}</span><span>${formatMs(state.playback.durationMs)}</span>`;
    if (miniFill) miniFill.style.width = `${Math.round((state.playback.progress01 || 0) * 100)}%`;
  }
}

refreshState()
  .then(startPlaybackPolling)
  .catch((error) => {
    document.querySelector('#app').innerHTML = `<div class="boot-error">Startup error: ${escapeHtml(error)}</div>`;
  });
