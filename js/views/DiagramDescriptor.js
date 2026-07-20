import VectorDiagram from '../VectorDiagram.js'
import { createFloatingWindowDOM }  from '../util.js';
 
export default class DiagramDescriptor {
    #containerElement;
    #aliases; // Карта: имя_исходного_вектора -> массив_id_созданных_псевдонимов

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
        const existingVector = this.data.vectors.find(v => v.id === vectorId);

        if (existingVector) {
            // Если вектор существует, просто реактивно обновляем его значение и слой
            existingVector.value = { re: complexValue.real, im: complexValue.imaginary };
            existingVector.layer = layerId;
            existingVector.label = labelTex;
        } else {
            // Если вектора нет, создаем его как базовый луч от центра
            this.data.vectors.push({
                id: vectorId,
                layer: layerId,
                label: labelTex,
                origin: { type: "center" },
                value: { re: complexValue.real, im: complexValue.imaginary }
            });
        }

        // Каскадно обновляем все зависимые псевдонимы (например, инвертированные копии)
        this.#updateDependentAliases(vectorId);

        // Запускаем реактивный пересчет холста
        this.reactiveUpdate();
    }

    /**
     * Системное добавление/обновление хорды на основе топологического анализа векторов
     * @param {Object} inputData - Подготовленные данные полинома
     * @param {string} layerId - Идентификатор слоя
     */
    addChord(inputData, layerId) {
        const chordId = inputData.mame_let;
        
        // 1. Построение инвариантного хэша топологии для однозначной идентификации цепочки
        const topologyHash = this.#generateTopologyHash(inputData);
        
        // Вычисляем результирующее комплексное значение хорды по формуле R = sum((-1)^n * Vi) + C
        const calculatedValue = this.#calculateChordValue(inputData);

        // Ищем, не была ли эта хорда уже построена ранее
        let existingChord = this.data.vectors.find(v => v.id === chordId);

        if (existingChord) {
            // Если хорда найдена, обновляем её значение
            existingChord.value = calculatedValue;
            existingChord.layer = layerId;
            existingChord.label = inputData.var_let_tex;
            
            // Если топологическая структура (состав векторов) изменилась, перестраиваем связи
            if (existingChord.topologyHash !== topologyHash) {
                existingChord.topologyHash = topologyHash;
                this.#buildTopologyConnections(existingChord, inputData, layerId);
            }
        } else {
            // Создаем новую хорду
            const newChord = {
                id: chordId,
                layer: layerId,
                label: inputData.var_let_tex,
                topologyHash: topologyHash,
                origin: { type: "center" }, // Будет переопределено в процессе топологического анализа
                value: calculatedValue
            };
            
            this.#buildTopologyConnections(newChord, inputData, layerId);
            this.data.vectors.push(newChord);
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

    /**
     * Вычисление результирующего значения хорды
     */
    #calculateChordValue(inputData) {
        let realSum = inputData.constant ? inputData.constant.real : 0;
        let imagSum = inputData.constant ? inputData.constant.imaginary : 0;

        for (const term of inputData.terms) {
            if (term.isNegative) {
                realSum -= term.value.real;
                imagSum -= term.value.imaginary;
            } else {
                realSum += term.value.real;
                imagSum += term.value.imaginary;
            }
        }

        return { re: realSum, im: imagSum };
    }

    /**
     * Генерация инвариантного хэша на основе алфавитной сортировки
     */
    #generateTopologyHash(inputData) {
        const cReal = inputData.constant ? inputData.constant.real.toFixed(4) : "0";
        const cImag = inputData.constant ? inputData.constant.imaginary.toFixed(4) : "0";
        
        // Сортируем копию массива terms по алфавиту Id для инвариантности к перестановкам
        const sortedTerms = [...inputData.terms].sort((a, b) => a.name.localeCompare(b.name));
        
        const termsString = sortedTerms.map(t => `${t.name}[${t.isNegative ? 'minus' : 'plus'}]`).join('_');
        return `C[${cReal}_${cImag}]_${termsString}`;
    }

    /**
     * Топологический анализ и выстраивание цепочки векторов/псевдонимов
     */
    #buildTopologyConnections(chordVector, inputData, layerId) {
        const terms = inputData.terms;
        if (terms.length === 0) {
            chordVector.origin = { type: "center" };
            return;
        }

        // --- ОПТИМИЗАЦИЯ ДЛЯ КЛАССИЧЕСКИХ ХОРД (Разность двух существующих лучей) ---
        // Если выражение состоит ровно из двух векторов, например: U_a (plus) и U_b (minus)
        if (terms.length === 2 && terms.some(t => t.isNegative) && terms.some(t => !t.isNegative)) {
            const positiveTerm = terms.find(t => !t.isNegative);
            const negativeTerm = terms.find(t => t.isNegative);

            const hasPosVector = this.data.vectors.some(v => v.id === positiveTerm.name && v.origin.type === "center");
            const hasNegVector = this.data.vectors.some(v => v.id === negativeTerm.name && v.origin.type === "center");

            // Если оба вектора уже существуют на диаграмме как опорные лучи от центра
            if (hasPosVector && hasNegVector) {
                // В электротехнике вектор U_ab = U_a - U_b начинается на конце U_b и заканчивается на конце U_a
                // Поэтому origin нашей хорды жестко привязывается к концу вектора со знаком МИНУС
                chordVector.origin = { type: "vector", id: negativeTerm.name };
                return; // Выходим, никакие скрытые/псевдонимные цепочки строить не нужно!
            }
        }

        // --- УНИВЕРСАЛЬНЫЙ ВАРИАНТ ДЛЯ СЛОЖНЫХ МНОГОЧЛЕНОВ (Построение цепочки) ---
        // Если это не просто разность двух лучей, а сложная ломаная линия:
        const firstTerm = terms[0];
        const existingBase = this.data.vectors.find(v => v.id === firstTerm.name);
        
        let currentOriginId = null;

        if (existingBase && existingBase.origin.type === "center") {
            currentOriginId = existingBase.id;
        } else {
            currentOriginId = this.#getOrCreateChainSegment(firstTerm, { type: "center" }, layerId);
        }

        for (let i = 1; i < terms.length; i++) {
            const nextTerm = terms[i];
            const nextOrigin = { type: "vector", id: currentOriginId };
            currentOriginId = this.#getOrCreateChainSegment(nextTerm, nextOrigin, layerId);
        }

        chordVector.origin = { type: "vector", id: currentOriginId };
    }

    /**
     * Создание или переиспользование сегмента топологической цепи (с учетом псевдонимов для минуса)
     */
    #getOrCreateChainSegment(term, originConfig, layerId) {
        let segmentId = term.name;
        let targetLabel = term.tex_name;
        let targetValue = { re: term.value.real, im: term.value.imaginary };

        // Если вектор идет со знаком минус, создаем/используем его инвертированный псевдоним
        if (term.isNegative) {
            segmentId = `${term.name}_minus`;
            
            // Модифицируем TeX Label: инвертируем знак прямо в строке
            targetLabel = term.tex_name.startsWith('-') ? term.tex_name.slice(1) : `-${term.tex_name}`;
            targetValue = { re: -term.value.real, im: -term.value.imaginary };

            // Регистрируем связь псевдонима с оригинальным вектором для последующей реактивности
            if (!this.#aliases.has(term.name)) {
                this.#aliases.set(term.name, []);
            }
            if (!this.#aliases.get(term.name).includes(segmentId)) {
                this.#aliases.get(term.name).push(segmentId);
            }
        }

        const existingSegment = this.data.vectors.find(v => v.id === segmentId);

        if (existingSegment) {
            // Если сегмент (или псевдоним) уже есть, обновляем его геометрию и точку привязки
            existingSegment.origin = originConfig;
            existingSegment.value = targetValue;
            existingSegment.layer = layerId;
            existingSegment.label = targetLabel;
        } else {
            // Иначе добавляем новый топологический узел на диаграмму
            this.data.vectors.push({
                id: segmentId,
                layer: layerId,
                label: targetLabel,
                origin: originConfig,
                value: targetValue
            });
        }

        return segmentId;
    }

    /**
     * Служебный метод каскадного обновления всех псевдонимов при изменении базового вектора
     */
    #updateDependentAliases(baseVectorId) {
        if (!this.#aliases.has(baseVectorId)) return;

        const baseVector = this.data.vectors.find(v => v.id === baseVectorId);
        if (!baseVector) return;

        const dependentIds = this.#aliases.get(baseVectorId);

        for (const aliasId of dependentIds) {
            const aliasVector = this.data.vectors.find(v => v.id === aliasId);
            if (aliasVector) {
                // Псевдонимы в нашей системе — это инвертированные векторы (isNegative: true)
                aliasVector.value = {
                    re: -baseVector.value.re,
                    im: -baseVector.value.im
                };
            }
        }
    }
    
}
