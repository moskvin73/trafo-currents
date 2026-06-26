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
        this.InitNewRow = callbacks.InitNewRow;
        
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

        // Автоматически считаем высоту шапки под текущий текст и браузер
        //this.updateHeaderHeight();        
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

    updateHeaderHeight() {
        if (!this.tbody) return;
        
        // Находим контейнер таблицы
        const container = this.tbody.closest('.table-container-fixed');
        if (!container) return;

        // Находим реальный элемент шапки tr внутри thead
        const headerTr = container.querySelector('thead tr') || container.querySelector('.project-table th');
        if (!headerTr) return;

        // Измеряем точную физическую высоту шапки в текущем браузере (включая padding и border)
        const realHeight = headerTr.offsetHeight;

        // Записываем это значение в CSS-переменную прямо на контейнер таблицы
        container.style.scrollPaddingTop = `${realHeight}px`;

        this.headerHeight = realHeight;
    }

    // Отеняет текущие редактирование строки

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

        // Получаем текущее количество строк в таблице
        const rowCount = this.tbody.querySelectorAll('tr').length;
        const lastRow = this.tbody.querySelector('tr:last-child');
        let tr = null;

        // 1. Вызываем внешний метод и передаем ТОЛЬКО число строк
        if (typeof this.InitNewRow === 'function') {
            tr = this.InitNewRow(rowCount);
            
            if (!tr || !(tr instanceof HTMLTableRowElement)) {
                console.error("Метод InitNewRow должен возвращать валидный HTML-элемент TR (строку таблицы).");
                return;
            }
        } else {
            console.warn("Не определена функция инициализации новой строки (InitNewRow).");
            return;
        }

        // 2. Внутреннее сравнение новой строки с предыдущей на идентичность
        if (lastRow) {
            const prevFields = lastRow.querySelectorAll('.table-input, .table-select');
            const newFields = tr.querySelectorAll('.table-input, .table-select');

            // Проверяем равенство количества полей и ячеек
            if (prevFields.length !== newFields.length || lastRow.cells.length !== tr.cells.length) {
                console.error(`Ошибка: Структура новой строки не совпадает с существующей таблицей!`);
                return; 
            }

            // Проверяем типы полей, их инлайн-стили и важные атрибуты
            let isIdentical = true;
            for (let i = 0; i < prevFields.length; i++) {
                const prevF = prevFields[i];
                const newF = newFields[i];

                if (prevF.tagName !== newF.tagName || 
                    prevF.getAttribute('inputmode') !== newF.getAttribute('inputmode') ||
                    prevF.style.cssText !== newF.style.cssText) {
                    
                    console.error(`Ошибка: Поле на позиции ${i} структурно или визуально отличается от оригинала.`);
                    isIdentical = false;
                    break;
                }
            }

            if (!isIdentical) return; // Отменяем добавление, если нашли нестыковки
        }

        // Валидация текущей строки перед созданием новой
        if (document.activeElement && this.tbody.contains(document.activeElement)) {
            const currentRow = document.activeElement.closest('tr');
            if (currentRow && !this.validateCurrentRow(currentRow)) return;
        }
        
        this.tbody.appendChild(tr);

        // Применяем родное форматирование к новой строке
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

     scrollToRow(row, targetInput = null) {
     if (!row) return;
        const container = row.closest('.table-container-fixed');
        if (!container) return;

        // ==========================================
        // 1. ВЕРТИКАЛЬНЫЙ СКРОЛЛ (ВВЕРХ / ВНИЗ) - Без изменений
        // ==========================================
        const rowTop = row.offsetTop;
        const rowBottom = rowTop + row.offsetHeight;
        const containerTop = container.scrollTop;
        const headerHeight = container.querySelector('thead')?.offsetHeight || 0; 
        const containerBottom = containerTop + container.clientHeight;

        if (rowTop < containerTop + headerHeight) {
            container.scrollTo({
                top: rowTop - headerHeight,
                behavior: 'smooth'
            });
        }
        else if (rowBottom > containerBottom) {
            container.scrollTo({
                top: rowBottom - container.clientHeight,
                behavior: 'smooth'
            });
        }

        // ==========================================
        // 2. ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ (ВЛЕВО / ВПРАВО)
        // ==========================================
        if (!targetInput) return;
        
        // Находим родительскую ячейку (td) инпута, чтобы знать её точные размеры
        const td = targetInput.closest('td');
        if (!td) return;

        const tdLeft = td.offsetLeft;
        const tdRight = tdLeft + td.offsetWidth;
        
        const containerLeft = container.scrollLeft;
        const containerRight = containerLeft + container.clientWidth;

        // Если ячейка ушла за левую границу экрана
        if (tdLeft < containerLeft) {
            container.scrollTo({
                left: tdLeft,
                behavior: 'smooth'
            });
        }
        // Если ячейка ушла за правую границу экрана
        else if (tdRight > containerRight) {
            container.scrollTo({
                left: tdRight - container.clientWidth,
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
            setTimeout(() => {
                this.scrollToRow(currentRow, event.target);
            }, 0);
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

        if (!input.classList.contains('table-input') || input.getAttribute('inputmode') !== 'decimal') return;

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

       // Вспомогательные переменные для навигации по всей таблице
        const allRows = Array.from(this.tbody.querySelectorAll('tr'));
        const currentRowIndex = allRows.indexOf(tr);
        const rowFields = tr.querySelectorAll('.table-input, .table-select');        

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

            case 'Home':
                event.preventDefault();
                if (event.ctrlKey) {
                    // Ctrl + Home -> В начало таблицы (первая ячейка первой строки)
                    const firstRow = allRows[0];
                    if (firstRow) targetInput = firstRow.querySelector('.table-input, .table-select');
                } else {
                    // Home -> В начало строки (первое редактируемое поле) [1]
                    targetInput = rowFields[0];
                }
                break;

            case 'End':
                event.preventDefault();
                if (event.ctrlKey) {
                    // Ctrl + End -> В конец таблицы (последняя ячейка последней строки)
                    const lastRow = allRows[allRows.length - 1];
                    if (lastRow) {
                        const lastRowFields = lastRow.querySelectorAll('.table-input, .table-select');
                        targetInput = lastRowFields[lastRowFields.length - 1];
                    }
                } else {
                    // End -> В конец строки (последнее редактируемое поле) [1]
                    targetInput = rowFields[rowFields.length - 1];
                }
                break;
                
            case 'PageUp':
                event.preventDefault();
                // Страница вверх -> Прыгаем на 10 строк назад (или до упора в первую строку) [1]
                const targetPrevIndex = Math.max(0, currentRowIndex - 10);
                const pageUpRow = allRows[targetPrevIndex];
                if (pageUpRow) targetInput = pageUpRow.children[colIndex]?.querySelector('.table-input, .table-select');
                break;

            case 'PageDown':
                event.preventDefault();
                // Страница вниз -> Прыгаем на 10 строк вперед [1]
                const targetNextIndex = currentRowIndex + 10;
                
                if (targetNextIndex < allRows.length) {
                    // Если строка в пределах существующей таблицы — прыгаем на неё
                    const pageDownRow = allRows[targetNextIndex];
                    if (pageDownRow) targetInput = pageDownRow.children[colIndex]?.querySelector('.table-input, .table-select');
                } else {
                    // Если прыжок выходит за пределы таблицы — упираемся в последнюю строку
                    const lastRow = allRows[allRows.length - 1];
                    if (lastRow) targetInput = lastRow.children[colIndex]?.querySelector('.table-input, .table-select');
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
                this.scrollToRow(targetRow, targetInput);
            }            

            if (targetInput.tagName === 'INPUT') setTimeout(() => targetInput.select(), 0);
        }
    }

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        const currentDataJson = this.collectRowData(row);

        if (rowId !== 'null' && this.initialRowDataJson === currentDataJson) return;
        
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
