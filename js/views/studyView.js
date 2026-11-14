// LexisCore View — Вкладка «Учить»

// --- VIEW: STUDY ---
    function renderStudyView(root) {
      if (state.modules.length === 0) {
        root.innerHTML = `
          <div class="text-center py-16 space-y-4">
            <div class="text-4xl">📦</div>
            <h2 class="text-xl font-bold">Нет загруженных блоков</h2>
            <p class="text-sm text-slate-500">Сначала импортируй файл или создай блок во вкладке «Блоки».</p>
            <button id="backToMods" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Перейти к блокам</button>
          </div>
        `;
        root.querySelector('#backToMods').addEventListener('click', () => { state.activeTab = 'modules'; render(); });
        return;
      }

      if (!session.moduleId && state.modules.length) {
        session.moduleId = state.modules[0].id;
      }
      const activeMod = (session.moduleId && session.moduleId.startsWith('__FOLDER__:'))
        ? (state.modules.find(m => getModuleFolder(m) === session.moduleId.slice('__FOLDER__:'.length)) || state.modules[0])
        : (state.modules.find(m => m.id === session.moduleId) || state.modules[0]);
      const availableModes = ModeRegistry.listForModule(activeMod);
      if (!availableModes.some(m => m.id === session.mode)) {
        session.mode = availableModes[0]?.id || 'flashcard';
      }

      const eligible = getEligibleItems();
      const { picked, isReviewInjection } = pickSmartItem(eligible, session.scope, session.currentItem?.item?.id);
      session.currentItem = picked;

      root.innerHTML = `
        <div class="max-w-2xl mx-auto space-y-4 card-enter">
          <!-- Mobile-First Controls Bar -->
          <div class="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 space-y-2 shadow-sm">
            <div class="flex items-center justify-between gap-2">
              <select id="studyModuleSelect" class="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm font-semibold focus:outline-none truncate">
                <option value="__ALL__" ${session.moduleId === null ? 'selected' : ''}>Все блоки (${state.modules.length})</option>
                ${Array.from(new Set(state.modules.map(m => getModuleFolder(m)))).sort().map(fn => `<option value="__FOLDER__:${escapeHtml(fn)}" ${session.moduleId === '__FOLDER__:' + fn ? 'selected' : ''}>📂 Папка: ${escapeHtml(fn)}</option>`).join('')}
                ${state.modules.map(m => `<option value="${m.id}" ${m.id === session.moduleId ? 'selected' : ''}>${escapeHtml(m.title)}</option>`).join('')}
              </select>
              <div class="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                ${[
                  { id: 'all', label: 'Умный' },
                  { id: 'errors', label: 'Ошибки' },
                  { id: 'favorites', label: '★' },
                  { id: 'new', label: 'Новые' }
                ].map(sc => `
                  <button data-scope="${sc.id}" class="tap-scale px-2 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition ${session.scope === sc.id ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}">${sc.label}</button>
                `).join('')}
              </div>
            </div>

            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              ${availableModes.map(md => `
                <button data-mode="${md.id}" title="${md.name}" class="tap-scale shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${session.mode === md.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${md.icon} <span>${md.name}</span></button>
              `).join('')}
            </div>
          </div>

          <!-- Card Arena -->
          <div id="studyArena" style="zoom: ${(getCfg().fontScale || 100) / 100}" class="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 sm:p-8 shadow-xl shadow-slate-950/5"></div>
        </div>
      `;

      root.querySelector('#studyModuleSelect').addEventListener('change', (e) => {
        session.moduleId = e.target.value === '__ALL__' ? null : e.target.value;
        session.currentItem = null;
        renderStudyView(root);
      });
      root.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => {
        session.scope = b.dataset.scope;
        session.currentItem = null;
        renderStudyView(root);
      }));
      root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
        session.mode = b.dataset.mode;
        renderStudyView(root);
      }));

      const arena = root.querySelector('#studyArena');
      if (!picked) {
        const emptyMsg = session.scope === 'errors'
          ? { icon: '🏆', title: 'Все ошибки отработаны!', desc: 'Активных ошибок больше нет. Отличная работа — переключись на «Умный» режим для новых слов.' }
          : { icon: '🎉', title: 'В этой выборке нет карточек', desc: 'Попробуй переключить фильтр на «Умный» или выбери другой режим.' };
        arena.innerHTML = `
          <div class="text-center py-10 space-y-3">
            <div class="text-4xl">${emptyMsg.icon}</div>
            <div class="text-lg font-bold">${emptyMsg.title}</div>
            <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">${emptyMsg.desc}</p>
            ${session.scope !== 'all' ? `<button id="switchSmartBtn" class="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Перейти в «Умный» режим</button>` : ''}
          </div>
        `;
        const sw = arena.querySelector('#switchSmartBtn');
        if (sw) sw.addEventListener('click', () => { session.scope = 'all'; renderStudyView(root); });
        return;
      }

      const st = getItemStat(picked.moduleId, picked.item.id);
      const modeDef = ModeRegistry.get(session.mode);

      arena.innerHTML = `
        <div class="flex items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800/80 text-xs">
          <div class="flex items-center flex-wrap gap-2 text-slate-400">
            <span class="truncate max-w-[130px] sm:max-w-xs">${escapeHtml(picked.moduleTitle)}</span>
            <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-semibold">🔥 Серия: ${session.sessionStreak}</span>
            ${isReviewInjection ? `<span class="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-semibold">🔄 Повторение старого</span>` : ''}
            ${st.activeError > 0 ? `<span class="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-semibold">До закрытия ошибки: ${st.activeError}</span>` : ''}
            ${st.streak > 0 && st.activeError === 0 ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">Верно: ${st.streak}/${MASTERY_STREAK}</span>` : ''}
          </div>
          <button id="favToggleBtn" title="В избранное (F)" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-lg leading-none ${st.favorite ? 'text-amber-400' : 'text-slate-400'}">
            ${st.favorite ? '★' : '☆'}
          </button>
        </div>
        <div id="modeStage"></div>
      `;

      const favBtn = arena.querySelector('#favToggleBtn');
      const doFav = () => {
        const nowFav = toggleFavorite(picked.moduleId, picked.item.id);
        favBtn.textContent = nowFav ? '★' : '☆';
        favBtn.className = `p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-lg leading-none ${nowFav ? 'text-amber-400' : 'text-slate-400'}`;
      };
      favBtn.addEventListener('click', doFav);

      const modeKeyHandler = modeDef.render(arena.querySelector('#modeStage'), {
        item: picked.item,
        moduleId: picked.moduleId,
        moduleItems: picked.moduleItems,
        onComplete: () => renderStudyView(root)
      });

      session.keyHandler = (e) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'а') {
          doFav();
          return;
        }
        if (modeKeyHandler) modeKeyHandler(e.key);
      };
    }
