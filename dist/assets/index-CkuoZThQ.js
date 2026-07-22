(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const l of r)if(l.type==="childList")for(const u of l.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&s(u)}).observe(document,{childList:!0,subtree:!0});function t(r){const l={};return r.integrity&&(l.integrity=r.integrity),r.referrerPolicy&&(l.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?l.credentials="include":r.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function s(r){if(r.ep)return;r.ep=!0;const l=t(r);fetch(r.href,l)}})();async function a(i,n={},t){return window.__TAURI_INTERNALS__.invoke(i,n,t)}async function E(i={}){return typeof i=="object"&&Object.freeze(i),await a("plugin:dialog|open",{options:i})}const e={sounds:[],inputDevices:[],selectedInputDevice:null,microphoneGain:1,nativeAudio:{available:!1,ready:!1,state:"starting",protocolVersion:0,enginePid:0,microphoneLevel01:0,mixedLevel01:0,underruns:0,error:null,runtime:"C++ / WASAPI"},virtualAudio:{installed:!1,ready:!1,installerAttempted:!1,restartRequired:!1,error:null,vendor:"VB-Audio / VB-CABLE Pack45",renderDeviceName:null,microphoneName:null},microphoneNameInput:"Soundboard Binder Microphone",microphoneNameDirty:!1,isInstallingDriver:!1,isRenamingMicrophone:!1,isRestartingEngine:!1,volume:1,soundOverdrive:1,monitorGain:0,filter:"",urlInput:"",isImporting:!1,playback:{isPlaying:!1,soundId:null,soundName:null,positionMs:0,durationMs:0,progress01:0,signalDbfs:-90,signalLevel01:0}};let b=null,k=null;function v(i){const n=Math.floor((i||0)/1e3),t=Math.floor(n/60),s=n%60;return`${String(t).padStart(2,"0")}:${String(s).padStart(2,"0")}`}function m(i){return`${Math.round((Number(i)||0)*100)}%`}function w(i){return`×${(Number(i)||1).toFixed(1)}`}function A(i){return!Number.isFinite(i)||i<=-90?"-∞ dBFS":`${i>0?"+":""}${i.toFixed(1)} dBFS`}function I(i){const n=(Math.max(-60,Math.min(12,i))+60)/72;return Math.round(n*100)}function o(i){return String(i).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}async function c(){const[i,n,t,s,r,l,u,y,g,h]=await Promise.all([a("list_sounds"),a("list_input_devices"),a("get_selected_input_device"),a("get_microphone_gain"),a("get_volume"),a("get_sound_overdrive"),a("get_monitor_gain"),a("get_playback_status"),a("get_virtual_audio_status"),a("get_native_audio_status")]);e.sounds=i,e.inputDevices=n,e.selectedInputDevice=t,e.microphoneGain=Number(s??1),e.volume=Number(r??1),e.soundOverdrive=Number(l??1),e.monitorGain=Number(u??0),e.playback=y,e.virtualAudio=g,e.nativeAudio=h,e.microphoneNameDirty||(e.microphoneNameInput=g.microphoneName||"Soundboard Binder Microphone"),d()}async function _(){if(!e.isInstallingDriver){e.isInstallingDriver=!0,d();try{await a("install_virtual_audio_driver")}catch(i){alert(`Instalacja sterownika nie powiodła się: ${String(i)}`)}finally{e.isInstallingDriver=!1,await c()}}}async function f(){const i=e.microphoneNameInput.trim();if(!(!i||e.isRenamingMicrophone)){e.isRenamingMicrophone=!0,d();try{await a("rename_virtual_microphone",{name:i}),await new Promise(n=>setTimeout(n,500)),e.microphoneNameDirty=!1,await c()}catch(n){alert(`Nie udało się zmienić nazwy mikrofonu: ${String(n)}`),e.isRenamingMicrophone=!1,d();return}e.isRenamingMicrophone=!1,d()}}async function L(){const i=await E({multiple:!0,filters:[{name:"Audio",extensions:["mp3","wav","flac","ogg","m4a","aac","wma"]}]});if(!i||Array.isArray(i)&&i.length===0)return;const n=Array.isArray(i)?i:[i];e.sounds=await a("add_sounds",{paths:n}),d()}async function $(){const i=e.urlInput.trim();if(!(!i||e.isImporting)){e.isImporting=!0,d();try{e.sounds=await a("import_from_url",{url:i}),e.urlInput="",await c()}catch(n){alert(String(n)),e.isImporting=!1,d();return}e.isImporting=!1,d()}}async function N(i){confirm("Usunąć ten dźwięk z biblioteki?")&&(await a("remove_sound",{id:i}),await c())}async function M(i){try{await a("play_sound",{id:i}),await c(),S()}catch(n){alert(`Nie udało się odtworzyć dźwięku: ${String(n)}`),await c()}}async function D(){await a("stop_playback"),await c()}async function x(i){try{e.selectedInputDevice=i,await a("set_selected_input_device",{deviceId:i}),await c()}catch(n){alert(`Nie udało się wybrać mikrofonu: ${String(n)}`),await c()}}async function P(i){e.microphoneGain=Number(i);const n=document.querySelector(".microphone-gain-pill");n&&(n.textContent=m(e.microphoneGain)),await a("set_microphone_gain",{gain:e.microphoneGain})}async function R(){if(!e.isRestartingEngine){e.isRestartingEngine=!0,d();try{await a("restart_native_audio_engine"),await new Promise(i=>setTimeout(i,350))}catch(i){alert(`Nie udało się uruchomić C++ audio engine: ${String(i)}`)}finally{e.isRestartingEngine=!1,await c()}}}async function q(i){e.volume=Number(i);const n=document.querySelector(".sound-gain-pill");n&&(n.textContent=m(e.volume)),await a("set_volume",{volume:e.volume})}async function C(i){e.soundOverdrive=Number(i);const n=document.querySelector(".sound-overdrive-pill");n&&(n.textContent=w(e.soundOverdrive)),await a("set_sound_overdrive",{overdrive:e.soundOverdrive})}async function B(i){e.monitorGain=Number(i);const n=document.querySelector(".monitor-gain-pill");n&&(n.textContent=m(e.monitorGain)),await a("set_monitor_gain",{gain:e.monitorGain})}async function G(){try{const i=`${e.nativeAudio.ready}:${e.nativeAudio.state}:${e.nativeAudio.error||""}`;[e.playback,e.nativeAudio]=await Promise.all([a("get_playback_status"),a("get_native_audio_status")]);const n=`${e.nativeAudio.ready}:${e.nativeAudio.state}:${e.nativeAudio.error||""}`;if(i!==n){d();return}F(),O()}catch{clearInterval(b),b=null}}function S(){b||(b=setInterval(async()=>{await G()},140))}function p(i){return Math.round(Math.max(0,Math.min(1,Number(i)||0))*100)}function O(){const i=document.querySelector(".microphone-meter-fill"),n=document.querySelector(".mixed-meter-fill"),t=document.querySelector(".microphone-meter-value"),s=document.querySelector(".mixed-meter-value");i&&(i.style.width=`${p(e.nativeAudio.microphoneLevel01)}%`),n&&(n.style.width=`${p(e.nativeAudio.mixedLevel01)}%`),t&&(t.textContent=`${p(e.nativeAudio.microphoneLevel01)}%`),s&&(s.textContent=`${p(e.nativeAudio.mixedLevel01)}%`)}function T(){const i=e.filter.trim().toLowerCase();return i?e.sounds.filter(n=>[n.name,n.path,n.extension].join(" ").toLowerCase().includes(i)):e.sounds}function V(){const i=e.nativeAudio,n=e.virtualAudio;return n.restartRequired?"Sterownik audio zainstalowany — zrestartuj Windows, aby aktywować wirtualny mikrofon.":n.error?`Sterownik audio: ${n.error}`:i.state==="error"?i.error?`Silnik audio: ${i.error}`:'Silnik audio nie wystartował — kliknij „Restart audio engine".':null}function d(){const i=T(),n=V();document.querySelector("#app").innerHTML=`
    ${n?`<div class="top-alert" role="alert">⚠️ ${o(n)}</div>`:""}
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
              value="${o(e.urlInput)}"
            />
          </div>
          <button class="button button-secondary" id="url-btn" ${e.isImporting?"disabled":""}>
            ${e.isImporting?"Importing…":"Fetch audio"}
          </button>
          <div class="micro-note">Requires <code>yt-dlp</code> and <code>ffmpeg</code> in PATH for URL imports.</div>
        </section>

        <section class="panel section-stack engine-panel ${e.nativeAudio.ready?"engine-ready":"engine-waiting"}">
          <div class="section-head">
            <div>
              <div class="section-title">Native audio engine</div>
              <div class="section-caption">Real microphone + soundboard, mixed in real time</div>
            </div>
            <span class="driver-status ${e.nativeAudio.ready?"is-ready":"is-waiting"}">
              ${e.nativeAudio.ready?"LIVE":e.nativeAudio.state.toUpperCase()}
            </span>
          </div>
          <div class="field-block">
            <label class="field-label" for="physical-microphone">Your real microphone</label>
            <select id="physical-microphone" class="input" ${e.inputDevices.length===0?"disabled":""}>
              ${e.inputDevices.length===0?'<option value="">No physical microphone found</option>':e.inputDevices.map(t=>`
                    <option value="${o(t.id)}" ${t.id===e.selectedInputDevice?"selected":""}>
                      ${o(t.name)}
                    </option>
                  `).join("")}
            </select>
          </div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Microphone gain</div>
              <div class="section-caption">Voice level before mixing</div>
            </div>
            <div class="gain-pill microphone-gain-pill">${m(e.microphoneGain)}</div>
          </div>
          <input id="microphone-gain-range" class="range" type="range" min="0" max="3" step="0.01" value="${e.microphoneGain}" />
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Soundboard gain</div>
              <div class="section-caption">Bind booster · turbo up to 600%</div>
            </div>
            <div class="gain-pill sound-gain-pill">${m(e.volume)}</div>
          </div>
          <input id="volume-range" class="range" type="range" min="0" max="6" step="0.01" value="${e.volume}" />
          <div class="range-scale"><span>0%</span><span>300%</span><span>600%</span></div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Overdrive</div>
              <div class="section-caption">Multiply the soundboard past 600% — expect grit</div>
            </div>
            <div class="gain-pill sound-overdrive-pill">${w(e.soundOverdrive)}</div>
          </div>
          <input id="overdrive-range" class="range" type="range" min="1" max="4" step="0.05" value="${e.soundOverdrive}" />
          <div class="range-scale"><span>×1</span><span>×2.5</span><span>×4</span></div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Monitor</div>
              <div class="section-caption">Hear the bind on your own speakers · 0% = off</div>
            </div>
            <div class="gain-pill monitor-gain-pill">${m(e.monitorGain)}</div>
          </div>
          <input id="monitor-range" class="range" type="range" min="0" max="2" step="0.01" value="${e.monitorGain}" />
          <div class="range-scale"><span>0%</span><span>100%</span><span>200%</span></div>
          <div class="native-meters">
            <div class="native-meter-row">
              <div class="native-meter-label"><span>MIC</span><strong class="microphone-meter-value">${p(e.nativeAudio.microphoneLevel01)}%</strong></div>
              <div class="signal-meter"><div class="signal-meter-fill microphone-meter-fill" style="width:${p(e.nativeAudio.microphoneLevel01)}%"></div></div>
            </div>
            <div class="native-meter-row">
              <div class="native-meter-label"><span>FINAL MIX</span><strong class="mixed-meter-value">${p(e.nativeAudio.mixedLevel01)}%</strong></div>
              <div class="signal-meter"><div class="signal-meter-fill mixed-meter-fill" style="width:${p(e.nativeAudio.mixedLevel01)}%"></div></div>
            </div>
          </div>
          ${e.nativeAudio.error?`<div class="driver-message engine-error">${o(e.nativeAudio.error)}</div>`:""}
          <div class="engine-meta">
            <span>${o(e.nativeAudio.runtime)} · IPC v${e.nativeAudio.protocolVersion||"—"}</span>
            <span>PID ${e.nativeAudio.enginePid||"—"}</span>
            <span>XRUN ${e.nativeAudio.underruns||0}</span>
          </div>
          <button class="button button-danger" id="stop-btn">Stop playback</button>
          <button class="button button-ghost" id="restart-engine-btn" ${e.isRestartingEngine?"disabled":""}>
            ${e.isRestartingEngine?"Restarting…":"Restart audio engine"}
          </button>
        </section>

        <section class="panel section-stack driver-panel ${e.virtualAudio.ready?"driver-ready":"driver-waiting"}">
          <div class="section-head">
            <div>
              <div class="section-title">Virtual microphone</div>
              <div class="section-caption">Managed entirely by Soundboard Binder</div>
            </div>
            <span class="driver-status ${e.virtualAudio.ready?"is-ready":"is-waiting"}">
              ${e.virtualAudio.ready?"READY":"SETUP"}
            </span>
          </div>
          ${e.virtualAudio.ready?`
            <div class="managed-route">
              <span>App output</span>
              <strong>${o(e.virtualAudio.renderDeviceName||"Managed cable")}</strong>
            </div>
            <div class="field-block">
              <label class="field-label" for="microphone-name">System microphone name</label>
              <input
                id="microphone-name"
                class="input"
                maxlength="80"
                value="${o(e.microphoneNameInput)}"
              />
            </div>
            <button class="button button-secondary" id="rename-microphone-btn" ${e.isRenamingMicrophone?"disabled":""}>
              ${e.isRenamingMicrophone?"Changing name…":"Apply microphone name"}
            </button>
            <div class="micro-note">Windows applications receive your voice and every bind through <strong>${o(e.virtualAudio.microphoneName||e.microphoneNameInput)}</strong>.</div>
          `:`
            <div class="driver-message">
              ${e.virtualAudio.error?o(e.virtualAudio.error):e.virtualAudio.restartRequired?"Driver installed. Restart Windows once to activate the virtual microphone.":"The signed audio driver is not active yet."}
            </div>
            <button class="button button-secondary" id="install-driver-btn" ${e.isInstallingDriver?"disabled":""}>
              ${e.isInstallingDriver?"Installing…":"Install signed driver"}
            </button>
          `}
          <div class="driver-vendor">
            Driver layer: ${o(e.virtualAudio.vendor)} · donationware ·
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
            <li>Set <strong>Input Device</strong> to <code>Default</code> or <code>${o(e.virtualAudio.microphoneName||e.microphoneNameInput)}</code>.</li>
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
            <input id="search-input" class="input search-input" placeholder="Search sounds" value="${o(e.filter)}" />
            <div class="stat-chip">${e.sounds.length} items</div>
          </div>
        </header>

        <section class="hero ${e.playback.isPlaying?"hero-live":""}">
          <div class="hero-main">
            <div>
              <div class="hero-label">Now playing</div>
              <div class="hero-title">${o(e.playback.isPlaying?e.playback.soundName||"Unknown":"No active playback")}</div>
              <div class="hero-meta">${e.playback.isPlaying?`${v(e.playback.positionMs)} / ${v(e.playback.durationMs)}`:"Start playback to monitor progress and signal level."}</div>
            </div>
            <div class="signal-box">
              <div class="signal-label">Signal</div>
              <div class="signal-db">${A(e.playback.signalDbfs)}</div>
              <div class="signal-meter"><div class="signal-meter-fill" style="width:${I(e.playback.signalDbfs)}%"></div></div>
            </div>
          </div>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((e.playback.progress01||0)*100)}%"></div></div>
          </div>
        </section>

        ${i.length===0?`
          <section class="empty-state">
            <div class="empty-icon">♪</div>
            <div class="empty-title">Your library is empty</div>
            <div class="empty-copy">Add local files or pull audio straight from a supported link.</div>
          </section>
        `:`
          <section class="card-grid">
            ${i.map(t=>{const s=e.playback.isPlaying&&e.playback.soundId===t.id;return`
                <article class="sound-card ${s?"sound-card-live":""}">
                  <div class="sound-card-head">
                    <div>
                      <div class="sound-title-row">
                        <h3>${o(t.name)}</h3>
                        ${s?'<span class="live-chip">LIVE</span>':""}
                      </div>
                      <div class="sound-path">${o(t.path)}</div>
                    </div>
                  </div>
                  <div class="tag-row">
                    <span class="tag">${o(t.extension.toUpperCase())}</span>
                    <span class="tag">${o(t.fileSizeText)}</span>
                    <span class="tag">${o(t.durationText)}</span>
                    <span class="tag">${o(t.sourceKind)}</span>
                  </div>
                  ${s?`
                    <div class="mini-line"><span>${v(e.playback.positionMs)}</span><span>${v(e.playback.durationMs)}</span></div>
                    <div class="mini-track"><div class="mini-fill" style="width:${Math.round((e.playback.progress01||0)*100)}%"></div></div>
                  `:""}
                  <div class="card-actions">
                    <button class="button button-primary play-btn" data-id="${o(t.id)}">Play</button>
                    <button class="button button-ghost remove-btn" data-id="${o(t.id)}">Remove</button>
                  </div>
                </article>
              `}).join("")}
          </section>
        `}
      </main>
    </div>
  `,document.getElementById("add-btn")?.addEventListener("click",L),document.getElementById("url-btn")?.addEventListener("click",$),document.getElementById("install-driver-btn")?.addEventListener("click",_),document.getElementById("rename-microphone-btn")?.addEventListener("click",f),document.getElementById("restart-engine-btn")?.addEventListener("click",R),document.getElementById("physical-microphone")?.addEventListener("change",t=>x(t.target.value)),document.getElementById("microphone-gain-range")?.addEventListener("input",t=>P(t.target.value)),document.getElementById("stop-btn")?.addEventListener("click",D),document.getElementById("volume-range")?.addEventListener("input",t=>q(t.target.value)),document.getElementById("overdrive-range")?.addEventListener("input",t=>C(t.target.value)),document.getElementById("monitor-range")?.addEventListener("input",t=>B(t.target.value)),document.getElementById("microphone-name")?.addEventListener("input",t=>{e.microphoneNameInput=t.target.value,e.microphoneNameDirty=!0}),document.getElementById("microphone-name")?.addEventListener("keydown",t=>{t.key==="Enter"&&f()}),document.getElementById("search-input")?.addEventListener("input",t=>{e.filter=t.target.value,d()}),document.getElementById("url-input")?.addEventListener("input",t=>{e.urlInput=t.target.value}),document.getElementById("url-input")?.addEventListener("keydown",t=>{t.key==="Enter"&&$()}),document.querySelectorAll(".play-btn").forEach(t=>{t.addEventListener("click",()=>M(t.dataset.id))}),document.querySelectorAll(".remove-btn").forEach(t=>{t.addEventListener("click",()=>N(t.dataset.id))}),k=e.playback.isPlaying?e.playback.soundId:null}function F(){const i=document.querySelector(".hero"),n=e.playback.isPlaying?e.playback.soundId:null;if(!i||n!==k){d();return}const t=document.querySelector(".hero-title"),s=document.querySelector(".hero-meta"),r=document.querySelector(".progress-fill"),l=document.querySelector(".signal-db"),u=document.querySelector(".signal-box .signal-meter-fill");if(i.classList.toggle("hero-live",!!e.playback.isPlaying),t&&(t.textContent=e.playback.isPlaying?e.playback.soundName||"Unknown":"No active playback"),s&&(s.textContent=e.playback.isPlaying?`${v(e.playback.positionMs)} / ${v(e.playback.durationMs)}`:"Start playback to monitor progress and signal level."),r&&(r.style.width=`${Math.round((e.playback.progress01||0)*100)}%`),l&&(l.textContent=A(e.playback.signalDbfs)),u&&(u.style.width=`${I(e.playback.signalDbfs)}%`),n){const y=document.querySelector(".sound-card-live"),g=y?.querySelector(".mini-line"),h=y?.querySelector(".mini-fill");g&&(g.innerHTML=`<span>${v(e.playback.positionMs)}</span><span>${v(e.playback.durationMs)}</span>`),h&&(h.style.width=`${Math.round((e.playback.progress01||0)*100)}%`)}}c().then(S).catch(i=>{document.querySelector("#app").innerHTML=`<div class="boot-error">Startup error: ${o(i)}</div>`});
