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
     * Живой расчет геометрии хорды на основе текущего состояния векторов
     */
    #evaluateChordGeometry(chord, layerId) {
        const recipe = chord.recipe;
        let realSum = recipe.constant ? recipe.constant.real : 0;
        let imagSum = recipe.constant ? recipe.constant.imaginary : 0;

        // 1. Математический пересчет значения R на основе актуальных координат на диаграмме
        for (const term of recipe.terms) {
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

        // 2. ОБЩИЙ ТОПОЛОГИЧЕСКИЙ АНАЛИЗ (Поиск граничных лучей контура R = Vлн + summ - Vлк)
        const rays = recipe.terms.filter(t => {
            const v = this.data.vectors.find(vec => vec.id === t.name);
            return v && v.origin.type === "center";
        });

        const negativeRay = rays.find(r => r.isNegative); // Наш V_лк (конечный луч с минусом)
        const positiveRay = rays.find(r => !r.isNegative); // Наш V_лн (начальный луч с плюсом)

        // Если в выражении есть конечный луч контура V_лк (идет со знаком минус)
        if (negativeRay) {
            // Хорда должна расти из конца вычитаемого луча, чтобы замкнуть контур геометрически
            chord.origin = { type: "vector", id: negativeRay.name };
            return;
        } 
        
        // Если отрицательного луча нет, но есть положительный опорный луч V_лн
        if (positiveRay) {
            chord.origin = { type: "vector", id: positiveRay.name };
            return;
        }

        // Абстрактная свободная цепочка (нет лучей от центра вообще): строим последовательную ломаную линию
        let currentOriginId = null;
        for (let i = 0; i < recipe.terms.length; i++) {
            const term = recipe.terms[i];
            const nextOrigin = currentOriginId ? { type: "vector", id: currentOriginId } : { type: "center" };
            currentOriginId = this.#getOrCreateChainSegment(term, nextOrigin, layerId);
        }
        chord.origin = { type: "vector", id: currentOriginId };
    }

    /**
     * Каскадный автоматический пересчет всех хорд
     */
    #recalculateDependentElements() {
        for (const vec of this.data.vectors) {
            if (vec.recipe) {
                this.#evaluateChordGeometry(vec, vec.layer);
            }
        }
    }

    /**
     * Создание или обновление звена свободной цепи
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
