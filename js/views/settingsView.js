// LexisCore View — Вкладка «Настройки» и модальные окна

// --- VIEW: SETTINGS (Глубокие настройки умного режима, тестов, промпта и демо-блока) ---
    function getActivePrompt() {
      return state.customPrompt || AI_PROMPT_TEXT;
    }

    function renderSettingsView(root) {
      const cfg = getCfg();
      root.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-6 card-enter">
          <div>
            <h1 class="text-2xl font-extrabold tracking-tight">Настройки LexisCore</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">Тонкая настройка алгоритма, режимов тестирования, оформления и промпта ИИ</p>
          </div>

          <!-- 1. Test Behavior & Formatting -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <h2 class="font-bold text-base flex items-center gap-2">🎯 Поведение тестов и текста</h2>
            <div class="space-y-3 text-sm">
              <label class="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div class="font-semibold">Перемешивать варианты ответов</div>
                  <div class="text-xs text-slate-500">Чтобы не запоминать визуально позицию правильной кнопки в тестах и пропусках</div>
                </div>
                <input id="cfgShuffle" type="checkbox" ${cfg.shuffleOptions ? 'checked' : ''} class="w-5 h-5 rounded text-indigo-600" />
              </label>

              <label class="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div class="font-semibold">Красные строки и авто-перенос предложений (1), (2), 1), 2)</div>
                  <div class="text-xs text-slate-500">Автоматически разбивает длинные задания с пронумерованными предложениями на абзацы с отступом</div>
                </div>
                <input id="cfgAutoBreak" type="checkbox" ${cfg.autoBreakNumbered ? 'checked' : ''} class="w-5 h-5 rounded text-indigo-600" />
              </label>

              <label class="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div class="font-semibold">Строгая буква «Ё» при вводе с клавиатуры</div>
                  <div class="text-xs text-slate-500">Если выключено, «е» и «ё» считаются одинаковыми при вводе ответа</div>
                </div>
                <input id="cfgStrictYo" type="checkbox" ${cfg.strictYo ? 'checked' : ''} class="w-5 h-5 rounded text-indigo-600" />
              </label>

              <label class="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div class="font-semibold">Звуковой отклик (Web Audio)</div>
                  <div class="text-xs text-slate-500">Короткий мягкий сигнал при верном и неверном ответе</div>
                </div>
                <input id="cfgSound" type="checkbox" ${cfg.soundEffects ? 'checked' : ''} class="w-5 h-5 rounded text-indigo-600" />
              </label>

              <div class="flex items-center justify-between gap-4 pt-1">
                <div>
                  <div class="font-semibold">Масштаб карточек и шрифта</div>
                  <div class="text-xs text-slate-500">Дополнительно к автоматическому уменьшению длинных текстов</div>
                </div>
                <select id="cfgFontScale" class="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold">
                  <option value="90" ${cfg.fontScale === 90 ? 'selected' : ''}>Компактный (90%)</option>
                  <option value="100" ${cfg.fontScale === 100 ? 'selected' : ''}>Стандартный (100%)</option>
                  <option value="112" ${cfg.fontScale === 112 ? 'selected' : ''}>Крупный (112%)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2. Deep Smart Mode Tuning -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-base">🧠 Глубокая настройка «Умного режима»</h2>
              <button id="resetSmartCfgBtn" class="text-xs text-indigo-500 hover:underline font-semibold">Сбросить по умолчанию</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div class="flex justify-between font-semibold">
                  <span>Горизонт новых слов (подмес)</span>
                  <span id="lblHorizon" class="text-indigo-500">${cfg.horizonSize}</span>
                </div>
                <input id="cfgHorizon" type="range" min="5" max="50" step="5" value="${cfg.horizonSize}" class="w-full accent-indigo-600" />
                <p class="text-[11px] text-slate-400">Сколько новых слов одновременно подмешивается в оборот из больших словарей</p>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div class="flex justify-between font-semibold">
                  <span>Шанс возврата созревшей ошибки</span>
                  <span id="lblErrChance" class="text-indigo-500">${cfg.errorReturnChance}%</span>
                </div>
                <input id="cfgErrChance" type="range" min="20" max="100" step="5" value="${cfg.errorReturnChance}" class="w-full accent-indigo-600" />
                <p class="text-[11px] text-slate-400">Вероятность сразу подкинуть слово с ошибкой, когда прошёл его кулдаун</p>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div class="flex justify-between font-semibold">
                  <span>Шанс подмеса старых усвоенных</span>
                  <span id="lblOldChance" class="text-indigo-500">${cfg.oldReviewChance}%</span>
                </div>
                <input id="cfgOldChance" type="range" min="0" max="60" step="5" value="${cfg.oldReviewChance}" class="w-full accent-indigo-600" />
                <p class="text-[11px] text-slate-400">Как часто подкидывать уже выученные слова для профилактики забывания</p>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div class="flex justify-between font-semibold">
                  <span>Пауза (кулдаун) ошибки в шагах</span>
                  <span class="text-indigo-500"><span id="lblCdMin">${cfg.errCooldownMin}</span>–<span id="lblCdMax">${cfg.errCooldownMax}</span></span>
                </div>
                <div class="flex gap-2 items-center">
                  <input id="cfgCdMin" type="number" min="2" max="30" value="${cfg.errCooldownMin}" class="w-20 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                  <span>до</span>
                  <input id="cfgCdMax" type="number" min="3" max="50" value="${cfg.errCooldownMax}" class="w-20 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                  <span class="text-xs text-slate-400">слов</span>
                </div>
                <p class="text-[11px] text-slate-400">Через сколько карточек минимум и максимум может вернуться ошибка</p>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div class="flex justify-between font-semibold">
                  <span>Верных ответов для закрытия ошибки</span>
                  <span id="lblDebt" class="text-indigo-500">${cfg.errorDebtAdd} (макс. ${cfg.errorDebtMax})</span>
                </div>
                <div class="flex gap-2 items-center">
                  <span>Штраф:</span>
                  <input id="cfgDebtAdd" type="number" min="1" max="5" value="${cfg.errorDebtAdd}" class="w-16 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                  <span>Лимит:</span>
                  <input id="cfgDebtMax" type="number" min="1" max="10" value="${cfg.errorDebtMax}" class="w-16 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                <div class="flex justify-between font-semibold">
                  <span>Серия для статуса «Усвоено»</span>
                  <span id="lblMastery" class="text-indigo-500">${cfg.masteryStreak} подряд</span>
                </div>
                <input id="cfgMastery" type="number" min="1" max="10" value="${cfg.masteryStreak}" class="w-24 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold" />
                <p class="text-[11px] text-slate-400">Сколько раз подряд нужно ответить верно, чтобы слово перешло в выученные</p>
              </div>
            </div>
          </div>

          <!-- 3. Hidden / Collapsible Advanced Tools (AI Prompt & Cloud Server) -->
          <details class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 group">
            <summary class="font-bold text-sm sm:text-base cursor-pointer list-none flex items-center justify-between gap-2">
              <span>✨ Промпт для генерации новых модулей через ИИ</span>
              <span class="text-xs text-slate-400 font-normal">Нажмите, чтобы раскрыть ▾</span>
            </summary>
            <div class="pt-4 space-y-3 border-t border-slate-100 dark:border-slate-800 mt-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs text-slate-500">Шаблон инструкции для нейросети, чтобы создавать собственные блоки в формате JSON</p>
                <div class="flex gap-2">
                  <button id="resetPromptDefaultBtn" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200">Сбросить шаблон</button>
                  <button id="copyEditedPromptBtn" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">📋 Сохранить и скопировать</button>
                </div>
              </div>
              <textarea id="settingsPromptArea" rows="10" class="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs leading-relaxed">${escapeHtml(getActivePrompt())}</textarea>
            </div>
          </details>

          <details class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
            <summary class="font-bold text-sm sm:text-base cursor-pointer list-none flex items-center justify-between gap-2 text-amber-700 dark:text-amber-400">
              <span>☁️ Настройка облачного сервера</span>
              <span class="text-xs font-normal opacity-80">Не трогать без необходимости ▾</span>
            </summary>
            <div class="pt-3 space-y-3 border-t border-amber-500/20 mt-3">
              <p class="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠️ Пожалуйста, не меняйте адрес ниже, если не знаете, для чего он нужен — синхронизация и общая библиотека уже настроены.</p>
              <div class="flex flex-col sm:flex-row gap-2">
                <input id="cfgCloudUrlInp" type="url" value="${escapeHtml(cloudMeta.url)}" placeholder="https://script.google.com/macros/s/.../exec" class="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono" />
                <button id="cfgCloudTestBtn" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shrink-0">Сохранить и проверить</button>
              </div>
            </div>
          </details>

          <!-- 4. Demo Starter Pack & Data -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="font-bold text-sm">Тестовый демо-блок («Ударения ЕГЭ — мини-набор»)</div>
              <div class="text-xs text-slate-500">Загрузить 12 демонстрационных слов для проверки режимов</div>
            </div>
            <button id="settingsLoadStarterBtn" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-semibold transition shrink-0">⚡ Загрузить демо-блок</button>
          </div>
        </div>
      `;

      const numOr = (val, def) => (val !== '' && !Number.isNaN(Number(val))) ? Number(val) : def;
      const bindSave = () => {
        cfg.shuffleOptions = root.querySelector('#cfgShuffle').checked;
        cfg.autoBreakNumbered = root.querySelector('#cfgAutoBreak').checked;
        cfg.indentParagraphs = cfg.autoBreakNumbered;
        cfg.strictYo = root.querySelector('#cfgStrictYo').checked;
        cfg.soundEffects = root.querySelector('#cfgSound').checked;
        cfg.fontScale = numOr(root.querySelector('#cfgFontScale').value, 100);
        cfg.horizonSize = Math.max(1, numOr(root.querySelector('#cfgHorizon').value, 15));
        cfg.errorReturnChance = Math.max(0, numOr(root.querySelector('#cfgErrChance').value, 65));
        cfg.oldReviewChance = Math.max(0, numOr(root.querySelector('#cfgOldChance').value, 20));
        cfg.errCooldownMin = Math.max(1, numOr(root.querySelector('#cfgCdMin').value, 5));
        cfg.errCooldownMax = Math.max(cfg.errCooldownMin, numOr(root.querySelector('#cfgCdMax').value, 14));
        cfg.errorDebtAdd = Math.max(1, numOr(root.querySelector('#cfgDebtAdd').value, 2));
        cfg.errorDebtMax = Math.max(cfg.errorDebtAdd, numOr(root.querySelector('#cfgDebtMax').value, 3));
        cfg.masteryStreak = Math.max(1, numOr(root.querySelector('#cfgMastery').value, 3));

        root.querySelector('#lblHorizon').textContent = cfg.horizonSize;
        root.querySelector('#lblErrChance').textContent = `${cfg.errorReturnChance}%`;
        root.querySelector('#lblOldChance').textContent = `${cfg.oldReviewChance}%`;
        root.querySelector('#lblCdMin').textContent = cfg.errCooldownMin;
        root.querySelector('#lblCdMax').textContent = cfg.errCooldownMax;
        root.querySelector('#lblDebt').textContent = `${cfg.errorDebtAdd} (макс. ${cfg.errorDebtMax})`;
        root.querySelector('#lblMastery').textContent = `${cfg.masteryStreak} подряд`;
        saveState();
      };

      ['#cfgShuffle', '#cfgAutoBreak', '#cfgStrictYo', '#cfgSound', '#cfgFontScale',
       '#cfgHorizon', '#cfgErrChance', '#cfgOldChance', '#cfgCdMin', '#cfgCdMax',
       '#cfgDebtAdd', '#cfgDebtMax', '#cfgMastery'].forEach(sel => {
        const el = root.querySelector(sel);
        el.addEventListener('input', bindSave);
        el.addEventListener('change', bindSave);
      });

      root.querySelector('#resetSmartCfgBtn').addEventListener('click', () => {
        state.settings = defaultSettings();
        saveState();
        renderSettingsView(root);
        showToast('Настройки умного режима сброшены', 'info');
      });

      const promptTa = root.querySelector('#settingsPromptArea');
      promptTa.addEventListener('input', () => {
        state.customPrompt = promptTa.value;
        saveState();
      });

      root.querySelector('#resetPromptDefaultBtn').addEventListener('click', () => {
        state.customPrompt = null;
        saveState();
        renderSettingsView(root);
        showToast('Шаблон промпта восстановлен', 'info');
      });

      root.querySelector('#copyEditedPromptBtn').addEventListener('click', () => {
        state.customPrompt = promptTa.value;
        saveState();
        const text = getActivePrompt();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => showToast('Промпт сохранён и скопирован!', 'success')).catch(() => fallbackCopy(text));
        } else {
          fallbackCopy(text);
        }
      });

      root.querySelector('#cfgCloudTestBtn').addEventListener('click', async () => {
        const val = root.querySelector('#cfgCloudUrlInp').value.trim();
        cloudMeta.url = val;
        saveCloudMeta();
        cloudDataCache = null;
        if (!val) {
          showToast('URL облака очищен', 'info');
          return;
        }
        try {
          await cloudGet('ping');
          showToast('Связь с Google Диском работает!', 'success');
        } catch (err) {
          showToast(`Ошибка подключения: ${err.message}`, 'error');
        }
      });

      root.querySelector('#settingsLoadStarterBtn').addEventListener('click', () => {
        validateAndAddModule(STARTER_STRESS_SAMPLE);
      });
    }

    // =========================================================================
    // 8. MODALS: DICTIONARY, PASTE JSON, AI PROMPT, BACKUP
    // =========================================================================
    function openDictionaryModal(moduleId) {
      const mod = state.modules.find(m => m.id === moduleId);
      if (!mod) return;
      openModal(`Словарь: ${mod.title} (${mod.items.length})`, `
        <div class="space-y-3">
          <input id="dictSearch" type="text" placeholder="Поиск по слову или правилу..." class="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" />
          <div id="dictRows" class="space-y-2 max-h-[55vh] overflow-y-auto custom-scroll"></div>
        </div>
      `);
      let limit = 80;
      const renderRows = (q = '') => {
        const query = q.toLowerCase().trim();
        const rows = mod.items.filter(it =>
          !query || it.front.toLowerCase().includes(query) || it.back.toLowerCase().includes(query) || (it.explanation || '').toLowerCase().includes(query)
        );
        const visible = rows.slice(0, limit);
        const container = document.getElementById('dictRows');
        container.innerHTML = (visible.map(it => {
          const st = getItemStat(mod.id, it.id);
          return `
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-start justify-between gap-3">
              <div>
                <div class="font-bold">${escapeHtml(it.back)} <span class="text-xs font-normal text-slate-400">${escapeHtml(it.hint || '')}</span></div>
                ${it.explanation ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(it.explanation)}</div>` : ''}
              </div>
              <div class="flex items-center gap-2 shrink-0 text-xs">
                ${st.activeError > 0 ? `<span class="text-rose-500 font-semibold">✗${st.activeError}</span>` : ''}
                <span class="${st.favorite ? 'text-amber-400' : 'text-slate-400'}">${st.favorite ? '★' : '☆'}</span>
              </div>
            </div>
          `;
        }).join('') || '<div class="text-slate-400 text-center py-6">Ничего не найдено</div>') +
        (rows.length > limit ? `<button id="dictMoreBtn" class="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-indigo-500">Показать ещё (+80 из ${rows.length - limit})</button>` : '');

        const mb = document.getElementById('dictMoreBtn');
        if (mb) mb.addEventListener('click', () => { limit += 80; renderRows(document.getElementById('dictSearch').value); });
      };
      renderRows();
      document.getElementById('dictSearch').addEventListener('input', (e) => { limit = 80; renderRows(e.target.value); });
    }

    function openPasteJsonModal() {
      openModal('Вставить JSON блока', `
        <p class="text-xs text-slate-500 dark:text-slate-400">Вставь JSON-код, который сгенерировала нейросеть:</p>
        <textarea id="pasteJsonArea" rows="10" placeholder='{"id": "...", "title": "...", "items": [...]}' class="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"></textarea>
        <div class="flex justify-end gap-2">
          <button id="confirmPasteBtn" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm">Импортировать</button>
        </div>
      `);
      document.getElementById('confirmPasteBtn').addEventListener('click', () => {
        try {
          const raw = document.getElementById('pasteJsonArea').value.trim();
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          validateAndAddModule(parsed);
          closeModal();
        } catch (err) {
          showToast(err.message || 'Ошибка парсинга JSON', 'error');
        }
      });
    }

    function openPromptModal() {
      openModal('Промпт для нейросети (редактируемый)', `
        <p class="text-xs text-slate-500 dark:text-slate-400">Можешь сразу вписать сюда свою тему или подправить шаблон — изменения автоматически сохраняются.</p>
        <textarea id="modalPromptEditor" rows="12" class="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono leading-relaxed">${escapeHtml(getActivePrompt())}</textarea>
        <div class="flex justify-between items-center gap-2">
          <button id="modalResetPromptBtn" class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold">Сбросить по умолчанию</button>
          <button id="copyPromptBtn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm">📋 Скопировать промпт</button>
        </div>
      `);
      const ed = document.getElementById('modalPromptEditor');
      ed.addEventListener('input', () => {
        state.customPrompt = ed.value;
        saveState();
      });
      document.getElementById('modalResetPromptBtn').addEventListener('click', () => {
        state.customPrompt = null;
        ed.value = getActivePrompt();
        saveState();
        showToast('Шаблон сброшен', 'info');
      });
      document.getElementById('copyPromptBtn').addEventListener('click', () => {
        state.customPrompt = ed.value;
        saveState();
        const text = ed.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => showToast('Промпт скопирован!', 'success')).catch(() => fallbackCopy(text));
        } else {
          fallbackCopy(text);
        }
      });
    }

    function fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast('Промпт скопирован!', 'success');
      } catch (e) {
        showToast('Не удалось скопировать автоматически', 'warn');
      }
      ta.remove();
    }


    function openDailyGoalModal() {
      openModal('Цель на сегодня', `
        <p class="text-xs text-slate-500 dark:text-slate-400">Сколько карточек хочешь проходить за день?</p>
        <div class="flex flex-wrap gap-2">
          ${[10, 20, 30, 50, 100].map(n => `
            <button data-preset-goal="${n}" class="px-3.5 py-2 rounded-xl border text-xs font-bold transition ${state.dailyGoal === n ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : 'border-slate-200 dark:border-slate-700'}">${n}</button>
          `).join('')}
        </div>
        <div class="flex items-center gap-2 pt-1">
          <input id="customGoalInput" type="number" min="1" max="1000" value="${state.dailyGoal}" class="w-28 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold" />
          <button id="saveGoalBtn" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold">Сохранить</button>
        </div>
      `);
      document.querySelectorAll('[data-preset-goal]').forEach(b => b.addEventListener('click', () => {
        document.getElementById('customGoalInput').value = b.dataset.presetGoal;
      }));
      document.getElementById('saveGoalBtn').addEventListener('click', () => {
        const val = parseInt(document.getElementById('customGoalInput').value, 10);
        if (!val || val < 1) { showToast('Введи число больше 0', 'warn'); return; }
        state.dailyGoal = val;
        saveState();
        updateBadges();
        closeModal();
        render();
        showToast(`Цель обновлена: ${val} карточек в день`, 'success');
      });
    }

    function openBackupModal() {
      openModal('Бэкап и перенос (Windows ↔ Android)', `
        <p class="text-xs text-slate-500 dark:text-slate-400">Прогресс сохраняется автоматически локально. Используй бэкап, чтобы перенести блоки и статистику между ПК и телефоном.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button id="exportFullBackupBtn" class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left space-y-1 transition">
            <div class="font-bold text-sm">⬇️ Экспорт всего прогресса</div>
            <div class="text-xs text-slate-400">Скачать lexiscore_backup.json</div>
          </button>
          <button id="importFullBackupBtn" class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left space-y-1 transition">
            <div class="font-bold text-sm">⬆️ Восстановить из файла</div>
            <div class="text-xs text-slate-400">Загрузить lexiscore_backup.json</div>
          </button>
        </div>
        <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span class="text-xs text-slate-400">Сбросить оболочку до пустого состояния</span>
          <button id="resetAllBtn" class="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold">Очистить всё</button>
        </div>
      `);
      document.getElementById('exportFullBackupBtn').addEventListener('click', () => {
        downloadJson(`lexiscore_backup_${todayKey()}.json`, state);
        showToast('Бэкап скачан', 'success');
      });
      document.getElementById('importFullBackupBtn').addEventListener('click', () => {
        document.getElementById('backupFileInput').click();
      });
      document.getElementById('resetAllBtn').addEventListener('click', () => {
        state = defaultState();
        saveState();
        closeModal();
        render();
        showToast('Оболочка очищена', 'info');
      });
    }

    // =========================================================================
