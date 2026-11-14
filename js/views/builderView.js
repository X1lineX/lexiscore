// LexisCore View — Вкладка «Создать»

// --- VIEW: BUILDER (Manual + Selection from Existing Words) ---
    let builderMode = 'from_existing'; // 'from_existing' | 'manual'
    let builderDraft = { title: '', category: 'Русский язык', description: '', items: [] };
    let builderStressIdx = -1;

    let pickerSourceMod = '__ALL__';
    let pickerFilter = 'all'; // 'all' | 'favorites' | 'errors' | 'unseen'
    let pickerQuery = '';
    let pickerLimit = 80;
    const pickerSelected = new Set(); // "moduleId::itemId"

    function renderBuilderView(root) {
      root.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-5 card-enter">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight">Конструктор блоков</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400">Собери отдельный блок из уже загруженных слов или создай с нуля</p>
            </div>
            <div class="flex gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl self-start">
              <button id="tabFromExisting" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition ${builderMode === 'from_existing' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}">📦 Из существующих</button>
              <button id="tabManual" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition ${builderMode === 'manual' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}">✍️ С нуля</button>
            </div>
          </div>

          <div id="builderStage"></div>
        </div>
      `;

      root.querySelector('#tabFromExisting').addEventListener('click', () => { builderMode = 'from_existing'; renderBuilderView(root); });
      root.querySelector('#tabManual').addEventListener('click', () => { builderMode = 'manual'; renderBuilderView(root); });

      const stage = root.querySelector('#builderStage');
      if (builderMode === 'from_existing') renderExistingPicker(stage);
      else renderManualBuilder(stage);
    }

    function renderExistingPicker(stage) {
      if (!state.modules.length) {
        stage.innerHTML = `
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-8 text-center space-y-3">
            <div class="text-3xl">📦</div>
            <div class="font-bold">Сначала загрузи хотя бы один блок</div>
            <p class="text-xs text-slate-500">Тогда здесь можно будет отбирать любые слова (избранное, ошибки, по поиску) и собирать из них отдельные мини-блоки.</p>
          </div>
        `;
        return;
      }

      const allItems = [];
      const itemMap = new Map();
      for (const m of state.modules) {
        for (const it of m.items) {
          const key = `${m.id}::${it.id}`;
          const st = getItemStat(m.id, it.id);
          const entry = { key, module: m, item: it, stat: st };
          itemMap.set(key, entry);
          if (pickerSourceMod !== '__ALL__' && m.id !== pickerSourceMod) continue;
          if (pickerFilter === 'favorites' && !st.favorite) continue;
          if (pickerFilter === 'errors' && st.activeError === 0 && st.totalErrors === 0) continue;
          if (pickerFilter === 'unseen' && st.attempts > 0) continue;
          if (pickerQuery) {
            const q = pickerQuery.toLowerCase();
            if (!it.front.toLowerCase().includes(q) && !it.back.toLowerCase().includes(q) && !(it.fullAnswer || '').toLowerCase().includes(q) && !(it.explanation || '').toLowerCase().includes(q)) continue;
          }
          allItems.push(entry);
        }
      }

      const visible = allItems.slice(0, pickerLimit);

      stage.innerHTML = `
        <div class="space-y-4">
          <!-- New Block Metadata -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 sm:p-5 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Название нового блока</label>
                <input id="pickBlockTitle" type="text" value="${escapeHtml(builderDraft.title)}" placeholder="Например: Сложные глаголы на сегодня" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Категория</label>
                <input id="pickBlockCat" type="text" value="${escapeHtml(builderDraft.category)}" placeholder="Русский язык" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span class="text-xs text-slate-500">Выбрано слов: <b id="selectedCountLabel" class="text-indigo-500">${pickerSelected.size}</b></span>
              <div class="flex gap-2">
                <button id="exportPickedBtn" class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition">⬇️ Скачать .json</button>
                <button id="createPickedBtn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition">✓ Создать отдельный блок</button>
              </div>
            </div>
          </div>

          <!-- Filter Bar -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 space-y-3">
            <div class="flex flex-col sm:flex-row gap-2.5">
              <input id="pickerSearch" type="text" value="${escapeHtml(pickerQuery)}" placeholder="Поиск слова или правила..." class="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              <select id="pickerModSelect" class="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-medium">
                <option value="__ALL__" ${pickerSourceMod === '__ALL__' ? 'selected' : ''}>Все блоки</option>
                ${state.modules.map(m => `<option value="${m.id}" ${pickerSourceMod === m.id ? 'selected' : ''}>${escapeHtml(m.title)}</option>`).join('')}
              </select>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap gap-1.5">
                ${[
                  { id: 'all', label: 'Все' },
                  { id: 'favorites', label: '★ Избранное' },
                  { id: 'errors', label: '✗ С ошибками' },
                  { id: 'unseen', label: 'Новые' }
                ].map(f => `
                  <button data-pfilter="${f.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition ${pickerFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${f.label}</button>
                `).join('')}
              </div>
              <div class="flex gap-2 text-xs">
                <button id="selectAllFilteredBtn" class="text-indigo-500 font-semibold hover:underline">Выбрать все (${allItems.length})</button>
                <button id="clearSelectedBtn" class="text-slate-400 hover:text-rose-500">Снять выбор</button>
              </div>
            </div>

            <!-- Items Checklist -->
            <div class="space-y-1.5 max-h-[420px] overflow-y-auto custom-scroll pr-1">
              ${!visible.length ? `<div class="text-center py-8 text-xs text-slate-400">По фильтру ничего не найдено</div>` : visible.map(({ key, module, item, stat }) => {
                const checked = pickerSelected.has(key);
                return `
                  <label class="flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${checked ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                    <input type="checkbox" data-pick-key="${key}" ${checked ? 'checked' : ''} class="mt-1 rounded text-indigo-600 focus:ring-indigo-500" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-sm text-slate-800 dark:text-slate-100">${escapeHtml(item.fullAnswer ? item.fullAnswer : (item.front.length > 110 ? item.front.slice(0, 110) + '…' : item.front))}</span>
                        ${item.fullAnswer ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">${escapeHtml(item.front)}</span>` : ''}
                        <span class="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">${escapeHtml(item.back)}</span>
                        <span class="text-[11px] text-slate-400">${escapeHtml(module.title)}</span>
                        ${stat.favorite ? `<span class="text-amber-400 text-xs">★</span>` : ''}
                        ${stat.activeError > 0 ? `<span class="text-rose-500 text-[11px] font-semibold">ошибка</span>` : ''}
                      </div>
                      ${item.explanation ? `<div class="text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHtml(item.explanation)}</div>` : ''}
                    </div>
                  </label>
                `;
              }).join('')}
              ${allItems.length > pickerLimit ? `
                <button id="loadMorePickerBtn" class="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-indigo-500 hover:bg-slate-200 dark:hover:bg-slate-700">Показать ещё (+80 из ${allItems.length - pickerLimit})</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      const pTitle = stage.querySelector('#pickBlockTitle');
      const pCat = stage.querySelector('#pickBlockCat');
      pTitle.addEventListener('input', () => builderDraft.title = pTitle.value);
      pCat.addEventListener('input', () => builderDraft.category = pCat.value);

      const pSearch = stage.querySelector('#pickerSearch');
      pSearch.addEventListener('input', () => {
        pickerQuery = pSearch.value;
        pickerLimit = 80;
        renderExistingPicker(stage);
        const inp = stage.querySelector('#pickerSearch');
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      });

      stage.querySelector('#pickerModSelect').addEventListener('change', (e) => {
        pickerSourceMod = e.target.value;
        pickerLimit = 80;
        renderExistingPicker(stage);
      });

      stage.querySelectorAll('[data-pfilter]').forEach(b => b.addEventListener('click', () => {
        pickerFilter = b.dataset.pfilter;
        pickerLimit = 80;
        renderExistingPicker(stage);
      }));

      stage.querySelectorAll('[data-pick-key]').forEach(cb => cb.addEventListener('change', () => {
        if (cb.checked) pickerSelected.add(cb.dataset.pickKey);
        else pickerSelected.delete(cb.dataset.pickKey);
        stage.querySelector('#selectedCountLabel').textContent = pickerSelected.size;
      }));

      stage.querySelector('#selectAllFilteredBtn').addEventListener('click', () => {
        allItems.forEach(x => pickerSelected.add(x.key));
        renderExistingPicker(stage);
      });
      stage.querySelector('#clearSelectedBtn').addEventListener('click', () => {
        pickerSelected.clear();
        renderExistingPicker(stage);
      });
      const lm = stage.querySelector('#loadMorePickerBtn');
      if (lm) lm.addEventListener('click', () => { pickerLimit += 80; renderExistingPicker(stage); });

      const buildSelectedModule = () => {
        const pickedItems = [];
        for (const k of pickerSelected) {
          const entry = itemMap.get(k);
          if (entry) pickedItems.push({ ...entry.item, id: `${entry.item.id}_copy_${pickedItems.length + 1}` });
        }
        if (!pickedItems.length) { showToast('Выбери хотя бы одно слово', 'warn'); return null; }
        const hasStress = pickedItems.some(i => typeof i.stressIndex === 'number');
        return {
          id: `pack_${Date.now()}`,
          title: builderDraft.title.trim() || `Подборка (${pickedItems.length} слов)`,
          category: builderDraft.category.trim() || 'Свой блок',
          description: `Собран вручную из выбранных карточек (${pickedItems.length} шт.).`,
          version: '1.0',
          supportedModes: hasStress ? ['stress', 'flashcard', 'quiz'] : ['flashcard', 'quiz', 'typing'],
          items: pickedItems
        };
      };

      stage.querySelector('#createPickedBtn').addEventListener('click', () => {
        const mod = buildSelectedModule();
        if (!mod) return;
        pickerSelected.clear();
        builderDraft.title = '';
        validateAndAddModule(mod);
        state.activeTab = 'modules';
        render();
      });

      stage.querySelector('#exportPickedBtn').addEventListener('click', () => {
        const mod = buildSelectedModule();
        if (mod) downloadJson(`${mod.id}.json`, mod);
      });
    }

    function renderManualBuilder(stage) {
      stage.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Название блока</label>
                <input id="bldTitle" type="text" value="${escapeHtml(builderDraft.title)}" placeholder="Например: Паронимы ЕГЭ" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Категория</label>
                <input id="bldCat" type="text" value="${escapeHtml(builderDraft.category)}" placeholder="Русский язык" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-500 block mb-1">Описание</label>
              <input id="bldDesc" type="text" value="${escapeHtml(builderDraft.description)}" placeholder="Короткое описание..." class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <h2 class="font-bold text-base">Добавить карточку</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Слово / Вопрос (front)</label>
                <input id="cardFront" type="text" placeholder="например: каталог" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Правильный ответ (back)</label>
                <input id="cardBack" type="text" placeholder="например: каталОг" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
            </div>

            <div id="stressPickerWrap" class="hidden p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div class="text-[11px] font-semibold text-indigo-500 mb-2">Кликни по ударной гласной (для режима «Ударения»):</div>
              <div id="stressPickerLetters" class="flex flex-wrap gap-1"></div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Подсказка (часть речи / тема)</label>
                <input id="cardHint" type="text" placeholder="Существительное" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label class="text-xs font-semibold text-slate-500 block mb-1">Правило / Мнемоника</label>
                <input id="cardExpl" type="text" placeholder="Слова на -лог имеют ударение на последний слог" class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
              </div>
            </div>
            <button id="addCardToDraftBtn" class="px-4 py-2 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:opacity-90 text-white text-xs sm:text-sm font-semibold transition">+ Добавить карточку в список</button>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-base">Карточки в блоке (${builderDraft.items.length})</h2>
              <div class="flex gap-2">
                <button id="saveDraftModuleBtn" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition">✓ Сохранить в программу</button>
                <button id="exportDraftBtn" class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold transition">⬇️ Скачать .json</button>
              </div>
            </div>
            <div class="space-y-2 max-h-64 overflow-y-auto custom-scroll">
              ${builderDraft.items.length === 0 ? `<p class="text-xs text-slate-400">Пока ни одной карточки.</p>` : builderDraft.items.map((it, idx) => `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div>
                    <span class="font-bold">${escapeHtml(it.front)}</span> → <span class="text-indigo-500 font-bold">${escapeHtml(it.back)}</span>
                    ${typeof it.stressIndex === 'number' ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">ударение: ${it.stressIndex}</span>` : ''}
                  </div>
                  <button data-rm-draft="${idx}" class="text-rose-500 px-2">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      const bTitle = stage.querySelector('#bldTitle');
      const bCat = stage.querySelector('#bldCat');
      const bDesc = stage.querySelector('#bldDesc');
      bTitle.addEventListener('input', () => builderDraft.title = bTitle.value);
      bCat.addEventListener('input', () => builderDraft.category = bCat.value);
      bDesc.addEventListener('input', () => builderDraft.description = bDesc.value);

      const cFront = stage.querySelector('#cardFront');
      const cBack = stage.querySelector('#cardBack');
      const pickerWrap = stage.querySelector('#stressPickerWrap');
      const pickerRow = stage.querySelector('#stressPickerLetters');

      cFront.addEventListener('input', () => {
        builderStressIdx = -1;
        const val = cFront.value.trim();
        if (!val) { pickerWrap.classList.add('hidden'); return; }
        pickerWrap.classList.remove('hidden');
        pickerRow.innerHTML = Array.from(val).map((ch, idx) => {
          const isV = RU_VOWELS.has(ch);
          return isV
            ? `<button type="button" data-pick-stress="${idx}" class="px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-white dark:bg-slate-800 font-bold text-sm hover:border-indigo-500">${escapeHtml(ch)}</button>`
            : `<span class="px-1 py-1 text-sm text-slate-400">${escapeHtml(ch)}</span>`;
        }).join('');
        pickerRow.querySelectorAll('[data-pick-stress]').forEach(btn => {
          btn.addEventListener('click', () => {
            builderStressIdx = Number(btn.dataset.pickStress);
            const chars = Array.from(val.toLowerCase());
            chars[builderStressIdx] = chars[builderStressIdx].toUpperCase();
            cBack.value = chars.join('');
            pickerRow.querySelectorAll('[data-pick-stress]').forEach(b => b.classList.remove('bg-indigo-600', 'text-white'));
            btn.classList.add('bg-indigo-600', 'text-white');
          });
        });
      });

      stage.querySelector('#addCardToDraftBtn').addEventListener('click', () => {
        const front = cFront.value.trim();
        const back = cBack.value.trim();
        if (!front || !back) { showToast('Заполни вопрос и ответ', 'warn'); return; }
        builderDraft.items.push({
          id: `custom_${Date.now()}_${builderDraft.items.length}`,
          front,
          back,
          stressIndex: builderStressIdx >= 0 ? builderStressIdx : undefined,
          hint: stage.querySelector('#cardHint').value.trim(),
          explanation: stage.querySelector('#cardExpl').value.trim()
        });
        builderStressIdx = -1;
        renderManualBuilder(stage);
        showToast('Карточка добавлена', 'success');
      });

      stage.querySelectorAll('[data-rm-draft]').forEach(b => b.addEventListener('click', () => {
        builderDraft.items.splice(Number(b.dataset.rmDraft), 1);
        renderManualBuilder(stage);
      }));

      const buildModuleObj = () => ({
        id: `custom_${Date.now()}`,
        title: builderDraft.title.trim() || 'Мой учебный блок',
        category: builderDraft.category.trim() || 'Общее',
        description: builderDraft.description.trim(),
        version: '1.0',
        supportedModes: builderDraft.items.some(i => typeof i.stressIndex === 'number')
          ? ['stress', 'flashcard', 'quiz']
          : ['flashcard', 'quiz', 'typing'],
        items: builderDraft.items
      });

      stage.querySelector('#saveDraftModuleBtn').addEventListener('click', () => {
        if (!builderDraft.items.length) { showToast('Добавь хотя бы одну карточку', 'warn'); return; }
        validateAndAddModule(buildModuleObj());
        builderDraft = { title: '', category: 'Русский язык', description: '', items: [] };
        state.activeTab = 'modules';
        render();
      });

      stage.querySelector('#exportDraftBtn').addEventListener('click', () => {
        if (!builderDraft.items.length) { showToast('Добавь хотя бы одну карточку', 'warn'); return; }
        const obj = buildModuleObj();
        downloadJson(`${obj.id}.json`, obj);
      });
    }
