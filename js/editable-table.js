class EditableTable {
    /**
     * @param {string} tbodyId - ID тела таблицы
     * @param {function} onSaveCallback - Функция сохранения при изменении строки
     * @param {function} [onRowSelectCallback] - ОПЦИОНАЛЬНО: Функция, вызываемая при выборе (переходе на) строки
     */
    constructor(tbodyId, onSaveCallback, onRowSelectCallback = null) {
        this.tbody = document.getElementById(tbodyId);
        if (!this.tbody) return;

        this.onSave = onSaveCallback;
        this.onRowSelect = onRowSelectCallback; // Наш новый обработчик выбора
        
        this.localeSeparator = (1.1).toLocaleString().substring(1, 2); 
        this.forbiddenSeparator = this.localeSeparator === ',' ? '.' : ',';

        this.initialRowDataJson = null;
        this.activeRowId = null; // Запоминаем текущую выделенную строку

        this.initEvents();
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleNavigation(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
        
        // Переход по клику для обработки выбора строки (даже если кликнули мимо инпутов)
        this.tbody.addEventListener('click', (e) => this.handleRowClick(e));
    }

    collectRowData(row) {
        const fields = row.querySelectorAll('.table-input, .table-select');
        return Array.from(fields).map(field => field.value).join('|');
    }

    handleFocusIn(event) {
        const currentRow = event.target.closest('tr');
        if (!currentRow) return;

        this.initialRowDataJson = this.collectRowData(currentRow);
        
        // Если перешли на строку с помощью клавиатуры (стрелками / Tab)
        this.checkRowSelection(currentRow);
    }

    handleRowClick(event) {
        const currentRow = event.target.closest('tr');
        if (!currentRow) return;

        // Если перешли на строку кликом мыши
        this.checkRowSelection(currentRow);
    }

    // НОВОЕ: Проверяем, действительно ли пользователь перешел на ДРУГУЮ строку
    checkRowSelection(row) {
        const rowId = row.getAttribute('data-id');
        
        // Если у нас есть обработчик выбора И пользователь перешел на новую строку
        if (this.onRowSelect && this.activeRowId !== rowId) {
            this.activeRowId = rowId;
            
            // Вызываем процедуру обновления подчиненной таблицы
            this.onRowSelect(rowId);
        }
    }

    handleNumericInput(event) {
        const input = event.target;
        if (!input.classList.contains('table-input') || input.style.textAlign === 'left') return;

        const regexForbidden = new RegExp(`\\${this.forbiddenSeparator}`, 'g');
        let value = input.value.replace(regexForbidden, this.localeSeparator);

        const regexClean = new RegExp(`[^0-9\\${this.localeSeparator}]`, 'g');
        value = value.replace(regexClean, '');
        
        const parts = value.split(this.localeSeparator);
        if (parts.length > 2) value = parts + this.localeSeparator + parts.slice(1).join('');

        if (input.value !== value) {
            const start = input.selectionStart;
            input.value = value;
            input.setSelectionRange(start, start);
        }
    }

    handleNavigation(event) {
        const input = event.target;
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
            case 'Enter':
                if (event.key === 'Enter' && input.tagName === 'SELECT') return;
                event.preventDefault();
                const nextRow = tr.nextElementSibling;
                if (nextRow) targetInput = nextRow.children[colIndex]?.querySelector('.table-input, .table-select');
                break;
            case 'ArrowLeft':
                if (input.tagName === 'SELECT' || input.selectionStart === 0) {
                    const prevTd = td.previousElementSibling;
                    targetInput = prevTd?.querySelector('.table-input, .table-select');
                }
                break;
            case 'ArrowRight':
                if (input.tagName === 'SELECT' || input.selectionStart === input.value.length) {
                    const nextTd = td.nextElementSibling;
                    targetInput = nextTd?.querySelector('.table-input, .table-select');
                }
                break;
        }

        if (targetInput) {
            targetInput.focus();
            if (targetInput.tagName === 'INPUT') setTimeout(() => targetInput.select(), 0);
        }
    }

    handleFocusOut(event) {
        const currentRow = event.target.closest('tr');
        const nextElement = event.relatedTarget;
        const nextRow = nextElement ? nextElement.closest('tr') : null;

        if (!nextRow || nextRow !== currentRow) {
            this.triggerSave(currentRow);
        }
    }

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        const currentDataJson = this.collectRowData(row);

        if (this.initialRowDataJson === currentDataJson) return;

        if (typeof this.onSave === 'function') {
            this.onSave(rowId);
        }
        this.initialRowDataJson = null;
    }
}

// Функция для красивого форматирования чисел в инпуте под локаль пользователя
function formatLocaleNum(val) {
    if (val === null || val === undefined) return '';
    // Переводим системное число (с точкой) в строку с запятой (для РФ)
    return val.toString().replace('.', (1.1).toLocaleString().substring(1, 2));
}