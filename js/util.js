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
    let win = document.getElementById(windowId);
    
    // ФУНКЦИЯ РАЗВЕРТЫВАНИЯ/ВОССТАНОВЛЕНИЯ ОКНА
    const restoreWindow = (targetWin) => {
        if (targetWin.dataset.isMinimized === 'true') {
            targetWin.dataset.isMinimized = 'false';
            // Восстанавливаем старые размеры и координаты
            targetWin.style.width = targetWin.dataset.savedWidth;
            targetWin.style.height = targetWin.dataset.savedHeight;
            targetWin.style.left = targetWin.dataset.savedLeft;
            targetWin.style.top = targetWin.dataset.savedTop;
            targetWin.style.position = 'fixed';
            
            // Показываем контент обратно
            targetWin.querySelector('.v-win-content').style.display = 'block';
            targetWin.querySelector('.v-resize-handle').style.display = 'block';
            targetWin.querySelector('.v-min-btn').textContent = '_';
            
            // Триггерим ресайз диаграммы, так как размеры контейнера вернулись
            triggerDiagramResize(diagramId);
        }
    };

    // Если окно уже существует в DOM — просто разворачиваем его в старых позициях
    if (win) {
        restoreWindow(win);
        return win.querySelector('.v-win-content');
    }

    // 1. Главный контейнер окна
    win = document.createElement('div');
    win.id = windowId;
    win.dataset.isMinimized = 'false';
    
    Object.assign(win.style, {
        position: 'fixed',
        width: '450px',
        height: '490px',
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

    win.style.left = `${window.innerWidth / 2 - 225}px`;
    win.style.top = `${window.innerHeight / 2 - 245}px`;

    // 2. Шапка окна
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '10px 14px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e5e5e5',
        cursor: 'move',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        userSelect: 'none'
    });

    const title = document.createElement('span');
    title.textContent = `Векторная диаграмма [${diagramId}]`;
    title.style.fontSize = '13px';
    title.style.fontWeight = 'bold';
    header.appendChild(title);

    // Блок кнопок управления (Свернуть и Закрыть)
    const btnBlock = document.createElement('div');
    btnBlock.style.display = 'flex';
    btnBlock.style.gap = '10px';

    // КНОПКА СВЕРНУТЬ (_)
    const minBtn = document.createElement('span');
    minBtn.className = 'v-min-btn';
    minBtn.textContent = '_';
    Object.assign(minBtn.style, { cursor: 'pointer', fontWeight: 'bold', color: '#999', padding: '0 4px' });
    
    minBtn.addEventListener('click', (e) => {
         e.stopPropagation(); // Чтобы не сработал драг шапки
        
        if (win.dataset.isMinimized === 'false') {
            // Сохраняем текущие координаты и размеры перед сворачиванием
            win.dataset.savedWidth = win.style.width;
            win.dataset.savedHeight = win.style.height;
            win.dataset.savedLeft = win.style.left;
            win.dataset.savedTop = win.style.top;
            
            // Превращаем окно в компактную горизонтальную плашку
            win.dataset.isMinimized = 'true';
            win.style.width = '220px';
            win.style.height = '38px';
            
            // ИНВЕРСНАЯ ЛОГИКА: Фиксируем в верхней части экрана (top)
            win.style.bottom = 'auto';
            win.style.top = '10px'; // Отступ 10 пикселей от верхнего края браузера
            
            // Находим все уже свернутые окна, чтобы выстроить их в ряд слева направо
            const openMinimized = document.querySelectorAll('[data-is-minimized="true"]').length - 1;
            win.style.left = `${10 + openMinimized * 230}px`; // Каждое окно занимает 220px + 10px зазор
            
            // Прячем контент холста и ресайзер, оставляем только шапку
            win.querySelector('.v-win-content').style.display = 'none';
            win.querySelector('.v-resize-handle').style.display = 'none';
            minBtn.textContent = '▢'; // Меняем иконку на "развернуть"
        } else {
            restoreWindow(win);
        }
    });

    // КНОПКА ЗАКРЫТЬ (×)
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, { cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: '#999' });
    closeBtn.addEventListener('click', () => document.body.removeChild(win));

    btnBlock.appendChild(minBtn);
    btnBlock.appendChild(closeBtn);
    header.appendChild(btnBlock);
    win.appendChild(header);

    // Клик по шапке свернутого окна также разворачивает его
    header.addEventListener('click', () => {
        if (win.dataset.isMinimized === 'true') restoreWindow(win);
    });

    // 3. Тело окна (Рабочая область для SVG)
    const content = document.createElement('div');
    content.className = 'v-win-content';
    Object.assign(content.style, { flex: '1', width: '100%', height: '100%', backgroundColor: '#fafafa', position: 'relative' });
    win.appendChild(content);

    // 4. ТРИГГЕР ИЗМЕНЕНИЯ РАЗМЕРА (Уголок Resize Handle в правом нижнем углу)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'v-resize-handle';
    Object.assign(resizeHandle.style, {
        position: 'absolute', right: '0', bottom: '0', width: '14px', height: '14px',
        cursor: 'se-resize', background: 'linear-gradient(135deg, transparent 40%, #ccc 40%, #ccc 60%, transparent 60%, transparent 80%, #ccc 80%)',
        zIndex: '10001'
    });
    win.appendChild(resizeHandle);

    document.body.appendChild(win);

    // ЛОГИКА ДРАГА (ПЕРЕМЕЩЕНИЯ)
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || win.dataset.isMinimized === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initialLeft = parseInt(win.style.left, 10); initialTop = parseInt(win.style.top, 10);
        document.body.style.cursor = 'move';
        e.preventDefault();
    });

    // ЛОГИКА РЕСАЙЗА (ИЗМЕНЕНИЯ РАЗМЕРОВ)
    let isResizing = false, startW, startH;
    resizeHandle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isResizing = true;
        startX = e.clientX; startY = e.clientY;
        startW = parseInt(win.style.width, 10); startH = parseInt(win.style.height, 10);
        document.body.style.cursor = 'se-resize';
        e.preventDefault();
        e.stopPropagation();
    });

    // ОБЩИЙ ОБРАБОТЧИК ДВИЖЕНИЯ МЫШИ
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let nl = initialLeft + (e.clientX - startX);
            let nt = initialTop + (e.clientY - startY);
            win.style.left = `${Math.max(0, Math.min(nl, window.innerWidth - win.offsetWidth))}px`;
            win.style.top = `${Math.max(0, Math.min(nt, window.innerHeight - win.offsetHeight))}px`;
        }
        else if (isResizing) {
            let nw = startW + (e.clientX - startX);
            let nh = startH + (e.clientY - startY);
            // Задаем минимальные ограничения, чтобы окно не схлопнулось (например, 250x250)
            win.style.width = `${Math.max(250, nw)}px`;
            win.style.height = `${Math.max(250, nh)}px`;
            
            // Важно: сообщаем движку диаграммы, что контейнер изменил размер!
            triggerDiagramResize(diagramId);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging || isResizing) {
            isDragging = false; isResizing = false;
            document.body.style.cursor = 'default';
        }
    });

    return content;
}

/**
 * Вспомогательная функция, которая находит диаграмму в таблице символов и обновляет ее геометрию
 */
export function triggerDiagramResize(diagramId) {
    // Если у вас есть глобальный контекст или вы можете достучаться до текущего evl_context:
    if (window.currentEvaluationContext) {
        const symbol = window.currentEvaluationContext.getSymbolByName(diagramId);
        if (symbol && symbol.value && symbol.value.type === "DiagramState") {
            symbol.value.syncContainerSizes();
        }
    }
}