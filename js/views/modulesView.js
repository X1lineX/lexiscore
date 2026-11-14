// LexisCore View — Вкладка «Блоки»

// --- VIEW: MODULES (Папки, поиск, фильтры, сортировка) ---
    let modFolderFilter = '__ALL__';
    let modStatusFilter = 'all'; // 'all' | 'errors' | 'unlearned' | 'done'
    let modSortBy = 'folder'; // 'folder' | 'name' | 'progress' | 'errors'
    let modQuery = '';
    let modGroupByFolder = true;

    async function quickSetupFromCloud(btnEl) {
      if (!cloudMeta.url) {
        showToast('Сервер базы не настроен', 'warn');
        return;
      }
      const origText = btnEl ? btnEl.textContent : '';
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '⏳ Загрузка заданий...';
      }
      try {
        const res = await cloudGet('listData');
        const files = res.files || [];
        cloudDataCache = files;
        if (!files.length) {
          showToast('В облачной библиотеке пока нет файлов', 'info');
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = origText; }
          return;
        }
        let downloadedBlocks = 0;
        for (const cf of files) {
          try { downloadedBlocks += await downloadFromCloudData(cf, true); } catch (e) {}
        }
        let installedCount = 0;
        const installedIds = new Set(state.modules.map(m => m.id));
        for (const d of state.downloaded) {
          if (!installedIds.has(d.module.id)) {
            validateAndAddModule({ ...d.module, folder: d.folder }, true);
            installedIds.add(d.module.id);
            installedCount++;
          }
        }
        saveState();
        updateBadges();
        showToast(`Готово! Загружено блоков: ${installedCount || downloadedBlocks}`, 'success');
        state.activeTab = 'modules';
        render();
      } catch (err) {
        showToast(`Ошибка загрузки: ${err.message}`, 'error');
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = origText; }
      }
    }

    function openMoveFolderModal(moduleId) {
      const mod = state.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const existingFolders = Array.from(new Set(state.modules.map(m => getModuleFolder(m)))).sort();
      const curFolder = getModuleFolder(mod);
      openModal('Переместить в папку', `
        <div class="space-y-3">
          <div class="text-xs text-slate-500">Блок: <b class="text-slate-800 dark:text-slate-200">${escapeHtml(mod.title)}</b></div>
          ${existingFolders.length ? `
            <div class="space-y-1.5">
              <div class="text-[11px] font-semibold text-slate-400 uppercase">Существующие папки</div>
              <div class="flex flex-wrap gap-1.5">
                ${existingFolders.map(fn => `
                  <button data-pick-folder="${escapeHtml(fn)}" class="px-3 py-1.5 rounded-xl text-xs font-semibold transition ${fn === curFolder ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/20'}">📂 ${escapeHtml(fn)}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div class="space-y-1">
            <label class="text-[11px] font-semibold text-slate-400 uppercase block">Или новая папка</label>
            <div class="flex gap-2">
              <input id="newFolderNameInp" type="text" value="${escapeHtml(curFolder)}" placeholder="Название папки..." class="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              <button id="saveNewFolderBtn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Сохранить</button>
            </div>
          </div>
        </div>
      `);
      document.querySelectorAll('[data-pick-folder]').forEach(btn => {
        btn.addEventListener('click', () => {
          mod.folder = btn.dataset.pickFolder;
          saveState();
          closeModal();
          render();
          showToast(`Перенесено в «${mod.folder}»`, 'success');
        });
      });
      document.getElementById('saveNewFolderBtn').addEventListener('click', () => {
        const val = document.getElementById('newFolderNameInp').value.trim();
        if (!val) { showToast('Введи название папки', 'warn'); return; }
        mod.folder = val;
        saveState();
        closeModal();
        render();
        showToast(`Перенесено в «${mod.folder}»`, 'success');
      });
    }

    function openCreateFolderModal() {
      openModal('Новая папка', `
        <div class="space-y-3">
          <p class="text-xs text-slate-500">Создайте папку для своих подборок или тем, а затем добавьте в неё нужные блоки.</p>
          <input id="createFolderNameInp" type="text" placeholder="Например: Избранное к ЕГЭ" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
          <div class="flex justify-end gap-2">
            <button id="cancelCreateFolderBtn" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold">Отмена</button>
            <button id="confirmCreateFolderBtn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Создать</button>
          </div>
        </div>
      `);
      document.getElementById('cancelCreateFolderBtn').addEventListener('click', closeModal);
      document.getElementById('confirmCreateFolderBtn').addEventListener('click', () => {
        const name = document.getElementById('createFolderNameInp').value.trim();
        if (!name) { showToast('Введите название папки', 'warn'); return; }
        if (!Array.isArray(state.customFolders)) state.customFolders = [];
        if (!state.customFolders.includes(name)) state.customFolders.push(name);
        if (state.collapsedFolders) delete state.collapsedFolders[name];
        saveState();
        closeModal();
        render();
        showToast(`Папка «${name}» создана`, 'success');
      });
    }

    function openAssignBlocksToFolderModal(folderName) {
      openModal(`Добавить блоки в «${folderName}»`, `
        <div class="space-y-3">
          <p class="text-xs text-slate-500">Отметьте блоки, которые нужно перенести в папку <b>${escapeHtml(folderName)}</b>:</p>
          <div class="max-h-72 overflow-y-auto custom-scroll space-y-1.5 pr-1">
            ${state.modules.map(m => {
              const inFolder = getModuleFolder(m) === folderName;
              return `
                <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <input type="checkbox" data-assign-mod="${escapeHtml(m.id)}" ${inFolder ? 'checked' : ''} class="rounded text-indigo-600" />
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold truncate">${escapeHtml(m.title)}</div>
                    <div class="text-[11px] text-slate-400">Сейчас: ${escapeHtml(getModuleFolder(m))} · ${m.items.length} карт.</div>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button id="cancelAssignFolderBtn" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold">Отмена</button>
            <button id="saveAssignFolderBtn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Применить</button>
          </div>
        </div>
      `);
      document.getElementById('cancelAssignFolderBtn').addEventListener('click', closeModal);
      document.getElementById('saveAssignFolderBtn').addEventListener('click', () => {
        let moved = 0;
        document.querySelectorAll('[data-assign-mod]').forEach(cb => {
          const mod = state.modules.find(m => m.id === cb.dataset.assignMod);
          if (!mod) return;
          if (cb.checked && getModuleFolder(mod) !== folderName) {
            mod.folder = folderName;
            moved++;
          } else if (!cb.checked && getModuleFolder(mod) === folderName) {
            mod.folder = mod.category || 'Общее';
            moved++;
          }
        });
        saveState();
        closeModal();
        render();
        showToast(moved > 0 ? `Папка «${folderName}» обновлена` : 'Изменений нет', 'success');
      });
    }

    function renderModulesView(root) {
      if (state.modules.length === 0) {
        const hasCloud = Boolean((cloudMeta.url || '').trim());
        root.innerHTML = `
          <div class="max-w-lg mx-auto py-8 sm:py-14 text-center space-y-6 card-enter">
            <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
            </div>
            <div class="space-y-2">
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Добро пожаловать в LexisCore</h1>
              <p class="text-sm sm:text-base text-slate-500 dark:text-slate-400">
                Умный тренажёр с интервальным повторением ошибок. Нажмите кнопку ниже — все учебные модули загрузятся автоматически.
              </p>
            </div>

            <div class="space-y-3">
              ${hasCloud ? `
                <button id="quickStartCloudBtn" class="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-bold shadow-xl shadow-indigo-500/25 transition tap-scale">🚀 Загрузить задания и начать</button>
                <button id="welcomeLoginBtn" class="w-full py-3 px-5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition">☁️ Войти или создать аккаунт</button>
              ` : `
                <button id="dropZone" class="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-base font-bold shadow-xl shadow-indigo-500/25 transition">📥 Загрузить файлы (.zip / .json)</button>
              `}
            </div>

            <details class="text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4">
              <summary class="text-xs font-semibold text-slate-500 cursor-pointer list-none text-center">Дополнительно: загрузить свой файл или создать блок вручную ▾</summary>
              <div class="pt-3 mt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-center gap-2">
                ${hasCloud ? `<button id="dropZone" class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">📁 Свой .zip / .json</button>` : ''}
                <button id="pasteJsonBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">📋 Вставить JSON</button>
                <button id="goBuilderBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">🛠️ Конструктор</button>
              </div>
            </details>
          </div>
        `;

        const qBtn = root.querySelector('#quickStartCloudBtn');
        if (qBtn) qBtn.addEventListener('click', () => quickSetupFromCloud(qBtn));
        const wLoginBtn = root.querySelector('#welcomeLoginBtn');
        if (wLoginBtn) wLoginBtn.addEventListener('click', openCloudAccountModal);
        const dz = root.querySelector('#dropZone');
        if (dz) dz.addEventListener('click', () => document.getElementById('jsonFileInput').click());
        root.querySelector('#pasteJsonBtn').addEventListener('click', openPasteJsonModal);
        root.querySelector('#goBuilderBtn').addEventListener('click', () => { state.activeTab = 'builder'; render(); });
        return;
      }

      const targetMastery = Math.max(1, Number(getCfg().masteryStreak) || 3);
      if (!state.collapsedFolders) state.collapsedFolders = {};

      const enriched = state.modules.map(m => {
        let mastered = 0, activeErrs = 0, favs = 0;
        m.items.forEach(it => {
          const st = getItemStat(m.id, it.id);
          if (st.streak >= targetMastery) mastered++;
          if (st.activeError > 0) activeErrs++;
          if (st.favorite) favs++;
        });
        const pct = m.items.length ? Math.round((mastered / m.items.length) * 100) : 0;
        return { m, folder: getModuleFolder(m), mastered, activeErrs, favs, pct };
      });

      const customList = Array.isArray(state.customFolders) ? state.customFolders : [];
      const folders = Array.from(new Set([...enriched.map(x => x.folder), ...customList])).sort();
      if (modFolderFilter !== '__ALL__' && !folders.includes(modFolderFilter)) {
        modFolderFilter = '__ALL__';
      }

      let filtered = enriched.filter(x => {
        if (modFolderFilter !== '__ALL__' && x.folder !== modFolderFilter) return false;
        if (modStatusFilter === 'errors' && x.activeErrs === 0) return false;
        if (modStatusFilter === 'unlearned' && x.pct === 100) return false;
        if (modStatusFilter === 'done' && x.pct < 100) return false;
        if (modQuery) {
          const q = modQuery.toLowerCase();
          const hay = `${x.m.title} ${x.m.description || ''} ${x.m.category || ''} ${x.folder}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      if (modSortBy === 'name') {
        filtered.sort((a, b) => a.m.title.localeCompare(b.m.title, 'ru'));
      } else if (modSortBy === 'progress') {
        filtered.sort((a, b) => a.pct - b.pct || a.m.title.localeCompare(b.m.title, 'ru'));
      } else if (modSortBy === 'errors') {
        filtered.sort((a, b) => b.activeErrs - a.activeErrs || a.m.title.localeCompare(b.m.title, 'ru'));
      } else {
        filtered.sort((a, b) => a.folder.localeCompare(b.folder, 'ru') || a.m.title.localeCompare(b.m.title, 'ru'));
      }

      const renderModuleCard = ({ m, folder, mastered, activeErrs, favs, pct }) => `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 flex flex-col justify-between gap-3 hover:border-indigo-500/40 transition relative">
          <div class="space-y-1.5">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <h3 class="text-sm sm:text-base font-bold leading-snug">${escapeHtml(m.title)}</h3>
              </div>
              <details class="relative shrink-0">
                <summary class="list-none cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold leading-none select-none">⋯</summary>
                <div class="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-20 p-1 space-y-0.5 text-xs">
                  <button data-dict-mod="${m.id}" class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">📖 Словарь блока</button>
                  <button data-move-mod="${m.id}" class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">📁 Переместить в папку</button>
                  <button data-export-mod="${m.id}" class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">⬇️ Скачать .json</button>
                  <button data-del-mod="${m.id}" class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-rose-500/10 text-rose-500 font-medium">🗑️ Удалить блок</button>
                </div>
              </details>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
              <span>${m.items.length} карт.</span>
              ${favs > 0 ? `<span class="text-amber-500">★ ${favs}</span>` : ''}
              ${!modGroupByFolder ? `<span>· 📂 ${escapeHtml(folder)}</span>` : ''}
            </div>
          </div>

          <div class="space-y-2">
            <div>
              <div class="flex justify-between text-[11px] mb-1">
                <span class="text-slate-400">Прогресс (серия ≥ ${targetMastery})</span>
                <span class="font-semibold text-emerald-500">${mastered}/${m.items.length} (${pct}%)</span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full transition-all" style="width:${pct}%"></div>
              </div>
            </div>
            <div class="flex gap-2">
              <button data-train-mod="${m.id}" class="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition">▶ Учить</button>
              ${activeErrs > 0 ? `<button data-err-mod="${m.id}" class="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 text-xs sm:text-sm font-semibold transition">Ошибки (${activeErrs})</button>` : ''}
            </div>
          </div>
        </div>
      `;

      let contentHtml = '';
      if (!filtered.length) {
        contentHtml = `
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center text-sm text-slate-500">
            По текущему фильтру блоков не найдено.
          </div>
        `;
      } else if (modGroupByFolder) {
        const grouped = new Map();
        if (modStatusFilter === 'all' && !modQuery && modFolderFilter === '__ALL__') {
          for (const fn of customList) grouped.set(fn, []);
        }
        for (const item of filtered) {
          if (!grouped.has(item.folder)) grouped.set(item.folder, []);
          grouped.get(item.folder).push(item);
        }
        contentHtml = Array.from(grouped.entries()).map(([folderName, list]) => {
          const isCollapsed = Boolean(state.collapsedFolders[folderName]);
          const fTotal = list.reduce((s, x) => s + x.m.items.length, 0);
          const fMastered = list.reduce((s, x) => s + x.mastered, 0);
          const fErrs = list.reduce((s, x) => s + x.activeErrs, 0);
          const fPct = fTotal ? Math.round((fMastered / fTotal) * 100) : 0;
          return `
            <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 overflow-hidden">
              <div class="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/70 dark:border-slate-800">
                <button data-toggle-folder="${escapeHtml(folderName)}" class="flex items-center gap-2.5 text-left min-w-0 flex-1">
                  <span class="text-xs text-slate-400 w-4 text-center">${isCollapsed ? '▸' : '▾'}</span>
                  <span class="text-lg">📂</span>
                  <div class="min-w-0">
                    <div class="font-bold text-sm sm:text-base truncate">${escapeHtml(folderName)} <span class="text-xs font-normal text-slate-400">(${list.length})</span></div>
                    <div class="text-[11px] text-slate-500 flex flex-wrap gap-2.5">
                      <span>Карточек: <b>${fTotal}</b></span>
                      <span class="text-emerald-500">Усвоено: <b>${fPct}%</b></span>
                      ${fErrs > 0 ? `<span class="text-rose-500">Ошибок: <b>${fErrs}</b></span>` : ''}
                    </div>
                  </div>
                </button>
                <div class="flex items-center gap-1.5">
                  <button data-assign-folder="${escapeHtml(folderName)}" title="Добавить блоки в папку" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 text-slate-600 dark:text-slate-300 text-xs font-semibold transition">+ Блок</button>
                  ${list.length ? `<button data-train-folder="${escapeHtml(folderName)}" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm">▶ Учить папку</button>` : ''}
                </div>
              </div>
              ${isCollapsed ? '' : (list.length ? `
                <div class="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  ${list.map(renderModuleCard).join('')}
                </div>
              ` : `
                <div class="p-5 text-center text-xs text-slate-400">
                  В этой папке пока пусто. Нажмите <b>«+ Блок»</b>, чтобы перенести сюда нужные блоки.
                </div>
              `)}
            </div>
          `;
        }).join('');
      } else {
        contentHtml = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            ${filtered.map(renderModuleCard).join('')}
          </div>
        `;
      }

      root.innerHTML = `
        <div class="space-y-4 card-enter">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight">Учебные блоки <span class="text-base font-semibold text-slate-400">(${state.modules.length})</span></h1>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Выберите тему или нажмите «Быстрая тренировка» для умного повторения</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button id="quickStudyAllBtn" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-indigo-500/20">⚡ Быстрая тренировка</button>
              <button id="createFolderBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-500 text-xs sm:text-sm font-semibold transition">📁 + Папка</button>
              ${cloudMeta.url ? `<button id="syncLibBtn" class="px-3.5 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 text-xs sm:text-sm font-semibold transition">☁️ Обновить базу</button>` : ''}
              <button id="importFileBtn" class="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition">+ Файл</button>
            </div>
          </div>

          <!-- Navigation, Search & Folder Controls -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3.5 sm:p-4 space-y-3">
            <div class="flex flex-col sm:flex-row gap-2">
              <input id="modSearchInput" type="text" value="${escapeHtml(modQuery)}" placeholder="Поиск блока по названию, теме или папке..." class="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              <div class="flex gap-2">
                <select id="modSortSelect" class="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold">
                  <option value="folder" ${modSortBy === 'folder' ? 'selected' : ''}>Сортировка: По папкам</option>
                  <option value="name" ${modSortBy === 'name' ? 'selected' : ''}>По названию (А–Я)</option>
                  <option value="progress" ${modSortBy === 'progress' ? 'selected' : ''}>Сначала невыученные</option>
                  <option value="errors" ${modSortBy === 'errors' ? 'selected' : ''}>Сначала с ошибками</option>
                </select>
                <button id="toggleGroupViewBtn" class="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold hover:border-indigo-500 transition whitespace-nowrap">
                  ${modGroupByFolder ? '📂 Папки' : '☷ Сетка'}
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                ${[
                  { id: 'all', label: 'Все' },
                  { id: 'errors', label: 'С ошибками' },
                  { id: 'unlearned', label: 'В процессе' },
                  { id: 'done', label: 'Выученные' }
                ].map(st => `
                  <button data-mod-status="${st.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition ${modStatusFilter === st.id ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}">${st.label}</button>
                `).join('')}
              </div>

              ${modGroupByFolder && folders.length > 1 ? `
                <div class="flex gap-2 text-xs">
                  <button id="expandAllFoldersBtn" class="text-indigo-500 font-semibold hover:underline">Развернуть все</button>
                  <button id="collapseAllFoldersBtn" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Свернуть все</button>
                </div>
              ` : ''}
            </div>

            ${folders.length > 1 ? `
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button data-mod-folder="__ALL__" class="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition ${modFolderFilter === '__ALL__' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}">📁 Все папки (${state.modules.length})</button>
                ${folders.map(f => {
                  const cnt = enriched.filter(x => x.folder === f).length;
                  return `<button data-mod-folder="${escapeHtml(f)}" class="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition ${modFolderFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}">📂 ${escapeHtml(f)} (${cnt})</button>`;
                }).join('')}
              </div>
            ` : ''}
          </div>

          <div class="space-y-4">
            ${contentHtml}
          </div>
        </div>
      `;

      root.querySelector('#quickStudyAllBtn').addEventListener('click', () => startStudy({ moduleId: null, scope: 'all' }));
      const syncLibBtn = root.querySelector('#syncLibBtn');
      if (syncLibBtn) syncLibBtn.addEventListener('click', () => quickSetupFromCloud(syncLibBtn));
      root.querySelector('#createFolderBtn').addEventListener('click', openCreateFolderModal);
      root.querySelectorAll('[data-assign-folder]').forEach(b => b.addEventListener('click', () => openAssignBlocksToFolderModal(b.dataset.assignFolder)));
      root.querySelector('#importFileBtn').addEventListener('click', () => document.getElementById('jsonFileInput').click());

      const mSearch = root.querySelector('#modSearchInput');
      mSearch.addEventListener('input', () => {
        modQuery = mSearch.value;
        renderModulesView(root);
        const f = root.querySelector('#modSearchInput');
        f.focus();
        f.setSelectionRange(f.value.length, f.value.length);
      });

      root.querySelector('#modSortSelect').addEventListener('change', (e) => {
        modSortBy = e.target.value;
        renderModulesView(root);
      });
      root.querySelector('#toggleGroupViewBtn').addEventListener('click', () => {
        modGroupByFolder = !modGroupByFolder;
        renderModulesView(root);
      });

      const expBtn = root.querySelector('#expandAllFoldersBtn');
      if (expBtn) expBtn.addEventListener('click', () => {
        state.collapsedFolders = {};
        saveState();
        renderModulesView(root);
      });
      const colBtn = root.querySelector('#collapseAllFoldersBtn');
      if (colBtn) colBtn.addEventListener('click', () => {
        folders.forEach(fn => { state.collapsedFolders[fn] = true; });
        saveState();
        renderModulesView(root);
      });

      root.querySelectorAll('[data-mod-status]').forEach(b => b.addEventListener('click', () => {
        modStatusFilter = b.dataset.modStatus;
        renderModulesView(root);
      }));
      root.querySelectorAll('[data-mod-folder]').forEach(b => b.addEventListener('click', () => {
        modFolderFilter = b.dataset.modFolder;
        renderModulesView(root);
      }));
      root.querySelectorAll('[data-toggle-folder]').forEach(b => b.addEventListener('click', () => {
        const fn = b.dataset.toggleFolder;
        state.collapsedFolders[fn] = !state.collapsedFolders[fn];
        saveState();
        renderModulesView(root);
      }));
      root.querySelectorAll('[data-train-folder]').forEach(b => b.addEventListener('click', () => {
        startStudy({ moduleId: '__FOLDER__:' + b.dataset.trainFolder, scope: 'all' });
      }));
      root.querySelectorAll('[data-move-mod]').forEach(b => b.addEventListener('click', () => openMoveFolderModal(b.dataset.moveMod)));
      root.querySelectorAll('[data-train-mod]').forEach(b => b.addEventListener('click', () => startStudy({ moduleId: b.dataset.trainMod, scope: 'all' })));
      root.querySelectorAll('[data-err-mod]').forEach(b => b.addEventListener('click', () => startStudy({ moduleId: b.dataset.errMod, scope: 'errors' })));
      root.querySelectorAll('[data-export-mod]').forEach(b => b.addEventListener('click', () => {
        const mod = state.modules.find(m => m.id === b.dataset.exportMod);
        if (mod) downloadJson(`${mod.id}.json`, mod);
      }));
      root.querySelectorAll('[data-dict-mod]').forEach(b => b.addEventListener('click', () => openDictionaryModal(b.dataset.dictMod)));
      root.querySelectorAll('[data-del-mod]').forEach(b => b.addEventListener('click', () => {
        const mod = state.modules.find(m => m.id === b.dataset.delMod);
        openModal('Удалить блок?', `
          <p class="text-slate-600 dark:text-slate-300">Точно удалить блок <b>${escapeHtml(mod?.title || '')}</b>? Прогресс по нему также очистится.</p>
          <div class="flex justify-end gap-2 pt-2">
            <button id="cancelDelBtn" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 font-semibold text-xs">Отмена</button>
            <button id="confirmDelBtn" class="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs">Удалить</button>
          </div>
        `);
        document.getElementById('cancelDelBtn').addEventListener('click', closeModal);
        document.getElementById('confirmDelBtn').addEventListener('click', () => {
          state.modules = state.modules.filter(m => m.id !== b.dataset.delMod);
          delete state.stats[b.dataset.delMod];
          saveState();
          closeModal();
          render();
          showToast('Блок удалён', 'info');
        });
      }));
    }
