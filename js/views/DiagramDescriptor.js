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
         let vec = this.data.vectors.find(v => v.id === vectorId);

        if (vec) {
            vec.value = { re: complexValue.real, im: complexValue.imaginary };
            vec.layer = layerId;
            vec.label = labelTex;
        } else {
            this.data.vectors.push({
                id: vectorId,
                layer: layerId,
                label: labelTex,
                origin: { type: "center" },
                value: { re: complexValue.real, im: complexValue.imaginary }
            });
        }

        // КРИТИЧЕСКИЙ СБРОС И ПЕРЕСЧЕТ: обновляем все зависимые хорды живыми значениями
        this.#recalculateDependentElements();
        this.reactiveUpdate();
    }

    /**
     * Системное добавление/обновление хорды на основе топологического анализа векторов
     * @param {Object} inputData - Подготовленные данные полинома
     * @param {string} layerId - Идентификатор слоя
     */
    addChord(inputData, layerId) {
     const chordId = inputData.var_let_name;
        if (!chordId) return;

        // Сохраняем рецепт (структуру формулы) внутри объекта хорды для реактивного пересчета
        let chord = this.data.vectors.find(v => v.id === chordId);

        if (!chord) {
            chord = {
                id: chordId,
                layer: layerId,
                label: inputData.var_let_tex,
                origin: { type: "center" }
            };
            this.data.vectors.push(chord);
        }

        // Запоминаем формулу в контексте объекта
        chord.recipe = {
            constant: inputData.constant,
            terms: inputData.terms.map(t => ({ name: t.name, isNegative: t.isNegative, tex_name: t.tex_name }))
        };

        // Связываем базовые векторы формулы с этой хордой в карте зависимостей
        inputData.terms.forEach(t => {
            if (!this.#aliases.has(t.name)) this.#aliases.set(t.name, []);
            if (!this.#aliases.get(t.name).includes(chordId)) this.#aliases.get(t.name).push(chordId);
        });

        // Считаем геометрию и связи
        this.#evaluateChordGeometry(chord, layerId);
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
        if (!terms || terms.length === 0) {
            chordVector.origin = { type: "center" };
            return;
        }

        // КЛАССИКА: Разность двух векторов (например, U_a - U_b)
        if (terms.length === 2) {
            const negativeTerm = terms.find(t => t.isNegative);
            const positiveTerm = terms.find(t => !t.isNegative);

            if (negativeTerm && positiveTerm) {
                // Проверяем, есть ли на диаграмме вектор, вычитаемый из выражения
                const hasNegVector = this.data.vectors.some(v => v.id === negativeTerm.name);
                
                if (hasNegVector) {
                    // Точка начала хорды — это всегда конец вычитаемого вектора (минусового)
                    chordVector.origin = { type: "vector", id: negativeTerm.name };
                    return; 
                }
            }
        }

        // УНИВЕРСАЛЬНАЯ СЛОЖНАЯ ЦЕПОЧКА (Если слагаемых больше двух)
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
        /**
     * Вычисление живого значения хорды на основе текущего состояния векторов на диаграмме
     */
    #evaluateChordGeometry(chord, layerId) {
        const recipe = chord.recipe;
        let realSum = recipe.constant ? recipe.constant.real : 0;
        let imagSum = recipe.constant ? recipe.constant.imaginary : 0;

        // 1. Расчет живого математического значения R = sum((-1)^n * V_живой) + C
        for (const term of recipe.terms) {
            // Ищем вектор прямо на диаграмме (берём актуальное измененное значение, например U_a/2)
            const liveVec = this.data.vectors.find(v => v.id === term.name);
            const val = liveVec ? liveVec.value : { re: 0, im: 0 };

            if (term.isNegative) {
                realSum -= val.re;
                imagSum -= val.im;
            } else {
                realSum += val.re;
                imagSum += val.im;
            }
        }
        chord.value = { re: realSum, im: imagSum };

        // 2. ОБЩИЙ ТОПОЛОГИЧЕСКИЙ АНАЛИЗ (Поиск граничных лучей контура)
        // Ищем опорные лучи (привязанные к центру), которые участвуют в выражении
        const rays = recipe.terms.filter(t => {
            const v = this.data.vectors.find(vec => vec.id === t.name);
            return v && v.origin.type === "center";
        });

        // Находим луч-вычитания (V_лк, идет с минусом) и луч-начала (V_лн, идет с плюсом)
        const negativeRay = rays.find(r => r.isNegative);
        const positiveRay = rays.find(r => !r.isNegative);

        // Если нашли вычитаемый луч V_лк (физический конец контура, например -U_b)
        if (negativeRay) {
            // Чтобы хорда замкнула полигон и пристыковалась к концу этого луча,
            // её геометрический origin должен быть привязан к его ID. При изменении луча хорда сдвинется сама.
            chord.origin = { type: "vector", id: negativeRay.name };
            return;
        } 
        
        // Если отрицательного луча нет, но есть положительный опорный луч V_лн
        if (positiveRay) {
            chord.origin = { type: "vector", id: positiveRay.name };
            return;
        }

        // Свободный случай (нет лучей вообще): строим последовательную цепочку в воздухе
        let currentOriginId = null;
        for (let i = 0; i < recipe.terms.length; i++) {
            const term = recipe.terms[i];
            const nextOrigin = currentOriginId ? { type: "vector", id: currentOriginId } : { type: "center" };
            currentOriginId = this.#getOrCreateChainSegment(term, nextOrigin, layerId);
        }
        chord.origin = { type: "vector", id: currentOriginId };
    }

    /**
     * Каскадный пересчет всех хорд при изменении любого базового вектора
     */
    #recalculateDependentElements() {
        // Проходим по всем векторам, у которых есть сохраненный рецепт формулы (это наши хорды)
        for (const vec of this.data.vectors) {
            if (vec.recipe) {
                this.#evaluateChordGeometry(vec, vec.layer);
            }
        }
    }

    /**
     * Создание цепочки для абстрактных свободных векторов (без опорных лучей)
     */
    #getOrCreateChainSegment(term, originConfig, layerId) {
        let segmentId = term.isNegative ? `${term.name}_minus` : term.name;
        let liveVec = this.data.vectors.find(v => v.id === term.name);
        
        let baseValue = liveVec ? liveVec.value : { re: 0, im: 0 };
        let targetValue = term.isNegative ? { re: -baseValue.re, im: -baseValue.im } : { re: baseValue.re, im: baseValue.im };
        let targetLabel = term.isNegative ? (term.tex_name.startsWith('-') ? term.tex_name.slice(1) : `-${term.tex_name}`) : term.tex_name;

        let segment = this.data.vectors.find(v => v.id === segmentId);
        if (segment) {
            segment.origin = originConfig;
            segment.value = targetValue;
        } else {
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
}
