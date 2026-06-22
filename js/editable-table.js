class EditableTable {
    /**
     * @param {string} tbodyId - ID тела таблицы
     * @param {object} callbacks - Объект с функциями обратного вызова
     */
    constructor(tbodyId, callbacks = {}) {
        this.tbody = document.getElementById(tbodyId);
        if (!this.tbody) return;

        this.onSave = callbacks.onSave;
        this.onRowSelect = callbacks.onRowSelect;
        this.onRowEdit = callbacks.onRowEdit;
        this.onRowCancel = callbacks.onRowCancel;
        this.onValidateRow = callbacks.onValidateRow; 
        
        this.localeSeparator = (1.1).toLocaleString().substring(1, 2); 
        this.forbiddenSeparator = this.localeSeparator === ',' ? '.' : ',';

        this.initialRowDataJson = null;
        this.initialFieldsValues = []; 
        this.activeRowId = null;
        this.currentFieldIndex = null;

        this.formatTableOnLoad();
        this.initEvents();
        this.initFabMenu();
    }

    initEvents() {
        // Обычные события таблицы
        this.tbody.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
        this.tbody.addEventListener('click', (e) => this.handleRowClick(e));

        // РЕШЕНИЕ ДЛЯ ESC: Слушаем его глобально на уровне документа. Браузер не сможет его скрыть!
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeRowId) {
                const activeTr = this.tbody.querySelector(`tr[data-id="${this.activeRowId}"]`);
                if (activeTr && (activeTr.contains(document.activeElement) || activeTr.querySelector('.input-error'))) {
                    this.resetRowChanges(activeTr);
                }
            }
        });
    }

    // Вынесли сброс по Esc в отдельный чистый метод
    resetRowChanges(row) {
        row.querySelectorAll('.table-input, .table-select').forEach(field => {
            field.classList.remove('input-error');
            if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
        });

        const fields = row.querySelectorAll('.table-input, .table-select');
        fields.forEach((field, index) => {
            if (this.initialFieldsValues[index] !== undefined) {
                field.value = this.initialFieldsValues[index];
            }
        });

        const rowId = row.getAttribute('data-id');
        if (typeof this.onRowCancel === 'function') this.onRowCancel(rowId, row);
        
        if (document.activeElement) document.activeElement.blur();
        this.initialRowDataJson = this.collectRowData(row);
    }

    formatTableOnLoad() {
    // Если передали конкретную строку (например, новую) — форматируем только её поля.
    // Если ничего не передали — форматируем, как обычно, весь tbody.
    const container = targetRow || this.tbody || this.table;
    if (!container) return;

    const fields = container.querySelectorAll('.table-input');
        fields.forEach(field => {
            if (field.getAttribute('inputmode') === 'decimal' && field.value !== '') {
                let val = field.value.replace('.', this.localeSeparator);
                const step = field.getAttribute('step');
                
                if (step && step.includes('.')) {
                    // ИСПРАВЛЕНО: берем длину именно дробной части (индекс 1)
                    const decimalsCount = step.split('.')[1]?.length;
                    const parsedNum = parseFloat(val.replace(this.localeSeparator, '.'));
                    if (!isNaN(parsedNum)) {
                        val = parsedNum.toFixed(decimalsCount).replace('.', this.localeSeparator);
                    }
                }
                field.value = val;
            }
        });
    }

    initFabMenu() {
        const container = document.getElementById('tableFabContainer');
        const mainBtn = document.getElementById('fabMainBtn');
        
        if (!container || !mainBtn) return;

        // 1. Тогл открытия/закрытия меню
        mainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isSaving) return; // Блокируем интерфейс при сохранении
            container.classList.toggle('open');
            mainBtn.textContent = container.classList.contains('open') ? '❌' : '⚙️';
        });

        // 2. Закрытие меню при клике в любое другое место экрана
        document.addEventListener('click', () => {
            container.classList.remove('open');
            mainBtn.textContent = '⚙️';
        });

        // 3. Делегирование кликов на кнопки действий
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.fab-btn');
            if (!btn) return;
            
            const action = btn.dataset.action;
            if (action === 'add-row') {
                this.addRow();
            }
        });
    }

    addRow() {
    if (this.isSaving) return;

        const tableElement = this.table || this.tableEl || this.el || document.querySelector('.project-table');
        if (!tableElement) {
            console.error("EditableTable: Элемент .project-table не найден.");
            return;
        }

        // ПРОВЕРКА: Если в таблице УЖЕ есть новая несохраненная строка
        const existingNewRow = tableElement.querySelector('tr[data-id="null"]');
        if (existingNewRow) {
            // Вместо создания новой, просто переводим фокус на первую ячейку существующей новой строки
            const firstField = existingNewRow.querySelector('input:not([disabled]), [contenteditable="true"]');
            if (firstField) {
                firstField.focus();
                if (firstField.select) firstField.select();
            }
            return; // Блокируем создание второй строки
        }        

        // Проверка валидности текущей строки перед созданием новой
        if (document.activeElement && tableElement.contains(document.activeElement)) {
            const currentCell = document.activeElement.closest('td');
            if (currentCell) {
                const currentRow = currentCell.closest('tr');
                if (currentRow && typeof this.onValidateRow === 'function') {
                    if (!this.onValidateRow(currentRow)) return; 
                }
            }
        }

        const tbody = tableElement.querySelector('tbody') || tableElement;
        
        // Находим последнюю существующую строку, чтобы использовать её как шаблон
        const lastRow = tbody.querySelector('tr:last-child');
        if (!lastRow) {
            console.error("EditableTable: Не удалось найти шаблонную строку (tr) в таблице для клонирования.");
            return;
        }

        // Клонируем строку со всей внутренней структурой ячеек
        const tr = lastRow.cloneNode(true);

        // Маркируем новую строку для сервера и логики rollback
        tr.dataset.id = 'null'; 

        // Очищаем значения во всех текстовых полях и инпутах новой строки
        const inputs = tr.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = ''; // Очищаем текст/числа
            }
            input.removeAttribute('disabled'); // Снимаем блокировку, если была
        });

        // Очищаем ячейки, если у вас используется contenteditable="true"
        const editables = tr.querySelectorAll('[contenteditable="true"]');
        editables.forEach(cell => {
            cell.textContent = '';
        });

        // Добавляем новую чистую строку в конец таблицы
        tbody.appendChild(tr);

        // Автоскролл контейнера вниз
        const container = tableElement.closest('.table-container-fixed');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }

        // Навешиваем ваши стандартные обработчики событий на новую строку, если это необходимо
        if (typeof this.bindRowEvents === 'function') {
            this.bindRowEvents(tr);
        } else if (typeof this.initListeners === 'function') {
            // Если у вас глобальное делегирование событий на уровне всей таблицы, 
            // то повторно навешивать события на строку не нужно — они поймаются сами
        }

        // Автофокус на первую редактируемую ячейку новой строки
        const firstEditableField = tr.querySelector('input:not([disabled]), [contenteditable="true"]');
        if (firstEditableField) {
            setTimeout(() => {
                firstEditableField.focus();
                if (firstEditableField.select) firstEditableField.select(); 
            }, 50);
        }
    } 
    
    // Вспомогательный метод для проверки строки перед уходом фокуса на новую строку
    validateRowBeforeLeave(row) {
        if (typeof this.onValidateRow === 'function') {
            // Передаем строку или данные в ваш кастомный валидатор
            return this.onValidateRow(row); 
        }
        return true;
    }


    collectRowData(row) {
        const fields = row.querySelectorAll('.table-input, .table-select');
        return Array.from(fields).map(field => field.value).join('|');
    }

    handleFocusIn(event) {
        const currentRow = event.target.closest('tr');
        if (!currentRow) return;

        const fields = currentRow.querySelectorAll('.table-input, .table-select');
        this.currentFieldIndex = Array.from(fields).indexOf(event.target);

        if (this.activeRowId !== currentRow.getAttribute('data-id')) {
            this.initialRowDataJson = this.collectRowData(currentRow);
            this.initialFieldsValues = Array.from(fields).map(field => field.value);
            this.checkRowSelection(currentRow);
        }
    }

    handleNumericInput(event) {
        const input = event.target;
        const currentRow = input.closest('tr');
        
        if (currentRow) {
            const currentSnapshot = this.collectRowData(currentRow);
            const rowId = currentRow.getAttribute('data-id');
            if (this.initialRowDataJson !== currentSnapshot) {
                if (typeof this.onRowEdit === 'function') this.onRowEdit(rowId, currentRow);
            } else {
                if (typeof this.onRowSelect === 'function') this.onRowSelect(rowId, currentRow);
            }
        }

        if (!input.classList.contains('table-input') || input.style.textAlign === 'left') return;

        const step = input.getAttribute('step');
        const isFloat = step && step.includes('.');
        const hasMinus = input.value.startsWith('-');

        if (!isFloat) {
            let value = input.value.replace(/[^0-9]/g, '');
            if (hasMinus) value = '-' + value;

            if (input.value !== value) {
                const start = input.selectionStart;
                input.value = value;
                input.setSelectionRange(start, start);
            }
            return;
        }

        const regexForbidden = new RegExp(`\\${this.forbiddenSeparator}`, 'g');
        let value = input.value.replace(regexForbidden, this.localeSeparator);

        const regexClean = new RegExp(`[^0-9\\${this.localeSeparator}]`, 'g');
        value = value.replace(regexClean, '');
        
        const parts = value.split(this.localeSeparator);
        if (parts.length > 2) {
            value = parts[0] + this.localeSeparator + parts.slice(1).join('');
        }

        if (hasMinus) value = '-' + value;

        if (input.value !== value) {
            const start = input.selectionStart;
            input.value = value;
            input.setSelectionRange(start, start);
        }
    }
	
    handleRowClick(event) {
        // БЛОКИРОВКА: Если идет сохранение на сервер, полностью игнорируем любые клики
        if (this.isSaving) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const targetRow = event.target.closest('tr');
        if (!targetRow) return;

        const activeElement = document.activeElement;
        const currentRow = activeElement ? activeElement.closest('tr') : null;

        if (currentRow && currentRow !== targetRow) {
            if (!this.validateCurrentRow(currentRow)) {
                event.preventDefault();
                event.stopPropagation();
                const firstInput = currentRow.querySelector('.table-input');
                if (firstInput) {
                    firstInput.focus();
                    firstInput.select();
                }
                return;
            }
        }
        this.checkRowSelection(targetRow);
    }

    checkRowSelection(row) {
        // БЛОКИРОВКА: Не меняем активную строку во время сохранения
        if (this.isSaving) return;

        const rowId = row.getAttribute('data-id');
        if (this.activeRowId !== rowId) {
            this.activeRowId = rowId;
            if (typeof this.onRowSelect === 'function') {
                this.onRowSelect(rowId, row);
            }
        }
    }

    validateCurrentRow(row) {
        if (!row) return true;
        const rowId = row.getAttribute('data-id');

        row.querySelectorAll('.table-input').forEach(input => {
            if (input.classList.contains('input-error') && !input.hasAttribute('min') && !input.hasAttribute('max') && !input.hasAttribute('data-validator')) {
                input.classList.remove('input-error');
                input.setCustomValidity('');
            }
        });

        if (row.querySelector('.input-error')) return false;

        if (this.onValidateRow) {
            const rowError = this.onValidateRow(rowId, row);
            if (rowError) {
                const firstInput = row.querySelector('.table-input');
                if (firstInput) this.showValidationError(firstInput, rowError);
                return false; 
            }
        }
        return true; 
    }

    showValidationError(input, message) {
        input.classList.add('input-error');
        input.setCustomValidity(message);
        input.reportValidity();
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    }

    handleKeyDown(event) {
        // БЛОКИРОВКА: Запрещаем клавиатуру во время сохранения
        if (this.isSaving) {
            event.preventDefault();
            return;
        }

        const input = event.target;
        const currentRow = input.closest('tr');
        
        if (event.key === 'Escape' && currentRow) {
            event.preventDefault();

            const rowId = currentRow.getAttribute('data-id');

            // Проверка на новую строку
            if (rowId === 'null') {
                // Находим строку выше, чтобы безопасно вернуть фокус
                const previousRow = currentRow.previousElementSibling;
                if (previousRow) {
                    const prevField = previousRow.querySelector('.table-input, .table-select, input, [contenteditable="true"]');
                    if (prevField) prevField.focus();
                } else {
                    input.blur();
                }

                // Вызываем колбэк отмены, чтобы внешняя логика знала об удалении строки
                if (typeof this.onRowCancel === 'function') {
                    this.onRowCancel(rowId, currentRow);
                }

                // Удаляем строку из таблицы
                currentRow.remove();
                return; // Завершаем выполнение, старый код отката для этой строки не нужен
            }

            currentRow.querySelectorAll('.table-input, .table-select').forEach(field => {
                field.classList.remove('input-error');
                if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
            });

            const fields = currentRow.querySelectorAll('.table-input, .table-select');
            fields.forEach((field, index) => {
                if (this.initialFieldsValues[index] !== undefined) {
                    field.value = this.initialFieldsValues[index];
                }
            });

            if (typeof this.onRowCancel === 'function') {
                this.onRowCancel(rowId, currentRow);
            }
            
            input.blur();
            this.initialRowDataJson = this.collectRowData(currentRow);
            return;
        }

        if (!input.classList.contains('table-input') && !input.classList.contains('table-select')) return;

        const td = input.closest('td');
        const tr = input.closest('tr');
        const colIndex = Array.from(tr.children).indexOf(td);
        let targetInput = null;

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                const prevRow = tr.previousElementSibling;
                if (prevRow) targetInput = prevRow.children[colIndex]?.querySelector('.table-input, .table-select');
                break;
            case 'ArrowDown':
                event.preventDefault();
                const nextRow = tr.nextElementSibling;
                if (nextRow) targetInput = nextRow.children[colIndex]?.querySelector('.table-input, .table-select');
                break;
            case 'ArrowLeft':
                if (input.tagName === 'SELECT' || input.selectionStart === 0) {
                    if (input.tagName === 'SELECT') event.preventDefault(); 
                    const prevTd = td.previousElementSibling;
                    targetInput = prevTd?.querySelector('.table-input, .table-select');
                }
                break;
            case 'ArrowRight':
                if (input.tagName === 'SELECT' || input.selectionStart === input.value.length) {
                    if (input.tagName === 'SELECT') event.preventDefault(); 
                    const nextTd = td.nextElementSibling;
                    targetInput = nextTd?.querySelector('.table-input, .table-select');
                }
                break;
            case 'Enter':
                event.preventDefault();
                if (event.ctrlKey) {
                    const prevTd = td.previousElementSibling;
                    targetInput = prevTd?.querySelector('.table-input, .table-select');
                } else {
                    const nextTd = td.nextElementSibling;
                    targetInput = nextTd?.querySelector('.table-input, .table-select');
                }
                break;
        }

        if (targetInput) {
            const currentRowNav = input.closest('tr');
            const targetRow = targetInput.closest('tr');

            if (currentRowNav && targetRow && currentRowNav !== targetRow) {
                if (!this.validateCurrentRow(currentRowNav)) {
                    event.preventDefault();
                    return;
                }
            }

            targetInput.focus();
            if (targetInput.tagName === 'INPUT') setTimeout(() => targetInput.select(), 0);
        }
    }

    handleFocusIn(event) {
        // БЛОКИРОВКА: Игнорируем фокус во время сохранения
        if (this.isSaving) {
            event.target.blur();
            return;
        }

        const currentRow = event.target.closest('tr');
        if (!currentRow) return;

        const fields = currentRow.querySelectorAll('.table-input, .table-select');
        this.currentFieldIndex = Array.from(fields).indexOf(event.target);

        if (this.activeRowId !== currentRow.getAttribute('data-id')) {
            this.initialRowDataJson = this.collectRowData(currentRow);
            this.initialFieldsValues = Array.from(fields).map(field => field.value);
            this.checkRowSelection(currentRow);
        }
    }

    handleFocusOut(event) {
        // БЛОКИРОВКА: Если класс уже в режиме сохранения, не запускаем focusout повторными кругами
        if (this.isSaving) return;

        const input = event.target;
        const currentRow = input.closest('tr');
        const nextElement = event.relatedTarget;
        const nextRow = nextElement ? nextElement.closest('tr') : null;

        if (!input.classList.contains('table-input')) {
            if (!nextRow || nextRow !== currentRow) {
                if (this.validateCurrentRow(currentRow)) this.triggerSave(currentRow);
            }
            return;
        }

        if (input.value.trim() === '') {
            if (this.currentFieldIndex !== null && this.initialFieldsValues[this.currentFieldIndex] !== undefined) {
                input.value = this.initialFieldsValues[this.currentFieldIndex];
                input.classList.remove('input-error');
            }
        } 
        else if (input.getAttribute('inputmode') === 'decimal') {
            const standardValue = input.value.replace(this.localeSeparator, '.');
            const parsedNum = parseFloat(standardValue);
            
            if (!isNaN(parsedNum)) {
                const min = input.getAttribute('min');
                const max = input.getAttribute('max');
                const validatorName = input.getAttribute('data-validator');
                let customError = null;
                
                if (validatorName && typeof window[validatorName] === 'function') {
                    customError = window[validatorName](parsedNum, currentRow);
                }

                if ((min !== null && parsedNum < parseFloat(min)) || (max !== null && parsedNum > parseFloat(max)) || customError) {
                    let msg = customError || (min !== null && max !== null ? `От ${min} до ${max}` : (min !== null ? `Не меньше ${min}` : `Не больше ${max}`));
                    this.showValidationError(input, msg);
                    return;
                }

                input.classList.remove('input-error');
                input.setCustomValidity(''); 

                const step = input.getAttribute('step');
                if (step && step.includes('.')) {
                    const decimalsCount = step.split('.').length;
                    input.value = parsedNum.toFixed(decimalsCount).replace('.', this.localeSeparator);
                }
            }
        }

        if (!nextRow || nextRow !== currentRow) {
            if (currentRow && currentRow.querySelector('.input-error')) return;
            if (this.validateCurrentRow(currentRow)) this.triggerSave(currentRow);
        }
    }

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        const currentDataJson = this.collectRowData(row);

        if (this.initialRowDataJson === currentDataJson) return;
        
        // Включаем режим сохранения (блокируем всю таблицу)
        this.isSaving = true;
        const backupValues = [...this.initialFieldsValues];
        
        // Запоминаем индекс поля, на котором фокус был прямо перед сохранением
        const lastFocusedFieldIndex = this.currentFieldIndex;

        // Функция отката
        const rollback = () => {
            // ВАЖНО: Исправлены кавычки на косые (``), чтобы переменная ${rowId} выводилась корректно
            console.warn(`Ошибка сохранения строки ${rowId}. Выполняется откат изменений...`);
            
            // Выключаем блокировку сохранения, так как процесс завершен
            this.isSaving = false;
            this.activeRowId = rowId;
            
            const fields = row.querySelectorAll('.table-input, .table-select');
            fields.forEach((field, index) => {
                if (backupValues[index] !== undefined) {
                    field.value = backupValues[index];
                }
            });
            
            row.style.backgroundColor = '#fef2f2';
            setTimeout(() => { row.style.backgroundColor = ''; }, 1000);
            
            this.initialRowDataJson = this.collectRowData(row);
            
            // Триггерим отмену, чтобы внешние скрипты вернули иконку ➔
            if (typeof this.onRowCancel === 'function') {
                this.onRowCancel(rowId, row);
            }

            // НОВОЕ: Автоматически возвращаем фокус на последний редактируемый элемент строки
            if (lastFocusedFieldIndex !== null && fields[lastFocusedFieldIndex]) {
                const targetField = fields[lastFocusedFieldIndex];
                
                // Делаем микротамаут, чтобы браузер успел обработать разблокировку isSaving
                setTimeout(() => {
                    targetField.focus();
                    if (targetField.tagName === 'INPUT') {
                        targetField.select(); // Выделяем текст для удобного переввода
                    }
                }, 50);
            }
        };

        if (typeof this.onSave === 'function') {
            const rawFields = row.querySelectorAll('.table-input, .table-select');
            const data = Array.from(rawFields).map(f => f.value);
            
            // Передаем по вашей новой сигнатуре: id, row, data, rollback, success
            const success = () => {
                this.isSaving = false; 
                this.initialRowDataJson = this.collectRowData(row);
            };
            this.onSave(rowId, row, data, rollback, success);
        } 
        else {
            this.isSaving = false;
        }
    }
}		

// Вспомогательная функция отрисовки статуса (живет в HTML-скрипте страницы)
function setVisualStatus(tbodyId, activeRow, icon) {
    // Очищаем индикаторы у всех строк в этой таблице
    document.querySelectorAll(`#${tbodyId} tr`).forEach(tr => {
        const indicator = tr.querySelector('.row-indicator');
        if (indicator) indicator.textContent = '';
    });

    // Ставим нужную иконку активной строке
    if (activeRow) {
        let indicator = activeRow.querySelector('.row-indicator');
        if (!indicator) {
            // Если тега для иконки еще нет в первом td, создаем его
            indicator = document.createElement('span');
            indicator.className = 'row-indicator';
            indicator.style.marginRight = '5px';
            activeRow.children[0].insertBefore(indicator, activeRow.children[0].firstChild);
        }
        indicator.textContent = icon;
    }
}
