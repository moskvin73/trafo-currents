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
        // ШАГ 1: Математический расчет комплексных значений (re/im) для всех хорд.
        // Сначала считаем значения, чтобы геометрия опиралась на правильные числа.
       /* let changed = true;
        let iterations = 0;
        
        // Крутим цикл, пока значения не стабилизируются (для обработки вложенности хорда-в-хорде)
        while (changed && iterations < 10) {
            changed = false;
            iterations++;
            
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
                            totalRe += sign * liveVector.value.re;
                            totalIm += sign * liveVector.value.im;
                        }
                    });
                }
                
                if (Math.abs(vector.value.re - totalRe) > 1e-5 || Math.abs(vector.value.im - totalIm) > 1e-5) {
                    vector.value = { re: totalRe, im: totalIm };
                    changed = true;
                }
            });
        }

        // ШАГ 2: ТОПОЛОГИЧЕСКАЯ ТРАССИРОВКА (Распределение связей origin)
        // Сначала сбрасываем всё в дефолтное состояние (базовые лучи из центра)
        this.data.vectors.forEach(v => {
            if (!v.isChordDependant) {
                v.origin = { type: "center" };
            }
        }); 

        // Теперь проходим по каждой хорде и выстраиваем её внутренние terms "паровозиком"
        this.data.vectors.forEach(vector => {
            if (!vector.isChordDependant || !vector.formula) return;

            const { terms } = vector.formula;
            if (!terms || terms.length === 0) return;

            const hasNegative = terms.some(t => t.isNegative);

            if (hasNegative) {
                // Сценарий вычитания (разности): хорда просто соединяет концы
                if (terms.length === 2) {
                    const negTerm = terms.find(t => t.isNegative);
                    vector.origin = { type: "vector", id: negTerm.name };
                }
            } else {
                // Сценарий СЛОЖЕНИЯ (Цепочка / Полином / Падение в линии)
                // Итоговый вектор суммы (например, U_c или ΔU) должен начинаться там же,
                // где начинается самое первое слагаемое этой цепочки!
                vector.origin = { type: "vector", id: terms[0].name };

                // А сами элементы цепочки (terms) жестко привязываем друг за другом
                for (let i = 1; i < terms.length; i++) {
                    const prevTermName = terms[i - 1].name;
                    const currentTerm = this.data.vectors.find(v => v.id === terms[i].name);
                    
                    if (currentTerm) {
                        currentTerm.origin = { type: "vector", id: prevTermName };
                    }
                }
            }
        });

        // ШАГ 3: КОРРЕКЦИЯ ВЛОЖЕННОСТИ (Главное исправление)
        // Если вектор (например, ΔU) сам стал хордой, то он сместился. 
        // Значит, первый элемент его подцепочки (ΔU_a) должен уйти из центра 
        // и встать ровно в ту точку, куда изначально указывал старт родительского ΔU!
        this.data.vectors.forEach(vector => {
            if (!vector.isChordDependant || !vector.formula) return;
            
            const { terms } = vector.formula;
            const hasNegative = terms.some(t => t.isNegative);
            
            if (!hasNegative && terms && terms.length > 0) {
                // Находим, не является ли сама эта хорда чьим-то слагаемым в другой большой хорде?
                const parentChord = this.data.vectors.find(p => 
                    p.isChordDependant && 
                    p.formula && 
                    p.formula.terms.some(t => t.name === vector.id)
                );

                if (parentChord) {
                    // Если нашли родительскую хорду (например, U_c), смотрим, где внутри неё стоял наш вектор (ΔU)
                    const pTerms = parentChord.formula.terms;
                    const myIdxInParent = pTerms.findIndex(t => t.name === vector.id);

                    const firstChildOfMine = this.data.vectors.find(v => v.id === terms[0].name);
                    if (firstChildOfMine) {
                        if (myIdxInParent === 0) {
                            // Если наш ΔU стоял первым в родительской цепочке, его подхорда начинается в центре
                            firstChildOfMine.origin = { type: "center" };
                        } else {
                            // Если наш ΔU стоит после кого-то (например, после U_н), 
                            // то первый элемент подцепочки (ΔU_a) привязывается к концу предыдущего слагаемого родителя (U_н)!
                            const siblingName = pTerms[myIdxInParent - 1].name;
                            firstChildOfMine.origin = { type: "vector", id: siblingName };
                        }
                        
                        // Сам вектор-сумма (ΔU) теперь тоже визуально стартует из этой же точки связи
                        vector.origin = firstChildOfMine.origin;
                    }
                }
            }
        });*/
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
