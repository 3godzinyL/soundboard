(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))c(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const d of n.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&c(d)}).observe(document,{childList:!0,subtree:!0});function s(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function c(i){if(i.ep)return;i.ep=!0;const n=s(i);fetch(i.href,n)}})();async function r(a,t={},s){return window.__TAURI_INTERNALS__.invoke(a,t,s)}async function $(a={}){return typeof a=="object"&&Object.freeze(a),await r("plugin:dialog|open",{options:a})}const e={sounds:[],devices:[],selectedDevice:null,volume:1,filter:"",urlInput:"",isImporting:!1,playback:{isPlaying:!1,soundId:null,soundName:null,positionMs:0,durationMs:0,progress01:0,signalDbfs:-90,signalLevel01:0}};let v=null;function u(a){const t=Math.floor((a||0)/1e3),s=Math.floor(t/60),c=t%60;return`${String(s).padStart(2,"0")}:${String(c).padStart(2,"0")}`}function S(a){return`${Math.round((Number(a)||0)*100)}%`}function f(a){return!Number.isFinite(a)||a<=-90?"-∞ dBFS":`${a>0?"+":""}${a.toFixed(1)} dBFS`}function g(a){const t=(Math.max(-60,Math.min(12,a))+60)/72;return Math.round(t*100)}function l(a){return String(a).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}async function p(){const[a,t,s,c,i]=await Promise.all([r("list_sounds"),r("list_output_devices"),r("get_selected_device"),r("get_volume"),r("get_playback_status")]);e.sounds=a,e.devices=t,e.selectedDevice=s,e.volume=Number(c??1),e.playback=i,o()}async function w(){const a=await $({multiple:!0,filters:[{name:"Audio",extensions:["mp3","wav","flac","ogg","m4a","aac","wma"]}]});if(!a||Array.isArray(a)&&a.length===0)return;const t=Array.isArray(a)?a:[a];e.sounds=await r("add_sounds",{paths:t}),o()}async function b(){const a=e.urlInput.trim();if(!(!a||e.isImporting)){e.isImporting=!0,o();try{e.sounds=await r("import_from_url",{url:a}),e.urlInput="",await p()}catch(t){alert(String(t)),e.isImporting=!1,o();return}e.isImporting=!1,o()}}async function I(a){confirm("Usunąć ten dźwięk z biblioteki?")&&(await r("remove_sound",{id:a}),await p())}async function L(a){try{await r("play_sound",{id:a}),await p(),h()}catch(t){alert(`Nie udało się odtworzyć dźwięku: ${String(t)}`),await p()}}async function E(){await r("stop_playback"),await p()}async function M(a){try{e.selectedDevice=a,await r("set_selected_device",{deviceId:a})}catch(t){alert(`Nie udało się wybrać urządzenia: ${String(t)}`),await p()}}async function _(a){e.volume=Number(a),o(),await r("set_volume",{volume:e.volume})}async function P(){try{e.playback=await r("get_playback_status"),A()}catch{clearInterval(v),v=null}}function h(){v||(v=setInterval(async()=>{await P(),e.playback?.isPlaying||(clearInterval(v),v=null,o())},120))}function q(){const a=e.filter.trim().toLowerCase();return a?e.sounds.filter(t=>[t.name,t.path,t.extension].join(" ").toLowerCase().includes(a)):e.sounds}function o(){const a=q();document.querySelector("#app").innerHTML=`
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
              value="${l(e.urlInput)}"
            />
          </div>
          <button class="button button-secondary" id="url-btn" ${e.isImporting?"disabled":""}>
            ${e.isImporting?"Importing…":"Fetch audio"}
          </button>
          <div class="micro-note">Requires <code>yt-dlp</code> and <code>ffmpeg</code> in PATH for URL imports.</div>
        </section>

        <section class="panel section-stack">
          <div class="section-title">Routing</div>
          <div class="field-block">
            <label class="field-label" for="device-select">Output device</label>
            <select class="input" id="device-select" ${e.devices.length===0?"disabled":""}>
              ${e.devices.length===0?"<option>Brak urządzeń audio</option>":""}
              ${e.devices.map(t=>`
                <option value="${l(t.id)}" ${t.id===e.selectedDevice?"selected":""}>
                  ${l(t.name)}
                </option>
              `).join("")}
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
            <div class="gain-pill">${S(e.volume)}</div>
          </div>
          <input id="volume-range" class="range" type="range" min="0" max="6" step="0.01" value="${e.volume}" />
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
            <input id="search-input" class="input search-input" placeholder="Search sounds" value="${l(e.filter)}" />
            <div class="stat-chip">${e.sounds.length} items</div>
          </div>
        </header>

        <section class="hero ${e.playback.isPlaying?"hero-live":""}">
          <div class="hero-main">
            <div>
              <div class="hero-label">Now playing</div>
              <div class="hero-title">${l(e.playback.isPlaying?e.playback.soundName||"Unknown":"No active playback")}</div>
              <div class="hero-meta">${e.playback.isPlaying?`${u(e.playback.positionMs)} / ${u(e.playback.durationMs)}`:"Start playback to monitor progress and signal level."}</div>
            </div>
            <div class="signal-box">
              <div class="signal-label">Signal</div>
              <div class="signal-db">${f(e.playback.signalDbfs)}</div>
              <div class="signal-meter"><div class="signal-meter-fill" style="width:${g(e.playback.signalDbfs)}%"></div></div>
            </div>
          </div>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((e.playback.progress01||0)*100)}%"></div></div>
          </div>
        </section>

        ${a.length===0?`
          <section class="empty-state">
            <div class="empty-icon">♪</div>
            <div class="empty-title">Your library is empty</div>
            <div class="empty-copy">Add local files or pull audio straight from a supported link.</div>
          </section>
        `:`
          <section class="card-grid">
            ${a.map(t=>{const s=e.playback.isPlaying&&e.playback.soundId===t.id;return`
                <article class="sound-card ${s?"sound-card-live":""}">
                  <div class="sound-card-head">
                    <div>
                      <div class="sound-title-row">
                        <h3>${l(t.name)}</h3>
                        ${s?'<span class="live-chip">LIVE</span>':""}
                      </div>
                      <div class="sound-path">${l(t.path)}</div>
                    </div>
                  </div>
                  <div class="tag-row">
                    <span class="tag">${l(t.extension.toUpperCase())}</span>
                    <span class="tag">${l(t.fileSizeText)}</span>
                    <span class="tag">${l(t.durationText)}</span>
                    <span class="tag">${l(t.sourceKind)}</span>
                  </div>
                  ${s?`
                    <div class="mini-line"><span>${u(e.playback.positionMs)}</span><span>${u(e.playback.durationMs)}</span></div>
                    <div class="mini-track"><div class="mini-fill" style="width:${Math.round((e.playback.progress01||0)*100)}%"></div></div>
                  `:""}
                  <div class="card-actions">
                    <button class="button button-primary play-btn" data-id="${l(t.id)}">Play</button>
                    <button class="button button-ghost remove-btn" data-id="${l(t.id)}">Remove</button>
                  </div>
                </article>
              `}).join("")}
          </section>
        `}
      </main>
    </div>
  `,document.getElementById("add-btn")?.addEventListener("click",w),document.getElementById("url-btn")?.addEventListener("click",b),document.getElementById("refresh-btn")?.addEventListener("click",p),document.getElementById("stop-btn")?.addEventListener("click",E),document.getElementById("device-select")?.addEventListener("change",t=>M(t.target.value)),document.getElementById("volume-range")?.addEventListener("input",t=>_(t.target.value)),document.getElementById("search-input")?.addEventListener("input",t=>{e.filter=t.target.value,o()}),document.getElementById("url-input")?.addEventListener("input",t=>{e.urlInput=t.target.value}),document.getElementById("url-input")?.addEventListener("keydown",t=>{t.key==="Enter"&&b()}),document.querySelectorAll(".play-btn").forEach(t=>{t.addEventListener("click",()=>L(t.dataset.id))}),document.querySelectorAll(".remove-btn").forEach(t=>{t.addEventListener("click",()=>I(t.dataset.id))})}function A(){const a=document.querySelector(".hero");if(!a){o();return}const t=document.querySelector(".hero-title"),s=document.querySelector(".hero-meta"),c=document.querySelector(".progress-fill"),i=document.querySelector(".signal-db"),n=document.querySelector(".signal-meter-fill");a.classList.toggle("hero-live",!!e.playback.isPlaying),t&&(t.textContent=e.playback.isPlaying?e.playback.soundName||"Unknown":"No active playback"),s&&(s.textContent=e.playback.isPlaying?`${u(e.playback.positionMs)} / ${u(e.playback.durationMs)}`:"Start playback to monitor progress and signal level."),c&&(c.style.width=`${Math.round((e.playback.progress01||0)*100)}%`),i&&(i.textContent=f(e.playback.signalDbfs)),n&&(n.style.width=`${g(e.playback.signalDbfs)}%`);const d=document.querySelector(".sound-card-live"),k=e.playback.isPlaying?e.playback.soundId:null;if(!d||d.querySelector(".play-btn")?.dataset.id!==k){o();return}const y=d.querySelector(".mini-line"),m=d.querySelector(".mini-fill");y&&(y.innerHTML=`<span>${u(e.playback.positionMs)}</span><span>${u(e.playback.durationMs)}</span>`),m&&(m.style.width=`${Math.round((e.playback.progress01||0)*100)}%`)}p().then(h).catch(a=>{document.querySelector("#app").innerHTML=`<div class="boot-error">Startup error: ${l(a)}</div>`});
