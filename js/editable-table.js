class EditableTable {
    constructor(tbodyId, onSaveCallback) {
        this.tbody = document.getElementById(tbodyId);
        if (!this.tbody) return;

        this.onSave = onSaveCallback;
        
        // Определяем системный разделитель пользователя ("," или ".")
        this.localeSeparator = (1.1).toLocaleString().substring(1, 2); 
        // Символ, который нужно заменять (если локаль ",", то заменяем ".", и наоборот)
        this.forbiddenSeparator = this.localeSeparator === ',' ? '.' : ',';

        this.initEvents();
    }

    initEvents() {
        this.tbody.addEventListener('keydown', (e) => this.handleNavigation(e));
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
        this.tbody.addEventListener('input', (e) => this.handleNumericInput(e));
    }

    // Региональный фильтр ввода чисел
    handleNumericInput(event) {
        const input = event.target;
        if (input.getAttribute('inputmode') !== 'decimal') return;

        // 1. Подменяем запрещенный разделитель на региональный (например, "." на ",")
        const regexForbidden = new RegExp(`\\${this.forbiddenSeparator}`, 'g');
        let value = input.value.replace(regexForbidden, this.localeSeparator);

        // 2. Разрешаем только цифры и один региональный разделитель
        // Удаляем всё, кроме цифр и нашего разделителя
        const regexClean = new RegExp(`[^0-9\\${this.localeSeparator}]`, 'g');
        value = value.replace(regexClean, '');
        
        // Если разделителей больше одного, оставляем только первый
        const parts = value.split(this.localeSeparator);
        if (parts.length > 2) {
            value = parts[0] + this.localeSeparator + parts.slice(1).join('');
        }

        // Обновляем значение в инпуте с сохранением позиции курсора
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

        if (!nextRow || nextRow !== currentRow) {
            this.triggerSave(currentRow);
        }
    }

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        const data = { id: rowId };
        
        row.querySelectorAll('[name]').forEach(field => {
            let value = field.value;
            
            if (field.getAttribute('inputmode') === 'decimal') {
                if (value === '') {
                    value = null;
                } else {
                    // Перед отправкой на сервер ВСЕГДА переводим региональный разделитель в стандартную точку JS
                    const standardValue = value.replace(this.localeSeparator, '.');
                    value = parseFloat(standardValue);
                    if (isNaN(value)) value = null;
                }
            }
            
            data[field.name] = value;
        });

        if (typeof this.onSave === 'function') {
            this.onSave(rowId, data);
        }
    }
}

// Функция для красивого форматирования чисел в инпуте под локаль пользователя
function formatLocaleNum(val) {
    if (val === null || val === undefined) return '';
    // Переводим системное число (с точкой) в строку с запятой (для РФ)
    return val.toString().replace('.', (1.1).toLocaleString().substring(1, 2));
}