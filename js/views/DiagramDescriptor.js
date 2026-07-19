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
        if (!this.data.layers[layerId]) {
            this.addLayer(layerId, "#666666", 2);
        }

        const vectorData = {
            id: vectorId,
            layer: layerId,
            label: labelTex,
            origin: { type: "center" }, // Лучи всегда из центра
            value: { re: complexValue.real, im: complexValue.imaginary },
            isChordDependant: false // Метка, что это базовый независимый луч
        };

        const existingIdx = this.data.vectors.findIndex(v => v.id === vectorId);
        if (existingIdx !== -1) {
            // Если вектор уже существовал, мы просто обновляем его значение
            // Но сохраняем его структуру, чтобы не сломать граф
            this.data.vectors[existingIdx].value = vectorData.value;
            this.data.vectors[existingIdx].label = vectorData.label;
            this.data.vectors[existingIdx].layer = layerId;
        } else {
            this.data.vectors.push(vectorData);
        }

        // Ключевой шаг: пересчитываем все зависимые хорды под новое значение этого вектора
        this.recalculateAllChords();
        
        // Рендерим обновленную картину
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

        // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ТУТ ---
        // Прежде чем что-то считать, мы должны обновить базовые векторы на диаграмме
        // теми СВЕЖИМИ значениями, которые прямо сейчас прилетели из калькулятора в массиве terms!
        if (terms && terms.length > 0) {
            terms.forEach(term => {
                const baseVector = this.data.vectors.find(v => v.id === term.name);
                
                if (baseVector) {
                    // Если вектор уже есть на диаграмме, принудительно обновляем его значение
                    // свежими данными из текущего расчета калькулятора
                    baseVector.value = { re: term.value.real, im: term.value.imaginary };
                } else if (this.data.config.auto_add) {
                    // Если базового вектора вообще не было (auto_add), создаем его как луч
                    this.addVector(term.name, term.tex_name, layerId, term.value);
                }
            });
        }
        // ---------------------------------

        // Сохраняем или обновляем декларацию формулы хорды
        const chordDeclaration = {
            id: var_let_name,
            layer: layerId,
            label: var_let_tex,
            origin: { type: "center" }, 
            value: { re: var_let_value.real, im: var_let_value.imaginary },
            formula: {
                constant: constant ? { re: constant.real, im: constant.imaginary } : { re: 0, im: 0 },
                terms: terms.map(t => ({
                    name: t.name,
                    tex_name: t.tex_name,
                    isNegative: t.isNegative
                }))
            },
            isChordDependant: true
        };

        const existingIdx = this.data.vectors.findIndex(v => v.id === var_let_name);
        if (existingIdx !== -1) {
            this.data.vectors[existingIdx].formula = chordDeclaration.formula;
            this.data.vectors[existingIdx].label = chordDeclaration.label;
            this.data.vectors[existingIdx].layer = layerId;
        } else {
            this.data.vectors.push(chordDeclaration);
        }

        // Теперь сквозной пересчет увидит обновленный U_a и перестроит всю геометрию!
        this.recalculateAllChords();
        
        this.reactiveUpdate();
    }

    /**
     * Сердце алгоритма: Сквозной динамический пересчет геометрии и значений всех хорд
     * Вызывается автоматически при любом изменении plot_vector или plot_chord
     */
    recalculateAllChords() {
        // ЭТАП 1: Сначала рассчитываем математические значения (re/im) абсолютно всех хорд,
        // чтобы графы и формулы обладали актуальными комплексными числами.
        this.data.vectors.forEach(vector => {
            if (!vector.isChordDependant || !vector.formula) return;

            const { terms, constant } = vector.formula;
            let totalRe = constant.re;
            let totalIm = constant.im;

            if (terms && terms.length > 0) {
                terms.forEach(term => {
                    const liveVector = this.data.vectors.find(v => v.id === term.name);
                    if (liveVector) {
                        const sign = term.isNegative ? -1 : 1;
                        // Если это вложенная хорда, берем ее посчитанное значение, иначе значение луча
                        totalRe += sign * liveVector.value.re;
                        totalIm += sign * liveVector.value.im;
                    }
                });
            }
            vector.value = { re: totalRe, im: totalIm };
        });

        // ЭТАП 2: Топологическая трассировка (выстраивание origin паровозиком)
        this.data.vectors.forEach(vector => {
            if (!vector.isChordDependant || !vector.formula) return;

            const { terms } = vector.formula;
            const hasNegative = terms.some(t => t.isNegative);

            // По умолчанию результирующий вектор суммы выходит из центра
            let currentOriginObj = { type: "center" }; 

            if (terms && terms.length > 0) {
                // Если вектор, к которому мы хотим привязаться, САМ является вложенной хордой,
                // мы должны наследовать его точку начала, а не ломать её!
                const parentChord = this.data.vectors.find(v => v.id === vector.id && v.origin.type === "vector");

                terms.forEach((term, index) => {
                    const liveVector = this.data.vectors.find(v => v.id === term.name);
                    if (!liveVector) return;

                    if (hasNegative) {
                        // Разность векторов (например, U_a - U_b) — цепляем за вычитаемый
                        if (terms.length === 2 && term.isNegative) {
                            currentOriginObj = { type: "vector", id: term.name };
                        }
                    } else {
                        // Чистое сложение (Полином / Вложенная цепочка, например ΔU_а + ΔU_r)
                        if (index === 0) {
                            // Первый элемент цепочки: 
                            // Если глобальный вектор (например, ΔU) уже куда-то привязан (был смещен первой хордой),
                            // то первый элемент его подцепочки (ΔU_а) должен встать ТУДА ЖЕ, куда указывал старт родителя!
                            const ownerChord = this.data.vectors.find(v => v.isChordDependant && v.formula.terms.some(t => t.name === vector.id));
                            if (ownerChord) {
                                // Находим базовый вектор, за который зацепился родитель
                                const siblingTermIdx = ownerChord.formula.terms.findIndex(t => t.name === vector.id);
                                if (siblingTermIdx > 0) {
                                    liveVector.origin = { type: "vector", id: ownerChord.formula.terms[siblingTermIdx - 1].name };
                                }
                            }
                        } else {
                            // Последующие элементы подцепочки строго привязываются к концу предыдущего
                            liveVector.origin = { type: "vector", id: terms[index - 1].name };
                        }
                    }
                });

                // Если это вложенная цепочка (как ΔU = ΔU_а + ΔU_r), то сам результирующий вектор ΔU 
                // должен визуально начинаться там же, где начался его первый элемент (ΔU_а)
                if (!hasNegative) {
                    const firstChild = this.data.vectors.find(v => v.id === terms[0].name);
                    if (firstChild && firstChild.origin.type === "vector") {
                        currentOriginObj = firstChild.origin;
                    }
                }
            }

            // Записываем финальный выверенный origin для хорды
            vector.origin = currentOriginObj;
        });
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