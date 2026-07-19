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

        // Регистрируем саму хорду под её чистым именем из калькулятора
        this.#registerAlias(var_let_name, var_let_name);

        // 1. Выстраиваем внутреннюю топологию слагаемых (terms)
        if (terms && terms.length > 0) {
            terms.forEach((term, index) => {
                // Создаем уникальный изолированный ID для слагаемого внутри этой конкретной хорды,
                // чтобы оно никогда не конфликтовало с одноименным базовым лучом!
                const termInstanceId = `${term.name}_in_${var_let_name}`;
                this.#registerAlias(term.name, termInstanceId);

                // Строго стандартный для вашего отрисовщика синтаксис: center или vector
                const termOrigin = (index === 0)
                    ? { type: "center" }
                    : { type: "vector", id: `${terms[index - 1].name}_in_${var_let_name}` };

                const existingIdx = this.data.vectors.findIndex(v => v.id === termInstanceId);
                if (existingIdx !== -1) {
                    this.data.vectors[existingIdx].value = { re: term.value.real, im: term.value.imaginary };
                } else {
                    this.data.vectors.push({
                        id: termInstanceId,
                        layer: layerId,
                        label: term.tex_name,
                        origin: termOrigin,
                        value: { re: term.value.real, im: term.value.imaginary }
                    });
                }
            });
        }

        // 2. Определение точки старта для самой хорды по правилам вашего отрисовщика.
        // Математика выражения диктует топологию: хорда-результат связывается с концом ПОСЛЕДНЕГО вектора цепочки.
        let chordOrigin = { type: "center" };
        if (terms && terms.length > 0) {
            const lastTermInstanceId = `${terms[terms.length - 1].name}_in_${var_let_name}`;
            chordOrigin = { type: "vector", id: lastTermInstanceId };
        }

        // 3. Записываем или обновляем результирующий вектор (хорду) под её настоящим ID
        const existingChordIdx = this.data.vectors.findIndex(v => v.id === var_let_name);
        if (existingChordIdx !== -1) {
            this.data.vectors[existingChordIdx].value = { re: var_let_value.real, im: var_let_value.imaginary };
            this.data.vectors[existingChordIdx].origin = chordOrigin;
            this.data.vectors[existingChordIdx].label = var_let_tex;
        } else {
            this.data.vectors.push({
                id: var_let_name,
                layer: layerId,
                label: var_let_tex,
                origin: chordOrigin, // Передаем строго валидный объект { type: "vector", id: "..." }
                value: { re: var_let_value.real, im: var_let_value.imaginary }
            });
        }

        // Синхронизируем обновленные калькулятором значения по всей таблице алиасов
        this.#updateAllAliasesOf(var_let_name, var_let_value);
        if (terms) {
            terms.forEach(t => this.#updateAllAliasesOf(t.name, t.value));
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
