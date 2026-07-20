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

        const existingVec = this.data.vectors.find(v => v.id === vectorId);
        const vecData = {
            id: vectorId,
            layer: layerId,
            label: labelTex,
            origin: { type: "center" },
            value: { re: complexValue.real, im: complexValue.imaginary }
        };

        if (existingVec) {
            existingVec.value.re = vecData.value.re;
            existingVec.value.im = vecData.value.im;
        } else {
            this.data.vectors.push(vecData);
        }

        // КЛЮЧЕВОЙ ШАГ: Пересчитываем все хорды диаграммы, так как этот вектор мог измениться!
        this.recalculateChordsGraph();
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

        // Сохраняем "рецепт" хорды прямо в объекте вектора, чтобы уметь пересчитывать её динамически
        const isSubtraction = terms && terms.length === 2 && terms.some(t => t.isNegative);
        
        const chordData = {
            id: var_let_name,
            layer: layerId,
            label: var_let_tex,
            origin: { type: "center" }, // Вычислится в recalculateChordsGraph
            value: { re: var_let_value.real, im: var_let_value.imaginary },
            // Метаданные для сквозного реактивного пересчета
            formula: {
                isSubtraction: isSubtraction,
                terms: terms.map(t => ({ name: t.name, isNegative: t.isNegative }))
            }
        };

        // Гарантируем наличие базовых векторов (terms) в массиве
        if (terms && terms.length > 0) {
            terms.forEach(term => {
                const exists = this.data.vectors.some(v => v.id === term.name);
                if (!exists) {
                    this.data.vectors.push({
                        id: term.name,
                        layer: layerId,
                        label: term.tex_name,
                        origin: { type: "center" },
                        value: { re: term.value.real, im: term.value.imaginary }
                    });
                }
            });
        }

        const existingChord = this.data.vectors.find(v => v.id === var_let_name);
        if (existingChord) {
            existingChord.value.re = chordData.value.re;
            existingChord.value.im = chordData.value.im;
            existingChord.formula = chordData.formula;
            existingChord.label = chordData.label;
        } else {
            this.data.vectors.push(chordData);
        }

        // КЛЮЧЕВОЙ ШАГ: Обновляем весь граф зависимостей
        this.recalculateChordsGraph();
        this.reactiveUpdate();
    }

     /**
     * Сквозной пересчет топологии и значений абсолютно всех хорд на диаграмме.
     * Автоматически подтягивает "уплывшие" векторы (например, U_ca при изменении U_a).
     */
    recalculateChordsGraph() {
        this.data.vectors.forEach(vector => {
            // Если у вектора есть сохраненная формула — значит это хорда, требующая динамического ведения
            if (!vector.formula) return;

            const { isSubtraction, terms } = vector.formula;
            if (!terms || terms.length === 0) return;

            // 1. Динамически пересчитываем значение хорды на основе ЖИВЫХ векторов из массива
            let totalRe = 0;
            let totalIm = 0;

            terms.forEach(term => {
                const liveVec = this.data.vectors.find(v => v.id === term.name);
                if (liveVec) {
                    const sign = term.isNegative ? -1 : 1;
                    totalRe += sign * liveVec.value.re;
                    totalIm += sign * liveVec.value.im;
                }
            });

            vector.value.re = totalRe;
            vector.value.im = totalIm;

            // 2. Динамически выравниваем её origin (точку старта)
            if (isSubtraction) {
                // Из конца вычитаемого (по правилу «Из конца начало»)
                const negativeTerm = terms.find(t => t.isNegative);
                vector.origin = { type: "vector", id: negativeTerm.name };
            } else {
                // Для последовательных цепочек (сумм) — из конца последнего слагаемого
                vector.origin = { type: "vector", id: terms[terms.length - 1].name };
            }
        });
    }

    /**
     * Внутренний метод реактивной перерисовки холста, если он уже выведен на экран
     */
    reactiveUpdate() {
        if (this.instance) {
            const freshData = {
                config: { ...this.data.config },
                layers: { ...this.data.layers },
                vectors: [...this.data.vectors]
            };
            this.instance.updateData(freshData);            
            //this.instance.updateData(this.data);
        }
    }
}
