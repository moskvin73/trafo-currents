export class DiagramDescriptor {
    /**
     * @param {string} mode - "three-phase" или "math"
     * @param {string} viewType - "inline" или "window"
     */
    constructor(mode, viewType) {
        this.type = "DiagramState"; // Метка типа для вашей SymbolTable
        this.target = viewType || "inline";
        this.instance = null;        // Ссылка на живой объект VectorDiagram
        this.containerElement = null; // DOM-элемент, куда рендерится SVG
        
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
            value: { re: complexValue.re, im: complexValue.im },
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