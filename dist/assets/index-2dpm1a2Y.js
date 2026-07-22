(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))d(o);new MutationObserver(o=>{for(const r of o)if(r.type==="childList")for(const u of r.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&d(u)}).observe(document,{childList:!0,subtree:!0});function s(o){const r={};return o.integrity&&(r.integrity=o.integrity),o.referrerPolicy&&(r.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?r.credentials="include":o.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function d(o){if(o.ep)return;o.ep=!0;const r=s(o);fetch(o.href,r)}})();async function a(t,i={},s){return window.__TAURI_INTERNALS__.invoke(t,i,s)}async function S(t={}){return typeof t=="object"&&Object.freeze(t),await a("plugin:dialog|open",{options:t})}const e={sounds:[],inputDevices:[],selectedInputDevice:null,microphoneGain:1,nativeAudio:{available:!1,ready:!1,state:"starting",protocolVersion:0,enginePid:0,microphoneLevel01:0,mixedLevel01:0,underruns:0,error:null,runtime:"C++ / WASAPI"},virtualAudio:{installed:!1,ready:!1,installerAttempted:!1,restartRequired:!1,error:null,vendor:"VB-Audio / VB-CABLE Pack45",renderDeviceName:null,microphoneName:null},microphoneNameInput:"Soundboard Binder Microphone",microphoneNameDirty:!1,isInstallingDriver:!1,isRenamingMicrophone:!1,isRestartingEngine:!1,volume:1,filter:"",urlInput:"",isImporting:!1,playback:{isPlaying:!1,soundId:null,soundName:null,positionMs:0,durationMs:0,progress01:0,signalDbfs:-90,signalLevel01:0}};let g=null,k=null;function p(t){const i=Math.floor((t||0)/1e3),s=Math.floor(i/60),d=i%60;return`${String(s).padStart(2,"0")}:${String(d).padStart(2,"0")}`}function y(t){return`${Math.round((Number(t)||0)*100)}%`}function w(t){return!Number.isFinite(t)||t<=-90?"-∞ dBFS":`${t>0?"+":""}${t.toFixed(1)} dBFS`}function A(t){const i=(Math.max(-60,Math.min(12,t))+60)/72;return Math.round(i*100)}function n(t){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}async function c(){const[t,i,s,d,o,r,u,m]=await Promise.all([a("list_sounds"),a("list_input_devices"),a("get_selected_input_device"),a("get_microphone_gain"),a("get_volume"),a("get_playback_status"),a("get_virtual_audio_status"),a("get_native_audio_status")]);e.sounds=t,e.inputDevices=i,e.selectedInputDevice=s,e.microphoneGain=Number(d??1),e.volume=Number(o??1),e.playback=r,e.virtualAudio=u,e.nativeAudio=m,e.microphoneNameDirty||(e.microphoneNameInput=u.microphoneName||"Soundboard Binder Microphone"),l()}async function E(){if(!e.isInstallingDriver){e.isInstallingDriver=!0,l();try{await a("install_virtual_audio_driver")}catch(t){alert(`Instalacja sterownika nie powiodła się: ${String(t)}`)}finally{e.isInstallingDriver=!1,await c()}}}async function f(){const t=e.microphoneNameInput.trim();if(!(!t||e.isRenamingMicrophone)){e.isRenamingMicrophone=!0,l();try{await a("rename_virtual_microphone",{name:t}),await new Promise(i=>setTimeout(i,500)),e.microphoneNameDirty=!1,await c()}catch(i){alert(`Nie udało się zmienić nazwy mikrofonu: ${String(i)}`),e.isRenamingMicrophone=!1,l();return}e.isRenamingMicrophone=!1,l()}}async function L(){const t=await S({multiple:!0,filters:[{name:"Audio",extensions:["mp3","wav","flac","ogg","m4a","aac","wma"]}]});if(!t||Array.isArray(t)&&t.length===0)return;const i=Array.isArray(t)?t:[t];e.sounds=await a("add_sounds",{paths:i}),l()}async function $(){const t=e.urlInput.trim();if(!(!t||e.isImporting)){e.isImporting=!0,l();try{e.sounds=await a("import_from_url",{url:t}),e.urlInput="",await c()}catch(i){alert(String(i)),e.isImporting=!1,l();return}e.isImporting=!1,l()}}async function _(t){confirm("Usunąć ten dźwięk z biblioteki?")&&(await a("remove_sound",{id:t}),await c())}async function N(t){try{await a("play_sound",{id:t}),await c(),I()}catch(i){alert(`Nie udało się odtworzyć dźwięku: ${String(i)}`),await c()}}async function M(){await a("stop_playback"),await c()}async function D(t){try{e.selectedInputDevice=t,await a("set_selected_input_device",{deviceId:t}),await c()}catch(i){alert(`Nie udało się wybrać mikrofonu: ${String(i)}`),await c()}}async function P(t){e.microphoneGain=Number(t);const i=document.querySelector(".microphone-gain-pill");i&&(i.textContent=y(e.microphoneGain)),await a("set_microphone_gain",{gain:e.microphoneGain})}async function x(){if(!e.isRestartingEngine){e.isRestartingEngine=!0,l();try{await a("restart_native_audio_engine"),await new Promise(t=>setTimeout(t,350))}catch(t){alert(`Nie udało się uruchomić C++ audio engine: ${String(t)}`)}finally{e.isRestartingEngine=!1,await c()}}}async function R(t){e.volume=Number(t);const i=document.querySelector(".sound-gain-pill");i&&(i.textContent=y(e.volume)),await a("set_volume",{volume:e.volume})}async function q(){try{const t=`${e.nativeAudio.ready}:${e.nativeAudio.state}:${e.nativeAudio.error||""}`;[e.playback,e.nativeAudio]=await Promise.all([a("get_playback_status"),a("get_native_audio_status")]);const i=`${e.nativeAudio.ready}:${e.nativeAudio.state}:${e.nativeAudio.error||""}`;if(t!==i){l();return}T(),B()}catch{clearInterval(g),g=null}}function I(){g||(g=setInterval(async()=>{await q()},140))}function v(t){return Math.round(Math.max(0,Math.min(1,Number(t)||0))*100)}function B(){const t=document.querySelector(".microphone-meter-fill"),i=document.querySelector(".mixed-meter-fill"),s=document.querySelector(".microphone-meter-value"),d=document.querySelector(".mixed-meter-value");t&&(t.style.width=`${v(e.nativeAudio.microphoneLevel01)}%`),i&&(i.style.width=`${v(e.nativeAudio.mixedLevel01)}%`),s&&(s.textContent=`${v(e.nativeAudio.microphoneLevel01)}%`),d&&(d.textContent=`${v(e.nativeAudio.mixedLevel01)}%`)}function C(){const t=e.filter.trim().toLowerCase();return t?e.sounds.filter(i=>[i.name,i.path,i.extension].join(" ").toLowerCase().includes(t)):e.sounds}function l(){const t=C();document.querySelector("#app").innerHTML=`
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
              value="${n(e.urlInput)}"
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
              ${e.inputDevices.length===0?'<option value="">No physical microphone found</option>':e.inputDevices.map(i=>`
                    <option value="${n(i.id)}" ${i.id===e.selectedInputDevice?"selected":""}>
                      ${n(i.name)}
                    </option>
                  `).join("")}
            </select>
          </div>
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Microphone gain</div>
              <div class="section-caption">Voice level before mixing</div>
            </div>
            <div class="gain-pill microphone-gain-pill">${y(e.microphoneGain)}</div>
          </div>
          <input id="microphone-gain-range" class="range" type="range" min="0" max="3" step="0.01" value="${e.microphoneGain}" />
          <div class="section-head compact-head">
            <div>
              <div class="field-label">Soundboard gain</div>
              <div class="section-caption">Bind booster · turbo up to 600%</div>
            </div>
            <div class="gain-pill sound-gain-pill">${y(e.volume)}</div>
          </div>
          <input id="volume-range" class="range" type="range" min="0" max="6" step="0.01" value="${e.volume}" />
          <div class="range-scale"><span>0%</span><span>300%</span><span>600%</span></div>
          <div class="native-meters">
            <div class="native-meter-row">
              <div class="native-meter-label"><span>MIC</span><strong class="microphone-meter-value">${v(e.nativeAudio.microphoneLevel01)}%</strong></div>
              <div class="signal-meter"><div class="signal-meter-fill microphone-meter-fill" style="width:${v(e.nativeAudio.microphoneLevel01)}%"></div></div>
            </div>
            <div class="native-meter-row">
              <div class="native-meter-label"><span>FINAL MIX</span><strong class="mixed-meter-value">${v(e.nativeAudio.mixedLevel01)}%</strong></div>
              <div class="signal-meter"><div class="signal-meter-fill mixed-meter-fill" style="width:${v(e.nativeAudio.mixedLevel01)}%"></div></div>
            </div>
          </div>
          ${e.nativeAudio.error?`<div class="driver-message engine-error">${n(e.nativeAudio.error)}</div>`:""}
          <div class="engine-meta">
            <span>${n(e.nativeAudio.runtime)} · IPC v${e.nativeAudio.protocolVersion||"—"}</span>
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
              <strong>${n(e.virtualAudio.renderDeviceName||"Managed cable")}</strong>
            </div>
            <div class="field-block">
              <label class="field-label" for="microphone-name">System microphone name</label>
              <input
                id="microphone-name"
                class="input"
                maxlength="80"
                value="${n(e.microphoneNameInput)}"
              />
            </div>
            <button class="button button-secondary" id="rename-microphone-btn" ${e.isRenamingMicrophone?"disabled":""}>
              ${e.isRenamingMicrophone?"Changing name…":"Apply microphone name"}
            </button>
            <div class="micro-note">Windows applications receive your voice and every bind through <strong>${n(e.virtualAudio.microphoneName||e.microphoneNameInput)}</strong>.</div>
          `:`
            <div class="driver-message">
              ${e.virtualAudio.error?n(e.virtualAudio.error):e.virtualAudio.restartRequired?"Driver installed. Restart Windows once to activate the virtual microphone.":"The signed audio driver is not active yet."}
            </div>
            <button class="button button-secondary" id="install-driver-btn" ${e.isInstallingDriver?"disabled":""}>
              ${e.isInstallingDriver?"Installing…":"Install signed driver"}
            </button>
          `}
          <div class="driver-vendor">
            Driver layer: ${n(e.virtualAudio.vendor)} · donationware ·
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
            <li>Set <strong>Input Device</strong> to <code>Default</code> or <code>${n(e.virtualAudio.microphoneName||e.microphoneNameInput)}</code>.</li>
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
            <input id="search-input" class="input search-input" placeholder="Search sounds" value="${n(e.filter)}" />
            <div class="stat-chip">${e.sounds.length} items</div>
          </div>
        </header>

        <section class="hero ${e.playback.isPlaying?"hero-live":""}">
          <div class="hero-main">
            <div>
              <div class="hero-label">Now playing</div>
              <div class="hero-title">${n(e.playback.isPlaying?e.playback.soundName||"Unknown":"No active playback")}</div>
              <div class="hero-meta">${e.playback.isPlaying?`${p(e.playback.positionMs)} / ${p(e.playback.durationMs)}`:"Start playback to monitor progress and signal level."}</div>
            </div>
            <div class="signal-box">
              <div class="signal-label">Signal</div>
              <div class="signal-db">${w(e.playback.signalDbfs)}</div>
              <div class="signal-meter"><div class="signal-meter-fill" style="width:${A(e.playback.signalDbfs)}%"></div></div>
            </div>
          </div>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((e.playback.progress01||0)*100)}%"></div></div>
          </div>
        </section>

        ${t.length===0?`
          <section class="empty-state">
            <div class="empty-icon">♪</div>
            <div class="empty-title">Your library is empty</div>
            <div class="empty-copy">Add local files or pull audio straight from a supported link.</div>
          </section>
        `:`
          <section class="card-grid">
            ${t.map(i=>{const s=e.playback.isPlaying&&e.playback.soundId===i.id;return`
                <article class="sound-card ${s?"sound-card-live":""}">
                  <div class="sound-card-head">
                    <div>
                      <div class="sound-title-row">
                        <h3>${n(i.name)}</h3>
                        ${s?'<span class="live-chip">LIVE</span>':""}
                      </div>
                      <div class="sound-path">${n(i.path)}</div>
                    </div>
                  </div>
                  <div class="tag-row">
                    <span class="tag">${n(i.extension.toUpperCase())}</span>
                    <span class="tag">${n(i.fileSizeText)}</span>
                    <span class="tag">${n(i.durationText)}</span>
                    <span class="tag">${n(i.sourceKind)}</span>
                  </div>
                  ${s?`
                    <div class="mini-line"><span>${p(e.playback.positionMs)}</span><span>${p(e.playback.durationMs)}</span></div>
                    <div class="mini-track"><div class="mini-fill" style="width:${Math.round((e.playback.progress01||0)*100)}%"></div></div>
                  `:""}
                  <div class="card-actions">
                    <button class="button button-primary play-btn" data-id="${n(i.id)}">Play</button>
                    <button class="button button-ghost remove-btn" data-id="${n(i.id)}">Remove</button>
                  </div>
                </article>
              `}).join("")}
          </section>
        `}
      </main>
    </div>
  `,document.getElementById("add-btn")?.addEventListener("click",L),document.getElementById("url-btn")?.addEventListener("click",$),document.getElementById("install-driver-btn")?.addEventListener("click",E),document.getElementById("rename-microphone-btn")?.addEventListener("click",f),document.getElementById("restart-engine-btn")?.addEventListener("click",x),document.getElementById("physical-microphone")?.addEventListener("change",i=>D(i.target.value)),document.getElementById("microphone-gain-range")?.addEventListener("input",i=>P(i.target.value)),document.getElementById("stop-btn")?.addEventListener("click",M),document.getElementById("volume-range")?.addEventListener("input",i=>R(i.target.value)),document.getElementById("microphone-name")?.addEventListener("input",i=>{e.microphoneNameInput=i.target.value,e.microphoneNameDirty=!0}),document.getElementById("microphone-name")?.addEventListener("keydown",i=>{i.key==="Enter"&&f()}),document.getElementById("search-input")?.addEventListener("input",i=>{e.filter=i.target.value,l()}),document.getElementById("url-input")?.addEventListener("input",i=>{e.urlInput=i.target.value}),document.getElementById("url-input")?.addEventListener("keydown",i=>{i.key==="Enter"&&$()}),document.querySelectorAll(".play-btn").forEach(i=>{i.addEventListener("click",()=>N(i.dataset.id))}),document.querySelectorAll(".remove-btn").forEach(i=>{i.addEventListener("click",()=>_(i.dataset.id))}),k=e.playback.isPlaying?e.playback.soundId:null}function T(){const t=document.querySelector(".hero"),i=e.playback.isPlaying?e.playback.soundId:null;if(!t||i!==k){l();return}const s=document.querySelector(".hero-title"),d=document.querySelector(".hero-meta"),o=document.querySelector(".progress-fill"),r=document.querySelector(".signal-db"),u=document.querySelector(".signal-box .signal-meter-fill");if(t.classList.toggle("hero-live",!!e.playback.isPlaying),s&&(s.textContent=e.playback.isPlaying?e.playback.soundName||"Unknown":"No active playback"),d&&(d.textContent=e.playback.isPlaying?`${p(e.playback.positionMs)} / ${p(e.playback.durationMs)}`:"Start playback to monitor progress and signal level."),o&&(o.style.width=`${Math.round((e.playback.progress01||0)*100)}%`),r&&(r.textContent=w(e.playback.signalDbfs)),u&&(u.style.width=`${A(e.playback.signalDbfs)}%`),i){const m=document.querySelector(".sound-card-live"),h=m?.querySelector(".mini-line"),b=m?.querySelector(".mini-fill");h&&(h.innerHTML=`<span>${p(e.playback.positionMs)}</span><span>${p(e.playback.durationMs)}</span>`),b&&(b.style.width=`${Math.round((e.playback.progress01||0)*100)}%`)}}c().then(I).catch(t=>{document.querySelector("#app").innerHTML=`<div class="boot-error">Startup error: ${n(t)}</div>`});
