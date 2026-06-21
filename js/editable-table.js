class EditableTable {
    /**
     * @param {string} tbodyId - ID тела таблицы
     * @param {function} onSaveCallback - Функция, которая вызовется для сохранения строки на сервер
     */
    constructor(tbodyId, onSaveCallback) {
        this.tbody = document.getElementById(tbodyId);
        if (!this.tbody) return;

        this.onSave = onSaveCallback;
        this.initEvents();
    }

    initEvents() {
        // Навигация кнопками клавиатуры
        this.tbody.addEventListener('keydown', (e) => this.handleNavigation(e));
        
        // Отслеживание ухода со строки для автосохранения
        this.tbody.addEventListener('focusout', (e) => this.handleFocusOut(e));
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
                // Для селектов Enter пускай работает стандартно (открывает список)
                if (event.key === 'Enter' && input.tagName === 'SELECT') return;
                
                event.preventDefault();
                const nextRow = tr.nextElementSibling;
                if (nextRow) targetInput = nextRow.children[colIndex]?.querySelector('.table-input, .table-select');
                break;

            case 'ArrowLeft':
                // Переходим влево, только если курсор в самом начале текста (или это селект)
                if (input.tagName === 'SELECT' || input.selectionStart === 0) {
                    const prevTd = td.previousElementSibling;
                    targetInput = prevTd?.querySelector('.table-input, .table-select');
                }
                break;

            case 'ArrowRight':
                // Переходим вправо, только если курсор в самом конце текста (или это селект)
                if (input.tagName === 'SELECT' || input.selectionStart === input.value.length) {
                    const nextTd = td.nextElementSibling;
                    targetInput = nextTd?.querySelector('.table-input, .table-select');
                }
                break;
        }

        if (targetInput) {
            targetInput.focus();
            if (targetInput.tagName === 'INPUT') {
                setTimeout(() => targetInput.select(), 0); // Автовыделение текста при переходе
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

    triggerSave(row) {
        const rowId = row.getAttribute('data-id');
        
        // Автоматически собираем все поля в один аккуратный объект
        const data = { id: rowId };
        
        // Ищем все элементы с атрибутом name внутри этой строки
        row.querySelectorAll('[name]').forEach(field => {
            let value = field.value;
            
            // Преобразуем типы данных, если это числовое поле
            if (field.type === 'number') {
                value = value === '' ? null : parseFloat(value);
            }
            
            data[field.name] = value;
        });

        // Передаем собранные данные в ваш внешний обработчик сохранения
        if (typeof this.onSave === 'function') {
            this.onSave(rowId, data);
        }
    }
}