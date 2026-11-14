// LexisCore — Умный алгоритм интервального повторения и отработки ошибок

// 2. TOASTS & MODALS (No alert/confirm/prompt)
    // =========================================================================
    function showToast(msg, type = 'info') {
      const el = document.createElement('div');
      const colors = {
        info: 'bg-slate-900 text-white dark:bg-slate-800 border-slate-700',
        success: 'bg-emerald-600 text-white border-emerald-500',
        error: 'bg-rose-600 text-white border-rose-500',
        warn: 'bg-amber-500 text-slate-950 border-amber-400'
      };
      el.className = `pointer-events-auto px-4 py-2.5 rounded-xl border shadow-lg text-sm font-medium transition-all duration-200 ${colors[type] || colors.info}`;
      el.textContent = msg;
      document.getElementById('toastContainer').appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => el.remove(), 220);
      }, 2600);
    }

    function openModal(title, html) {
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalBody').innerHTML = html;
      document.getElementById('modalOverlay').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.add('hidden');
    }

    // =========================================================================
    // 3. SMART ERROR & GRADUAL EXPANSION ENGINE (For 1000+ word packs)
    // =========================================================================
    const MASTERY_STREAK = 3; // 3 correct answers in a row -> word graduates to "Mastered" (spaced review)

    function getItemStat(moduleId, itemId) {
      if (!state.stats[moduleId]) state.stats[moduleId] = {};
      if (!state.stats[moduleId][itemId]) {
        state.stats[moduleId][itemId] = {
          attempts: 0,
          totalErrors: 0,
          activeError: 0, // Error debt: must answer correctly N times to resolve!
          streak: 0,
          favorite: false,
          lastWrong: null,
          nextReview: 0,
          inWork: false // True once introduced into the active working set
        };
      }
      const st = state.stats[moduleId][itemId];
      // Migrate v1 stats cleanly
      if (st.totalErrors === undefined) st.totalErrors = st.errors || 0;
      if (st.activeError === undefined) st.activeError = st.errors > 0 ? Math.min(st.errors, 2) : 0;
      if (st.inWork === undefined) st.inWork = st.attempts > 0;
      return st;
    }

    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function recordAnswer(moduleId, itemId, isCorrect, wrongLabel = null) {
      const st = getItemStat(moduleId, itemId);
      st.attempts += 1;
      state.stepCounter = (state.stepCounter || 0) + 1;
      const step = state.stepCounter;
      const now = Date.now();

      const cfg = getCfg();
      playTone(isCorrect);
      if (isCorrect) {
        st.streak += 1;
        session.sessionStreak += 1;

        if (st.activeError > 0) {
          st.activeError -= 1;
          if (st.activeError === 0) {
            showToast('✓ Ошибка отработана и закрыта!', 'success');
          }
        }

        const cooldown = st.streak === 1 ? randInt(5, 9)
          : st.streak === 2 ? randInt(12, 20)
          : randInt(25, 45);
        st.dueAtStep = step + cooldown;

        const mins = [1, 10, 120, 1440, 4320, 10080][Math.min(st.streak - 1, 5)];
        st.nextReview = now + mins * 60000;
      } else {
        st.totalErrors += 1;
        st.activeError = Math.min((st.activeError || 0) + (cfg.errorDebtAdd || 2), cfg.errorDebtMax || 3);
        st.streak = 0;
        session.sessionStreak = 0;
        st.lastWrong = wrongLabel || 'Ошибка';

        const cMin = Math.min(cfg.errCooldownMin || 5, cfg.errCooldownMax || 14);
        const cMax = Math.max(cfg.errCooldownMin || 5, cfg.errCooldownMax || 14);
        st.dueAtStep = step + randInt(cMin, cMax);
        st.nextReview = now;
      }

      if (state.dailyLog.date !== todayKey()) {
        state.dailyLog = { date: todayKey(), count: 0 };
      }
      state.dailyLog.count += 1;
      saveState();
      updateBadges();
    }

    function toggleFavorite(moduleId, itemId) {
      const st = getItemStat(moduleId, itemId);
      st.favorite = !st.favorite;
      saveState();
      updateBadges();
      return st.favorite;
    }

    function pickSmartItem(allEligible, scope, lastItemId = null) {
      if (!allEligible.length) return { picked: null, isReviewInjection: false };
      const step = state.stepCounter || 0;

      if (scope === 'errors') {
        const errPool = allEligible.filter(e => getItemStat(e.moduleId, e.item.id).activeError > 0);
        if (!errPool.length) return { picked: null, isReviewInjection: false };
        // Prefer errors whose cooldown has passed, fallback to any active error
        const ready = errPool.filter(e => (getItemStat(e.moduleId, e.item.id).dueAtStep || 0) <= step);
        const pool = ready.length ? ready : errPool;
        const picked = weightedRandomPick(pool, lastItemId, e => {
          const st = getItemStat(e.moduleId, e.item.id);
          return 1 + st.activeError * 2 + (st.favorite ? 1 : 0);
        });
        return { picked, isReviewInjection: false };
      }

      if (scope === 'favorites') {
        const favPool = allEligible.filter(e => getItemStat(e.moduleId, e.item.id).favorite);
        if (!favPool.length) return { picked: null, isReviewInjection: false };
        const ready = favPool.filter(e => (getItemStat(e.moduleId, e.item.id).dueAtStep || 0) <= step);
        const pool = ready.length ? ready : favPool;
        const picked = weightedRandomPick(pool, lastItemId, e => {
          const st = getItemStat(e.moduleId, e.item.id);
          return 1 + st.activeError * 2;
        });
        return { picked, isReviewInjection: false };
      }

      if (scope === 'new') {
        const newPool = allEligible.filter(e => getItemStat(e.moduleId, e.item.id).attempts === 0);
        if (!newPool.length) return { picked: null, isReviewInjection: false };
        const chunk = newPool.slice(0, 20);
        const picked = weightedRandomPick(chunk, lastItemId, () => 1);
        return { picked, isReviewInjection: false };
      }

      // SMART MODE ('all'):
      // 1. Due error words (cooldown 5-14 steps already elapsed -> feels natural, not repetitive!)
      // 2. Sliding active horizon of unseen/learning words (so 3000+ word JSONs expand smoothly)
      // 3. Occasional return to old mastered words (~15% chance or when due)
      const dueErrors = [];
      const learningReady = [];
      const unseen = [];
      const masteredReady = [];
      const masteredAll = [];

      const cfg = getCfg();
      const targetMastery = cfg.masteryStreak || MASTERY_STREAK;
      for (const entry of allEligible) {
        const st = getItemStat(entry.moduleId, entry.item.id);
        const isReady = (st.dueAtStep || 0) <= step;

        if (st.activeError > 0 && isReady) {
          dueErrors.push(entry);
        } else if (st.attempts === 0) {
          unseen.push(entry);
        } else if (st.streak < targetMastery) {
          if (isReady) learningReady.push(entry);
        } else {
          masteredAll.push(entry);
          if (isReady) masteredReady.push(entry);
        }
      }

      const errProb = (cfg.errorReturnChance ?? 65) / 100;
      if (dueErrors.length && Math.random() < errProb) {
        const picked = weightedRandomPick(dueErrors, lastItemId, e => {
          const st = getItemStat(e.moduleId, e.item.id);
          return 1 + st.activeError * 2;
        });
        return { picked, isReviewInjection: false };
      }

      const oldProb = (cfg.oldReviewChance ?? 20) / 100;
      if (masteredAll.length && (masteredReady.length > 0 && Math.random() < oldProb || Math.random() < oldProb * 0.5)) {
        const revPool = masteredReady.length ? masteredReady : masteredAll;
        const picked = weightedRandomPick(revPool, lastItemId, () => 1);
        return { picked, isReviewInjection: true };
      }

      const hSize = cfg.horizonSize || 15;
      const horizon = [...learningReady, ...unseen.slice(0, hSize)];
      if (horizon.length) {
        const picked = weightedRandomPick(horizon, lastItemId, e => {
          const st = getItemStat(e.moduleId, e.item.id);
          return st.attempts === 0 ? 1.4 : (1.8 + st.activeError);
        });
        return { picked, isReviewInjection: false };
      }

      // Fallback if all words are on cooldown (e.g. very small deck)
      const picked = weightedRandomPick(allEligible, lastItemId, e => {
        const st = getItemStat(e.moduleId, e.item.id);
        return 1 + st.activeError * 2;
      });
      return { picked, isReviewInjection: false };
    }

    function weightedRandomPick(pool, lastItemId, weightFn) {
      if (!pool.length) return null;
      const filtered = pool.length > 1 && lastItemId ? pool.filter(x => x.item.id !== lastItemId) : pool;
      const weights = filtered.map(x => Math.max(weightFn(x), 0.2));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < filtered.length; i++) {
        r -= weights[i];
        if (r <= 0) return filtered[i];
      }
      return filtered[filtered.length - 1];
    }

    // =========================================================================
