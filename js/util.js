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

function getOrCreateTaskbar() {
    let taskbar = document.getElementById('v-taskbar');
    if (!taskbar) {
        taskbar = document.createElement('div');
        taskbar.id = 'v-taskbar';
        Object.assign(taskbar.style, {
            position: 'fixed',
            top: '0',              // <-- Прижимаем к верхнему краю экрана
            left: '0',
            width: '100%',
            height: '40px',
            backgroundColor: 'rgba(245, 245, 245, 0.95)',
            borderBottom: '1px solid #dcdcdc', // <-- Линия теперь снизу панели
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            gap: '8px',
            boxSizing: 'border-box',
            zIndex: '999999',      // По-прежнему на самом верху
            userSelect: 'none'
        });
        document.body.appendChild(taskbar);
    }
    return taskbar;
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
        height: 'auto', //`${height}px`,
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
    /* let targetLeft = 0;
    let targetTop = 0;

    // Получаем ЧИСТЫЕ размеры видимой области страницы без учета полос прокрутки
    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = document.documentElement.clientHeight;

    // Расчет по оси X (Используем viewWidth)
    if (alignX === 'left') {
        targetLeft = 20; 
    } else if (alignX === 'right') {
        targetLeft = viewWidth - width - 20; // Теперь окно встанет ровно перед скроллбаром!
    } else { // 'center'
        targetLeft = viewWidth / 2 - width / 2;
    }

    // Расчет по оси Y (Используем viewHeight)
    if (alignY === 'top') {
        targetTop = 20;
    } else if (alignY === 'bottom') {
        targetTop = viewHeight - height - 40; // Даем чуть больше зазор снизу под горизонтальный скроллбар, если он есть
    } else { // 'center'
        targetTop = viewHeight / 2 - height / 2;
    }

    // ЭФФЕКТ СМЕЩЕНИЯ (Каскадное открытие окон)
    const openWindowsCount = document.querySelectorAll(`div[id^="floating-win-"]:not([data-is-minimized="true"])`).length;
    
    if (openWindowsCount > 0) {
        targetLeft += (openWindowsCount * 25);
        targetTop += (openWindowsCount * 25);
    }

    // Дополнительная проверка безопасности: если из-за каскада (смещения) 
    // окно начинает вылезать за правый или нижний край чистой видимой зоны, возвращаем его в границы.
    if (targetLeft + width > viewWidth) {
        targetLeft = viewWidth - width - 20;
    }
    if (targetTop + height > viewHeight) {
        targetTop = viewHeight - height - 40;
    }

    // Применяем финальные координаты
    win.style.left = `${targetLeft}px`;
    win.style.top = `${targetTop}px`; */
 
    let targetLeft = 0;
    let targetTop = 0;

    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = document.documentElement.clientHeight;

    if (alignX === 'left') {
        targetLeft = 20; 
    } else if (alignX === 'right') {
        targetLeft = viewWidth - width - 20;
    } else {
        targetLeft = viewWidth / 2 - width / 2;
    }

    if (alignY === 'top') {
        targetTop = 50; // <-- МЕНЯЕМ НА 50 (40px панель + 10px зазор), чтобы окно не уходило под панель!
    } else if (alignY === 'bottom') {
        targetTop = viewHeight - height - 20; 
    } else {
        targetTop = viewHeight / 2 - height / 2;
    }

    // ЭФФЕКТ СМЕЩЕНИЯ (Каскад)
    const openWindowsCount = document.querySelectorAll(`div[id^="floating-win-"]:not([data-is-minimized="true"])`).length;
    if (openWindowsCount > 0) {
        targetLeft += (openWindowsCount * 25);
        targetTop += (openWindowsCount * 25);
    }

    // Проверка границ (учитываем верхнюю панель задач в 40px)
    if (targetLeft + width > viewWidth) targetLeft = viewWidth - width - 20;
    if (targetTop + height > viewHeight) targetTop = viewHeight - height - 20;
    if (targetTop < 40) targetTop = 50; // Защита: не даем перетащить или создать окно выше панели

    win.style.left = `${targetLeft}px`;
    win.style.top = `${targetTop}px`;    

    // 2. Шапка окна
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '8px 14px',        // Чуть уменьшили вертикальный паддинг для аккуратности
        height: '38px',             // Жёстко фиксируем высоту шапки для точности расчётов
        boxSizing: 'border-box',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e5e5e5',
        cursor: 'move',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',       // Центрирует заголовок и блок кнопок по вертикали
        userSelect: 'none'
    });

    const title = document.createElement('span');
    title.textContent = `Векторная диаграмма [${diagramId}]`;
        Object.assign(title.style, {
        fontSize: '13px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',       // Запрещаем перенос строки
        overflow: 'hidden',         // Прячем то, что не влезло
        textOverflow: 'ellipsis',   // Добавляем красивое троеточие (...)
        marginRight: '10px',
        flex: '1'                   // Даём заголовку занять всё свободное место
    });
    header.appendChild(title);

    // Блок кнопок управления (Свернуть и Закрыть)
    const btnBlock = document.createElement('div');
    Object.assign(btnBlock.style, {
        display: 'flex',
        alignItems: 'center',       // Ровно центрируем кнопки внутри блока
        gap: '6px',
        height: '100%'
    });    

     // Общие базовые стили для кнопок, чтобы они стояли идеально ровно
    const baseBtnStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        cursor: 'pointer',
        fontWeight: 'bold',
        color: '#666',
        fontSize: '14px',
        borderRadius: '4px',
        transition: 'background-color 0.2s'
    };

    // КНОПКА СВЕРНУТЬ (_)
    const minBtn = document.createElement('span');
    minBtn.className = 'v-min-btn';
    minBtn.textContent = '_';
    Object.assign(minBtn.style, baseBtnStyle);
    // Добавим микро-эффект при наведении
    minBtn.addEventListener('mouseenter', () => minBtn.style.backgroundColor = '#e0e0e0');
    minBtn.addEventListener('mouseleave', () => minBtn.style.backgroundColor = 'transparent')

    minBtn.addEventListener('click', (e) => {
        /*e.stopPropagation(); // Чтобы не сработал драг шапки
        
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
        }*/
        e.stopPropagation();
        
        if (win.dataset.isMinimized === 'false') {
            win.dataset.isMinimized = 'true';
            win.style.display = 'none'; // Просто прячем окно
            
            const taskbar = getOrCreateTaskbar();
            
            const taskBtn = document.createElement('div');
            taskBtn.id = `task-btn-${diagramId}`;
            taskBtn.textContent = `📊 [${diagramId}]`;
            
            Object.assign(taskBtn.style, {
                padding: '0 12px',
                height: '30px',
                backgroundColor: '#ffffff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                maxWidth: '160px',
                minWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
            });
            
            taskBtn.addEventListener('mouseenter', () => taskBtn.style.backgroundColor = '#f0f0f0');
            taskBtn.addEventListener('mouseleave', () => taskBtn.style.backgroundColor = '#ffffff');
            
            taskBtn.addEventListener('click', () => {
                restoreWindow(win);
                taskbar.removeChild(taskBtn);
                
                if (taskbar.children.length === 0) {
                    taskbar.remove();
                }
            });
            
            taskbar.appendChild(taskBtn);
        }       
    });

    // КНОПКА ЗАКРЫТЬ (×)
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, baseBtnStyle);
    closeBtn.style.fontSize = '18px'; // Крестик сделаем чуть крупнее визуально
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
        
        // Удаляем кнопку с панели задач, если она там была
        const taskBtn = document.getElementById(`task-btn-${diagramId}`);
        if (taskBtn) {
            taskBtn.remove();
            // Проверяем, не опустела ли панель задач
            const taskbar = document.getElementById('v-taskbar');
            if (taskbar && taskbar.children.length === 0) taskbar.remove();
        }
        
        document.body.removeChild(win);        
        /*e.stopPropagation();
        document.body.removeChild(win);*/
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
    Object.assign(content.style, 
        { flex: '1', 
          width: '100%', 
          height: `${height}px`, //'100%', 
          backgroundColor: '#fafafa', 
          position: 'relative' });
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
        startW = parseInt(win.style.width, 10); 
        startH = parseInt(content.style.height, 10); // <-- СЧИТЫВАЕМ ВЫСОТУ С КОНТЕНТА, А НЕ С WIN
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
            
            // Ограничиваем минимальные размеры
            nw = Math.max(180, nw);
            nh = Math.max(100, nh);
            
            // Меняем ширину у всего окна, а высоту — строго у контента диаграммы!
            win.style.width = `${nw}px`;
            content.style.height = `${nh}px`; // <-- МЕНЯЕМ ТУТ
            
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