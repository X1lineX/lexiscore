// LexisCore — Инициализация приложения и глобальные обработчики событий

// 9. FILE INPUTS & GLOBAL EVENTS
    // =========================================================================
    async function handleFileList(files) {
      let addedCount = 0;
      for (const file of Array.from(files)) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.zip')) {
          if (typeof JSZip === 'undefined') {
            showToast('Библиотека ZIP не загрузилась (проверь интернет для CDN)', 'error');
            continue;
          }
          try {
            const zip = await JSZip.loadAsync(file);
            const zipBase = file.name.replace(/\.zip$/i, '');
            const entries = Object.values(zip.files).filter(f =>
              !f.dir && f.name.toLowerCase().endsWith('.json') && !f.name.includes('__MACOSX')
            );
            if (!entries.length) {
              showToast(`В архиве ${file.name} не найдено .json файлов`, 'warn');
              continue;
            }
            for (const entry of entries) {
              try {
                const text = await entry.async('string');
                const parsed = JSON.parse(text);
                const parts = entry.name.split('/').filter(Boolean);
                const folder = parts.length > 1 ? parts.slice(0, -1).join(' / ') : zipBase;
                addToDownloaded(parsed, folder);
                addedCount++;
              } catch (e) {
                // Skip invalid JSON inside archive
              }
            }
          } catch (err) {
            showToast(`Ошибка архива ${file.name}: ${err.message}`, 'error');
          }
        } else if (lower.endsWith('.json')) {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            addToDownloaded(parsed, parsed.category || 'Общая папка');
            addedCount++;
          } catch (err) {
            showToast(`Ошибка в ${file.name}: ${err.message}`, 'error');
          }
        }
      }
      if (addedCount > 0) {
        saveState();
        updateBadges();
        state.activeTab = 'downloads';
        render();
        showToast(`Загружено в «Скачанное»: ${addedCount} блок(ов)`, 'success');
      }
    }

    document.getElementById('jsonFileInput').addEventListener('change', (e) => {
      handleFileList(e.target.files);
      e.target.value = '';
    });

    document.getElementById('backupFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!Array.isArray(parsed.modules)) throw new Error('Неверный файл бэкапа');
          state = { ...defaultState(), ...parsed };
          saveState();
          applyTheme(state.theme);
          closeModal();
          render();
          showToast('Прогресс и блоки восстановлены!', 'success');
        } catch (err) {
          showToast(err.message || 'Ошибка чтения бэкапа', 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    });

    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        saveState();
        render();
      });
    });

    const toggleTheme = () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      saveState();
    };
    document.getElementById('themeToggleDesktop').addEventListener('click', toggleTheme);
    document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

    // Кнопка промпта ИИ перенесена в Настройки (спойлер)
    document.getElementById('editDailyGoalBtn').addEventListener('click', openDailyGoalModal);
    document.getElementById('editDailyGoalMobile').addEventListener('click', openDailyGoalModal);
    document.getElementById('openCloudModalBtn').addEventListener('click', openCloudAccountModal);
    document.getElementById('openCloudModalMobile').addEventListener('click', openCloudAccountModal);
    document.getElementById('openBackupModalBtn').addEventListener('click', openBackupModal);
    document.getElementById('openBackupModalMobile').addEventListener('click', openBackupModal);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (session.keyHandler) session.keyHandler(e);
    });

    loadCloudMeta();
    loadState();
    render();
