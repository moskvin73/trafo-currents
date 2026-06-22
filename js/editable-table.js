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
        this.isSaving = false; // Флаг защиты интерфейса

        this.formatTableOnLoad();
        this.initEvents();
        this.initFabMenu();
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
        this.tbody.addEventListener('click', (e) => this.handleRowClick(e));

        // Слушаем ESC глобально на уровне документа
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeRowId) {
                const activeTr = this.tbody.querySelector(`tr[data-id="${this.activeRowId}"]`);
                if (activeTr && (activeTr.contains(document.activeElement) || activeTr.querySelector('.input-error'))) {
                    this.resetRowChanges(activeTr);
                }
            }
        });
    }

    resetRowChanges(row) {
        const rowId = row.getAttribute('data-id');

        // Если это новая строка и пользователь отменил ввод — удаляем её из DOM
        if (rowId === 'null') {
            const previousRow = row.previousElementSibling;
            if (previousRow) {
                const prevField = previousRow.querySelector('.table-input, .table-select');
                if (prevField) prevField.focus();
            } else {
                if (document.activeElement) document.activeElement.blur();
            }

            if (typeof this.onRowCancel === 'function') this.onRowCancel(rowId, row);
            row.remove();
            this.activeRowId = null;
            return;
        }

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

        if (typeof this.onRowCancel === 'function') this.onRowCancel(rowId, row);
        
        if (document.activeElement) document.activeElement.blur();
        this.initialRowDataJson = this.collectRowData(row);
    }

    formatTableOnLoad() {
        if (!this.tbody) return; 

        const fields = this.tbody.querySelectorAll('.table-input');
        fields.forEach(field => {
            if (field.getAttribute('inputmode') === 'decimal' && field.value !== '') {
                let val = field.value.replace('.', this.localeSeparator);
                const step = field.getAttribute('step');
                
                if (step && step.includes('.')) {
                    const stepParts = step.split('.');
                    const decimalsCount = stepParts[1] ? stepParts[1].length : 0;
                    
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

        mainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isSaving) return; 
            container.classList.toggle('open');
            mainBtn.textContent = container.classList.contains('open') ? '❌' : '⚙️';
        });

        document.addEventListener('click', () => {
            container.classList.remove('open');
            mainBtn.textContent = '⚙️';
        });

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
        if (!this.tbody) return;

        // Блокируем создание второй строки, если первая еще не зафиксирована
        const existingNewRow = this.tbody.querySelector('tr[data-id="null"]');
        if (existingNewRow) {
            const firstField = existingNewRow.querySelector('.table-input, .table-select');
            if (firstField) {
                firstField.focus();
                if (firstField.select) firstField.select();
            }
            return; 
        }        

        // Валидация текущей строки перед созданием новой
        if (document.activeElement && this.tbody.contains(document.activeElement)) {
            const currentRow = document.activeElement.closest('tr');
            if (currentRow && !this.validateCurrentRow(currentRow)) return;
        }
        
        const lastRow = this.tbody.querySelector('tr:last-child');
        if (!lastRow) return;

        const tr = lastRow.cloneNode(true);
        tr.dataset.id = 'null'; 

        // ИСПРАВЛЕНО: Чистим только ваши оригинальные классы полей без лишних чекбоксов
        const fields = tr.querySelectorAll('.table-input, .table-select');
        fields.forEach(field => {
            field.classList.remove('input-error');
            if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');

            if (field.getAttribute('inputmode') === 'decimal') {
                field.value = '0'; // База для форматирования нуля
            } else {
                field.value = ''; 
            }
            field.removeAttribute('disabled');
        });

        this.tbody.appendChild(tr);

        // Применяем ваше родное форматирование к новой строке
        const originalTbody = this.tbody;
        this.tbody = tr; 
        this.formatTableOnLoad(); 
        this.tbody = originalTbody; 

        const scrollContainer = tr.closest('.table-container-fixed');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }

        // Автофокус на первое поле новой строки
        const firstEditableField = tr.querySelector('.table-input, .table-select');
        if (firstEditableField) {
            setTimeout(() => {
                firstEditableField.focus();
                if (firstEditableField.tagName === 'INPUT') firstEditableField.select(); 
            }, 50);
        }
    } 

    collectRowData(row) {
        const fields = row.querySelectorAll('.table-input, .table-select');
        return Array.from(fields).map(field => field.value).join('|');
    }

     scrollToRow(row) {
        if (!row) return;
        // Находим ваш фиксированный контейнер со скроллом
        const container = row.closest('.table-container-fixed');
        if (!container) return;

        // Положение верхней и нижней границы строки относительно контейнера
        const rowTop = row.offsetTop;
        const rowBottom = rowTop + row.offsetHeight;

        // Текущая видимая область контейнера
        const containerTop = container.scrollTop;
        
        // Учитываем высоту шапки, если она зафиксирована (например, 40px). 
        // Если шапка не липнет, поставьте здесь 0.
        const headerHeight = container.querySelector('thead')?.offsetHeight || 0; 
        const containerBottom = containerTop + container.clientHeight;

        // 1. Если двигаемся ВВЕРХ и строка уходит под верхний край (или под шапку)
        if (rowTop < containerTop + headerHeight) {
            container.scrollTo({
                top: rowTop - headerHeight,
                behavior: 'smooth'
            });
        }
        // 2. Если двигаемся ВНИЗ и строка уходит за нижний край
        else if (rowBottom > containerBottom) {
            container.scrollTo({
                top: rowBottom - container.clientHeight,
                behavior: 'smooth'
            });
        }
    }   

    handleFocusIn(event) {
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
            this.scrollToRow(currentRow);
        }
    }

   handleFocusOut(event) {
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

        if (input.value.trim() === '' || input.value === '-') {
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
                    const stepParts = step.split('.');
                    const decimalsCount = stepParts[1] ? stepParts[1].length : 0;
                    input.value = parsedNum.toFixed(decimalsCount).replace('.', this.localeSeparator);
                }
            }
        }

        if (!nextRow || nextRow !== currentRow) {
            if (currentRow && currentRow.querySelector('.input-error')) return;
            if (this.validateCurrentRow(currentRow)) this.triggerSave(currentRow);
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
        if (this.isSaving) return;

        const rowId = row.getAttribute('data-id');
        if (this.activeRowId !== rowId) {
            this.activeRowId = rowId;
            if (typeof this.onRowSelect === 'function') {
                this.onRowSelect(rowId === 'null' ? null : rowId, row);
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
            const cleanId = rowId === 'null' ? null : rowId;
            const rowError = this.onValidateRow(cleanId, row);
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
            if (input.tagName === 'INPUT') input.select();
        }, 0);
    }

   handleKeyDown(event) {
        if (this.isSaving) {
            event.preventDefault();
            return;
        }

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
                event.preventDefault();
                const nextRow = tr.nextElementSibling;
                if (nextRow) {
                    targetInput = nextRow.children[colIndex]?.querySelector('.table-input, .table-select');
                } else {
                    if (this.validateCurrentRow(tr)) {
                        this.addRow();
                        return;
                    }
                }
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
                    if (nextTd) {
                        targetInput = nextTd?.querySelector('.table-input, .table-select');
                    } else {
                        const nextRowFromCurrent = tr.nextElementSibling;
                        if (!nextRowFromCurrent && this.validateCurrentRow(tr)) {
                            this.addRow();
                            return;
                        }
                    }
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

            if (targetRow) {
                this.scrollToRow(targetRow);
            }            

            if (targetInput.tagName === 'INPUT') setTimeout(() => targetInput.select(), 0);
        }
    }

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        const currentDataJson = this.collectRowData(row);

        if (this.initialRowDataJson === currentDataJson) return;
        
        this.isSaving = true;
        const backupValues = [...this.initialFieldsValues];
        const lastFocusedFieldIndex = this.currentFieldIndex;

        const rollback = () => {
            console.warn(`Ошибка сохранения строки ${rowId}. Выполняется откат изменений...`);
            this.isSaving = false;

            if (rowId === 'null') {
                const previousRow = row.previousElementSibling;
                if (previousRow) {
                    const prevField = previousRow.querySelector('.table-input, .table-select');
                    if (prevField) prevField.focus();
                }
                if (typeof this.onRowCancel === 'function') this.onRowCancel(rowId, row);
                row.remove();
                this.activeRowId = null;
                return;
            }
            
            this.activeRowId = rowId;
            const fields = row.querySelectorAll('.table-input, .table-select');
            fields.forEach((field, index) => {
                if (backupValues[index] !== undefined) field.value = backupValues[index];
            });
            
            row.style.backgroundColor = '#fef2f2';
            setTimeout(() => { row.style.backgroundColor = ''; }, 1000);
            
            this.initialRowDataJson = this.collectRowData(row);
            if (typeof this.onRowCancel === 'function') this.onRowCancel(rowId, row);

            if (lastFocusedFieldIndex !== null && fields[lastFocusedFieldIndex]) {
                const targetField = fields[lastFocusedFieldIndex];
                setTimeout(() => {
                    targetField.focus();
                    if (targetField.tagName === 'INPUT') targetField.select();
                }, 50);
            }
        };

        if (typeof this.onSave === 'function') {
            const rawFields = row.querySelectorAll('.table-input, .table-select');
            const data = Array.from(rawFields).map(f => f.value);
            
            const success = (newId = null) => {
                this.isSaving = false; 
                if (rowId === 'null' && newId !== null) {
                    row.setAttribute('data-id', newId); 
                    this.activeRowId = newId;
                }
                this.initialRowDataJson = this.collectRowData(row);
            };

            this.onSave(rowId === 'null' ? null : rowId, row, data, rollback, success);
        } else {
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
