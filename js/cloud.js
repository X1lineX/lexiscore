// LexisCore — Облачная синхронизация (Google Apps Script + Google Drive)

// 1.5 CLOUD SYNC ENGINE (Google Apps Script + Google Drive data/ & user/)
    // =========================================================================
    // Адрес облачного сервера синхронизации (Web App URL):
    const DEFAULT_CLOUD_URL = 'https://script.google.com/macros/s/AKfycbwYRlP9jV4YtVbbC_a3OIqECRz6f2t4aC1QwAbKYZka5vCBDXhI75CvIX2AsKIrVB3r/exec';
    const CLOUD_META_KEY = 'lexiscore_cloud_meta_v1';

    let cloudMeta = { url: DEFAULT_CLOUD_URL, login: '', passwordHash: '', lastSync: null };
    let cloudDataCache = null;
    let cloudDataLoading = false;
    let cloudDataError = '';
    let cloudSyncTimer = null;

    function loadCloudMeta() {
      try {
        const raw = localStorage.getItem(CLOUD_META_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          cloudMeta = {
            url: (parsed.url || DEFAULT_CLOUD_URL || '').trim(),
            login: parsed.login || '',
            passwordHash: parsed.passwordHash || '',
            lastSync: parsed.lastSync || null
          };
        }
      } catch (e) {}
      if (!cloudMeta.url && DEFAULT_CLOUD_URL) cloudMeta.url = DEFAULT_CLOUD_URL;
      updateCloudBadges();
    }

    function saveCloudMeta() {
      try {
        localStorage.setItem(CLOUD_META_KEY, JSON.stringify(cloudMeta));
      } catch (e) {}
      updateCloudBadges();
    }

    function updateCloudBadges() {
      const dLbl = document.getElementById('desktopCloudLabel');
      const mBtn = document.getElementById('openCloudModalMobile');
      if (dLbl) {
        dLbl.textContent = cloudMeta.login ? `☁️ @${cloudMeta.login}` : '☁️ Вход';
      }
      if (mBtn) {
        mBtn.textContent = cloudMeta.login ? `☁️ @${cloudMeta.login}` : '☁️ Вход';
      }
    }

    // Универсальный SHA-256 (работает и по HTTPS, и локально по file://)
    async function sha256Hex(str) {
      try {
        if (window.crypto && window.crypto.subtle) {
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
          return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
      } catch (e) {}
      // Чистый JS-фолбэк (FNV-1a 128-bit style) для небезопасного контекста file://
      let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193);
        h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
      }
      return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
    }

    async function cloudGet(action, params = {}) {
      const base = (cloudMeta.url || '').trim();
      if (!base) throw new Error('Не указан URL Google Apps Script');
      const url = new URL(base);
      url.searchParams.set('action', action);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      const res = await fetch(url.toString(), { method: 'GET' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка сервера');
      return data;
    }

    async function cloudPost(payload) {
      const base = (cloudMeta.url || '').trim();
      if (!base) throw new Error('Не указан URL Google Apps Script');
      // text/plain — CORS simple request (без preflight OPTIONS для Google Apps Script)
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка сервера');
      return data;
    }

    function scheduleCloudSync() {
      if (!cloudMeta.url || !cloudMeta.login || !cloudMeta.passwordHash) return;
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(() => {
        pushProgressToCloud(true);
      }, 3500);
    }

    async function pushProgressToCloud(silent = false) {
      if (!cloudMeta.url || !cloudMeta.login || !cloudMeta.passwordHash) return false;
      try {
        const res = await cloudPost({
          action: 'saveProgress',
          login: cloudMeta.login,
          passwordHash: cloudMeta.passwordHash,
          state: state
        });
        cloudMeta.lastSync = res.updatedAt || Date.now();
        saveCloudMeta();
        if (!silent) showToast('Прогресс сохранён на Google Диск!', 'success');
        return true;
      } catch (err) {
        if (!silent) showToast(`Ошибка синхронизации: ${err.message}`, 'error');
        return false;
      }
    }

    async function refreshCloudDataList(force = false) {
      if (!cloudMeta.url) return;
      if (cloudDataLoading) return;
      if (cloudDataCache && !force) return;
      cloudDataLoading = true;
      cloudDataError = '';
      try {
        const res = await cloudGet('listData');
        cloudDataCache = res.files || [];
      } catch (err) {
        cloudDataError = err.message || 'Не удалось загрузить список файлов с Диска';
      } finally {
        cloudDataLoading = false;
        if (state.activeTab === 'downloads') {
          renderDownloadsView(document.getElementById('viewContainer'));
        }
      }
    }

    const installingCloudIds = new Set();

    // Проверяет, соответствует ли уже установленный или скачанный модуль файлу с Google Диска
    function matchesCloudFile(modOrEntry, cf) {
      if (!modOrEntry || !cf) return false;
      const mod = modOrEntry.module || modOrEntry;
      const folder = modOrEntry.folder || mod.folder || '';
      if (modOrEntry.cloudFileId === cf.id || mod.cloudFileId === cf.id) return true;
      if ((modOrEntry.sourceFileName || mod.sourceFileName) === cf.name && folder === cf.folder) return true;
      // Сопоставление для ранее установленных блоков по папке и номеру задания (например, 10.json -> Задание 10)
      const numMatch = String(cf.name || '').match(/^(\d+)\.json$/i);
      if (numMatch && folder === cf.folder) {
        const num = numMatch[1];
        const title = String(mod.title || '');
        const id = String(mod.id || '');
        if (title.includes(`Задание ${num} `) || id.includes(`_${num}_`)) return true;
      }
      return false;
    }

    async function downloadFromCloudData(fileEntry, silent = false, autoInstall = true) {
      const res = await cloudGet('fetchFile', { fileId: fileEntry.id });
      let added = 0;
      if (res.ext === 'zip' && res.base64) {
        if (typeof JSZip === 'undefined') throw new Error('Библиотека JSZip не загружена');
        const zip = await JSZip.loadAsync(res.base64, { base64: true });
        const zipBase = res.name.replace(/\.zip$/i, '');
        const entries = Object.values(zip.files).filter(f =>
          !f.dir && f.name.toLowerCase().endsWith('.json') && !f.name.includes('__MACOSX')
        );
        for (const entry of entries) {
          try {
            const text = await entry.async('string');
            const parsed = JSON.parse(text);
            const parts = entry.name.split('/').filter(Boolean);
            const subFolder = parts.length > 1 ? parts.slice(0, -1).join(' / ') : zipBase;
            const fullFolder = fileEntry.folder && fileEntry.folder !== 'Общая папка'
              ? `${fileEntry.folder} / ${subFolder}`
              : subFolder;
            const dlEntry = addToDownloaded(parsed, fullFolder, fileEntry.id, fileEntry.name);
            if (autoInstall) validateAndAddModule({ ...dlEntry.module, folder: fullFolder, cloudFileId: fileEntry.id, sourceFileName: fileEntry.name }, true);
            added++;
          } catch (e) {}
        }
      } else if (res.text) {
        const parsed = JSON.parse(res.text);
        const targetFolder = fileEntry.folder || parsed.category || 'Общая папка';
        const dlEntry = addToDownloaded(parsed, targetFolder, fileEntry.id, fileEntry.name);
        if (autoInstall) validateAndAddModule({ ...dlEntry.module, folder: targetFolder, cloudFileId: fileEntry.id, sourceFileName: fileEntry.name }, true);
        added++;
      }
      if (added > 0) {
        saveState();
        updateBadges();
        if (!silent) showToast(autoInstall ? `Блок «${fileEntry.name.replace(/\.json$/i, '')}» установлен!` : `Загружено: ${added} блок(ов)`, 'success');
      }
      return added;
    }

    function openCloudAccountModal() {
      const hasUrl = Boolean((cloudMeta.url || '').trim());
      const renderModalBody = () => {
        if (!hasUrl && !cloudMeta.url) {
          openModal('☁️ Облако (Google Диск)', `
            <div class="space-y-3">
              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Чтобы хранить прогресс в папке <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">user/</code> и подгружать файлы из <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">data/</code>, вставь URL развёрнутого <b>Google Apps Script</b> (или перейди в «Настройки»).</p>
              <input id="modalCloudUrlInp" type="url" value="${escapeHtml(cloudMeta.url)}" placeholder="https://script.google.com/macros/s/.../exec" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono" />
              <div class="flex justify-end gap-2">
                <button id="saveCloudUrlModalBtn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Сохранить URL и продолжить</button>
              </div>
            </div>
          `);
          document.getElementById('saveCloudUrlModalBtn').addEventListener('click', () => {
            const val = document.getElementById('modalCloudUrlInp').value.trim();
            if (!val) { showToast('Вставь ссылку на Web App', 'warn'); return; }
            cloudMeta.url = val;
            saveCloudMeta();
            cloudDataCache = null;
            openCloudAccountModal();
          });
          return;
        }

        if (cloudMeta.login) {
          const syncStr = cloudMeta.lastSync ? new Date(cloudMeta.lastSync).toLocaleString('ru-RU') : 'ещё не синхронизировано';
          openModal(`☁️ Аккаунт: @${cloudMeta.login}`, `
            <div class="space-y-4">
              <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                <div class="font-bold text-emerald-500">Подключено к Google Диску</div>
                <div class="text-slate-500 dark:text-slate-400">Последняя синхронизация: <b>${escapeHtml(syncStr)}</b></div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button id="cloudPushNowBtn" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">☁️ Сохранить прогресс сейчас</button>
                <button id="cloudPullNowBtn" class="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold">⬇️ Загрузить с Диска</button>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <button id="cloudLogoutBtn" class="text-xs text-rose-500 font-semibold hover:underline">Выйти из аккаунта</button>
                <button id="cloudChangeUrlBtn" class="text-xs text-slate-400 hover:text-slate-600">Изменить URL скрипта</button>
              </div>
            </div>
          `);
          document.getElementById('cloudPushNowBtn').addEventListener('click', async () => {
            await pushProgressToCloud(false);
            openCloudAccountModal();
          });
          document.getElementById('cloudPullNowBtn').addEventListener('click', async () => {
            try {
              const res = await cloudPost({ action: 'login', login: cloudMeta.login, passwordHash: cloudMeta.passwordHash });
              if (res.state) {
                state = { ...defaultState(), ...res.state, settings: { ...defaultSettings(), ...(res.state.settings || {}) } };
                saveState();
                applyTheme(state.theme);
                cloudMeta.lastSync = res.updatedAt || Date.now();
                saveCloudMeta();
                closeModal();
                render();
                showToast('Прогресс загружен с Google Диска!', 'success');
              } else {
                showToast('На Диске пока нет сохранённого прогресса', 'info');
              }
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
          document.getElementById('cloudLogoutBtn').addEventListener('click', () => {
            cloudMeta.login = '';
            cloudMeta.passwordHash = '';
            cloudMeta.lastSync = null;
            saveCloudMeta();
            closeModal();
            showToast('Вы вышли из облачного аккаунта', 'info');
          });
          document.getElementById('cloudChangeUrlBtn').addEventListener('click', () => {
            cloudMeta.url = '';
            saveCloudMeta();
            openCloudAccountModal();
          });
          return;
        }

        openModal('☁️ Вход и регистрация', `
          <div class="space-y-4">
            <p class="text-xs text-slate-500">Войдите или создайте аккаунт — прогресс и выбранные блоки будут сохраняться в облаке и останутся доступными с любого устройства.</p>
            <div class="space-y-2.5">
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Логин (3–24 символа)</label>
                <input id="authLoginInp" type="text" placeholder="Например: alex_11a" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Пароль</label>
                <input id="authPassInp" type="password" placeholder="••••••" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div id="authStatusMsg" class="text-xs text-rose-500 hidden"></div>
            <div class="flex gap-2">
              <button id="authLoginBtn" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold">Войти</button>
              <button id="authRegisterBtn" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold">Создать аккаунт</button>
            </div>
          </div>
        `);

        let isAuthBusy = false;
        const loginBtnEl = document.getElementById('authLoginBtn');
        const regBtnEl = document.getElementById('authRegisterBtn');

        const setAuthBusy = (busy, mode) => {
          isAuthBusy = busy;
          loginBtnEl.disabled = busy;
          regBtnEl.disabled = busy;
          loginBtnEl.classList.toggle('opacity-50', busy);
          loginBtnEl.classList.toggle('pointer-events-none', busy);
          regBtnEl.classList.toggle('opacity-50', busy);
          regBtnEl.classList.toggle('pointer-events-none', busy);
          if (busy) {
            if (mode === 'login') loginBtnEl.textContent = '⏳ Вход...';
            if (mode === 'register') regBtnEl.textContent = '⏳ Создание...';
          } else {
            loginBtnEl.textContent = 'Войти';
            regBtnEl.textContent = 'Создать аккаунт';
          }
        };

        const showErr = (msg) => {
          const el = document.getElementById('authStatusMsg');
          el.textContent = msg;
          el.classList.remove('hidden');
        };

        loginBtnEl.addEventListener('click', async () => {
          if (isAuthBusy) return;
          const login = document.getElementById('authLoginInp').value.trim();
          const pass = document.getElementById('authPassInp').value;
          if (!login || !pass) { showErr('Введите логин и пароль'); return; }
          setAuthBusy(true, 'login');
          try {
            const hash = await sha256Hex(pass);
            const res = await cloudPost({ action: 'login', login, passwordHash: hash });
            cloudMeta.login = res.login;
            cloudMeta.passwordHash = hash;
            cloudMeta.lastSync = res.updatedAt || Date.now();
            saveCloudMeta();
            if (res.state) {
              state = { ...defaultState(), ...res.state, settings: { ...defaultSettings(), ...(res.state.settings || {}) } };
              saveState();
              applyTheme(state.theme);
            }
            closeModal();
            render();
            showToast(res.passwordReset ? `Пароль обновлён для @${res.login}, прогресс восстановлен!` : `Добро пожаловать, @${res.login}!`, 'success');
          } catch (err) {
            setAuthBusy(false);
            showErr(err.message);
          }
        });

        regBtnEl.addEventListener('click', async () => {
          if (isAuthBusy) return;
          const login = document.getElementById('authLoginInp').value.trim();
          const pass = document.getElementById('authPassInp').value;
          if (login.length < 3 || pass.length < 4) { showErr('Логин от 3 символов, пароль от 4 символов'); return; }
          setAuthBusy(true, 'register');
          try {
            const hash = await sha256Hex(pass);
            const res = await cloudPost({ action: 'register', login, passwordHash: hash, initialState: state });
            cloudMeta.login = res.login;
            cloudMeta.passwordHash = hash;
            cloudMeta.lastSync = res.updatedAt || Date.now();
            saveCloudMeta();
            if (res.passwordReset && res.state) {
              state = { ...defaultState(), ...res.state, settings: { ...defaultSettings(), ...(res.state.settings || {}) } };
              saveState();
              applyTheme(state.theme);
            }
            closeModal();
            render();
            showToast(res.passwordReset ? `Пароль обновлён для @${res.login}, прогресс восстановлен!` : `Аккаунт @${res.login} создан в облаке!`, 'success');
          } catch (err) {
            setAuthBusy(false);
            showErr(err.message);
          }
        });
      };
      renderModalBody();
    }

    function applyTheme(theme) {
      state.theme = theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }


    function getCfg() {
      if (!state.settings) state.settings = defaultSettings();
      return state.settings;
    }

    let audioCtx = null;
    function playTone(isCorrect) {
      if (!getCfg().soundEffects) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (isCorrect) {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.07);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.setValueAtTime(175, now + 0.1);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
          osc.start(now);
          osc.stop(now + 0.26);
        }
      } catch (e) {}
    }

    function shuffleArray(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // Dynamic font sizing based on character length so long tasks look great
    function adaptiveFontClass(text) {
      const len = String(text || '').length;
      if (len <= 25) return 'text-2xl sm:text-3xl font-extrabold text-center';
      if (len <= 75) return 'text-xl sm:text-2xl font-bold text-center leading-snug';
      if (len <= 180) return 'text-base sm:text-lg font-semibold text-left leading-relaxed';
      if (len <= 380) return 'text-sm sm:text-base font-medium text-left leading-relaxed';
      return 'text-xs sm:text-sm font-normal text-left leading-relaxed';
    }

    // Formats multi-line task text with red lines (paragraph indent) and auto-breaks for numbered sentences
    function formatRichTaskText(rawText) {
      const cfg = getCfg();
      let t = String(rawText || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');

      // If autoBreakNumbered is enabled and text is long with multiple numbered sentences "(1) ... (2) ..." or "1) ... 2) ..."
      if (cfg.autoBreakNumbered && t.length > 65) {
        // Break before "1) ", "2) " when preceded by space/punctuation
        t = t.replace(/([.!?:;])\s+(?=\d+\)\s)/g, '$1\n');
        // Break before "(2) [А-ЯЁ]" if "(1) [А-ЯЁ]" is used as sentence numbering (not inline comma markers like "дождь (1) начавшийся")
        if (/\(1\)\s*[А-ЯЁA-Z]/.test(t) && /\(2\)\s*[А-ЯЁA-Z]/.test(t)) {
          t = t.replace(/([.!?…])\s+(?=\(\d+\)\s*[А-ЯЁA-Z])/g, '$1\n\t');
        }
      }

      const lines = t.split(/\n+/);
      const isMulti = lines.length > 1 || t.length > 85;
      return lines.map(line => {
        let hasExplicitIndent = false;
        let clean = line;
        if (clean.startsWith('\t') || clean.startsWith('[indent]') || clean.startsWith('    ')) {
          hasExplicitIndent = true;
          clean = clean.replace(/^(\t|\[indent\]|    )+/, '');
        }
        const useIndent = hasExplicitIndent || (cfg.indentParagraphs && isMulti && clean.length > 45);
        return `<p class="${useIndent ? 'indent-6' : ''} mb-1.5 last:mb-0">${escapeHtml(clean)}</p>`;
      }).join('');
    }

    // =========================================================================
