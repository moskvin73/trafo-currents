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

        this.currentFieldIndex = null;

        this.formatTableOnLoad();

        this.initEvents();
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
        this.tbody.addEventListener('click', (e) => this.handleRowClick(e));
    }

    formatTableOnLoad() {
        const fields = this.tbody.querySelectorAll('.table-input');
        fields.forEach(field => {
            if (field.getAttribute('inputmode') === 'decimal' && field.value !== '') {
                // Заменяем стандартную точку из БД на локальный разделитель
                let val = field.value.replace('.', this.localeSeparator);
                const step = field.getAttribute('step');
                
                // Если задан шаг, выставляем фиксированное количество знаков (дописываем нули)
                if (step && step.includes('.')) {
                    const decimalsCount = step.split('.')[1].length;
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

        if (this.activeRowId !== currentRow.getAttribute('data-id')) {
            this.initialRowDataJson = this.collectRowData(currentRow);
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
                if (typeof this.onRowSelect === 'function') this.onRowSelect(rowId, currentRow);
            }
        }

        if (!input.classList.contains('table-input') || input.style.textAlign === 'left') return;

        const step = input.getAttribute('step');
        const isFloat = step && step.includes('.');

        // ФИКС: Сохраняем информацию, был ли минус в самом начале строки
        const hasMinus = input.value.startsWith('-');

        if (!isFloat) {
            // Удаляем всё, кроме цифр
            let value = input.value.replace(/[^0-9]/g, '');
            // Если в начале был минус — возвращаем его на место
            if (hasMinus) value = '-' + value;

            if (input.value !== value) {
                const start = input.selectionStart;
                input.value = value;
                input.setSelectionRange(start, start);
            }
            return;
        }

        // Логика для дробных чисел (float):
        // 1. Подмена запрещенного разделителя на разрешенный
        const regexForbidden = new RegExp(`\\${this.forbiddenSeparator}`, 'g');
        let value = input.value.replace(regexForbidden, this.localeSeparator);

        // 2. Валидация: разрешаем цифры и один разделитель локали
        const regexClean = new RegExp(`[^0-9\\${this.localeSeparator}]`, 'g');
        value = value.replace(regexClean, '');
        
        // 3. Контроль единственности разделителя
        const parts = value.split(this.localeSeparator);
        if (parts.length > 2) {
            value = parts[0] + this.localeSeparator + parts.slice(1).join('');
        }

        // ФИКС: Если в начале был минус — возвращаем его на место для дробного числа
        if (hasMinus) value = '-' + value;

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
                if (event.key === 'Enter' && input.tagName === 'SELECT') return;
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
                        // Ctrl + Enter -> Переход ВЛЕВО
                        const prevTd = td.previousElementSibling;
                        targetInput = prevTd?.querySelector('.table-input, .table-select');
                    } else {
                        // Просто Enter -> Переход ВПРАВО
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
        /*const input = event.target; 

        const currentRow = event.target.closest('tr');
        const nextElement = event.relatedTarget;
        const nextRow = nextElement ? nextElement.closest('tr') : null;

        if (input.classList.contains('table-input') && input.getAttribute('inputmode') === 'decimal' && input.value !== '') {
            const step = input.getAttribute('step');
            if (step && step.includes('.')) {
                // Считаем количество знаков после точки в атрибуте step (например, "0.0001" -> 4)
                const decimalsCount = step.split('.')[1].length;
                
                // Переводим текущее значение в стандартное JS число для округления
                const standardValue = input.value.replace(this.localeSeparator, '.');
                const parsedNum = parseFloat(standardValue);
                
                if (!isNaN(parsedNum)) {
                    // Округляем и возвращаем локальную запятую
                    input.value = parsedNum.toFixed(decimalsCount).replace('.', this.localeSeparator);
                }
            }                
        }

        if (!nextRow || nextRow !== currentRow) {
            this.triggerSave(currentRow);
        }*/

     const input = event.target;
        const currentRow = input.closest('tr');
        const nextElement = event.relatedTarget;
        const nextRow = nextElement ? nextElement.closest('tr') : null;

        // Если фокус ушел не из текстового инпута (например, из селекта)
        if (!input.classList.contains('table-input')) {
            if (!nextRow || nextRow !== currentRow) {
                if (currentRow && !currentRow.querySelector('.input-error')) {
                    this.triggerSave(currentRow);
                }
            }
            return;
        }

        // ПУНКТ 1: Валидация пустой строки -> восстанавливаем из бэкапа
        if (input.value.trim() === '') {
            if (this.currentFieldIndex !== null && this.initialFieldsValues[this.currentFieldIndex] !== undefined) {
                input.value = this.initialFieldsValues[this.currentFieldIndex];
                input.classList.remove('input-error');
            }
        } 
        // Логика проверки числовых значений
        else if (input.getAttribute('inputmode') === 'decimal') {
            const standardValue = input.value.replace(this.localeSeparator, '.');
            const parsedNum = parseFloat(standardValue);
            
            if (!isNaN(parsedNum)) {
                const min = input.getAttribute('min');
                const max = input.getAttribute('max');
                
                // ПУНКТ 3: Валидация min/max границ
                if ((min !== null && parsedNum < parseFloat(min)) || (max !== null && parsedNum > parseFloat(max))) {
                    event.preventDefault();
                    
                    // Делаем рамку красной
                    input.classList.add('input-error');
                    
                    // Формируем и показываем подсказку браузера
                    let msg = '';
                    if (min !== null && max !== null) {
                        msg = `Значение должно быть от ${min} до ${max}`;
                    } else if (min !== null) {
                        msg = `Значение должно быть не меньше ${min}`;
                    } else if (max !== null) {
                        msg = `Значение должно быть не больше ${max}`;
                    }
                    
                    input.setCustomValidity(msg);
                    input.reportValidity();

                    // Жестко возвращаем фокус обратно в ошибочное поле
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 0);
                    return; // Прерываем выполнение, сохранение не вызывается
                }

                // Если проверка пройдена, очищаем ошибку
                input.classList.remove('input-error');
                input.setCustomValidity(''); 

                // Форматируем нули на конце, если это float (есть step с точкой)
                const step = input.getAttribute('step');
                if (step && step.includes('.')) {
                    const decimalsCount = step.split('.')[1].length;
                    input.value = parsedNum.toFixed(decimalsCount).replace('.', this.localeSeparator);
                }
            }
        }

        // Если полностью ушли со строки и в ней нет других ошибок — сохраняем
        if (!nextRow || nextRow !== currentRow) {
            if (currentRow && currentRow.querySelector('.input-error')) return; // блокируем сохранение всей строки при ошибке
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
function formatLocaleNum(val, decimals = null) {
    if (val === null || val === undefined) return '';
    // Переводим системное число (с точкой) в строку с запятой (для РФ)
    let str = val.toString();
    if (decimals !== null) {
        str = val.toFixed(decimals); // Сразу принудительно выводим нули на конце, если нужно
    }
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
