/**
 * Проверяет синтаксическую валидность CSS-строки цвета на уровне движка браузера.
 * Поддерживает: Hex, RGB/RGBA, HSL/HSLA, ключевые слова (red, blue и т.д.), transparent.
 * @param {string} colorStr - Строка цвета для проверки
 * @returns {boolean} true, если синтаксис верный, иначе false
 */
export function isValidCSSColor(colorStr) {
    if (typeof colorStr !== 'string') return false;
    
    const trimmed = colorStr.trim();
    if (!trimmed) return false;

    // 1. Проверяем через встроенное API браузера CSS.supports
    // Мы спрашиваем у браузера: "Понимаешь ли ты такой синтаксис для свойства color?"
    if (typeof CSS !== 'undefined' && CSS.supports) {
        return CSS.supports('color', trimmed);
    }

    // 2. Резервный вариант (Fallback): если код выполняется в старых браузерах 
    // или тестовой среде, где нет CSS.supports (например, в Node.js тестах)
    // Используем быстрое регулярное выражение для базовых форматов
    return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed) || 
           /^(rgb|hsl)a?\(.*\)$/i.test(trimmed) ||
           /^[a-z]+$/i.test(trimmed);
}

/**
 * Создает плавающее перетаскиваемое окно для отображения векторной диаграммы.
 * @param {string} diagramId - Уникальный идентификатор диаграммы (имя переменной)
 * @returns {HTMLElement} DOM-элемент контента окна, куда нужно инициализировать VectorDiagram
 */
export function createFloatingWindowDOM(diagramId) {
    const windowId = `floating-win-${diagramId}`;
    
    // Если окно для этой диаграммы уже открыто — не дублируем, а возвращаем его тело
    let win = document.getElementById(windowId);
    if (win) {
        const existingContent = win.querySelector('.v-win-content');
        existingContent.innerHTML = ''; // Очищаем старый холст перед перерисовкой
        return existingContent;
    }

    // 1. Создаем главный контейнер окна
    win = document.createElement('div');
    win.id = windowId;
    
    // Стилизуем окно (Инженерный стиль: аккуратные тени, фиксированный размер)
    Object.assign(win.style, {
        position: 'fixed',
        width: '450px',
        height: '490px', // Высота чуть больше ширины, чтобы учесть шапку
        backgroundColor: '#ffffff',
        border: '1px solid #dcdcdc',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });

    // Стартовая позиция окна на экране (например, по центру с небольшим смещением)
    win.style.left = `${window.innerWidth / 2 - 225 + (Math.random() * 40 - 20)}px`;
    win.style.top = `${window.innerHeight / 2 - 245 + (Math.random() * 40 - 20)}px`;

    // 2. Создаем шапку окна (Drag Handle)
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '10px 14px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e5e5e5',
        cursor: 'move',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        userSelect: 'none' // Запрещаем выделение текста при таскании
    });

    // Заголовок окна (Имя диаграммы)
    const title = document.createElement('span');
    title.textContent = `Векторная диаграмма [${diagramId}]`;
    Object.assign(title.style, {
        fontWeight: 'bold',
        fontSize: '13px',
        color: '#333'
    });
    header.appendChild(title);

    // Кнопка закрытия окна (х)
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
        cursor: 'pointer',
        fontSize: '18px',
        lineHeight: '1',
        color: '#999',
        fontWeight: 'bold',
        padding: '2px 6px',
        transition: 'color 0.2s'
    });
    closeBtn.addEventListener('mouseover', () => closeBtn.style.color = '#ff4d4d');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.color = '#999');
    
    // При закрытии просто уничтожаем DOM-элемент окна
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(win);
        // Опционально: зануляем ссылку в реестре диаграмм, чтобы калькулятор знал о закрытии
        if (window.CalculatorDiagrams && window.CalculatorDiagrams[diagramId]) {
            window.CalculatorDiagrams[diagramId].instance = null;
        }
    });
    header.appendChild(closeBtn);
    win.appendChild(header);

    // 3. Создаем тело окна, куда встанет резиновый SVG
    const content = document.createElement('div');
    content.className = 'v-win-content';
    Object.assign(content.style, {
        flex: '1',
        width: '100%',
        height: '100%',
        backgroundColor: '#fafafa',
        position: 'relative'
    });
    win.appendChild(content);

    // Встраиваем окно в корень страницы
    document.body.appendChild(win);

    // =====================================================================
    // ЛОГИКА ПЕРЕТАСКИВАНИЯ (DRAG AND DROP)
    // =====================================================================
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
        // Таскать можно только левой кнопкой мыши
        if (e.button !== 0) return; 
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        initialLeft = parseInt(win.style.left, 10);
        initialTop = parseInt(win.style.top, 10);
        
        // Меняем курсор на "захват" на всём экране на время перемещения
        document.body.style.cursor = 'move';
        
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // Считаем дельту смещения мыши
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Рассчитываем новые координаты окна
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Защита от вылета окна за границы видимого экрана браузера
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - win.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - win.offsetHeight));

        win.style.left = `${newLeft}px`;
        win.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
        }
    });

    // Возвращаем именно блок контента, так как DiagramDescriptor ожидает рабочую область
    return content;
}