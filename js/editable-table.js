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
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
        
        // Перехватываем нажатие мыши до смены фокуса
        this.tbody.addEventListener('mousedown', (e) => this.handleRowClick(e));
    }

    formatTableOnLoad() {
        const fields = this.tbody.querySelectorAll('.table-input');
        fields.forEach(field => {
            if (field.getAttribute('inputmode') === 'decimal' && field.value !== '') {
                let val = field.value.replace('.', this.localeSeparator);
                const step = field.getAttribute('step');
                
                if (step && step.includes('.')) {
                    const decimalsCount = step.split('.').length;
                    const parsedNum = parseFloat(val.replace(this.localeSeparator, '.'));
                    if (!isNaN(parsedNum)) {
                        val = parsedNum.toFixed(decimalsCount).replace('.', this.localeSeparator);
                    }
                }
                field.value = val;
            }
        });
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

        // ФИКС ESC: Надежно сохраняем массив исходных значений для отмены по Esc
        if (this.activeRowId !== currentRow.getAttribute('data-id')) {
            this.initialRowDataJson = this.collectRowData(currentRow);
            this.initialFieldsValues = Array.from(fields).map(field => field.value);
        }
        
        this.checkRowSelection(currentRow);
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
            value = parts + this.localeSeparator + parts.slice(1).join('');
        }

        if (hasMinus) value = '-' + value;

        if (input.value !== value) {
            const start = input.selectionStart;
            input.value = value;
            input.setSelectionRange(start, start);
        }
    }
	
    handleRowClick(event) {
        const targetRow = event.target.closest('tr');
        if (!targetRow) return;

        const activeElement = document.activeElement;
        const currentRow = activeElement ? activeElement.closest('tr') : null;

        if (currentRow && currentRow !== targetRow) {
            setTimeout(() => {
                if (!this.validateCurrentRow(currentRow)) {
                    const firstInput = currentRow.querySelector('.table-input');
                    if (firstInput) {
                        firstInput.focus();
                        firstInput.select();
                    }
                } else {
                    this.checkRowSelection(targetRow);
                }
            }, 50);
            return;
        }

        this.checkRowSelection(targetRow);
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
        const input = event.target;
        const currentRow = input.closest('tr');
        
        // ФИКС ESC: Выносим в самый верх метода, чтобы срабатывало ВСЕГДА
        if (event.key === 'Escape' && currentRow) {
            event.preventDefault();

            // Принудительно очищаем ошибки на ВСЕХ элементах строки перед возвратом значений
            currentRow.querySelectorAll('.table-input, .table-select').forEach(field => {
                field.classList.remove('input-error');
                if (typeof field.setCustomValidity === 'function') {
                    field.setCustomValidity('');
                }
            });

            // Восстанавливаем точные текстовые бэкапы по индексам
            const fields = currentRow.querySelectorAll('.table-input, .table-select');
            fields.forEach((field, index) => {
                if (this.initialFieldsValues[index] !== undefined) {
                    field.value = this.initialFieldsValues[index];
                }
            });

            const rowId = currentRow.getAttribute('data-id');
            if (typeof this.onRowCancel === 'function') {
                this.onRowCancel(rowId, currentRow);
            }
            
            // Снимаем фокус и принудительно перезаписываем снимок, чтобы строка не пробовала сохраниться
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

    handleFocusOut(event) {
        const input = event.target;
        const currentRow = input.closest('tr');
        const nextElement = event.relatedTarget;
        const nextRow = nextElement ? nextElement.closest('tr') : null;

        if (!input.classList.contains('table-input')) {
            if (!nextRow || nextRow !== currentRow) {
                setTimeout(() => {
                    if (this.validateCurrentRow(currentRow)) this.triggerSave(currentRow);
                }, 60);
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
            setTimeout(() => {
                if (currentRow && currentRow.querySelector('.input-error')) return;
                if (this.validateCurrentRow(currentRow)) this.triggerSave(currentRow);
            }, 60);
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
