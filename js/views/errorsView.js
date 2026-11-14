// LexisCore View — Вкладки «Ошибки» и «Избранное»

// --- VIEW: ERRORS ---
    let errorViewTab = 'active'; // 'active' | 'archive'
    function renderErrorsView(root) {
      const activeList = [];
      const archiveList = [];
      for (const m of state.modules) {
        for (const it of m.items) {
          const st = getItemStat(m.id, it.id);
          if (st.activeError > 0) activeList.push({ module: m, item: it, stat: st });
          else if (st.totalErrors > 0) archiveList.push({ module: m, item: it, stat: st });
        }
      }
      activeList.sort((a, b) => b.stat.activeError - a.stat.activeError || b.stat.totalErrors - a.stat.totalErrors);
      archiveList.sort((a, b) => b.stat.totalErrors - a.stat.totalErrors);
      const list = errorViewTab === 'active' ? activeList : archiveList;

      root.innerHTML = `
        <div class="space-y-5 card-enter">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight">Умная работа над ошибками</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400">Чтобы закрыть ошибку, ответь на слово верно 2 раза — оно само уйдёт из списка</p>
            </div>
            ${activeList.length ? `<button id="drillErrorsBtn" class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-500/20 transition">🎯 Отработать ошибки (${activeList.length})</button>` : ''}
          </div>

          <div class="flex gap-2">
            <button id="errTabActive" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${errorViewTab === 'active' ? 'bg-rose-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}">Активные (${activeList.length})</button>
            <button id="errTabArchive" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${errorViewTab === 'archive' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}">Исправленные (${archiveList.length})</button>
          </div>

          ${!list.length ? `
            <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center space-y-2">
              <div class="text-4xl">${errorViewTab === 'active' ? '🏆' : '📂'}</div>
              <div class="font-bold text-lg">${errorViewTab === 'active' ? 'Активных ошибок нет!' : 'Архив пока пуст'}</div>
              <p class="text-sm text-slate-500">${errorViewTab === 'active' ? 'Все промахи отработаны или их ещё не было.' : 'Когда ты закроешь ошибку, слово попадёт сюда для истории.'}</p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${list.slice(0, 100).map(({ module, item, stat }) => `
                <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-bold text-base text-slate-900 dark:text-white">${escapeHtml(item.back)}</span>
                      ${stat.activeError > 0
                        ? `<span class="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-semibold">Осталось верных: ${stat.activeError}</span>`
                        : `<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">✓ Закрыто (всего ошибок: ${stat.totalErrors})</span>`}
                      ${stat.lastWrong ? `<span class="text-xs text-slate-400">Было: <span class="line-through text-rose-400">${escapeHtml(stat.lastWrong)}</span></span>` : ''}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(module.title)} ${item.explanation ? `• ${escapeHtml(item.explanation)}` : ''}</div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button data-fav-err="${module.id}::${item.id}" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm ${stat.favorite ? 'text-amber-400' : 'text-slate-400'}">${stat.favorite ? '★' : '☆'}</button>
                    ${stat.activeError > 0 ? `<button data-clear-err="${module.id}::${item.id}" class="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">Закрыть</button>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;

      root.querySelector('#errTabActive').addEventListener('click', () => { errorViewTab = 'active'; renderErrorsView(root); });
      root.querySelector('#errTabArchive').addEventListener('click', () => { errorViewTab = 'archive'; renderErrorsView(root); });

      const drillBtn = root.querySelector('#drillErrorsBtn');
      if (drillBtn) drillBtn.addEventListener('click', () => startStudy({ moduleId: null, scope: 'errors' }));

      root.querySelectorAll('[data-fav-err]').forEach(b => b.addEventListener('click', () => {
        const [mId, iId] = b.dataset.favErr.split('::');
        toggleFavorite(mId, iId);
        renderErrorsView(root);
      }));
      root.querySelectorAll('[data-clear-err]').forEach(b => b.addEventListener('click', () => {
        const [mId, iId] = b.dataset.clearErr.split('::');
        const st = getItemStat(mId, iId);
        st.activeError = 0;
        saveState();
        updateBadges();
        renderErrorsView(root);
      }));
    }

    // --- VIEW: FAVORITES ---
    function renderFavoritesView(root) {
      const favList = [];
      for (const m of state.modules) {
        for (const it of m.items) {
          const st = getItemStat(m.id, it.id);
          if (st.favorite) favList.push({ module: m, item: it, stat: st });
        }
      }

      root.innerHTML = `
        <div class="space-y-5 card-enter">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight">Избранное</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400">Сложные или важные карточки, отмеченные звёздочкой</p>
            </div>
            ${favList.length ? `
              <div class="flex flex-wrap gap-2">
                <button id="packFavsBtn" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition">📦 Собрать блок из избранного</button>
                <button id="drillFavsBtn" class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-semibold transition">★ Учить избранное (${favList.length})</button>
              </div>
            ` : ''}
          </div>

          ${!favList.length ? `
            <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center space-y-2">
              <div class="text-4xl">☆</div>
              <div class="font-bold text-lg">Список избранного пуст</div>
              <p class="text-sm text-slate-500">Нажимай ☆ во время тренировки или клавишу F на клавиатуре.</p>
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${favList.map(({ module, item }) => `
                <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <div class="font-bold text-base">${escapeHtml(item.back)}</div>
                    <div class="text-xs text-slate-400">${escapeHtml(module.title)}</div>
                    ${item.explanation ? `<p class="text-xs text-slate-500 dark:text-slate-400 pt-1">${escapeHtml(item.explanation)}</p>` : ''}
                  </div>
                  <button data-unfav="${module.id}::${item.id}" class="text-amber-400 hover:text-slate-400 text-xl leading-none p-1">★</button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;

      const drillBtn = root.querySelector('#drillFavsBtn');
      if (drillBtn) drillBtn.addEventListener('click', () => startStudy({ moduleId: null, scope: 'favorites' }));
      const packBtn = root.querySelector('#packFavsBtn');
      if (packBtn) packBtn.addEventListener('click', () => {
        builderMode = 'from_existing';
        pickerFilter = 'favorites';
        pickerSelected.clear();
        favList.forEach(({ module, item }) => pickerSelected.add(`${module.id}::${item.id}`));
        state.activeTab = 'builder';
        render();
      });
      root.querySelectorAll('[data-unfav]').forEach(b => b.addEventListener('click', () => {
        const [mId, iId] = b.dataset.unfav.split('::');
        toggleFavorite(mId, iId);
        renderFavoritesView(root);
      }));
    }
