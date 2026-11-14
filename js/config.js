// LexisCore — Конфигурация, состояние и IndexedDB-хранилище

'use strict';

    // =========================================================================
    // 1. STORAGE & CORE STATE (Empty Shell by default)
    // =========================================================================
    const STORAGE_KEY = 'lexiscore_v2_state';
    const RU_VOWELS = new Set(['а','е','ё','и','о','у','ы','э','ю','я','А','Е','Ё','И','О','У','Ы','Э','Ю','Я']);

    function todayKey() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const defaultSettings = () => ({
      shuffleOptions: true,
      autoNextOnCorrect: false,
      soundEffects: false,
      strictYo: false,
      autoBreakNumbered: true,
      indentParagraphs: true,
      fontScale: 100, // 85, 100, 115
      horizonSize: 15,
      errorReturnChance: 65,
      oldReviewChance: 20,
      errCooldownMin: 5,
      errCooldownMax: 14,
      errorDebtAdd: 2,
      errorDebtMax: 3,
      masteryStreak: 3
    });

    const defaultState = () => ({
      theme: 'dark',
      dailyGoal: 20,
      stepCounter: 0,
      dailyLog: { date: todayKey(), count: 0 },
      settings: defaultSettings(),
      customPrompt: null,
      modules: [],
      downloaded: [],
      customFolders: [],
      stats: {},
      activeModuleId: null,
      activeTab: 'modules'
    });

    let state = defaultState();

    const IDB_NAME = 'lexiscore_idb_v2';
    const IDB_STORE = 'app_state';

    function openIdb() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function loadStateFromIdb() {
      try {
        const db = await openIdb();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(STORAGE_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        return null;
      }
    }

    async function saveStateToIdb(stateSnapshot) {
      try {
        const db = await openIdb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(stateSnapshot, STORAGE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {}
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('lexiscore_v1_state');
        if (raw) {
          const parsed = JSON.parse(raw);
          state = { ...defaultState(), ...parsed, settings: { ...defaultSettings(), ...(parsed.settings || {}) } };
          if (!state.dailyLog || state.dailyLog.date !== todayKey()) {
            state.dailyLog = { date: todayKey(), count: 0 };
          }
        }
      } catch (e) {}
      applyTheme(state.theme);
      // Асинхронная подгрузка полной базы из IndexedDB (если в localStorage не поместились все блоки)
      loadStateFromIdb().then(idbState => {
        if (idbState && typeof idbState === 'object') {
          const idbMods = Array.isArray(idbState.modules) ? idbState.modules.length : 0;
          const idbDl = Array.isArray(idbState.downloaded) ? idbState.downloaded.length : 0;
          if (idbMods >= state.modules.length && idbDl >= state.downloaded.length && (idbMods > 0 || idbDl > 0)) {
            state = { ...defaultState(), ...idbState, settings: { ...defaultSettings(), ...(idbState.settings || {}) } };
            if (!state.dailyLog || state.dailyLog.date !== todayKey()) {
              state.dailyLog = { date: todayKey(), count: 0 };
            }
            applyTheme(state.theme);
            updateBadges();
            render();
          }
        }
      });
    }

    function saveState() {
      saveStateToIdb(state);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // Если база превысила лимит 5 МБ в localStorage, сохраняем компактную версию (без дублирования downloaded)
        try {
          const compact = { ...state, downloaded: [] };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
        } catch (e2) {}
      }
      scheduleCloudSync();
    }

    // =========================================================================
