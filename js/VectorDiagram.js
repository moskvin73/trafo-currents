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
        const layerMaxMagnitudes = {};
        
        // Инициализируем слои из конфига
        Object.keys(this.data.layers).forEach(layerName => {
            layerMaxMagnitudes[layerName] = 0.001; // Защита от деления на ноль
        });
        
        // Ищем максимальный вылет вектора в каждом слое
        this.calculated.forEach(vec => {
            if (layerMaxMagnitudes[vec.layer] !== undefined) {
                if (vec.maxR > layerMaxMagnitudes[vec.layer]) {
                    layerMaxMagnitudes[vec.layer] = vec.maxR;
                }
            }
        });
        
        // Вычисляем масштаб scale = пикселей на 1 ед. физической величины
        Object.keys(layerMaxMagnitudes).forEach(layerName => {
            this.scales[layerName] = this.maxRadius / layerMaxMagnitudes[layerName];
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
    }
	
    /**
     * Этап 4: Отрисовка MathJax, замер BBox элементов и их прецизионное выравнивание
     */
    async renderAndPositionLabels() {
        const svgNS = "http://www.w3.org/2000/svg";
        const foreignObjects = [];

        this.calculated.forEach(vec => {
            // Вычисляем экранную пиксельную точку острия стрелки
            const ptEnd = this.projectCoordinates(vec.xEnd, vec.yEnd, vec.layer);
            
            // Создаем foreignObject. Изначально ставим opacity: 0 и делаем его заведомо большим
            const fo = document.createElementNS(svgNS, "foreignObject");
            fo.setAttribute("width", "150");
            fo.setAttribute("height", "80");
            fo.setAttribute("x", ptEnd.x);
            fo.setAttribute("y", ptEnd.y);
            fo.setAttribute("opacity", "0");          // Надёжный SVG-атрибут прозрачности
            fo.setAttribute("overflow", "visible");   // Надёжный SVG-атрибут переполнения

            // Контейнер для MathJax сбросит стили SVG и заставит текст не переноситься
            const div = document.createElement("div");
            div.style.display = "inline-block";
            div.style.whiteSpace = "nowrap";
            div.style.fontFamily = "MathJax_Main, sans-serif";
            div.style.lineHeight = "1";
            div.innerHTML = `\\(${vec.label}\\)`; // Используем инлайновые разделители \( \)

            fo.appendChild(div);
            this.labelsLayer.appendChild(fo);

            // Сохраняем метаданные для последующего сдвига после рендеринга MathJax
            foreignObjects.push({
                element: fo,
                wrapperDiv: div,
                // Считаем угол направления вектора в радианах (математический), чтобы знать в какую сторону сдвигать текст
                angle: Math.atan2(vec.value.im, vec.value.re),
                ptEnd: ptEnd
            });
        });

        // Проверяем наличие MathJax в глобальной области видимости
        if (window.MathJax && window.MathJax.typesetPromise) {
            // Запускаем асинхронный рендеринг формул во всем слое подписей
            await window.MathJax.typesetPromise([this.labelsLayer]);

            // Перед расчетом создадим карту занятых координат, чтобы метки не садились друг на друга
            const occupiedPositions = [];

            // MathJax отработал, теперь браузер знает физический размер BBox каждого элемента
            foreignObjects.forEach(obj => {
                /*const rect = obj.wrapperDiv.getBoundingClientRect();
                const W = rect.width;
                const H = rect.height;

                // Устанавливаем точные размеры контейнера под размер формулы
                obj.element.setAttribute("width", W);
                obj.element.setAttribute("height", H);

                // Вычисляем смещение, чтобы формула не накладывалась на стрелку
                // Выталкиваем текст наружу по направлению вектора + добавляем отступ 8px
                let offsetX = Math.cos(obj.angle) * 8;
                let offsetY = -Math.sin(obj.angle) * 8; // минус, т.к. Y в пикселях идет вниз

                // Дополнительная корректировка центра масс (Bounding Box alignment)
                // Если вектор направлен влево, сдвигаем X влево на всю ширину формулы
                if (Math.cos(obj.angle) < -0.1) offsetX -= W;
                // Если вектор по центру, центрируем формулу по оси X
                else if (Math.abs(Math.cos(obj.angle)) <= 0.1) offsetX -= W / 2;

                // Если вектор направлен вниз, сдвигаем Y вниз (в пикселях это плюс)
                if (-Math.sin(obj.angle) > 0.1) offsetY += 0; 
                // Если вверх — поднимаем на всю высоту формулы
                else if (-Math.sin(obj.angle) < -0.1) offsetY -= H;
                else offsetY -= H / 2;

                // Применяем финальные скорректированные пиксельные координаты
                obj.element.setAttribute("x", obj.ptEnd.x + offsetX);
                obj.element.setAttribute("y", obj.ptEnd.y + offsetY);
                
                // Делаем элемент плавно видимым
                obj.element.setAttribute("opacity", "1");*/

   const rect = obj.wrapperDiv.getBoundingClientRect();
    const W = rect.width || 60;
    const H = rect.height || 20;

    obj.element.setAttribute("width", W);
    obj.element.setAttribute("height", H);

    // Базовый вынос от острия стрелки (на 12 пикселей наружу)
    const padding = 12;
    let offsetX = Math.cos(obj.angle) * padding;
    let offsetY = -Math.sin(obj.angle) * padding;

    // --- ИНТЕЛЛЕКТУАЛЬНОЕ ВЫРАВНИВАНИЕ ОТНОСИТЕЛЬНО ОСТРИЯ ---
    // Плавное смещение X: если вектор смотрит влево (cos < 0),offsetX плавно уменьшается на ширину W
    offsetX += (-0.5 * (1 - Math.cos(obj.angle))) * W;
    
    // Плавное смещение Y: аналогично для высоты текста
    offsetY += (-0.5 * (1 + Math.sin(obj.angle))) * H;

    // Финальные пиксельные координаты для этой метки
    let finalX = obj.ptEnd.x + offsetX;
    let finalY = obj.ptEnd.y + offsetY;

    // --- АНТИКОЛЛИЗИЯ (Защита от наложения меток друг на друга) ---
    // Проверяем, не слишком ли близко эта метка к уже размещенным
    let attempts = 0;
    let collision = true;
    
    while (collision && attempts < 4) {
        collision = false;
        for (let pos of occupiedPositions) {
            // Проверяем пересечение прямоугольников (Bounding Boxes) меток
            const dX = Math.abs(finalX - pos.x);
            const dY = Math.abs(finalY - pos.y);
            
            // Если метки перекрывают друг друга ближе чем на 80% ширины и высоту
            if (dX < W * 0.8 && dY < H * 0.9) {
                collision = true;
                // Расталкиваем метки: сдвигаем текущую метку чуть выше или ниже в зависимости от угла
                finalY += (obj.angle > 0) ? -H : H; 
                finalX += (Math.cos(obj.angle) > 0) ? W * 0.2 : -W * 0.2;
                break;
            }
        }
        attempts++;
    }

    // Сохраняем координаты в реестр занятых мест
    occupiedPositions.push({ x: finalX, y: finalY, w: W, h: H });

    // Применяем скорректированные координаты к SVG
    obj.element.setAttribute("x", finalX);
    obj.element.setAttribute("y", finalY);
    obj.element.setAttribute("opacity", "1");                
            });
        } else {
            console.warn("MathJax v3/v4 не обнаружен на странице. Формулы отображены как обычный текст.");
            // На случай отсутствия MathJax просто делаем текст видимым
            foreignObjects.forEach(obj => obj.element.style.opacity = "1");
        }
    }
}