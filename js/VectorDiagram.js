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
        
        // Размеры и центр холста
        this.width = this.data.config.width || 600;
        this.height = this.data.config.height || 600;
        this.x0 = this.width / 2;
        this.y0 = this.height / 2;
        
        // Допустимый радиус для векторов (80% от минимального полуразмера осей, 20% под поля)
        this.maxRadius = Math.min(this.width, this.height) / 2 * 0.8;
        
        this.scales = {};       // Масштабы для каждого слоя
        this.calculated = [];   // Геометрически рассчитанные векторы
        
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
        // Зазор в пикселях для полей под формулы MathJax по краям холста
        const padding = 50; 
        const usableWidth = this.width - padding * 2;
        const usableHeight = this.height - padding * 2;

        // Находим экстремумы (границы) графики для каждого слоя отдельно
        const layerBounds = {};
        
        Object.keys(this.data.layers).forEach(layerName => {
            // Точка (0,0) обязана быть на графике, чтобы оси пересекались в видимой зоне
            layerBounds[layerName] = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        });

        // Сканируем все рассчитанные точки векторов
        this.calculated.forEach(vec => {
            const b = layerBounds[vec.layer];
            if (b) {
                b.minX = Math.min(b.minX, vec.xStart, vec.xEnd);
                b.maxX = Math.max(b.maxX, vec.xStart, vec.xEnd);
                b.minY = Math.min(b.minY, vec.yStart, vec.yEnd);
                b.maxY = Math.max(b.maxY, vec.yStart, vec.yEnd);
            }
        });

        // Для простоты интеграции с общей сеткой и осями выберем один базовый слой для геометрии холста
        // (Обычно это первый слой, например, напряжение)
        const baseLayer = Object.keys(this.data.layers)[0];
        const bounds = layerBounds[baseLayer];

        // Математическая ширина и высота, занимаемая векторами
        const mathW = bounds.maxX - bounds.minX || 1;
        const mathH = bounds.maxY - bounds.minY || 1;

        // Рассчитываем масштаб (пикселей на физ. единицу) отдельно по X и по Y
        const scaleX = usableWidth / mathW;
        const scaleY = usableHeight / mathH;
        
        // Берем минимальный масштаб, чтобы диаграмма влезла целиком без искажения пропорций (круг остался кругом)
        const S_base = Math.min(scaleX, scaleY);
        this.scales[baseLayer] = S_base;

        // Вычисляем, где должен быть центр осей (x0, y0) на экране, чтобы вся графика влезла
        if (this.data.config.mode === 'three-phase') {
            // Для трехфазного режима учитываем поворот базиса на 90 градусов при расчете центра
            const midMathX = (bounds.minX + bounds.maxX) / 2;
            const midMathY = (bounds.minY + bounds.maxY) / 2;
            this.x0 = this.width / 2 - midMathY * S_base;
            this.y0 = this.height / 2 + midMathX * S_base;
        } else {
            // Для стандартного математического режима
            this.x0 = padding - bounds.minX * S_base + (usableWidth - mathW * S_base) / 2;
            this.y0 = this.height - padding + bounds.minY * S_base - (usableHeight - mathH * S_base) / 2;
        }

        // Пересчитываем масштабы для остальных произвольных слоев относительно базового
        Object.keys(this.data.layers).forEach(layerName => {
            if (layerName !== baseLayer) {
                const b = layerBounds[layerName];
                const mW = b.maxX - b.minX || 1;
                const mH = b.maxY - b.minY || 1;
                // Рассчитываем масштаб слоя так, чтобы его экстремумы заняли ту же полезную площадь холста
                this.scales[layerName] = Math.min(usableWidth / mW, usableHeight / mH);
            }
        });
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
        if (this.data.config.mode === 'three-phase') {
            // Электротехника (+90 град): Re -> вверх (-Y_svg), Im -> вправо (+X_svg)
            return {
                x: this.x0 + y * S,
                y: this.y0 - x * S
            };
        } else {
            // Математический базис: Re -> вправо (+X_svg), Im -> вверх (-Y_svg)
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
        this.svg.setAttribute("width", this.width);
        this.svg.setAttribute("height", this.height);
        this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
        this.svg.style.backgroundColor = "#fafafa";
        this.svg.style.overflow = "visible"
        
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

        // 3.2 Отрисовка координатной сетки (необязательно, но полезно)
        this.renderGrid(svgNS);

        // 3.3 Создание трансформируемых групп графики для каждого слоя
        const layerGroups = {};
        Object.entries(this.data.layers).forEach(([layerName, layerConfig]) => {
            const g = document.createElementNS(svgNS, "g");
            g.setAttribute("id", `layer-${layerName}`);
            
            // Расчет матрицы трансформации matrix(a, b, c, d, e, f)
            const S = this.scales[layerName];
            let matrix = "";
            if (this.data.config.mode === 'three-phase') {
                matrix = `matrix(0, ${-S}, ${S}, 0, ${this.x0}, ${this.y0})`;
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
        axes.setAttribute("stroke", "#666");
        axes.setAttribute("stroke-width", "1");

        // Горизонтальная ось (чертится через весь холст на высоте динамического y0)
        const hLine = document.createElementNS(svgNS, "line");
        hLine.setAttribute("x1", "0"); hLine.setAttribute("y1", this.y0);
        hLine.setAttribute("x2", this.width); hLine.setAttribute("y2", this.y0);
        
        // Вертикальная ось (чертится на ширине динамического x0)
        const vLine = document.createElementNS(svgNS, "line");
        vLine.setAttribute("x1", this.x0); vLine.setAttribute("y1", "0");
        vLine.setAttribute("x2", this.x0); vLine.setAttribute("y2", this.height);

        axes.appendChild(hLine);
        axes.appendChild(vLine);
        this.svg.appendChild(axes);

        // --- ДОБАВЛЕНИЕ ПОДПИСЕЙ ОСЕЙ (+1, +j) ---
        // Определяем, какая подпись куда идет на основе режима ТОЭ
        const isThreePhase = (this.data.config.mode === 'three-phase');
        const textHorizontal = isThreePhase ? "+j" : "+1";
        const textVertical = isThreePhase ? "+1" : "+j";

        // Метка для правого края горизонтальной оси
        const foH = document.createElementNS(svgNS, "foreignObject");
        foH.setAttribute("width", "40"); foH.setAttribute("height", "25");
        foH.setAttribute("x", this.width - 45); foH.setAttribute("y", this.y0 - 28);
        foH.innerHTML = `<div style="font-family: MathJax_Main, sans-serif; font-size: 14px; text-align: right;">\\(${textHorizontal}\\)</div>`;

        // Метка для верхнего края вертикальной оси
        const foV = document.createElementNS(svgNS, "foreignObject");
        foV.setAttribute("width", "40"); foV.setAttribute("height", "25");
        foV.setAttribute("x", this.x0 + 8); foV.setAttribute("y", "5");
        foV.innerHTML = `<div style="font-family: MathJax_Main, sans-serif; font-size: 14px;">\\(${textVertical}\\)</div>`;

        // Добавляем их в слой подписей, чтобы MathJax подхватил их вместе с векторами
        this.labelsLayer.appendChild(foH);
        this.labelsLayer.appendChild(foV);
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
}