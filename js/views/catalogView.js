// LexisCore View — Вкладка «Скачанное / Каталог»

// --- VIEW: DOWNLOADS (Единый каталог с Google Диска + локальные файлы) ---
    let dlFolderFilter = '__ALL__'; // '__ALL__' = Все папки
    let dlStatusFilter = 'all'; // 'all' | 'installed' | 'available'
    let dlQuery = '';
    let isBatchInstalling = false;

    function formatCloudCardTitle(cf) {
      const base = String(cf.name || '').replace(/\.(json|zip)$/i, '');
      if (/^\d+$/.test(base)) {
        const isExam = String(cf.folder || '').toUpperCase().includes('ФОРМАТ') || String(cf.folder || '').toUpperCase().includes('ЕГЭ');
        return `Задание ${base} ЕГЭ (${isExam ? 'Формат ЕГЭ — ввод цифр' : 'Отработка слов ФИПИ'})`;
      }
      return base;
    }

    function buildUnifiedCatalog() {
      const items = [];
      const matchedModuleIds = new Set();
      const matchedDownloadIds = new Set();

      // 1. Все файлы из облачной папки data/ на Google Диске
      for (const cf of (cloudDataCache || [])) {
        const instMod = state.modules.find(m => matchesCloudFile(m, cf));
        const dlEntry = state.downloaded.find(d => matchesCloudFile(d, cf));
        if (instMod) matchedModuleIds.add(instMod.id);
        if (dlEntry) matchedDownloadIds.add(dlEntry.module.id);

        const modObj = instMod || (dlEntry ? dlEntry.module : null);
        items.push({
          key: `cloud::${cf.id}`,
          cloudFile: cf,
          folder: cf.folder || (modObj ? getModuleFolder(modObj) : 'Общая папка'),
          title: modObj ? modObj.title : formatCloudCardTitle(cf),
          description: modObj
            ? (modObj.description || `Файл ${cf.name}`)
            : `Модуль из папки «${cf.folder}» (${cf.name}, ${Math.max(1, Math.round((cf.size || 1024) / 1024))} КБ). Нажмите «+ Установить», чтобы добавить в свои блоки.`,
          category: modObj ? (modObj.category || 'Русский язык') : 'Русский язык',
          cardsCount: modObj ? modObj.items.length : null,
          sizeKb: Math.max(1, Math.round((cf.size || 1024) / 1024)),
          isInstalled: Boolean(instMod),
          isDownloadedOnly: !instMod && Boolean(dlEntry),
          moduleId: modObj ? modObj.id : null,
          sortName: cf.name
        });
      }

      // 2. Локально загруженные в «Скачанное» блоки, которых нет на Диске
      for (const d of state.downloaded) {
        if (matchedDownloadIds.has(d.module.id)) continue;
        const instMod = state.modules.find(m => m.id === d.module.id);
        if (instMod) matchedModuleIds.add(instMod.id);
        items.push({
          key: `local::${d.module.id}`,
          cloudFile: null,
          localEntry: d,
          folder: d.folder || 'Общая папка',
          title: d.module.title,
          description: d.module.description || 'Локально импортированный блок',
          category: d.module.category || 'Общее',
          cardsCount: d.module.items.length,
          sizeKb: null,
          isInstalled: Boolean(instMod),
          isDownloadedOnly: !instMod,
          moduleId: d.module.id,
          sortName: d.module.title
        });
      }

      items.sort((a, b) => {
        const fCmp = a.folder.localeCompare(b.folder, 'ru', { numeric: true });
        if (fCmp !== 0) return fCmp;
        return String(a.sortName || a.title).localeCompare(String(b.sortName || b.title), 'ru', { numeric: true });
      });

      return items;
    }

    function renderDownloadsView(root) {
      if (cloudMeta.url && !cloudDataCache && !cloudDataLoading && !cloudDataError) {
        refreshCloudDataList(false);
      }

      const catalog = buildUnifiedCatalog();
      const folders = Array.from(new Set(catalog.map(x => x.folder))).sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
      if (dlFolderFilter !== '__ALL__' && !folders.includes(dlFolderFilter)) {
        dlFolderFilter = '__ALL__';
      }

      const filtered = catalog.filter(item => {
        if (dlFolderFilter !== '__ALL__' && item.folder !== dlFolderFilter) return false;
        if (dlStatusFilter === 'installed' && !item.isInstalled) return false;
        if (dlStatusFilter === 'available' && item.isInstalled) return false;
        if (dlQuery) {
          const q = dlQuery.toLowerCase();
          const hay = `${item.title} ${item.description} ${item.category} ${item.folder}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const uninstalledFiltered = filtered.filter(x => !x.isInstalled);

      root.innerHTML = `
        <div class="space-y-5 card-enter">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight">Каталог и загрузки</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400">Все папки с Google Диска и загруженные архивы в одном месте — устанавливай нужные блоки в 1 клик</p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${uninstalledFiltered.length > 0 ? `
                <button id="dlInstallAllBtn" ${isBatchInstalling ? 'disabled' : ''} class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-500/20 transition ${isBatchInstalling ? 'opacity-60 pointer-events-none' : ''}">
                  ${isBatchInstalling ? '⏳ Установка...' : `⚡ Установить все (${uninstalledFiltered.length})`}
                </button>
              ` : ''}
              ${cloudMeta.url ? `
                <button id="refreshCloudDataBtn" class="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-500 text-xs sm:text-sm font-semibold transition">🔄 Обновить с Диска</button>
              ` : ''}
              <button id="dlImportBtn" class="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/20 transition">+ Свой .zip / .json</button>
            </div>
          </div>

          <!-- Search, Status & Folder Pills (Обе папки с Диска видны сразу!) -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 space-y-3">
            <div class="flex flex-col sm:flex-row gap-2.5">
              <input id="dlSearchInput" type="text" value="${escapeHtml(dlQuery)}" placeholder="Поиск по номеру задания, названию или папке..." class="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              <div class="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start">
                ${[
                  { id: 'all', label: `Все (${catalog.length})` },
                  { id: 'available', label: `Не установлены (${catalog.filter(x => !x.isInstalled).length})` },
                  { id: 'installed', label: `Установлены (${catalog.filter(x => x.isInstalled).length})` }
                ].map(st => `
                  <button data-dl-status="${st.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition ${dlStatusFilter === st.id ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}">${st.label}</button>
                `).join('')}
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button data-dl-folder="__ALL__" class="px-3 py-1.5 rounded-full text-xs font-semibold transition ${dlFolderFilter === '__ALL__' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}">📁 Все папки (${catalog.length})</button>
              ${folders.map(f => {
                const allInF = catalog.filter(x => x.folder === f);
                const instInF = allInF.filter(x => x.isInstalled).length;
                return `<button data-dl-folder="${escapeHtml(f)}" class="px-3 py-1.5 rounded-full text-xs font-semibold transition ${dlFolderFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}">📂 ${escapeHtml(f)} (${instInF}/${allInF.length})</button>`;
              }).join('')}
            </div>
          </div>

          ${cloudDataLoading && !catalog.length ? `
            <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center space-y-2">
              <div class="text-2xl animate-pulse">☁️</div>
              <div class="font-bold text-sm">Загружаем список папок и заданий с Google Диска...</div>
            </div>
          ` : cloudDataError && !catalog.length ? `
            <div class="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center space-y-2">
              <div class="text-sm font-bold text-rose-500">Не удалось загрузить каталог с Диска: ${escapeHtml(cloudDataError)}</div>
              <button id="retryCloudBtn" class="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold">Повторить</button>
            </div>
          ` : !catalog.length ? `
            <div id="dlDropZone" class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center space-y-2 cursor-pointer hover:border-indigo-500 transition">
              <div class="text-4xl">🗜️</div>
              <div class="font-bold text-base">В каталоге пока пусто</div>
              <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">Нажмите «🔄 Обновить с Диска» или перетащите сюда свой <b>.zip / .json</b> файл.</p>
            </div>
          ` : !filtered.length ? `
            <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center text-sm text-slate-500">
              По выбранному фильтру модулей не найдено.
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              ${filtered.map(item => {
                const isBusy = item.cloudFile && installingCloudIds.has(item.cloudFile.id);
                return `
                  <div class="rounded-2xl border ${item.isInstalled ? 'border-emerald-500/30 bg-white dark:bg-slate-900/80' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'} p-4 flex flex-col justify-between gap-3 hover:border-indigo-500/40 transition">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">📂 ${escapeHtml(item.folder)}</span>
                          ${item.cloudFile ? `<span class="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">${escapeHtml(item.cloudFile.name)}</span>` : ''}
                        </div>
                        ${item.isInstalled
                          ? `<span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">✓ Установлен</span>`
                          : `<span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-400">Не установлен</span>`}
                      </div>
                      <h3 class="font-bold text-base leading-snug">${escapeHtml(item.title)}</h3>
                      <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${escapeHtml(item.description)}</p>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <span class="text-xs text-slate-400">
                        ${item.cardsCount !== null ? `Карточек: <b class="text-slate-700 dark:text-slate-200">${item.cardsCount}</b>` : `Размер: <b class="text-slate-700 dark:text-slate-200">${item.sizeKb} КБ</b>`}
                      </span>
                      <div class="flex items-center gap-2">
                        ${!item.cloudFile && item.moduleId ? `
                          <button data-dl-remove="${escapeHtml(item.moduleId)}" title="Удалить из каталога" class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold transition">🗑️</button>
                        ` : ''}
                        ${item.isInstalled
                          ? `
                            <button data-dl-train="${escapeHtml(item.moduleId)}" class="px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-500 text-xs font-bold transition">▶ Учить</button>
                            <button data-dl-uninstall="${escapeHtml(item.moduleId)}" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-500/15 hover:text-rose-500 text-xs font-semibold transition">Убрать из блоков</button>
                          `
                          : `<button data-catalog-install="${escapeHtml(item.key)}" ${isBusy ? 'disabled' : ''} class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm ${isBusy ? 'opacity-60 pointer-events-none' : ''}">${isBusy ? '⏳ Загрузка...' : '+ Установить'}</button>`}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;

      const refCloudBtn = root.querySelector('#refreshCloudDataBtn');
      if (refCloudBtn) refCloudBtn.addEventListener('click', () => refreshCloudDataList(true));
      const retryBtn = root.querySelector('#retryCloudBtn');
      if (retryBtn) retryBtn.addEventListener('click', () => refreshCloudDataList(true));

      root.querySelector('#dlImportBtn').addEventListener('click', () => document.getElementById('jsonFileInput').click());
      const dz = root.querySelector('#dlDropZone');
      if (dz) {
        dz.addEventListener('click', () => document.getElementById('jsonFileInput').click());
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('border-indigo-500', 'bg-indigo-500/5'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('border-indigo-500', 'bg-indigo-500/5'));
        dz.addEventListener('drop', (e) => {
          e.preventDefault();
          dz.classList.remove('border-indigo-500', 'bg-indigo-500/5');
          handleFileList(e.dataTransfer.files);
        });
      }

      const sInp = root.querySelector('#dlSearchInput');
      sInp.addEventListener('input', () => {
        dlQuery = sInp.value;
        renderDownloadsView(root);
        const f = root.querySelector('#dlSearchInput');
        f.focus();
        f.setSelectionRange(f.value.length, f.value.length);
      });

      root.querySelectorAll('[data-dl-status]').forEach(b => b.addEventListener('click', () => {
        dlStatusFilter = b.dataset.dlStatus;
        renderDownloadsView(root);
      }));
      root.querySelectorAll('[data-dl-folder]').forEach(b => b.addEventListener('click', () => {
        dlFolderFilter = b.dataset.dlFolder;
        renderDownloadsView(root);
      }));

      const installAllBtn = root.querySelector('#dlInstallAllBtn');
      if (installAllBtn) {
        installAllBtn.addEventListener('click', async () => {
          if (isBatchInstalling || !uninstalledFiltered.length) return;
          isBatchInstalling = true;
          renderDownloadsView(root);
          let installedCount = 0;
          try {
            for (const item of uninstalledFiltered) {
              if (item.cloudFile) {
                const existingDl = state.downloaded.find(d => matchesCloudFile(d, item.cloudFile));
                if (existingDl) {
                  validateAndAddModule({ ...existingDl.module, folder: item.folder, cloudFileId: item.cloudFile.id, sourceFileName: item.cloudFile.name }, true);
                  installedCount++;
                } else {
                  installedCount += await downloadFromCloudData(item.cloudFile, true, true);
                }
              } else if (item.localEntry) {
                validateAndAddModule({ ...item.localEntry.module, folder: item.folder }, true);
                installedCount++;
              }
            }
            saveState();
            updateBadges();
            showToast(`Установлено в «Блоки»: ${installedCount} шт.!`, 'success');
          } catch (err) {
            showToast(`Ошибка при пакетной установке: ${err.message}`, 'error');
          } finally {
            isBatchInstalling = false;
            renderDownloadsView(root);
          }
        });
      }

      root.querySelectorAll('[data-catalog-install]').forEach(btn => btn.addEventListener('click', async () => {
        const key = btn.dataset.catalogInstall;
        const item = catalog.find(x => x.key === key);
        if (!item || item.isInstalled) return;

        if (item.cloudFile) {
          const cf = item.cloudFile;
          if (installingCloudIds.has(cf.id)) return;
          const existingDl = state.downloaded.find(d => matchesCloudFile(d, cf));
          if (existingDl) {
            validateAndAddModule({ ...existingDl.module, folder: item.folder, cloudFileId: cf.id, sourceFileName: cf.name }, true);
            showToast(`Блок «${existingDl.module.title}» установлен!`, 'success');
            renderDownloadsView(root);
            return;
          }
          installingCloudIds.add(cf.id);
          btn.disabled = true;
          btn.textContent = '⏳ Загрузка...';
          btn.classList.add('opacity-60', 'pointer-events-none');
          try {
            await downloadFromCloudData(cf, false, true);
          } catch (err) {
            showToast(`Ошибка загрузки: ${err.message}`, 'error');
          } finally {
            installingCloudIds.delete(cf.id);
            renderDownloadsView(root);
          }
        } else if (item.localEntry) {
          validateAndAddModule({ ...item.localEntry.module, folder: item.folder }, true);
          showToast(`Блок «${item.localEntry.module.title}» установлен!`, 'success');
          renderDownloadsView(root);
        }
      }));

      root.querySelectorAll('[data-dl-train]').forEach(b => b.addEventListener('click', () => {
        startStudy({ moduleId: b.dataset.dlTrain, scope: 'all' });
      }));

      root.querySelectorAll('[data-dl-uninstall]').forEach(b => b.addEventListener('click', () => {
        state.modules = state.modules.filter(m => m.id !== b.dataset.dlUninstall);
        saveState();
        updateBadges();
        showToast('Блок убран из активных (доступен в каталоге)', 'info');
        renderDownloadsView(root);
      }));

      root.querySelectorAll('[data-dl-remove]').forEach(b => b.addEventListener('click', () => {
        state.downloaded = state.downloaded.filter(d => d.module.id !== b.dataset.dlRemove);
        saveState();
        updateBadges();
        showToast('Удалено из локального кэша', 'info');
        renderDownloadsView(root);
      }));
    }
