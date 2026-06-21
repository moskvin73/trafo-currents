class EditableTable {
    /**
     * @param {string} tbodyId - ID тела таблицы
     * @param {object} callbacks - Объект с функциями обратного вызова
     * @param {function} callbacks.onSave - При уходе со строки (если были изменения)
     * @param {function} [callbacks.onRowSelect] - При выборе строки (кликом или стрелками)
     * @param {function} [callbacks.onRowEdit] - Когда строка перешла в режим редактирования
     * @param {function} [callbacks.onRowCancel] - При отмене изменений через Esc
     */
    constructor(tbodyId, callbacks = {}) {
        this.tbody = document.getElementById(tbodyId);
        if (!this.tbody) return;

        this.onSave = callbacks.onSave;
        this.onRowSelect = callbacks.onRowSelect;
        this.onRowEdit = callbacks.onRowEdit;
        this.onRowCancel = callbacks.onRowCancel;
        
        this.localeSeparator = (1.1).toLocaleString().substring(1, 2); 
        this.forbiddenSeparator = this.localeSeparator === ',' ? '.' : ',';

        this.initialRowDataJson = null;
        this.initialFieldsValues = []; 
        this.activeRowId = null;

        this.initEvents();
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
        this.tbody.addEventListener('click', (e) => this.handleRowClick(e));
    }

    collectRowData(row) {
        const fields = row.querySelectorAll('.table-input, .table-select');
        return Array.from(fields).map(field => field.value).join('|');
    }

    handleFocusIn(event) {
        const currentRow = event.target.closest('tr');
        if (!currentRow) return;

        if (this.activeRowId !== currentRow.getAttribute('data-id')) {
            this.initialRowDataJson = this.collectRowData(currentRow);
            
            const fields = currentRow.querySelectorAll('.table-input, .table-select');
            this.initialFieldsValues = Array.from(fields).map(field => field.value);
        }
        
        this.checkRowSelection(currentRow);
    }

    handleRowClick(event) {
        const currentRow = event.target.closest('tr');
        if (!currentRow) return;
        this.checkRowSelection(currentRow);
    }

    checkRowSelection(row) {
        const rowId = row.getAttribute('data-id');
        
        if (this.activeRowId !== rowId) {
            this.activeRowId = rowId;
            
            if (typeof this.onRowSelect === 'function') {
                this.onRowSelect(rowId, row);
            }
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
                // Если пользователь стёр изменения обратно до исходных
                if (typeof this.onRowSelect === 'function') this.onRowSelect(rowId, currentRow);
            }
        }

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

    handleKeyDown(event) {
        const input = event.target;
        
        if (event.key === 'Escape') {
            const currentRow = input.closest('tr');
            if (!currentRow) return;

            const fields = currentRow.querySelectorAll('.table-input, .table-select');
            fields.forEach((field, index) => {
                field.value = this.initialFieldsValues[index];
            });

            const rowId = currentRow.getAttribute('data-id');
            if (typeof this.onRowCancel === 'function') {
                this.onRowCancel(rowId, currentRow);
            }
            
            input.blur();
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
