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

// Глобальный счетчик слоев (должен быть объявлен ВНЕ функции вверху файла)
let maxZIndex = 10000;

/**
 * Создает верхнюю панель задач, если её еще нет
 */
function getOrCreateTaskbar() {
    let taskbar = document.getElementById('v-taskbar');
    if (!taskbar) {
        taskbar = document.createElement('div');
        taskbar.id = 'v-taskbar';
        Object.assign(taskbar.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '42px',
            backgroundColor: '#2c3e50', // Темная контрастная панель
            borderBottom: '2px solid #34495e',
            display: 'flex',
            alignItems: 'center',
            padding: '0 15px',
            gap: '8px',
            boxSizing: 'border-box',
            zIndex: '999999',
            userSelect: 'none'
        });
        document.body.appendChild(taskbar);
    }
    return taskbar;
}

/**
 * Создает плавающее перетаскиваемое окно для отображения векторной диаграммы.
 * @param {string} diagramId - Уникальный идентификатор диаграммы
 * @param {Function} onResize - Коллбэк при изменении размеров
 * @param {Object} [options] - Настройки
 */
export function createFloatingWindowDOM(diagramId, onResize, options = {}) {
    const windowId = `floating-win-${diagramId}`;
    let win = document.getElementById(windowId);
    
    // Считываем размеры и позиционирование
    let width = options.width || 300;
    let height = options.height || 330;
    const alignX = options.alignX || 'center';
    const alignY = options.alignY || 'center';

    // Ограничиваем размеры по окну браузера
    width = Math.min(width, window.innerWidth - 40);
    height = Math.min(height, window.innerHeight - 80);
    width = Math.max(180, width);
    height = Math.max(100, height);

    // ФУНКЦИЯ ВОССТАНОВЛЕНИЯ ОКНА
    const restoreWindow = (targetWin) => {
        if (targetWin.dataset.isMinimized === 'true') {
            targetWin.dataset.isMinimized = 'false';
            targetWin.style.display = 'flex'; // Возвращаем flex-контейнер окна
            
            // Восстанавливаем сохраненные размеры контента и позиции окна
            const contentEl = targetWin.querySelector('.v-win-content');
            const resizeEl = targetWin.querySelector('.v-resize-handle');
            
            if (contentEl) contentEl.style.height = targetWin.dataset.savedContentHeight;
            targetWin.style.width = targetWin.dataset.savedWidth;
            targetWin.style.left = targetWin.dataset.savedLeft;
            targetWin.style.top = targetWin.dataset.savedTop;
            
            if (contentEl) contentEl.style.display = 'block';
            if (resizeEl) resizeEl.style.display = 'block';
            
            const minBtnEl = targetWin.querySelector('.v-min-btn');
            if (minBtnEl) minBtnEl.textContent = '_';
            
            if (typeof onResize === 'function') {
                try { onResize(); } catch (e) {}
            }
        }
    };

    // Если окно уже существует — разворачиваем его и выводим на передний план
    if (win) {
        restoreWindow(win);
        maxZIndex++;
        win.style.zIndex = String(maxZIndex);
        return win.querySelector('.v-win-content');
    }

    // 1. Создаем главный контейнер окна
    win = document.createElement('div');
    win.id = windowId;
    win.dataset.isMinimized = 'false';
    
    const activateWindow = () => {
        if (win.style.zIndex !== String(maxZIndex)) {
            maxZIndex++;
            win.style.zIndex = String(maxZIndex);
        }
    };

    win.addEventListener('mousedown', activateWindow);
    
    Object.assign(win.style, {
        position: 'fixed',
        width: `${width}px`,
        height: 'auto', // Высота подстраивается автоматически под шапку + контент
        backgroundColor: '#ffffff',
        border: '1px solid #dcdcdc',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: String(maxZIndex),
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });

    // Расчет чистых координат видимой области (без скроллбаров)
    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = document.documentElement.clientHeight;
    let targetLeft = 0;
    let targetTop = 0;

    if (alignX === 'left') targetLeft = 20;
    else if (alignX === 'right') targetLeft = viewWidth - width - 20;
    else targetLeft = viewWidth / 2 - width / 2;

    if (alignY === 'top') targetTop = 60; // 42px панель + зазор
    else if (alignY === 'bottom') targetTop = viewHeight - height - 60;
    else targetTop = viewHeight / 2 - height / 2;

    // Каскадное смещение
    const openWindowsCount = document.querySelectorAll(`div[id^="floating-win-"]:not([data-is-minimized="true"])`).length;
    if (openWindowsCount > 0) {
        targetLeft += (openWindowsCount * 25);
        targetTop += (openWindowsCount * 25);
    }

    // Проверка выхода за границы экрана
    if (targetLeft + width > viewWidth) targetLeft = viewWidth - width - 20;
    if (targetTop + height > viewHeight) targetTop = viewHeight - height - 60;
    if (targetTop < 42) targetTop = 60;

    win.style.left = `${targetLeft}px`;
    win.style.top = `${targetTop}px`;    

    // 2. Шапка окна
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '0 14px',
        height: '38px',
        boxSizing: 'border-box',
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
    Object.assign(title.style, {
        fontSize: '13px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginRight: '10px',
        flex: '1'
    });
    header.appendChild(title);

    // Блок кнопок управления
    const btnBlock = document.createElement('div');
    Object.assign(btnBlock.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '100%'
    });

    const baseBtnStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '22px',
        height: '22px',
        cursor: 'pointer',
        fontWeight: 'bold',
        color: '#666',
        fontSize: '14px',
        borderRadius: '4px',
        transition: 'background-color 0.2s'
    };

    // КНОПКА СВЕРНУТЬ
    const minBtn = document.createElement('span');
    minBtn.className = 'v-min-btn';
    minBtn.textContent = '_';
    Object.assign(minBtn.style, baseBtnStyle);
    minBtn.addEventListener('mouseenter', () => minBtn.style.backgroundColor = '#e0e0e0');
    minBtn.addEventListener('mouseleave', () => minBtn.style.backgroundColor = 'transparent');
    
    minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (win.dataset.isMinimized === 'false') {
            const contentEl = win.querySelector('.v-win-content');
            const resizeEl = win.querySelector('.v-resize-handle');
            
            // Сохраняем размеры перед скрытием
            win.dataset.savedWidth = win.style.width;
            win.dataset.savedContentHeight = contentEl ? contentEl.style.height : `${height}px`;
            win.dataset.savedLeft = win.style.left;
            win.dataset.savedTop = win.style.top;
            
            win.dataset.isMinimized = 'true';
            win.style.display = 'none'; // Прячем окно полностью
            
            const taskbar = getOrCreateTaskbar();
            const taskBtn = document.createElement('div');
            taskBtn.id = `task-btn-${diagramId}`;
            taskBtn.textContent = `📊 [${diagramId}]`;
            
            Object.assign(taskBtn.style, {
                padding: '0 12px',
                height: '30px',
                backgroundColor: '#ffffff', // Белая кнопка
                border: '1px solid #ccc',
                color: '#333333',          // Темный текст
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                maxWidth: '160px',
                minWidth: '90px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
            });
            
            taskBtn.addEventListener('mouseenter', () => taskBtn.style.backgroundColor = '#ecf0f1');
            taskBtn.addEventListener('mouseleave', () => taskBtn.style.backgroundColor = '#ffffff');
            
            taskBtn.addEventListener('click', () => {
                restoreWindow(win);
                taskBtn.remove();
                if (taskbar.children.length === 0) taskbar.remove();
            });
            
            taskbar.appendChild(taskBtn);
        }
    });
	
    // КНОПКА ЗАКРЫТЬ
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, baseBtnStyle);
    closeBtn.style.fontSize = '18px';
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = '#ff4d4f';
        closeBtn.style.color = '#fff';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.color = '#666';
    });
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskBtn = document.getElementById(`task-btn-${diagramId}`);
        if (taskBtn) {
            taskBtn.remove();
            const taskbar = document.getElementById('v-taskbar');
            if (taskbar && taskbar.children.length === 0) taskbar.remove();
        }
        document.body.removeChild(win);
    });

    btnBlock.appendChild(minBtn);
    btnBlock.appendChild(closeBtn);
    header.appendChild(btnBlock);
    win.appendChild(header);

    // 3. Тело окна (Чистая высота под диаграмму)
    const content = document.createElement('div');
    content.className = 'v-win-content';
    Object.assign(content.style, {
        flex: '1',
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#fafafa',
        position: 'relative'
    });
    win.appendChild(content);

    // 4. Уголок Resize Handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'v-resize-handle';
    Object.assign(resizeHandle.style, {
        position: 'absolute', right: '0', bottom: '0', width: '14px', height: '14px',
        cursor: 'se-resize', background: 'linear-gradient(135deg, transparent 40%, #ccc 40%, #ccc 60%, transparent 60%, transparent 80%, #ccc 80%)',
        zIndex: '10001'
    });
    win.appendChild(resizeHandle);

    document.body.appendChild(win);

    // ЛОГИКА ПЕРЕМЕЩЕНИЯ (ДРАГ)
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || win.dataset.isMinimized === 'true') return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initialLeft = parseInt(win.style.left, 10); initialTop = parseInt(win.style.top, 10);
        document.body.style.cursor = 'move';
        e.preventDefault();
    });

    // ЛОГИКА РЕСАЙЗА
    let isResizing = false, startW, startH;
    resizeHandle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isResizing = true;
        startX = e.clientX; startY = e.clientY;
        startW = parseInt(win.style.width, 10); 
        startH = parseInt(content.style.height, 10);
        document.body.style.cursor = 'se-resize';
        e.preventDefault();
        e.stopPropagation();
    });

    // ОБЩИЙ ОБРАБОТЧИК ДВИЖЕНИЯ МЫШИ
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let nl = initialLeft + (e.clientX - startX);
            let nt = initialTop + (e.clientY - startY);
            win.style.left = `${Math.max(0, Math.min(nl, document.documentElement.clientWidth - win.offsetWidth))}px`;
            win.style.top = `${Math.max(42, Math.min(nt, document.documentElement.clientHeight - win.offsetHeight))}px`;
        }
        else if (isResizing) {
            let nw = startW + (e.clientX - startX);
            let nh = startH + (e.clientY - startY);
            nw = Math.max(180, nw);
            nh = Math.max(100, nh);
            
            win.style.width = `${nw}px`;
            content.style.height = `${nh}px`;
            
            if (typeof onResize === 'function') {
                try { onResize(); } catch (err) {}
            } 
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