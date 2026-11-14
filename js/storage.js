// LexisCore — Импорт/экспорт модулей, нормализация JSON и управление сессией

// 5. MODULE IMPORT, EXPORT & AI PROMPT
    // =========================================================================
    function normalizeModule(mod) {
      if (!mod || typeof mod !== 'object' || !mod.title || !Array.isArray(mod.items) || !mod.items.length) {
        throw new Error('Неверный формат JSON: нужны поля title и непустой массив items.');
      }
      const id = mod.id || `mod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      return {
        id,
        title: String(mod.title),
        description: String(mod.description || ''),
        category: String(mod.category || 'Общее'),
        folder: String(mod.folder || mod.category || 'Общее').trim() || 'Общее',
        cloudFileId: mod.cloudFileId ? String(mod.cloudFileId) : undefined,
        sourceFileName: mod.sourceFileName ? String(mod.sourceFileName) : undefined,
        version: String(mod.version || '1.0'),
        supportedModes: Array.isArray(mod.supportedModes) && mod.supportedModes.length
          ? mod.supportedModes
          : (typeof mod.items[0].stressIndex === 'number'
              ? ['stress', 'flashcard', 'quiz']
              : ['auto', 'flashcard', 'quiz']),
        items: mod.items.map((it, idx) => {
          const front = String(it.front || '');
          const back = String(it.back || '');
          let stressIndex = typeof it.stressIndex === 'number' ? it.stressIndex : undefined;
          if (stressIndex !== undefined && back.length === front.length) {
            const upperIndices = Array.from(back).reduce((acc, ch, i) => {
              if (RU_VOWELS.has(ch) && ch === ch.toUpperCase() && ch !== ch.toLowerCase()) acc.push(i);
              return acc;
            }, []);
            if (upperIndices.length === 1) stressIndex = upperIndices[0];
          }
          return {
            id: String(it.id || `${id}_item_${idx + 1}`),
            type: it.type ? String(it.type) : undefined,
            front,
            back,
            stressIndex,
            choices: Array.isArray(it.choices) ? it.choices.map(String) : undefined,
            fullAnswer: it.fullAnswer ? String(it.fullAnswer) : undefined,
            correctIndices: Array.isArray(it.correctIndices) ? it.correctIndices.map(Number) : undefined,
            ordered: Boolean(it.ordered),
            hint: it.hint ? String(it.hint) : '',
            explanation: it.explanation ? String(it.explanation) : '',
            options: Array.isArray(it.options) ? it.options.map(String) : undefined
          };
        })
      };
    }

    function validateAndAddModule(mod, silent = false) {
      const normalized = normalizeModule(mod);
      const existingIdx = state.modules.findIndex(m => m.id === normalized.id);
      if (existingIdx >= 0) {
        if (!mod.folder && state.modules[existingIdx].folder) {
          normalized.folder = state.modules[existingIdx].folder;
        }
        state.modules[existingIdx] = normalized;
        if (!silent) showToast(`Блок «${normalized.title}» обновлён (${normalized.items.length} карт.)`, 'success');
      } else {
        state.modules.push(normalized);
        if (!silent) showToast(`Блок «${normalized.title}» добавлен (${normalized.items.length} карт.)`, 'success');
      }
      state.activeModuleId = normalized.id;
      saveState();
      updateBadges();
      if (!silent) render();
      return normalized;
    }

    function addToDownloaded(mod, folder = 'Общая папка', cloudFileId = undefined, sourceFileName = undefined) {
      const normalized = normalizeModule({ ...mod, folder: folder || mod.folder, cloudFileId: cloudFileId || mod.cloudFileId, sourceFileName: sourceFileName || mod.sourceFileName });
      const cleanFolder = (folder || 'Общая папка').trim() || 'Общая папка';
      const idx = state.downloaded.findIndex(d => d.module.id === normalized.id || (cloudFileId && d.cloudFileId === cloudFileId));
      const entry = {
        id: normalized.id,
        folder: cleanFolder,
        cloudFileId: cloudFileId || normalized.cloudFileId,
        sourceFileName: sourceFileName || normalized.sourceFileName,
        module: normalized,
        addedAt: Date.now()
      };
      if (idx >= 0) state.downloaded[idx] = entry;
      else state.downloaded.push(entry);
      return entry;
    }

    function downloadJson(filename, dataObj) {
      const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    const AI_PROMPT_TEXT = `Ты — методист и генератор учебных данных для модульного приложения LexisCore.
Твоя задача — создать учебный блок строго в формате чистого валидного JSON (без пояснений до или после, только JSON).

### Базовая структура блока:
{
  "id": "уникальный_id_латиницей",
  "title": "Понятное название блока",
  "description": "Что именно тренирует этот блок",
  "category": "Русский язык / Английский / Инфобез / Литература",
  "version": "1.0",
  "supportedModes": ["auto", "flashcard", "quiz"],
  "items": [ ... ]
}

Поддерживаемые типы карточек (поле "type" внутри каждого элемента массива "items"):

1. "stress" — Ударения (Задание 4 ЕГЭ)
   - "front": слово полностью строчными ("звонит")
   - "back": слово с заглавной ударной гласной ("звонИт")
   - "stressIndex": индекс ударной гласной в "front" с 0 (для "звонит" -> 4)

2. "gap_choice" — Выбор буквы или слитно/раздельно прямо в пропуске (Задания 9–15 ЕГЭ)
   - "front": слово/фраза с пропуском, обозначенным ".." ("прик..снуться", "(не)лепый")
   - "choices": массив вариантов для подстановки (["а", "о"] или ["слитно", "раздельно"] или ["н", "нн"])
   - "back": правильный вариант из choices ("а")
   - "fullAnswer": полное слово с ответом ("прикоснуться")

3. "gap_input" — Ввод пропущенной буквы с клавиатуры прямо в пропуск (Орфография / Задания 9–15 ЕГЭ)
   - "front": слово с пропуском ".." ("бе..шумный", "пре..положение")
   - "back": только пропущенные буквы ("с", "д", "нн")
   - "fullAnswer": полное слово ("бесшумный")

4. "digits" — Ввод цифр (Задания 16–21 ЕГЭ на запятые, 8, 22–26)
   - "front": текст задания/предложения с цифрами в скобках: "Дождь (1) начавшийся утром (2) не утихал."
   - "back": строка с правильными цифрами без пробелов ("12")

5. "multi_choice" — Несколько правильных вариантов (Задания 9–12, 16, 22–23 ЕГЭ)
   - "front": вопрос/инструкция ("Укажите варианты ответов, в которых во всех словах одного ряда пропущена одна и та же буква:")
   - "options": массив из 4–5 строк БЕЗ ведущих номеров "1)", "2)" — нумерацию подставит сама программа, так как варианты перемешиваются! (например: ["пр..града, пр..мудрый", "пр..ехать, пр..брежный", ...])
   - "correctIndices": массив индексов правильных строк с 0 ([0, 2])
   - "back": правильные ответы текстом для пояснения

6. "quiz" — Одиночный выбор из 4 вариантов (Задания 1–3, 5, 6, 7 или общие тесты)
   - "front": вопрос или контекст
   - "options": массив из 4 вариантов (без номеров "1)", "2)")
   - "back": точный правильный вариант из options

7. "typing" — Полный ввод ответа с клавиатуры (Паронимы Задание 5, исправление ошибки Задание 6–7, перевод слов, команды)
   - "front": задание или слово для перевода
   - "back": точный ожидаемый ответ

8. "flashcard" — Обычная карточка «Вопрос -> Ответ» (Слова, термины, даты, аргументы)
   - "front": слово/вопрос
   - "back": перевод/ответ

### Форматирование текста, абзацев и «красных строк» (ВАЖНО!):
- Внутри JSON-строк ("front" и "explanation") используй \`\\n\` для переноса на новую строку и \`\\t\` (или \`[indent]\`) в начале абзаца для красной строки.
- Если в задании идут пронумерованные предложения или пункты \`1) ...\`, \`2) ...\`, \`(1) ...\` (например, в заданиях 8, 16, 21, 22–26 ЕГЭ), ОБЯЗАТЕЛЬНО отделяй каждое такое предложение переносом \`\\n\`, чтобы оно начиналось с новой строки!
- Пример для длинного задания:
  "front": "Найдите предложения, в которых тире ставится в соответствии с одним и тем же правилом:\\n\\t(1) Байкал — самое глубокое озеро на планете.\\n\\t(2) Глубина его достигает полутора километров."

### Общие поля для КАЖДОЙ карточки:
- "id": уникальный id ("item_001")
- "type": один из типов выше
- "hint": короткая подсказка (часть речи, номер задания ЕГЭ, тема)
- "explanation": чёткое правило или мнемоника (показывается после ответа)

### Правила генерации:
- Для однотипных заданий ставь в "supportedModes": ["auto", "flashcard"] (или ["stress", "flashcard", "quiz"] для ударений).
- Никаких лишних комментариев вне JSON. Проверяй орфографию и индексы.
- НИКОГДА не пиши в тексте вопроса ("front") количество правильных ответов (не «укажите 2 цифры», а «укажите все верные цифры/варианты»).
- Запрещено обрывать список комментариями вроде "// ... и так далее" или сокращать объём. Если карточек очень много и они не влезают в один ответ — выдай валидный JSON первой части и напиши в конце, сколько осталось, чтобы я запросил продолжение.

### Переменные (заполни нужные или оставь пустыми, если задача описана ниже):
- Тема / Предмет: [ВПИШИ СЮДА]
- Количество карточек: [например: 100 / 250 / весь словник]
- Тип карточек ("type"): [например: gap_input / stress / digits / auto (разные)]
- Сложность и акценты: [например: сложные случаи и исключения ФИПИ]
- Формат выдачи: [один JSON / разбить на блоки по N карточек]
- Особые пожелания: [например: краткие мнемоники в explanation / без повторов]

### Подробная задача (описание ниже):
[ЗДЕСЬ ОПИШИ ЗАДАЧУ СВОИМИ СЛОВАМИ]`;

    const STARTER_STRESS_SAMPLE = {
      id: "ege_ru_stress_starter",
      title: "Ударения ЕГЭ (Мини-набор ФИПИ)",
      description: "Базовый набор сложных слов из орфоэпического словника ФИПИ. Для полного списка (91 слово) импортируйте ege_stress_ru.json.",
      category: "Русский язык",
      version: "1.0",
      supportedModes: ["stress", "flashcard", "quiz"],
      items: [
        { id: "s1", front: "звонит", back: "звонИт", stressIndex: 4, hint: "Глагол", explanation: "В глаголах на -звонить ударение падает на окончание: звонИт, позвонИт." },
        { id: "s2", front: "банты", back: "бАнты", stressIndex: 1, hint: "Существительное", explanation: "Во всех падежах мн. ч. ударение фиксировано на основе: бАнты, бАнтов." },
        { id: "s3", front: "торты", back: "тОрты", stressIndex: 1, hint: "Существительное", explanation: "Ударение всегда на первый слог: тОрты, тОртов." },
        { id: "s4", front: "жалюзи", back: "жалюзИ", stressIndex: 5, hint: "Существительное", explanation: "Французское заимствование — ударение всегда на последний слог." },
        { id: "s5", front: "красивее", back: "красИвее", stressIndex: 4, hint: "Прилагательное", explanation: "В сравнительной степени сохраняется ударение исходного слова красИвый." },
        { id: "s6", front: "баловать", back: "баловАть", stressIndex: 5, hint: "Глагол", explanation: "Ударение на суффикс -ова-: баловАть (но причастие балОванный)." },
        { id: "s7", front: "вероисповедание", back: "вероисповЕдание", stressIndex: 9, hint: "Существительное", explanation: "От глагола «исповЕдать» — ударение падает на букву Е." },
        { id: "s8", front: "начали", back: "нАчали", stressIndex: 1, hint: "Глагол (мн. ч.)", explanation: "Во мн. ч. прош. вр. ударение смещается на первый слог: нАчали (но началА)." },
        { id: "s9", front: "свекла", back: "свЁкла", stressIndex: 2, hint: "Существительное", explanation: "Ударение на Ё в первом слоге, даже если на письме стоит Е." },
        { id: "s10", front: "оптовый", back: "оптОвый", stressIndex: 3, hint: "Прилагательное", explanation: "Ударение на второй слог: оптОвый (не «Оптовый»)." },
        { id: "s11", front: "некролог", back: "некролОг", stressIndex: 6, hint: "Существительное", explanation: "В словах на -лог (каталОг, некролОг) ударение падает на последний слог." },
        { id: "s12", front: "закупорить", back: "закУпорить", stressIndex: 3, hint: "Глагол", explanation: "Ударение на У (как и откУпорить)." }
      ]
    };

    // =========================================================================
    // 6. STUDY SESSION CONTROLLER
    // =========================================================================
    let session = {
      scope: 'all', // 'all' | 'errors' | 'favorites' | 'new'
      mode: 'stress',
      moduleId: null, // null = all modules
      currentItem: null,
      sessionStreak: 0,
      keyHandler: null
    };

    function getModuleFolder(m) {
      return (m.folder || m.category || 'Общее').trim() || 'Общее';
    }

    function getEligibleItems() {
      let mods = state.modules;
      if (session.moduleId && session.moduleId.startsWith('__FOLDER__:')) {
        const fname = session.moduleId.slice('__FOLDER__:'.length);
        mods = state.modules.filter(m => getModuleFolder(m) === fname);
      } else if (session.moduleId) {
        mods = state.modules.filter(m => m.id === session.moduleId);
      }
      const modeDef = ModeRegistry.get(session.mode);
      const list = [];
      for (const m of mods) {
        for (const it of m.items) {
          if (modeDef && !modeDef.supportsItem(it)) continue;
          list.push({ moduleId: m.id, moduleTitle: m.title, moduleItems: m.items, item: it });
        }
      }
      return list;
    }

    function startStudy({ moduleId = null, scope = 'all', mode = null } = {}) {
      session.moduleId = moduleId;
      session.scope = scope;
      let targetMod = null;
      if (moduleId && moduleId.startsWith('__FOLDER__:')) {
        const fname = moduleId.slice('__FOLDER__:'.length);
        targetMod = state.modules.find(m => getModuleFolder(m) === fname) || state.modules[0];
      } else {
        targetMod = moduleId ? state.modules.find(m => m.id === moduleId) : state.modules[0];
      }
      if (mode) {
        session.mode = mode;
      } else if (targetMod) {
        const available = ModeRegistry.listForModule(targetMod);
        session.mode = available[0]?.id || 'flashcard';
      }
      session.currentItem = null;
      state.activeTab = 'study';
      render();
    }

    // =========================================================================
    // 7. VIEWS RENDERER
    // =========================================================================
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function updateBadges() {
      let activeErrCount = 0;
      let favCount = 0;
      for (const m of state.modules) {
        for (const it of m.items) {
          const st = getItemStat(m.id, it.id);
          if (st.activeError > 0) activeErrCount++;
          if (st.favorite) favCount++;
        }
      }
      const bMod = document.getElementById('badgeModules');
      const bDl = document.getElementById('badgeDownloads');
      const bErr = document.getElementById('badgeErrors');
      const bFav = document.getElementById('badgeFavs');
      if (bMod) bMod.textContent = state.modules.length;
      if (bDl) bDl.textContent = state.downloaded.length;
      if (bErr) bErr.textContent = activeErrCount;
      if (bFav) bFav.textContent = favCount;

      const pct = Math.min(100, Math.round((state.dailyLog.count / state.dailyGoal) * 100));
      const dgText = document.getElementById('dailyGoalText');
      const dgBar = document.getElementById('dailyGoalBar');
      const mhGoal = document.getElementById('mobileHeaderGoal');
      if (dgText) dgText.textContent = `${state.dailyLog.count} / ${state.dailyGoal}`;
      if (mhGoal) mhGoal.textContent = `${state.dailyLog.count}/${state.dailyGoal}`;
      if (dgBar) dgBar.style.width = `${pct}%`;
    }

    function updateNavStyles() {
      document.querySelectorAll('.nav-btn').forEach(btn => {
        const active = btn.dataset.tab === state.activeTab;
        btn.className = `nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
          active
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
        }`;
      });
      document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        const active = btn.dataset.tab === state.activeTab;
        btn.className = `mobile-nav-btn tap-scale flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold min-w-0 transition ${
          active
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 dark:text-slate-400'
        }`;
      });
    }

    function render() {
      updateBadges();
      updateNavStyles();
      const root = document.getElementById('viewContainer');
      session.keyHandler = null;

      if (state.activeTab === 'modules') renderModulesView(root);
      else if (state.activeTab === 'downloads') renderDownloadsView(root);
      else if (state.activeTab === 'study') renderStudyView(root);
      else if (state.activeTab === 'errors') renderErrorsView(root);
      else if (state.activeTab === 'favorites') renderFavoritesView(root);
      else if (state.activeTab === 'builder') renderBuilderView(root);
      else if (state.activeTab === 'settings') renderSettingsView(root);
    }
