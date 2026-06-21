class EditableTable {
    constructor(tbodyId, onSaveCallback) {
        this.tbody = document.getElementById(tbodyId);
        if (!this.tbody) return;

        this.onSave = onSaveCallback;
        
        this.localeSeparator = (1.1).toLocaleString().substring(1, 2); 
        this.forbiddenSeparator = this.localeSeparator === ',' ? '.' : ',';

        // Хранилище для исходного состояния редактируемой строки
        this.initialRowDataJson = null;

        this.initEvents();
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleNavigation(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
        
        // НОВОЕ: Фиксируем состояние строки в момент, когда пользователь в неё зашёл
        this.tbody.addEventListener('focusin', (e) => this.handleFocusIn(e));
    }

    // НОВОЕ: Запоминаем данные при входе в строку
    handleFocusIn(event) {
        const currentRow = event.target.closest('tr');
        if (!currentRow) return;

        // Собираем текущие данные этой строки
        const currentData = this.collectRowData(currentRow);
        
        // Превращаем в строку для быстрого и точного сравнения
        this.initialRowDataJson = JSON.stringify(currentData);
    }

    handleNumericInput(event) {
        const input = event.target;
        if (input.getAttribute('inputmode') !== 'decimal') return;

        const regexForbidden = new RegExp(`\\${this.forbiddenSeparator}`, 'g');
        let value = input.value.replace(regexForbidden, this.localeSeparator);

        const regexClean = new RegExp(`[^0-9\\${this.localeSeparator}]`, 'g');
        value = value.replace(regexClean, '');
        
        const parts = value.split(this.localeSeparator);
        if (parts.length > 2) {
            value = parts + this.localeSeparator + parts.slice(1).join('');
        }

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
            if (targetInput.tagName === 'INPUT') {
                setTimeout(() => targetInput.select(), 0);
            }
        }
    }

    handleFocusOut(event) {
        const currentRow = event.target.closest('tr');
        const nextElement = event.relatedTarget;
        const nextRow = nextElement ? nextElement.closest('tr') : null;

        // Если фокус перешел на другую строку или вообще ушел из таблицы
        if (!nextRow || nextRow !== currentRow) {
            this.triggerSave(currentRow);
        }
    }

    // Вспомогательный метод сбора данных (вынесен отдельно, чтобы использовать и в focusin, и в focusout)
    collectRowData(row) {
        const rowId = row.getAttribute('data-id');
        const data = { id: rowId };
        
        row.querySelectorAll('[name]').forEach(field => {
            let value = field.value;
            
            if (field.getAttribute('inputmode') === 'decimal') {
                if (value === '') {
                    value = null;
                } else {
                    const standardValue = value.replace(this.localeSeparator, '.');
                    value = parseFloat(standardValue);
                    if (isNaN(value)) value = null;
                }
            }
            
            data[field.name] = value;
        });

        return data;
    }

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        
        // 1. Собираем новые измененные данные
        const currentData = this.collectRowData(row);
        const currentDataJson = JSON.stringify(currentData);

        // 2. СРАВНИВАЕМ: Если данные абсолютно такие же, как при входе — ничего не делаем
        if (this.initialRowDataJson === currentDataJson) {
            console.log(`Строка ${rowId} закрыта без изменений. Сохранение отменено.`);
            return;
        }

        // 3. Если данные изменились — отправляем на сервер
        if (typeof this.onSave === 'function') {
            this.onSave(rowId, currentData);
        }

        // Очищаем кэш после успешного триггера сохранения
        this.initialRowDataJson = null;
    }
}

// Функция для красивого форматирования чисел в инпуте под локаль пользователя
function formatLocaleNum(val) {
    if (val === null || val === undefined) return '';
    // Переводим системное число (с точкой) в строку с запятой (для РФ)
    return val.toString().replace('.', (1.1).toLocaleString().substring(1, 2));
}