import VectorDiagram from '../VectorDiagram.js'
import { createFloatingWindowDOM }  from '../util.js';
 
export default class DiagramDescriptor {
    #containerElement;
    #aliases; // Карта: имя_в_калькуляторе -> массив_id_на_диаграмме

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
        this.#aliases = new Map();
        
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

    /**
     * Быстрое обновление значений всех графических проявлений вектора из калькулятора
     */
    #updateAllAliasesOf(calculatorName, complexValue) {
        const aliasList = this.#aliases.get(calculatorName);
        if (aliasList) {
            aliasList.forEach(diagramId => {
                const vec = this.data.vectors.find(v => v.id === diagramId);
                if (vec) {
                    vec.value = { re: complexValue.real, im: complexValue.imaginary };
                }
            });
        }
    }

    #registerAlias(calculatorName, diagramId) {
        if (!this.#aliases.has(calculatorName)) {
            this.#aliases.set(calculatorName, []);
        }
        if (!this.#aliases.get(calculatorName).includes(diagramId)) {
            this.#aliases.get(calculatorName).push(diagramId);
        }
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
        if (!this.data.layers[layerId]) {
            this.addLayer(layerId, "#666666", 2);
        }

        // Регистрируем чистое имя вектора
        this.#registerAlias(vectorId, vectorId);

        const existingIdx = this.data.vectors.findIndex(v => v.id === vectorId);
        if (existingIdx !== -1) {
            // Если вектор есть, обновляем его и все его копии в формулах
            this.#updateAllAliasesOf(vectorId, complexValue);
        } else {
            this.data.vectors.push({
                id: vectorId,
                layer: layerId,
                label: labelTex,
                origin: { type: "center" }, // Базовый луч всегда из центра
                value: { re: complexValue.real, im: complexValue.imaginary }
            });
        }

        this.reactiveUpdate();
    }

    /**
     * Системное добавление/обновление хорды на основе топологического анализа векторов
     * @param {Object} inputData - Подготовленные данные полинома
     * @param {string} layerId - Идентификатор слоя
     */
    addChord(inputData, layerId) {
    const { var_let_name, var_let_tex, var_let_value, terms } = inputData;

    if (!this.data.layers[layerId]) {
        this.addLayer(layerId, "#666666", 1.5);
    }

    // Храним ID точек старта для элементов текущей цепочки
    const currentChainIds = [];

    // 1. Проходим по слагаемым выражения
    if (terms && terms.length > 0) {
        terms.forEach((term, index) => {
            const existingVec = this.data.vectors.find(v => v.id === term.name);
            
            // Вычисляем, какой origin ТРЕБУЕТСЯ по математике этого выражения:
            // Первый элемент — от центра (или от базовой точки), последующие — от конца предыдущего
            const requiredOrigin = (index === 0)
                ? { type: "center" }
                : { type: "vector", id: currentChainIds[index - 1] };

            if (existingVec) {
                // ОБНАРУЖЕН КОНФЛИКТ ТОПОЛОГИИ:
                // Если вектор уже есть, но его текущий origin не совпадает с тем, что требует выражение
                // (например, он луч из центра, а выражение требует прицепить его к концу другого вектора)
                if (existingVec.origin.type !== requiredOrigin.type || existingVec.origin.id !== requiredOrigin.id) {
                    
                    // Создаем геометрический клон вектора для этой цепочки
                    const cloneId = `${term.name}_chain_v`;
                    currentChainIds.push(cloneId);

                    const existingCloneIdx = this.data.vectors.findIndex(v => v.id === cloneId);
                    const cloneData = {
                        id: cloneId,
                        layer: existingVec.layer, // СТРОГО РОДНОЙ СЛОЙ базового вектора!
                        label: term.tex_name,
                        origin: requiredOrigin,   // Ставим в нужное место цепочки
                        value: { re: term.value.real, im: term.value.imaginary }
                    };

                    if (existingCloneIdx !== -1) {
                        this.data.vectors[existingCloneIdx].value = cloneData.value;
                    } else {
                        this.data.vectors.push(cloneData);
                    }
                } else {
                    // Если топология совпадает (вектор уже правильно привязан), используем его «как есть»
                    existingVec.value = { re: term.value.real, im: term.value.imaginary };
                    currentChainIds.push(term.name);
                }
            } else {
                // Если вектора вообще нет на диаграмме — создаем его в текущем слое хорды (логика auto_add)
                this.data.vectors.push({
                    id: term.name,
                    layer: layerId,
                    label: term.tex_name,
                    origin: requiredOrigin,
                    value: { re: term.value.real, im: term.value.imaginary }
                });
                currentChainIds.push(term.name);
            }
        });
    }

    // 2. Определяем точку старта для результирующего вектора (хорды)
    // Хорда-результат всегда соединяет начало и конец получившейся цепочки
    let chordOrigin = { type: "center" };
    if (currentChainIds.length > 0) {
        // Хорда привязывается к концу последнего элемента цепочки
        chordOrigin = { type: "vector", id: currentChainIds[currentChainIds.length - 1] };
    }

    // 3. Записываем/обновляем результирующую хорду под её настоящим ID
    const existingChordIdx = this.data.vectors.findIndex(v => v.id === var_let_name);
    const chordData = {
        id: var_let_name,
        layer: layerId,
        label: var_let_tex,
        origin: chordOrigin,
        value: { re: var_let_value.real, im: var_let_value.imaginary }
    };

    if (existingChordIdx !== -1) {
        this.data.vectors[existingChordIdx].value = chordData.value;
        this.data.vectors[existingChordIdx].origin = chordData.origin;
        this.data.vectors[existingChordIdx].label = chordData.label;
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
