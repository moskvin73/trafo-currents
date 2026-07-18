/**
 * Класс для интерактивного рендеринга векторных диаграмм в SVG с поддержкой MathJax v3/v4
 */
export default class VectorDiagram {
    /**
     * @param {string|HTMLElement} container - Селектор или DOM-элемент, куда вставить SVG
     * @param {Object} data - Специфицированный JSON-пакет данных
     */
    constructor(container, data) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.data = data;
        
        // 1. Динамически считываем ширину контейнера, в который нас вставили.
        // Если калькулятор создал div шириной 300px или 800px, мы адаптируемся под него.
        const rect = this.container.getBoundingClientRect();
        
        const w = rect.width || this.data.config.width || 300;
        const h = rect.height || this.data.config.height || 300;

        const s = Math.min(w, h);
        // Берем ширину контейнера. Если он скрыт или равен 0, то берем значение из конфига или 600
        this.width = s;
        
        // Чтобы диаграмма была квадратной, делаем высоту равной ширине 
        // (для векторных диаграмм это обычно оптимально)
        this.height = s;
        
        this.x0 = this.width / 2;
        this.y0 = this.height / 2;
        
        // Оставляем прежний ваш расчет радиуса, но теперь он отталкивается от реального размера
        this.maxRadius = Math.min(this.width, this.height) / 2 * 0.8;
        
        this.scales = {};       
        this.calculated = [];   
        
