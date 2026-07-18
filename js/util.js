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

// Переменная живет вне функции, чтобы быть общей для всех создаваемых окон
let maxZIndex = 10000;

/**
 * @param {string} diagramId 
 * @param {Function} onResize - функция обратного вызова при ресайзе
 * @param {Object} [options] - настройки размеров и позиционирования
 * @param {number} [options.width=300] - начальная ширина окна
 * @param {number} [options.height=320] - начальная высота окна
 * @param {string} [options.alignX='center'] - 'left' | 'center' | 'right'
 * @param {string} [options.alignY='center'] - 'top' | 'center' | 'bottom'
 */
export function createFloatingWindowDOM(diagramId, onResize, options = {}) {
    const windowId = `floating-win-${diagramId}`;
    let win = document.getElementById(windowId);
    
    // Значения по умолчанию, если пользователь ничего не передал
    const alignX = options.alignX || 'center';
    const alignY = options.alignY || 'center';

    // 1. Берем размеры из настроек или ставим значения по умолчанию
    let width = options.width || 300;
    let height = options.height || 330;

    // 2. Ограничиваем МАКСИМАЛЬНЫЙ размер по окну браузера (минус 40px на зазоры)
    // Если браузер пользователя сжат до 800px, то окно не станет шире 760px
    width = Math.min(width, window.innerWidth - 40);
    height = Math.min(height, window.innerHeight - 40);

    // 3. Защита от экстремально маленьких размеров
    // Меньше 180px делать нельзя, иначе кнопки «_» и «×» перекроют текст заголовка
    width = Math.max(180, width);
    height = Math.max(100, height); // Высота может быть совсем маленькой    

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
            //triggerDiagramResize(diagramId);
            if (typeof onResize === 'function') onResize();
        }
    };

    // Если окно уже существует в DOM — просто разворачиваем его в старых позициях
    if (win) {
        restoreWindow(win);
        // При повторном открытии существующего окна тоже выводим его на передний план
        maxZIndex++;
        win.style.zIndex = String(maxZIndex);
        return win.querySelector('.v-win-content');
    }

    // 1. Главный контейнер окна
    win = document.createElement('div');
    win.id = windowId;
    win.dataset.isMinimized = 'false';
    
    // Логика вывода окна на передний план
    const activateWindow = () => {
        if (win.style.zIndex !== String(maxZIndex)) {
            maxZIndex++;
            win.style.zIndex = String(maxZIndex);
        }
    };

    // Выводим на передний план при любом клике внутри окна
    win.addEventListener('mousedown', activateWindow);
    
    Object.assign(win.style, {
        position: 'fixed',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#ffffff',
        border: '1px solid #dcdcdc',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: String(maxZIndex), // Стартовый z-index
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });

    // --- УМНОЕ ПОЗИЦИОНИРОВАНИЕ (Как в Windows) ---
    let targetLeft = 0;
    let targetTop = 0;

    // Расчет по оси X
    if (alignX === 'left') {
        targetLeft = 20; // Небольшой отступ от края экрана
    } else if (alignX === 'right') {
        targetLeft = window.innerWidth - width - 20;
    } else { // 'center'
        targetLeft = window.innerWidth / 2 - width / 2;
    }

    // Расчет по оси Y
    if (alignY === 'top') {
        targetTop = 20;
    } else if (alignY === 'bottom') {
        targetTop = window.innerHeight - height - 20;
    } else { // 'center'
        targetTop = window.innerHeight / 2 - height / 2;
    }

    // ЭФФЕКТ СМЕЩЕНИЯ (Каскадное открытие окон, чтобы они не перекрывали друг друга один в один)
    // Находим сколько окон СЕЙЧАС открыто (не свернуто) на экране
    const openWindowsCount = document.querySelectorAll(`div[id^="floating-win-"]:not([data-is-minimized="true"])`).length;
    
    // Если на экране уже есть окна, смещаем новое окно по диагонали на 25 пикселей за каждое окно
    if (openWindowsCount > 0) {
        targetLeft += (openWindowsCount * 25);
        targetTop += (openWindowsCount * 25);
    }

    // Применяем финальные координаты
    win.style.left = `${targetLeft}px`;
    win.style.top = `${targetTop}px`;    
    //win.style.left = `${window.innerWidth / 2 - 225}px`;
    //win.style.top = `${window.innerHeight / 2 - 245}px`; // Досчитали центрирование по вертикале

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
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.removeChild(win);
    });

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
            win.style.width = `${Math.max(250, nw)}px`;
            win.style.height = `${Math.max(250, nh)}px`;
            
            //triggerDiagramResize(diagramId);
            if (typeof onResize === 'function') onResize();
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
/*export function triggerDiagramResize(diagramId) {
    // Если у вас есть глобальный контекст или вы можете достучаться до текущего evl_context:
    if (window.currentEvaluationContext) {
        const symbol = window.currentEvaluationContext.getSymbolByName(diagramId);
        if (symbol && symbol.value && symbol.value.type === "DiagramState") {
            symbol.value.syncContainerSizes();
        }
    }
}*/