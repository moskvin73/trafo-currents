import VectorDiagram from '../VectorDiagram.js'
import { createFloatingWindowDOM }  from '../util.js';

export default class DiagramDescriptor {
    #containerElement;
    /**
     * @param {string} mode - "three_phase" или "math"
     * @param {string} viewType - "inline" или "window"
     */
    constructor(id, mode, viewType) {
        this.id = id;
        this.type = "DiagramState"; // Метка типа для вашей SymbolTable
        this.target = viewType || "inline";
        this.instance = null;        // Ссылка на живой объект VectorDiagram
        this.#containerElement = null; // DOM-элемент, куда рендерится SVG
        
        // Чистая структура данных, которую ожидает VectorDiagram
        this.data = {
            config: { 
                mode: mode, 
                width: 600, 
                height: 600, 
                auto_add: true // Флаг автодобавления векторов для хорд
            },
            layers: {},
            vectors: []
        };
    }

    get containerElement() { return this.#containerElement; }

    set containerElement(contentDiv) {
        if (this.#containerElement === contentDiv) {
            return;
        }

        if (!contentDiv || !(contentDiv instanceof Element)) {
            throw new TypeError("Инициализация невозможна: containerElement должен быть валидным DOM-элементом.");
        }

        this.instance = new VectorDiagram(contentDiv, this.data);
        this.#containerElement = contentDiv;
    }

    createFloatingWindow() {
        // 1. Создаем DOM окна (оно добавляется в body, но размеры еще 0)
        const contentDiv = createFloatingWindowDOM(this.id, () => {
            if (this.instance) this.instance.syncContainerSizes();
        });

        // 2. Вызываем ваш сеттер (он внутри создает new VectorDiagram)
        this.containerElement = contentDiv;

        // 3. Следим за тем, когда браузер реально выделит пиксели для contentDiv
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // Как только появились реальные размеры > 0
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    if (this.instance && typeof this.instance.syncContainerSizes === 'function') {
                        // Принудительно заставляем диаграмму пересчитать геометрию по факту отрисовки
                        this.instance.syncContainerSizes(); 
                    }
                    observer.disconnect(); // Отключаем слежку, так как первый запуск прошел
                }
            }
        });
        
        observer.observe(contentDiv);
        return contentDiv;
        //this.containerElement = createFloatingWindowDOM(this.id);
        //return this.containerElement;
    }

    /**
     * Считывает новые измененные размеры HTML-окна и обновляет внутренний SVG-viewBox
     */
    syncContainerSizes() {
        if (!this.containerElement) return;
        
        // Измеряем новые физические габариты окна после изменения его мышкой
        const rect = this.containerElement.getBoundingClientRect();
        
        if (rect.width > 0 && rect.height > 0) {
            this.data.config.width = rect.width;
            this.data.config.height = rect.height;
            
            this.width = rect.width;
            this.height = rect.height;
            
            // Если экземпляр графики VectorDiagram жив, обновляем его корневые свойства
            if (this.instance) {
                this.instance.width = rect.width;
                this.instance.height = rect.height;
                this.instance.x0 = rect.width / 2;
                this.instance.y0 = rect.height / 2;
                // Пересчитываем радиус векторов под новый размер окна
                this.instance.maxRadius = Math.min(rect.width, rect.height) / 2 * 0.8;
            }
            
            // Перерисовываем диаграмму
            this.reactiveUpdate();
        }
    }

     /**
     * Динамическое изменение настроек диаграммы из калькулятора
     * @param {string} key - Имя параметра (например, auto_add, width, height)
     * @param {*} value - Значение параметра (boolean, number и т.д.)
     */
    setConfig(key, value) {
        // Приводим типы к нужным, если парсер отдал их как строки или индентификаторы
        if (key === 'auto_add') {
            // Если пришло строкой 'true'/'false' или токеном, приводим к честному boolean
            this.data.config.auto_add = (value === true || value === 'true');
        } 
        else if (key === 'width' || key === 'height') {
            const num = Number(value);
            if (!isNaN(num) && num > 0) {
                this.data.config[key] = num;
                // Синхронизируем внутренние свойства дескриптора
                if (key === 'width') this.width = num;
                if (key === 'height') this.height = num;
            }
        } 
        else {
            // Для любых других кастомных настроек на будущее
            this.data.config[key] = value;
        }

        // Если диаграмма уже отрендерена на экране, отправляем ее на пересчет
        this.reactiveUpdate();
    }

    /**
     * Регистрация или обновление слоя
     */
    addLayer(layerId, color, strokeWidth = 2) {
        // Генерируем уникальный маркер для SVG defs
        const markerId = `marker-${layerId}-${Math.random().toString(36).substr(2, 5)}`;
        
        this.data.layers[layerId] = {
            color: color,
            markerId: markerId,
            strokeWidth: Number(strokeWidth)
        };
        
        this.reactiveUpdate();
    }

    /**
     * Добавление базового вектора от центра координат
     */
    addVector(vectorId, labelTex, layerId, complexValue) {
        if (!complexValue.isComplexNumber) {
            throw new TypeError(`Ожидалось комплексное число в параметре 'complexValue', получено: ${typeof complexValue}`);
        }
        // Если слоя не существует, создаем дефолтный, чтобы не падало
        if (!this.data.layers[layerId]) {
            this.addLayer(layerId, "#666666", 2);
        }

        // Защита от дубликатов: если вектор уже есть, обновляем его значение
        const existingIdx = this.data.vectors.findIndex(v => v.id === vectorId);
        const vectorData = {
            id: vectorId,
            label: labelTex,
            layer: layerId,
            value: { re: complexValue.real, im: complexValue.imaginary },
            origin: { type: "center" }
        };

        if (existingIdx !== -1) {
            this.data.vectors[existingIdx] = vectorData;
        } else {
            this.data.vectors.push(vectorData);
        }

        this.reactiveUpdate();
    }

    /**
     * Добавление соединительного вектора (хорды) на основе разобранного AST
     */
    addChord(targetId, labelTex, layerId, complexValue, parent1Id, parent2Id, operator, evl_context) {
        if (!this.data.layers[layerId]) {
            this.addLayer(layerId, "#666666", 1.5);
        }

        // Логика Опционального Автодобавления векторов-родителей
        if (this.data.config.auto_add) {
            [parent1Id, parent2Id].forEach(parentId => {
                const exists = this.data.vectors.some(v => v.id === parentId);
                if (!exists) {
                    // Вытаскиваем комплексное значение пропущенного родителя из SymbolTable
                    const parentSymbol = evl_context.getSymbolByName(parentId);
                    if (parentSymbol && parentSymbol.value) {
                        const tex = evl_context.translateToTeX(parentId);
                        // Добавляем его в тот же слой или в базовый
                        this.addVector(parentId, tex, layerId, parentSymbol.value);
                    } else {
                        throw new Error(`Runtime Error: Невозможно автоматически добавить вектор '${parentId}'. Переменная не найдена в калькуляторе.`);
                    }
                }
            });
        } else {
            // Если автодобавление выключено — проверяем жестко
            const p1Exists = this.data.vectors.some(v => v.id === parent1Id);
            const p2Exists = this.data.vectors.some(v => v.id === parent2Id);
            if (!p1Exists || !p2Exists) {
                throw new Error(`Runtime Error: Для хорды '${targetId}' требуются векторы '${parent1Id}' и '${parent2Id}' на диаграмме.`);
            }
        }

        // Правило знаков ТОЭ: при вычитании (U_a - U_b) хорда начинается в конце вычитаемого (U_b)
        // При сложении (U_a + U_b) хорда идет последовательно из конца U_a
        const originId = (operator === '-') ? parent2Id : parent1Id;

        const chordData = {
            id: targetId,
            label: labelTex,
            layer: layerId,
            value: { re: complexValue.re, im: complexValue.im },
            origin: { type: "vector", id: originId }
        };

        const existingIdx = this.data.vectors.findIndex(v => v.id === targetId);
        if (existingIdx !== -1) {
            this.data.vectors[existingIdx] = chordData;
        } else {
            this.data.vectors.push(chordData);
        }

        this.reactiveUpdate();
    }

    /**
     * Внутренний метод реактивной перерисовки холста, если он уже выведен на экран
     */
    reactiveUpdate() {
        if (this.instance) {
            this.instance.updateData(this.data);
        }
    }
}