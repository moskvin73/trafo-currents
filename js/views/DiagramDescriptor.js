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
                width: 300, 
                height: 300, 
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

        // Вытаскиваем настройки, заданные пользователем или калькулятором
        // Например, пользователь может написать в коде: config: { width: 500, alignX: 'right', alignY: 'top' }
        const userConfig = (this.data && this.data.config) || {};

        const options = {
            width: userConfig.width || 300,
            height: userConfig.height || 320,
            alignX: userConfig.alignX || 'right',
            alignY: userConfig.alignY || 'top'
        };

        // 1. Создаем DOM окна (оно добавляется в body, но размеры еще 0)
        const contentDiv = createFloatingWindowDOM(this.id, () => {
            if (this.instance && typeof this.instance.syncContainerSizes === 'function') {
                this.instance.syncContainerSizes();
            }
        }, options); 

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
     * Системное добавление/обновление хорды на основе топологического анализа векторов
     * @param {Object} inputData - Подготовленные данные полинома
     * @param {string} layerId - Идентификатор слоя
     */
    addChord(inputData, layerId) {
        const { var_let_name, var_let_tex, var_let_value, constant, terms } = inputData;

        if (!this.data.layers[layerId]) {
            this.addLayer(layerId, "#666666", 1.5);
        }

        // 1. Формируем ПОЛНЫЙ список участников полинома (цепочки)
        const fullChain = [];

        // Добавляем базовые векторы-слагаемые
        if (terms && terms.length > 0) {
            terms.forEach(term => {
                fullChain.push({
                    id: term.name,
                    label: term.tex_name,
                    isNegative: term.isNegative,
                    // Если флаг true, инвертируем значение для отрисовки результирующего смещения
                    value: { 
                        re: term.isNegative ? -term.value.real : term.value.real, 
                        im: term.isNegative ? -term.value.imaginary : term.value.imaginary 
                    }
                });
            });
        }

        // Обработка свободной константы: если она не равна нулю, синтезируем для нее вектор
        if (constant && (constant.real !== 0 || constant.imaginary !== 0)) {
            const constId = `const_${var_let_name}`; // Синтезируемое уникальное имя
            fullChain.push({
                id: constId,
                label: `C`,
                isNegative: false,
                value: { re: constant.real, im: constant.imaginary }
            });
        }

        // 2. РЕЖИМ 1: ПРОВЕРКА НА ПОЛНОЕ ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕЙ СИСТЕМЫ
        // Проверяем, есть ли уже на диаграмме абсолютно все элементы и сама хорда
        const allElementsExist = fullChain.every(elem => this.data.vectors.some(v => v.id === elem.id)) 
                                && this.data.vectors.some(v => v.id === var_let_name);

        if (allElementsExist) {
            // Если вся система уже построена, мы просто обновляем их физические значения re/im
            fullChain.forEach(elem => {
                const idx = this.data.vectors.findIndex(v => v.id === elem.id);
                this.data.vectors[idx].value = elem.value;
            });

            // Обновляем значение самой хорды
            const chordIdx = this.data.vectors.findIndex(v => v.id === var_let_name);
            this.data.vectors[chordIdx].value = { re: var_let_value.real, im: var_let_value.imaginary };

            this.reactiveUpdate();
            return; // Завершаем выполнение, структура связей не нарушена
        }

        // 3. РЕЖИМ 2: СИНТЕЗ НОВОЙ СИСТЕМЫ ВЕКТОРОВ И ХОРДЫ
        // Ищем на диаграмме существующие "опорные лучи" среди элементов полинома
        const existingRays = fullChain.filter(elem => this.data.vectors.some(v => v.id === elem.id));

        if (existingRays.length > 0) {
            // Сценарий А: Есть опорные лучи. Нам нужно встроить недостающие векторы в цепочку.
            // Для этого мы берем первый найденный опорный луч как базу
            const baseRay = existingRays[0];
            
            // Перестраиваем структуру недостающих векторов, привязывая их последовательно
            let currentOriginId = baseRay.id;

            fullChain.forEach(elem => {
                const exists = this.data.vectors.some(v => v.id === elem.id);
                if (!exists) {
                    this.data.vectors.push({
                        id: elem.id,
                        layer: layerId,
                        label: elem.label,
                        origin: { type: "vector", id: currentOriginId },
                        value: elem.value
                    });
                    currentOriginId = elem.id;
                } else {
                    // Если элемент уже был, цепочка развернется от него дальше
                    currentOriginId = elem.id;
                }
            });

            // Саму хорду привязываем к концу последнего элемента получившейся цепочки
            this.data.vectors.push({
                id: var_let_name,
                layer: layerId,
                label: var_let_tex,
                origin: { type: "vector", id: currentOriginId },
                value: { re: var_let_value.real, im: var_let_value.imaginary }
            });

        } else {
            // Сценарий Б: Полная пустота на диаграмме (нет опорных лучей)
            // Произвольно размещаем первый вектор в начало координат (origin: center)
            if (fullChain.length > 0) {
                const firstElem = fullChain[0];
                
                this.data.vectors.push({
                    id: firstElem.id,
                    layer: layerId,
                    label: firstElem.label,
                    origin: { type: "center" }, // Сделали его опорным лучом
                    value: firstElem.value
                });

                // Все последующие элементы выстраиваем «паровозиком» за ним
                let currentOriginId = firstElem.id;
                for (let i = 1; i < fullChain.length; i++) {
                    const elem = fullChain[i];
                    this.data.vectors.push({
                        id: elem.id,
                        layer: layerId,
                        label: elem.label,
                        origin: { type: "vector", id: currentOriginId },
                        value: elem.value
                    });
                    currentOriginId = elem.id;
                }

                // Хорду цепляем к концу этой цепочки
                this.data.vectors.push({
                    id: var_let_name,
                    layer: layerId,
                    label: var_let_tex,
                    origin: { type: "vector", id: currentOriginId },
                    value: { re: var_let_value.real, im: var_let_value.imaginary }
                });
            } else {
                // Если полином пустой и содержит только хорду (редкий случай)
                this.data.vectors.push({
                    id: var_let_name,
                    layer: layerId,
                    label: var_let_tex,
                    origin: { type: "center" },
                    value: { re: var_let_value.real, im: var_let_value.imaginary }
                });
            }
        }

        // 4. Реактивно перерисовываем холст
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