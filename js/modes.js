// LexisCore — Реестр тренировочных режимов ЕГЭ и карточек

// 4. PLUGGABLE MODE REGISTRY (Конструктность режимов)
    // =========================================================================
    const ModeRegistry = {
      modes: {},
      register(id, def) {
        this.modes[id] = { id, ...def };
      },
      get(id) {
        return this.modes[id];
      },
      listForModule(mod) {
        const supported = mod && Array.isArray(mod.supportedModes) && mod.supportedModes.length
          ? mod.supportedModes
          : ['flashcard', 'quiz'];
        return supported.map(id => this.modes[id]).filter(Boolean);
      }
    };

    function generateStressDistractors(item) {
      const word = item.front.toLowerCase();
      const vowelIndices = [];
      for (let i = 0; i < word.length; i++) {
        if (RU_VOWELS.has(word[i])) vowelIndices.push(i);
      }
      const variants = [item.back];
      for (const idx of vowelIndices) {
        if (idx === item.stressIndex) continue;
        const v = word.slice(0, idx) + word[idx].toUpperCase() + word.slice(idx + 1);
        if (!variants.includes(v)) variants.push(v);
      }
      return variants.slice(0, 4).sort(() => Math.random() - 0.5);
    }

    // MODE 1: STRESS TAP (Ударения)
    ModeRegistry.register('stress', {
      name: 'Ударения',
      icon: '🎯',
      supportsItem: (item) => typeof item.stressIndex === 'number' && item.stressIndex >= 0,
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        const chars = Array.from(item.front.toLowerCase());
        let answered = false;

        const vowelMap = [];
        chars.forEach((ch, idx) => {
          if (RU_VOWELS.has(ch)) vowelMap.push(idx);
        });

        container.innerHTML = `
          <div class="text-center space-y-6">
            <div class="text-xs uppercase tracking-wider font-semibold text-indigo-500 dark:text-indigo-400">
              Нажми на ударную гласную ${item.hint ? `• ${escapeHtml(item.hint)}` : ''}
            </div>
            <div id="stressWordRow" class="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-4">
              ${chars.map((ch, idx) => {
                const isVowel = RU_VOWELS.has(ch);
                if (!isVowel) {
                  return `<span class="text-3xl sm:text-4xl font-bold text-slate-500 dark:text-slate-400 px-0.5 select-none">${escapeHtml(ch)}</span>`;
                }
                const vNum = vowelMap.indexOf(idx) + 1;
                return `
                  <button data-char-idx="${idx}" class="vowel-pill relative group px-3 sm:px-3.5 py-2 rounded-xl border-2 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500 text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white cursor-pointer">
                    ${escapeHtml(ch)}
                    <span class="hidden sm:block absolute -top-2 -right-1.5 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${vNum}</span>
                  </button>
                `;
              }).join('')}
            </div>
            <div id="stressFeedback" class="hidden rounded-2xl p-4 text-left border"></div>
          </div>
        `;

        const handlePick = (idx) => {
          if (answered) return;
          answered = true;
          const isCorrect = idx === item.stressIndex;
          const wrongDisplay = chars.map((c, i) => i === idx ? c.toUpperCase() : c).join('');
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : wrongDisplay);

          container.querySelectorAll('[data-char-idx]').forEach(btn => {
            const bIdx = Number(btn.dataset.charIdx);
            btn.disabled = true;
            btn.classList.remove('border-indigo-500/30', 'bg-indigo-500/10', 'hover:bg-indigo-500/20');
            if (bIdx === item.stressIndex) {
              btn.classList.add('border-emerald-500', 'bg-emerald-500/20', 'text-emerald-600', 'dark:text-emerald-300', 'scale-110');
              btn.firstChild.textContent = chars[bIdx].toUpperCase();
            } else if (bIdx === idx && !isCorrect) {
              btn.classList.add('border-rose-500', 'bg-rose-500/20', 'text-rose-500');
            } else {
              btn.classList.add('border-transparent', 'opacity-45');
            }
          });

          const fb = container.querySelector('#stressFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 text-left border ${isCorrect
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-100'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-bold text-base">${isCorrect ? '✓ Верно!' : `✗ Ошибка — правильно: ${escapeHtml(item.back)}`}</span>
              <button id="nextCardBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 leading-relaxed mt-1">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#nextCardBtn').addEventListener('click', onComplete);
        };

        container.querySelectorAll('[data-char-idx]').forEach(btn => {
          btn.addEventListener('click', () => handlePick(Number(btn.dataset.charIdx)));
        });

        return (key) => {
          if (!answered && /^[1-9]$/.test(key)) {
            const vIdx = vowelMap[Number(key) - 1];
            if (vIdx !== undefined) handlePick(vIdx);
          } else if (answered && (key === ' ' || key === 'Enter')) {
            onComplete();
          }
        };
      }
    });

    // MODE 2: FLASHCARDS (Карточки)
    ModeRegistry.register('flashcard', {
      name: 'Карточки',
      icon: '🗂️',
      supportsItem: () => true,
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        let flipped = false;

        container.innerHTML = `
          <div class="space-y-5">
            <div id="flashcardBox" class="cursor-pointer select-none rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 text-center min-h-[200px] flex flex-col items-center justify-center transition hover:border-indigo-500/40">
              <div class="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">${escapeHtml(item.hint || 'Нажми, чтобы перевернуть')}</div>
              <div class="${adaptiveFontClass(item.front)} w-full">${formatRichTaskText(item.front)}</div>
              <div id="flashcardBack" class="hidden mt-5 pt-5 border-t border-slate-200 dark:border-slate-700 w-full space-y-2">
                <div class="text-2xl sm:text-3xl font-extrabold text-indigo-500">${escapeHtml(item.back)}</div>
                ${item.explanation ? `<p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">${escapeHtml(item.explanation)}</p>` : ''}
              </div>
            </div>
            <div id="flashcardActions" class="hidden grid grid-cols-2 gap-3">
              <button id="fcWrongBtn" class="py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-semibold text-sm transition">✗ Не помню</button>
              <button id="fcRightBtn" class="py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-semibold text-sm transition">✓ Знаю</button>
            </div>
            <div id="flashcardFlipHint" class="text-center">
              <button id="fcFlipBtn" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition">Показать ответ (Space)</button>
            </div>
          </div>
        `;

        const flip = () => {
          if (flipped) return;
          flipped = true;
          container.querySelector('#flashcardBack').classList.remove('hidden');
          container.querySelector('#flashcardActions').classList.remove('hidden');
          container.querySelector('#flashcardFlipHint').classList.add('hidden');
        };

        container.querySelector('#flashcardBox').addEventListener('click', flip);
        container.querySelector('#fcFlipBtn').addEventListener('click', flip);
        container.querySelector('#fcWrongBtn').addEventListener('click', () => {
          recordAnswer(moduleId, item.id, false, 'Не вспомнил');
          onComplete();
        });
        container.querySelector('#fcRightBtn').addEventListener('click', () => {
          recordAnswer(moduleId, item.id, true);
          onComplete();
        });

        return (key) => {
          if (!flipped && (key === ' ' || key === 'Enter')) flip();
          else if (flipped && key === '1') { recordAnswer(moduleId, item.id, false, 'Не вспомнил'); onComplete(); }
          else if (flipped && (key === '2' || key === 'Enter')) { recordAnswer(moduleId, item.id, true); onComplete(); }
        };
      }
    });

    // MODE 3: QUIZ (Тест 4 варианта)
    ModeRegistry.register('quiz', {
      name: 'Тест',
      icon: '⚡',
      supportsItem: () => true,
      render(container, ctx) {
        const { item, moduleId, moduleItems, onComplete } = ctx;
        let options = Array.isArray(item.options) && item.options.length >= 2 ? [...item.options] : null;
        if (!options && typeof item.stressIndex === 'number') {
          options = generateStressDistractors(item);
        }
        if (!options) {
          const others = moduleItems.filter(x => x.id !== item.id).map(x => x.back).sort(() => Math.random() - 0.5).slice(0, 3);
          options = [item.back, ...others];
        }
        if (getCfg().shuffleOptions) {
          options = shuffleArray(options);
        }

        let answered = false;
        container.innerHTML = `
          <div class="space-y-5">
            <div class="space-y-2">
              <div class="text-center text-xs uppercase tracking-wider font-semibold text-indigo-500">${escapeHtml(item.hint || 'Выбери правильный вариант')}</div>
              <div class="${adaptiveFontClass(item.front)}">${formatRichTaskText(item.front)}</div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${options.map((opt, idx) => `
                <button data-opt-idx="${idx}" class="quiz-opt text-left px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-indigo-500 font-semibold text-base transition flex items-center gap-3">
                  <span class="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs flex items-center justify-center font-bold shrink-0">${idx + 1}</span>
                  <span>${escapeHtml(opt)}</span>
                </button>
              `).join('')}
            </div>
            <div id="quizFeedback" class="hidden rounded-2xl p-4 border"></div>
          </div>
        `;

        const pick = (idx) => {
          if (answered) return;
          answered = true;
          const chosen = options[idx];
          const isCorrect = chosen === item.back;
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : chosen);

          container.querySelectorAll('.quiz-opt').forEach(btn => {
            const oIdx = Number(btn.dataset.optIdx);
            btn.disabled = true;
            if (options[oIdx] === item.back) {
              btn.classList.add('border-emerald-500', 'bg-emerald-500/15', 'text-emerald-600', 'dark:text-emerald-300');
            } else if (oIdx === idx && !isCorrect) {
              btn.classList.add('border-rose-500', 'bg-rose-500/15', 'text-rose-500');
            } else {
              btn.classList.add('opacity-50');
            }
          });

          const fb = container.querySelector('#quizFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">${isCorrect ? '✓ Верно!' : `✗ Правильно: ${escapeHtml(item.back)}`}</span>
              <button id="quizNextBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 mt-1.5">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#quizNextBtn').addEventListener('click', onComplete);
        };

        container.querySelectorAll('.quiz-opt').forEach(btn => {
          btn.addEventListener('click', () => pick(Number(btn.dataset.optIdx)));
        });

        return (key) => {
          if (!answered && /^[1-4]$/.test(key)) {
            const idx = Number(key) - 1;
            if (options[idx] !== undefined) pick(idx);
          } else if (answered && (key === ' ' || key === 'Enter')) {
            onComplete();
          }
        };
      }
    });

    // MODE 4: TYPING (Ввод ответа)
    ModeRegistry.register('typing', {
      name: 'Ввод',
      icon: '⌨️',
      supportsItem: () => true,
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        let answered = false;

        container.innerHTML = `
          <div class="space-y-5">
            <div class="space-y-2">
              <div class="text-center text-xs uppercase tracking-wider font-semibold text-indigo-500">${escapeHtml(item.hint || 'Введи правильный ответ')}</div>
              <div class="${adaptiveFontClass(item.front)}">${formatRichTaskText(item.front)}</div>
            </div>
            <form id="typingForm" class="flex flex-col sm:flex-row gap-2.5">
              <input id="typingInput" type="text" autocomplete="off" placeholder="Напиши ответ..." class="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition">Проверить</button>
            </form>
            <div id="typingFeedback" class="hidden rounded-2xl p-4 border"></div>
          </div>
        `;

        const input = container.querySelector('#typingInput');
        setTimeout(() => input.focus(), 50);

        container.querySelector('#typingForm').addEventListener('submit', (e) => {
          e.preventDefault();
          if (answered) { onComplete(); return; }
          const val = input.value.trim();
          if (!val) return;
          answered = true;
          const norm = s => getCfg().strictYo ? s.toLowerCase().trim() : s.toLowerCase().replace(/ё/g, 'е').trim();
          const isCorrect = norm(val) === norm(item.back);
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : val);

          input.disabled = true;
          const fb = container.querySelector('#typingFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">${isCorrect ? '✓ Верно!' : `✗ Правильно: ${escapeHtml(item.back)}`}</span>
              <button type="button" id="typingNextBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 mt-1.5">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#typingNextBtn').addEventListener('click', onComplete);
        });

        return (key) => {
          if (answered && key === 'Enter') onComplete();
        };
      }
    });


    // MODE 5: GAP CHOICE (Выбор буквы/части прямо в пропуске — Задания 9-15 ЕГЭ)
    ModeRegistry.register('gap_choice', {
      name: 'Пропуск (выбор)',
      icon: '🔤',
      supportsItem: (item) => Array.isArray(item.choices) && item.choices.length > 0,
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        const choices = getCfg().shuffleOptions ? shuffleArray(item.choices || []) : (item.choices || []);
        const parts = item.front.split(/\.\.|___|\[\.\.\.\]/);
        let answered = false;

        const wordHtml = parts.length > 1
          ? parts.map((p, i) => i < parts.length - 1
              ? `<span>${escapeHtml(p)}</span><span id="gapSlot" class="inline-block min-w-[2.2rem] px-2 py-0.5 mx-1 rounded-xl border-2 border-dashed border-indigo-500 bg-indigo-500/10 text-indigo-500 font-extrabold">?</span>`
              : `<span>${escapeHtml(p)}</span>`).join('')
          : `<span>${escapeHtml(item.front)}</span>`;

        container.innerHTML = `
          <div class="text-center space-y-6">
            <div class="text-xs uppercase tracking-wider font-semibold text-indigo-500 dark:text-indigo-400">
              Выбери правильную вставку ${item.hint ? `• ${escapeHtml(item.hint)}` : ''}
            </div>
            <div class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-relaxed py-2">${wordHtml}</div>
            <div class="flex flex-wrap items-center justify-center gap-2.5">
              ${choices.map((ch, idx) => `
                <button data-gap-opt="${idx}" class="vowel-pill px-5 py-3 rounded-xl border-2 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500 text-lg sm:text-xl font-extrabold transition cursor-pointer">
                  ${escapeHtml(ch)}
                </button>
              `).join('')}
            </div>
            <div id="gapChoiceFeedback" class="hidden rounded-2xl p-4 text-left border"></div>
          </div>
        `;

        const pick = (idx) => {
          if (answered) return;
          answered = true;
          const chosen = choices[idx];
          const isCorrect = chosen.toLowerCase() === item.back.toLowerCase();
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : chosen);

          const slot = container.querySelector('#gapSlot');
          if (slot) {
            slot.textContent = item.back;
            slot.className = `inline-block px-2 py-0.5 mx-1 rounded-xl border-2 font-extrabold ${isCorrect ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-rose-500 bg-rose-500/20 text-rose-500'}`;
          }

          container.querySelectorAll('[data-gap-opt]').forEach(btn => {
            const oIdx = Number(btn.dataset.gapOpt);
            btn.disabled = true;
            if (choices[oIdx].toLowerCase() === item.back.toLowerCase()) {
              btn.classList.add('border-emerald-500', 'bg-emerald-500/20', 'text-emerald-500');
            } else if (oIdx === idx && !isCorrect) {
              btn.classList.add('border-rose-500', 'bg-rose-500/20', 'text-rose-500');
            } else {
              btn.classList.add('opacity-45');
            }
          });

          const ansDisplay = item.fullAnswer ? `${item.fullAnswer} (${item.back})` : item.back;
          const fb = container.querySelector('#gapChoiceFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 text-left border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">${isCorrect ? '✓ Верно!' : `✗ Правильно: ${escapeHtml(ansDisplay)}`}</span>
              <button id="gapNextBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 mt-1.5">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#gapNextBtn').addEventListener('click', onComplete);
        };

        container.querySelectorAll('[data-gap-opt]').forEach(b => b.addEventListener('click', () => pick(Number(b.dataset.gapOpt))));
        return (key) => {
          if (!answered && /^[1-9]$/.test(key)) {
            const idx = Number(key) - 1;
            if (choices[idx] !== undefined) pick(idx);
          } else if (answered && (key === ' ' || key === 'Enter')) {
            onComplete();
          }
        };
      }
    });

    // MODE 6: GAP INPUT (Ввод пропущенной буквы прямо внутрь слова)
    ModeRegistry.register('gap_input', {
      name: 'Пропуск (ввод)',
      icon: '✏️',
      supportsItem: (item) => /\.\.|___|\[\.\.\.\]/.test(item.front),
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        const parts = item.front.split(/\.\.|___|\[\.\.\.\]/);
        let answered = false;

        const inlineHtml = parts.map((p, i) => i < parts.length - 1
          ? `<span>${escapeHtml(p)}</span><input id="inlineGapInput" type="text" autocomplete="off" maxlength="12" placeholder="_" class="inline-block w-16 sm:w-20 mx-1 px-2 py-1 text-center rounded-xl border-2 border-indigo-500 bg-indigo-500/10 text-2xl sm:text-3xl font-extrabold text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400" />`
          : `<span>${escapeHtml(p)}</span>`).join('');

        container.innerHTML = `
          <form id="gapInputForm" class="text-center space-y-6">
            <div class="text-xs uppercase tracking-wider font-semibold text-indigo-500 dark:text-indigo-400">
              Впиши пропущенную букву / буквы ${item.hint ? `• ${escapeHtml(item.hint)}` : ''}
            </div>
            <div class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-relaxed py-3 flex flex-wrap items-center justify-center">
              ${inlineHtml}
            </div>
            <button id="gapSubmitBtn" type="submit" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition">Проверить</button>
            <div id="gapInputFeedback" class="hidden rounded-2xl p-4 text-left border"></div>
          </form>
        `;

        const inp = container.querySelector('#inlineGapInput');
        if (inp) setTimeout(() => inp.focus(), 50);

        container.querySelector('#gapInputForm').addEventListener('submit', (e) => {
          e.preventDefault();
          if (answered) { onComplete(); return; }
          const val = (inp ? inp.value : '').trim();
          if (!val) return;
          answered = true;
          const norm = x => getCfg().strictYo ? x.toLowerCase().trim() : x.toLowerCase().replace(/ё/g, 'е').trim();
          const isCorrect = norm(val) === norm(item.back);
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : val);

          if (inp) {
            inp.disabled = true;
            inp.classList.remove('border-indigo-500', 'bg-indigo-500/10', 'text-indigo-500');
            inp.classList.add(
              isCorrect ? 'border-emerald-500' : 'border-rose-500',
              isCorrect ? 'bg-emerald-500/20' : 'bg-rose-500/20',
              isCorrect ? 'text-emerald-500' : 'text-rose-500'
            );
          }
          container.querySelector('#gapSubmitBtn').classList.add('hidden');

          const ansDisplay = item.fullAnswer ? `${item.fullAnswer} (${item.back})` : item.back;
          const fb = container.querySelector('#gapInputFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 text-left border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">${isCorrect ? '✓ Верно!' : `✗ Правильно: ${escapeHtml(ansDisplay)}`}</span>
              <button type="button" id="gapInNextBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 mt-1.5">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#gapInNextBtn').addEventListener('click', onComplete);
        });

        return (key) => {
          if (answered && (key === ' ' || key === 'Enter')) onComplete();
        };
      }
    });

    // MODE 7: DIGITS (Ввод цифр — Задания 8, 16-21, 22-26 ЕГЭ, без подсказки количества)
    ModeRegistry.register('digits', {
      name: 'Цифры',
      icon: '🔢',
      supportsItem: (item) => item.type === 'digits' || /\(\d+\)/.test(item.front),
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        let answered = false;
        const markers = Array.from(new Set((item.front.match(/\((\d+)\)/g) || []).map(m => m.replace(/\D/g, ''))));
        const selectedDigits = new Set();

        container.innerHTML = `
          <form id="digitsForm" class="space-y-5">
            <div class="text-center text-xs uppercase tracking-wider font-semibold text-indigo-500 dark:text-indigo-400">
              Укажите цифры ответа ${item.hint ? `• ${escapeHtml(item.hint)}` : ''}
            </div>
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 ${adaptiveFontClass(item.front)}">
              ${formatRichTaskText(item.front)}
            </div>
            ${markers.length ? `
              <div class="flex flex-wrap items-center justify-center gap-2">
                ${markers.map(d => `
                  <button type="button" data-digit-chip="${d}" class="w-10 h-10 rounded-xl border-2 border-slate-300 dark:border-slate-700 font-bold text-sm hover:border-indigo-500 transition">${d}</button>
                `).join('')}
              </div>
            ` : ''}
            <div class="flex gap-2.5">
              <input id="digitsInput" type="text" inputmode="numeric" autocomplete="off" placeholder="Например: 124" class="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button id="digitsSubmitBtn" type="submit" class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition">Проверить</button>
            </div>
            <div id="digitsFeedback" class="hidden rounded-2xl p-4 border"></div>
          </form>
        `;

        const inp = container.querySelector('#digitsInput');
        const syncInputFromChips = () => {
          inp.value = Array.from(selectedDigits).sort((a, b) => Number(a) - Number(b)).join('');
        };

        container.querySelectorAll('[data-digit-chip]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (answered) return;
            const d = btn.dataset.digitChip;
            if (selectedDigits.has(d)) {
              selectedDigits.delete(d);
              btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600');
            } else {
              selectedDigits.add(d);
              btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600');
            }
            syncInputFromChips();
          });
        });

        container.querySelector('#digitsForm').addEventListener('submit', (e) => {
          e.preventDefault();
          if (answered) { onComplete(); return; }
          const raw = inp.value.replace(/[^0-9]/g, '');
          if (!raw) return;
          answered = true;
          const normDigits = (str) => item.ordered ? str.replace(/[^0-9]/g, '') : Array.from(new Set(str.replace(/[^0-9]/g, '').split(''))).sort().join('');
          const isCorrect = normDigits(raw) === normDigits(item.back);
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : raw);

          inp.disabled = true;
          container.querySelector('#digitsSubmitBtn').classList.add('hidden');
          const fb = container.querySelector('#digitsFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">${isCorrect ? '✓ Верно!' : `✗ Правильный ответ: ${escapeHtml(item.back)}`}</span>
              <button type="button" id="digitsNextBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 mt-1.5">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#digitsNextBtn').addEventListener('click', onComplete);
        });

        return (key) => {
          if (answered && (key === ' ' || key === 'Enter')) onComplete();
        };
      }
    });

    // MODE 8: MULTI CHOICE (Несколько вариантов — Задания 9-12 ЕГЭ, без показа количества ответов)
    ModeRegistry.register('multi_choice', {
      name: 'Несколько ответов',
      icon: '☑️',
      supportsItem: (item) => Array.isArray(item.correctIndices) && Array.isArray(item.options),
      render(container, ctx) {
        const { item, moduleId, onComplete } = ctx;
        const rawOptions = (item.options || []).map((text, origIdx) => ({
          origIdx,
          cleanText: String(text).replace(/^\s*\d+[).]\s*/, ''),
          isCorrect: (item.correctIndices || []).includes(origIdx)
        }));
        const entries = getCfg().shuffleOptions ? shuffleArray(rawOptions) : rawOptions;
        const correctSet = new Set(entries.map((e, i) => e.isCorrect ? i : -1).filter(i => i >= 0));
        const pickedSet = new Set();
        let answered = false;

        container.innerHTML = `
          <div class="space-y-4">
            <div class="space-y-1.5">
              <div class="text-center text-xs uppercase tracking-wider font-semibold text-indigo-500">${escapeHtml(item.hint || 'Выбери все верные варианты')}</div>
              <div class="${adaptiveFontClass(item.front)}">${formatRichTaskText(item.front)}</div>
            </div>
            <div class="space-y-2">
              ${entries.map((ent, idx) => `
                <button type="button" data-mc-idx="${idx}" class="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-indigo-500 text-sm sm:text-base font-medium transition flex items-center gap-3">
                  <span class="mc-box w-5 h-5 rounded-md border-2 border-slate-400 flex items-center justify-center text-xs shrink-0"></span>
                  <span><b class="text-indigo-500 mr-1">${idx + 1})</b> ${escapeHtml(ent.cleanText)}</span>
                </button>
              `).join('')}
            </div>
            <div class="flex justify-end">
              <button id="mcSubmitBtn" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition">Проверить</button>
            </div>
            <div id="mcFeedback" class="hidden rounded-2xl p-4 border"></div>
          </div>
        `;

        container.querySelectorAll('[data-mc-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (answered) return;
            const idx = Number(btn.dataset.mcIdx);
            const box = btn.querySelector('.mc-box');
            if (pickedSet.has(idx)) {
              pickedSet.delete(idx);
              btn.classList.remove('border-indigo-500', 'bg-indigo-500/10');
              box.textContent = '';
              box.classList.remove('bg-indigo-600', 'border-indigo-600', 'text-white');
            } else {
              pickedSet.add(idx);
              btn.classList.add('border-indigo-500', 'bg-indigo-500/10');
              box.textContent = '✓';
              box.classList.add('bg-indigo-600', 'border-indigo-600', 'text-white');
            }
          });
        });

        container.querySelector('#mcSubmitBtn').addEventListener('click', () => {
          if (answered || pickedSet.size === 0) return;
          answered = true;
          const isCorrect = pickedSet.size === correctSet.size && Array.from(pickedSet).every(x => correctSet.has(x));
          const userLabel = Array.from(pickedSet).sort((a, b) => a - b).map(i => i + 1).join(', ');
          recordAnswer(moduleId, item.id, isCorrect, isCorrect ? null : userLabel);

          container.querySelector('#mcSubmitBtn').classList.add('hidden');
          container.querySelectorAll('[data-mc-idx]').forEach(btn => {
            const idx = Number(btn.dataset.mcIdx);
            btn.disabled = true;
            if (correctSet.has(idx)) {
              btn.classList.add('border-emerald-500', 'bg-emerald-500/15');
            } else if (pickedSet.has(idx)) {
              btn.classList.add('border-rose-500', 'bg-rose-500/15');
            }
          });

          const rightLabel = Array.from(correctSet).sort((a, b) => a - b).map(i => i + 1).join(', ');
          const fb = container.querySelector('#mcFeedback');
          fb.classList.remove('hidden');
          fb.className = `${isCorrect ? 'pop-in' : 'shake-err'} rounded-2xl p-4 border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`;
          fb.innerHTML = `
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">${isCorrect ? '✓ Верно!' : `✗ Правильные номера: ${escapeHtml(rightLabel)}`}</span>
              <button id="mcNextBtn" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Дальше →</button>
            </div>
            ${item.explanation ? `<p class="text-xs sm:text-sm opacity-90 mt-1.5">${escapeHtml(item.explanation)}</p>` : ''}
          `;
          fb.querySelector('#mcNextBtn').addEventListener('click', onComplete);
        });

        return (key) => {
          if (answered && (key === ' ' || key === 'Enter')) onComplete();
        };
      }
    });

    // MODE 9: AUTO (Автоматически выбирает нужный режим под тип карточки)
    function inferItemMode(item) {
      if (item.type && ModeRegistry.get(item.type)) return item.type;
      if (typeof item.stressIndex === 'number' && item.stressIndex >= 0) return 'stress';
      if (Array.isArray(item.choices) && item.choices.length) return 'gap_choice';
      if (Array.isArray(item.correctIndices) && Array.isArray(item.options)) return 'multi_choice';
      if (/\.\.|___|\[\.\.\.\]/.test(item.front)) return 'gap_input';
      if (/\(\d+\)/.test(item.front) && /^\d+$/.test(String(item.back).trim())) return 'digits';
      if (Array.isArray(item.options) && item.options.length >= 2) return 'quiz';
      return 'flashcard';
    }

    ModeRegistry.register('auto', {
      name: 'По заданию',
      icon: '🧩',
      supportsItem: () => true,
      render(container, ctx) {
        const targetModeId = inferItemMode(ctx.item);
        const modeDef = ModeRegistry.get(targetModeId) || ModeRegistry.get('flashcard');
        return modeDef.render(container, ctx);
      }
    });

    // =========================================================================