        this.svg = null;
        this.init();        
    }
    
    /**
     * Инициализация процесса построения
     */
    async init() {
        this.calculateGeometry();
        this.calculateScales();
        this.renderSVG();
        await this.renderAndPositionLabels();
        this.initContextMenu();
    }

    /**
     * Динамическое обновление данных диаграммы (для реактивного калькулятора)
     */
    async updateData(newData) {
        this.data = newData;
        
        // Сбрасываем старые расчеты
        this.scales = {};
        this.calculated = [];
        
        // Запускаем конвейер пересчета заново
        this.calculateGeometry();
        this.calculateScales();
        this.renderSVG(); // Перерисовывает сетку и линии векторов
        await this.renderAndPositionLabels(); // Запускает MathJax и расставляет подписи
    }   

    /**
     * Этап 1: Перевод относительных связей векторов в абсолютные математические координаты
     */
    calculateGeometry() {
        const vectorMap = new Map();
        const queue = [...this.data.vectors];
        
        // Рекурсивно/циклически разрешаем зависимости origin.type === "vector"
        let attempts = 0;
        while (queue.length > 0 && attempts < queue.length * 2) {
            const vec = queue.shift();
            
            let xStart = 0;
            let yStart = 0;
            
            if (vec.origin && vec.origin.type === 'vector') {
                const parent = vectorMap.get(vec.origin.id);
                if (!parent) {
                    // Родитель еще не рассчитан, отправляем в конец очереди
                    queue.push(vec);
                    attempts++;
                    continue;
                }
                xStart = parent.xEnd;
                yStart = parent.yEnd;
            }
            
            const xEnd = xStart + vec.value.re;
            const yEnd = yStart + vec.value.im;
            
            const calculatedVec = {
                ...vec,
                xStart,
                yStart,
                xEnd,
                yEnd,
                // Модуль (длина) финальной точки от центра координат (нужен для масштаба слоя)
                maxR: Math.hypot(xEnd, yEnd)
            };
            
            vectorMap.set(vec.id, calculatedVec);
            this.calculated.push(calculatedVec);
            attempts = 0; // Сбрасываем счетчик зацикливания при успешном разборе
        }
        
        if (queue.length > 0) {
            console.error("Обнаружена циклическая зависимость или потерян родительский ID в векторах:", queue);
        }
    }

    /**
     * Этап 2: Расчет индивидуального масштаба (S) для каждой субдиаграммы (слоя)
     */
    calculateScales() {
        const layerMaxMagnitudes = {};
        
        // 1. Инициализируем слои
        Object.keys(this.data.layers).forEach(layerName => {
            layerMaxMagnitudes[layerName] = 0.001; 
        });
        
        // 2. Ищем максимальный вылет вектора (maxR) индивидуально в каждом слое
        this.calculated.forEach(vec => {
            if (layerMaxMagnitudes[vec.layer] !== undefined) {
                if (vec.maxR > layerMaxMagnitudes[vec.layer]) {
                    layerMaxMagnitudes[vec.layer] = vec.maxR;
                }
            }
        });
        
        // 3. Считаем индивидуальный масштаб для каждого слоя отдельно!
        // Каждый слой теперь занимает свой максимум в пределах доступного maxRadius
        Object.keys(layerMaxMagnitudes).forEach(layerName => {
            this.scales[layerName] = this.maxRadius / layerMaxMagnitudes[layerName];
        });

        // 4. УМНОЕ ЦЕНТРИРОВАНИЕ (Bounding Box) с учетом разных масштабов
        // Переводим математические экстремумы в пиксельные границы холста относительно локального нуля
        let minPixX = 0, maxPixX = 0, minPixY = 0, maxPixY = 0;

        this.calculated.forEach(vec => {
            const S = this.scales[vec.layer];
            
            // Считаем координаты точек в пикселях без учета сдвига (относительно нуля)
            let xStartPix, yStartPix, xEndPix, yEndPix;
            
            if (this.data.config.mode === 'three_phase') {
                // Электротехника базис: Re -> вверх (-Y), Im -> вправо (+X)
                xStartPix = -vec.yStart * S; // Im уходит влево
                yStartPix = -vec.xStart * S; // Re уходит вверх
                xEndPix = -vec.yEnd * S;
                yEndPix = -vec.xEnd * S;
            } else {
                // Математический базис: Re -> вправо (+X), Im -> вверх (-Y)
                xStartPix = vec.xStart * S;
                yStartPix = -vec.yStart * S;
                xEndPix = vec.xEnd * S;
                yEndPix = -vec.yEnd * S;
            }

            minPixX = Math.min(minPixX, xStartPix, xEndPix);
            maxPixX = Math.max(maxPixX, xStartPix, xEndPix);
            minPixY = Math.min(minPixY, yStartPix, yEndPix);
            maxPixY = Math.max(maxPixY, yStartPix, yEndPix);
        });

        // Находим пиксельный центр геометрии векторов
        const pixCenterX = (minPixX + maxPixX) / 2;
        const pixCenterY = (minPixY + maxPixY) / 2;

        // Сдвигаем (x0, y0) холста так, чтобы компенсировать пустые поля
        this.x0 = (this.width / 2) - pixCenterX;
        this.y0 = (this.height / 2) - pixCenterY;
    }

    /**
     * Перевод математических координат в экранные пиксели SVG для подписей (Label-слой)
     * @param {number} x - Математическая координата X
     * @param {number} y - Математическая координата Y
     * @param {string} layer - Имя слоя (для извлечения масштаба)
     * @returns {{x: number, y: number}} Пиксели на холсте
     */
    projectCoordinates(x, y, layer) {
        const S = this.scales[layer];
        if (this.data.config.mode === 'three_phase') {
            // Изменили знак плюс на минус перед мнимой частью (y), чтобы подписи тоже уходили влево
            return {
                x: this.x0 - y * S, 
                y: this.y0 - x * S
            };
        } else {
            return {
                x: this.x0 + x * S,
                y: this.y0 - y * S
            };
        }
    }

    /**
     * Этап 3: Генерация базовой структуры SVG и векторов через матрицы трансформации
     */
    renderSVG() {
        // Создаем элемент SVG
        const svgNS = "http://www.w3.org/2000/svg";
        this.svg = document.createElementNS(svgNS, "svg");
   
        // ВАЖНО: Вместо жестких width/height задаем viewBox
        this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
        
        // Делаем SVG адаптивным через CSS стили
        this.svg.style.width = "100%";
        this.svg.style.height = "auto";
        this.svg.style.display = "block"; 
        this.svg.style.backgroundColor = "#fafafa";
        this.svg.style.overflow = "visible";        
        
        // 3.1 Генерация маркеров-стрелок в <defs>
        const defs = document.createElementNS(svgNS, "defs");
        Object.entries(this.data.layers).forEach(([layerName, layerConfig]) => {
            const marker = document.createElementNS(svgNS, "marker");
            marker.setAttribute("id", layerConfig.markerId);
            marker.setAttribute("viewBox", "0 0 10 10");
            marker.setAttribute("refX", "10"); // Остриё на конце линии
            marker.setAttribute("refY", "5");
            marker.setAttribute("markerWidth", "6");
            marker.setAttribute("markerHeight", "6");
            marker.setAttribute("orient", "auto-start-reverse");
            
            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", "M 0 1.5 L 10 5 L 0 8.5 z");
            path.setAttribute("fill", layerConfig.color);
            
            marker.appendChild(path);
            defs.appendChild(marker);
        });
        this.svg.appendChild(defs);

        // 3.3 Создание трансформируемых групп графики для каждого слоя
        const layerGroups = {};
        Object.entries(this.data.layers).forEach(([layerName, layerConfig]) => {
            const g = document.createElementNS(svgNS, "g");
            g.setAttribute("id", `layer-${layerName}`);
            
            // Расчет матрицы трансформации matrix(a, b, c, d, e, f)
            const S = this.scales[layerName];
            let matrix = "";
            if (this.data.config.mode === 'three_phase') {
                matrix = `matrix(0, ${-S}, ${-S}, 0, ${this.x0}, ${this.y0})`;
            } else {
                matrix = `matrix(${S}, 0, 0, ${-S}, ${this.x0}, ${this.y0})`;
            }
            g.setAttribute("transform", matrix);
            
            this.svg.appendChild(g);
            layerGroups[layerName] = g;
        });

        // 3.4 Отрендерить стрелы векторов в их группы (в чистых физ. величинах)
        this.calculated.forEach(vec => {
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", vec.xStart);
            line.setAttribute("y1", vec.yStart);
            line.setAttribute("x2", vec.xEnd);
            line.setAttribute("y2", vec.yEnd);
            
            const config = this.data.layers[vec.layer];
            line.setAttribute("stroke", config.color);
            line.setAttribute("stroke-width", (config.strokeWidth || 2) / this.scales[vec.layer]); // Компенсация масштаба для толщины линии
            line.setAttribute("marker-end", `url(#${config.markerId})`);
            
            layerGroups[vec.layer].appendChild(line);
        });

        // 3.5 Создаем выделенный "чистый" слой для MathJax поверх трансформированных групп
        this.labelsLayer = document.createElementNS(svgNS, "g");
        this.labelsLayer.setAttribute("id", "mathjax-labels-layer");
        this.svg.appendChild(this.labelsLayer);

        // 3.2 Отрисовка координатной сетки (необязательно, но полезно)
        this.renderGrid(svgNS);

        // НАПОЛНЯЕМ СЛОЙ ПОДПИСЯМИ (Важное исправление!)
        this.calculated.forEach(vec => {
            const fo = document.createElementNS(svgNS, "foreignObject");
            fo.setAttribute("id", `label-fo-${vec.id}`);
            fo.setAttribute("width", "200"); // Задаем временный большой размер, чтобы текст поместился
            fo.setAttribute("height", "100");
            fo.setAttribute("overflow", "visible");
            // Изначально прячем элементы через opacity, чтобы они не мерцали в левом верхнем углу (0,0)
            fo.setAttribute("opacity", "0"); 

            const div = document.createElement("div");
            div.style.display = "inline-block";
            div.style.whiteSpace = "nowrap";
            div.style.fontFamily = "MathJax_Main, sans-serif";
            div.style.lineHeight = "1";
            div.innerHTML = `\\(${vec.label}\\)`; // Инлайновые разделители MathJax

            fo.appendChild(div);
            this.labelsLayer.appendChild(fo);
        });

        // Встраиваем готовый SVG в контейнер страницы
        this.container.innerHTML = "";
        this.container.appendChild(this.svg);
    }

    /**
     * Отрисовка базовых осей
     */
    renderGrid(svgNS) {
         const axes = document.createElementNS(svgNS, "g");
        axes.setAttribute("stroke", "#ccc");
        axes.setAttribute("stroke-width", "1");
        axes.setAttribute("stroke-dasharray", "4 4");

        // Горизонтальная ось
        const hLine = document.createElementNS(svgNS, "line");
        hLine.setAttribute("x1", "0"); hLine.setAttribute("y1", this.y0);
        hLine.setAttribute("x2", this.width); hLine.setAttribute("y2", this.y0);
        
        // Вертикальная ось
        const vLine = document.createElementNS(svgNS, "line");
        vLine.setAttribute("x1", this.x0); vLine.setAttribute("y1", "0");
        vLine.setAttribute("x2", this.x0); vLine.setAttribute("y2", this.height);

        axes.appendChild(hLine);
        axes.appendChild(vLine);
        this.svg.appendChild(axes);

        // Определяем текст и координаты подписей в зависимости от режима
        let axisLabels = [];
        const padding = 15; // Отступ от краев осей в пикселях

        if (this.data.config.mode === 'three_phase') {
            // ЭЛЕКТРОТЕХНИКА: Вверх -> +1, Влево -> +j (поворот против часовой стрелки на 90 градусов)
            axisLabels = [
                { text: '+1', x: this.x0 + 8, y: padding }, // Сверху на вертикальной оси
                { text: '+j', x: padding, y: this.y0 - 22 }  // Слева на горизонтальной оси (над линией)
            ];
        } else {
            // СТАНДАРТНАЯ МАТЕМАТИКА: Вправо -> +1, Вверх -> +j
            axisLabels = [
                { text: '+j', x: this.x0 + 8, y: padding }, // Сверху на вертикальной оси
                { text: '+1', x: this.width - padding - 20, y: this.y0 + 5 } // Справа на горизонтальной оси
            ];
        }

        // Рендерим подписи осей через foreignObject для MathJax
        axisLabels.forEach((axis, index) => {
            const fo = document.createElementNS(svgNS, "foreignObject");
            fo.setAttribute("id", `axis-label-${index}`);
            fo.setAttribute("width", "40");
            fo.setAttribute("height", "30");
            fo.setAttribute("x", axis.x);
            fo.setAttribute("y", axis.y);
            fo.setAttribute("overflow", "visible");
            fo.setAttribute("opacity", "0"); // Изначально скрываем для хака с MathJax

            const div = document.createElement("div");
            div.style.display = "inline-block";
            div.style.whiteSpace = "nowrap";
            div.style.fontFamily = "MathJax_Main, sans-serif";
            div.style.fontSize = "14px";
            div.style.color = "#666"; 
            div.innerHTML = `\\(${axis.text}\\)`;

            fo.appendChild(div);
            
            // Если labelsLayer еще не создан в renderSVG, подстрахуемся
            if (!this.labelsLayer) {
                this.labelsLayer = document.createElementNS(svgNS, "g");
                this.labelsLayer.setAttribute("id", "mathjax-labels-layer");
                this.svg.appendChild(this.labelsLayer);
            }
            this.labelsLayer.appendChild(fo);
        }); 
    }
	
    /**
     * Этап 4: Отрисовка MathJax, замер BBox элементов и их прецизионное выравнивание
     */
    async renderAndPositionLabels() {
        const svgNS = "http://www.w3.org/2000/svg";
        
        // ХАК ДЛЯ БРАУЗЕРА: На мгновение делаем все подписи видимыми, 
        // иначе getBoundingClientRect() вернет нули для скрытых элементов!
        this.calculated.forEach(vec => {
            const fo = this.labelsLayer.querySelector(`#label-fo-${vec.id}`);
            if (fo) fo.setAttribute("opacity", "1");
        });

        // ДОБАВИТЬ СТРОКУ: Делаем видимыми наименования осей
        this.labelsLayer.querySelectorAll("[id^='axis-label-']").forEach(fo => fo.setAttribute("opacity", "1"));

        // Запускаем рендеринг MathJax
        if (window.MathJax && window.MathJax.typesetPromise) {
            await window.MathJax.typesetPromise([this.labelsLayer]);
        }
        // Собираем массив метаданных обо всех метках (Ваш текущий код без изменений)
        const labelItems = this.calculated.map(vec => {
            const fo = this.labelsLayer.querySelector(`#label-fo-${vec.id}`); 
            const div = fo ? fo.querySelector("div") : null;
            const rect = div ? div.getBoundingClientRect() : { width: 60, height: 20 };
            
            return {
                vec: vec,
                element: fo,
                wrapperDiv: div,
                w: rect.width || 60,
                h: rect.height || 20,
                ptEnd: this.projectCoordinates(vec.xEnd, vec.yEnd, vec.layer)
            };
        });

        // Разделяем метки на два типа: центральные лучи и соединительные хорды
        const centralLabels = [];
        const chordLabels = [];

        labelItems.forEach(item => {
            if (item.element) {
                // Задаем точные размеры foreignObject на основе замеров MathJax
                item.element.setAttribute("width", item.w);
                item.element.setAttribute("height", item.h);
                
                if (item.vec.origin && item.vec.origin.type === 'vector') {
                    chordLabels.push(item);
                } else {
                    centralLabels.push(item);
                }
            }
        });

        // =====================================================================
        // ЧАСТЬ 1: ГРУППИРОВКА ЦЕНТРАЛЬНЫХ ЛУЧЕЙ В ПУЧКИ (КЛАСТЕРИЗАЦИЯ)
        // =====================================================================
        const bundles = []; // Массив пучков векторов
        const ANGLE_THRESHOLD = 0.08; // Порог совпадения фаз (~4.5 градуса)

        centralLabels.forEach(item => {
            // Считаем чистый математический угол вектора в радианах
            let angle = Math.atan2(item.vec.value.im, item.vec.value.re);
            // Нормализуем угол в диапазон [0, 2*PI)
            if (angle < 0) angle += 2 * Math.PI;

            // Ищем, есть ли уже существующий пучок с похожим углом
            let foundBundle = bundles.find(b => {
                let diff = Math.abs(b.baseAngle - angle);
                // Учитываем переход через 0 / 2*PI
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                return diff < ANGLE_THRESHOLD;
            });

            if (foundBundle) {
                foundBundle.items.push(item);
            } else {
                bundles.push({
                    baseAngle: angle,
                    items: [item]
                });
            }
        });

        // =====================================================================
        // ЧАСТЬ 2: РАСПРЕДЕЛЕНИЕ МЕТОК ВНУТРИ ПУЧКОВ (ПРАВИЛО ОЧЕРЕДИ И НОРМАЛЕЙ)
        // =====================================================================
        bundles.forEach(bundle => {
            // 1. Находим остриё самого длинного вектора в пучке
            let maxPtEnd = bundle.items[0].ptEnd;
            let maxDist = 0;
            bundle.items.forEach(item => {
                const dist = Math.hypot(item.ptEnd.x - this.x0, item.ptEnd.y - this.y0);
                if (dist > maxDist) {
                    maxDist = dist;
                    maxPtEnd = item.ptEnd;
                }
            });

            // 2. Считаем угол луча НА ЭКРАНЕ (в пикселях от центра SVG)
            // Везервация инверсии оси Y в SVG: экранный Y растет вниз, поэтому знак минус перед дельтой Y
            const screenAngle = Math.atan2(this.y0 - maxPtEnd.y, maxPtEnd.x - this.x0);

            // Сортируем элементы пучка по слоям
            bundle.items.sort((a, b) => a.vec.layer.localeCompare(b.vec.layer));

            bundle.items.forEach((item, index) => {
                let finalX = maxPtEnd.x;
                let finalY = maxPtEnd.y;
                
                const indent = 25; // Отступ от острия в пикселях

                if (index === 0) {
                    // Элемент 0: СТРОГО НА ПРОДОЛЖЕНИИ ЛУЧА НА ЭКРАНЕ
                    finalX += Math.cos(screenAngle) * indent;
                    finalY -= Math.sin(screenAngle) * indent;

                    // Корректируем центр масс прямоугольника MathJax, 
                    // чтобы линия луча визуально протыкала формулу ровно по центру
                    finalX += (-0.5 * (1 - Math.cos(screenAngle))) * item.w;
                    finalY += (-0.5 * (1 + Math.sin(screenAngle))) * item.h;

                } else {
                    // Элементы 1, 2...: Вынос по перпендикулярам к экранному лучу
                    const isPositiveNormal = (index % 2 !== 0);
                    const stepMultiplier = Math.ceil(index / 2);
                    
                    // Угол перпендикуляра на экране
                    const normalAngle = isPositiveNormal ? (screenAngle + Math.PI / 2) : (screenAngle - Math.PI / 2);
                    
                    // Шаг сдвига вбок в зависимости от наклона (по высоте или ширине формулы)
                    const sideShift = Math.abs(Math.cos(screenAngle)) > 0.7 ? item.h * 1.2 : item.w * 0.8;
                    const totalShift = sideShift * stepMultiplier;

                    // Чуть-чуть выдвигаем за остриё и смещаем строго вбок по перпендикуляру
                    finalX += Math.cos(screenAngle) * (indent * 0.4) + Math.cos(normalAngle) * totalShift;
                    finalY -= Math.sin(screenAngle) * (indent * 0.4) + Math.sin(normalAngle) * totalShift;

                    // Центрируем коробку текста относительно точки сдвига
                    finalX -= item.w / 2;
                    finalY -= item.h / 2;
                }

                // Применяем выверенные экранные координаты
                item.element.setAttribute("x", finalX);
                item.element.setAttribute("y", finalY);
                item.element.setAttribute("opacity", "1");
            });
        });

        // =====================================================================
        // ЧАСТЬ 3: РАЗМЕЩЕНИЕ СОЕДИНИТЕЛЬНЫХ ВЕКТОРОВ (ХОРД, НАПРИМЕР U_AB)
        // =====================================================================
        chordLabels.forEach(item => {
            // Находим пиксельную точку начала вектора на экране
            const ptStart = this.projectCoordinates(item.vec.xStart, item.vec.yStart, item.vec.layer);
            
            // Находим геометрический центр отрезка (середину хорды на экране)
            const midX = (ptStart.x + item.ptEnd.x) / 2;
            const midY = (ptStart.y + item.ptEnd.y) / 2;

            // Вычисляем угол направления из НАЧАЛА координат холста (this.x0, this.y0)
            // строго ЧЕРЕЗ середину этой хорды (midX, midY) наружу
            const outwardAngle = Math.atan2(this.y0 - midY, midX - this.x0);

            // Выталкиваем метку наружу вдоль этого радиального угла на 20 пикселей
            const extPadding = 20;
            let finalX = midX + Math.cos(outwardAngle) * extPadding;
            let finalY = midY - Math.sin(outwardAngle) * extPadding;

            // Центрируем габариты прямоугольника MathJax относительно вынесенной точки
            finalX -= item.w / 2;
            finalY -= item.h / 2;

            // Применяем итоговые координаты к SVG
            item.element.setAttribute("x", finalX);
            item.element.setAttribute("y", finalY);
            item.element.setAttribute("opacity", "1");
        });
    }

    /**
     * Сборка чистого SVG-строкового кода со всеми стилями и MathJax
     */
    getSVGString() {
        const clonedSvg = this.svg.cloneNode(true);
        
        // Фиксируем физический размер для скачиваемого файла
        clonedSvg.setAttribute("width", this.width);
        clonedSvg.setAttribute("height", this.height);
        clonedSvg.style.width = this.width + "px";
        clonedSvg.style.height = this.height + "px";
        
        // Принудительно прописываем пространство имен, без него Canvas падает на GitHub
        clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        
        const mathJaxStyles = document.getElementById("MathJax_SVG_styles") || 
                              document.querySelector("style[id^='MathJax']") || 
                              document.querySelector("style");
        
        if (mathJaxStyles) {
            const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
            styleElement.textContent = mathJaxStyles.textContent;
            clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);
        }
        
        const serializer = new XMLSerializer();
        return serializer.serializeToString(clonedSvg);
    }

    /**
     * Функция 1: Скачивание диаграммы в формате SVG
     */
    downloadSVG(filename = 'vector-diagram.svg') {
        const svgString = this.getSVGString();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Вспомогательный метод для рендеринга SVG на скрытый Canvas (нужен для PNG)
     */
    async renderToCanvas(scaleFactor = 2) {
        return new Promise((resolve, reject) => {
            try {
                const svgString = this.getSVGString();
                
                const canvas = document.createElement('canvas');
                canvas.width = this.width * scaleFactor;
                canvas.height = this.height * scaleFactor;
                
                const ctx = canvas.getContext('2d');
                ctx.scale(scaleFactor, scaleFactor);

                const img = new Image();
                
                // Конвертируем строку в безопасный формат Base64 DataURL
                // Решает проблему безопасности Tainted Canvas на GitHub
                const utf8Bytes = new TextEncoder().encode(svgString);
                let binaryStr = "";
                for (let i = 0; i < utf8Bytes.length; i++) {
                    binaryStr += String.fromCharCode(utf8Bytes[i]);
                }
                const base64Svg = btoa(binaryStr);
                
                img.onload = () => {
                    // Делаем подложку чисто белой, чтобы в Word 2010 не было черного фона
                    ctx.fillStyle = "#fafafa";
                    ctx.fillRect(0, 0, this.width, this.height);
                    
                    ctx.drawImage(img, 0, 0, this.width, this.height);
                    resolve(canvas);
                };
                
                img.onerror = (err) => {
                    reject(new Error("Ошибка рендеринга SVG. Проверьте валидность тегов."));
                };
                
                // Передаем строку напрямую
                img.src = "data:image/svg+xml;base64," + base64Svg;
                
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Функция 2: Скачивание диаграммы в формате PNG (высокое разрешение для Word)
     */
    async downloadPNG(filename = 'vector-diagram.png') {
        try {
            const canvas = await this.renderToCanvas(2); // 2х разрешение
            const url = canvas.toDataURL('image/png');
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Ошибка генерации PNG:', err);
        }
    }

    /**
     * Функция 3: Копирование PNG прямо в буфер обмена (для Ctrl+V в Word 2010)
     */
    async copyPNGToClipboard() {
        try {
            // Современный Clipboard API требует Async/Await и безопасное окружение (localhost или HTTPS)
            if (!navigator.clipboard || !window.ClipboardItem) {
                alert("Ваш браузер не поддерживает копирование картинок в буфер обмена. Используйте скачивание PNG.");
                return;
            }

            const canvas = await this.renderToCanvas(2);
            
            canvas.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);
                    
                    // Небольшое красивое уведомление (можно заменить на всплывашку в калькуляторе)
                    alert("Диаграмма успешно скопирована в буфер обмена! Теперь её можно вставить в Word через Ctrl+V.");
                } catch (e) {
                    console.error("Не удалось записать в буфер:", e);
                }
            }, 'image/png');
            
        } catch (err) {
            console.error('Ошибка копирования:', err);
        }
    }

    /**
     * Инициализация кастомного контекстного меню по правому клику
     */
    initContextMenu() {
        // Создаем уникальное меню для конкретного контейнера этой диаграммы
        let menu = this.container.querySelector('.vector-diagram-context-menu');
        
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'vector-diagram-context-menu'; // Используем класс вместо ID
            
            // Стили меню
            Object.assign(menu.style, {
                position: 'fixed', // Используем fixed, чтобы не зависеть от scroll
                backgroundColor: '#ffffff',
                border: '1px solid #cccccc',
                boxShadow: '2px 2px 8px rgba(0,0,0,0.15)',
                padding: '4px 0',
                borderRadius: '4px',
                zIndex: '10000',
                display: 'none',
                fontFamily: 'sans-serif',
                fontSize: '13px',
                minWidth: '210px'
            });

            // Создаем пункты меню как DOM-элементы, чтобы привязать контекст (this)
            const items = [
                { text: 'Копировать PNG (для Word)', action: () => this.copyPNGToClipboard() },
                { text: 'Скачать как PNG-рисунок', action: () => this.downloadPNG() },
                { text: 'Скачать как векторный SVG', action: () => this.downloadSVG() }
            ];

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'v-menu-item';
                div.textContent = item.text;
                Object.assign(div.style, {
                    padding: '6px 14px',
                    cursor: 'pointer',
                    color: '#333'
                });

                // Привязываем действие напрямую к текущему экземпляру (this) через стрелочную функцию
                div.addEventListener('click', () => {
                    item.action();
                    menu.style.display = 'none';
                });

                // Эффекты наведения
                div.addEventListener('mouseover', () => div.style.backgroundColor = '#f0f0f0');
                div.addEventListener('mouseout', () => div.style.backgroundColor = 'transparent');
                
                menu.appendChild(div);
            });

            // Линия-разделитель и подпись версии
            const hr = document.createElement('div');
            Object.assign(hr.style, { borderTop: '1px solid #eeeeee', margin: '4px 0' });
            menu.appendChild(hr);

            const footer = document.createElement('div');
            footer.textContent = 'Векторная диаграмма v1.1';
            Object.assign(footer.style, { padding: '4px 14px', color: '#999', fontSize: '11px', fontStyle: 'italic' });
            menu.appendChild(footer);

            document.body.appendChild(menu);
        }

        // 1. БЛОКИРОВКА МЕНЮ MATHJAX: перехватываем правый клик на этапе погружения (true)
        // Мы вешаем слушатель на labelsLayer, где и живут формулы MathJax
        if (this.labelsLayer) {
            this.labelsLayer.addEventListener('contextmenu', (e) => {
                e.stopPropagation(); // Критично! Останавливает событие, не давая MathJax узнать о клике
            }, true); // Флаг true активирует этап погружения (Capture Phase)
        }

        // 2. ОТКРЫТИЕ НАШЕГО КАСТОМНОГО МЕНЮ
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 

            // Считываем текущий максимальный слой окон и ставим меню НА ЕДИНИЦУ ВЫШЕ
            // Чтобы получить доступ к переменной, импортируйте её вверху этого файла: 
            // import { maxZIndex } from './путь_к_файлу_окон.js';
            if (typeof maxZIndex !== 'undefined') {
                menu.style.zIndex = String(maxZIndex + 1);
            } else {
                menu.style.zIndex = '9999999'; // Жесткий запасной вариант, если импорт не настроен
            }

            // Показываем меню точно под курсором
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.style.display = 'block';


        });

        // Скрываем меню при клике или скролле
        document.addEventListener('click', () => menu.style.display = 'none');
        document.addEventListener('scroll', () => menu.style.display = 'none');
    }   
}