import ASTNode,  from './ASTNodes.js';
import ASTNode,  from '../views/DiagramDescriptor.js';
import { createFloatingWindowDOM },  from '../views/util.js';

export class PlotInitNode extends ASTNode {
  constructor(diagramId, mode, loc, viewType = "inline") {
    super(loc);
    this.diagramId = diagramId;
    this.mode = mode;
    this.viewType = viewType;
  }

  internal_evaluate(context) { 
    try
    {
        // Регистрируем в SymbolTableContext
        const id = context.scope_context.acquireId(this.diagramId);
        const sym = context.scope_context.getSymbolById(id);

        // Создаем экземпляр нашего нового класса-описателя
        const descriptor = new DiagramDescriptor(this.mode, this.viewType);
        sym.value = descriptor;

        // Если режим window — сразу генерируем плавающее окно
        if (this.viewType === "window") {
            // 1. Создаем плавающее окно и получаем его внутренний div
            const contentDiv = createFloatingWindowDOM(this.diagramId);
            
            descriptor.containerElement = contentDiv;
            // 2. Инициализируем отрисовщик векторных диаграмм в этом окне
            descriptor.instance = new VectorDiagram(contentDiv, descriptor.data);
        }
        return descriptor;
    }
    catch(err) {
       this.error(context, err);
       return this.errorValue();
    }
  }
}

export class PlotDataNode extends ASTNode {
  constructor(diagramId, loc) {
    super(loc);
    this.diagramId = diagramId;
  }

  getDiagram() {
    const symbol = context.scope_context.getSymbolByName(this.diagramId);
    if (!symbol || symbol.value.type !== "DiagramState") {
        this.error(context, `Переменная '${this.diagramId}' не инициализирована как диаграмма.`);
        return null;
    }
    return symbol.value;
  }
}

export class PlotConfigNode extends PlotDataNode {
  constructor(diagramId, key, valueNode, loc) {
    super(diagramId, loc);
    this.key = key;
    this.valueNode = valueNode;
  }

  internal_evaluate(context) {
    try
    {
        const descriptor = this.getDiagram();
        if (descriptor)
        {
            const computedValue = this.valueNode.internal_evaluate(context);
            descriptor.setConfig(this.key, computedValue);
        }
    }
    catch(err) {
        this.error(context, err);
    }
    return this.errorValue();
  }
}

export class PlotLayerNode extends PlotDataNode {
    /**
     * @param {string} diagramId - Имя переменной диаграммы ("d1")
     * @param {string} layerId - Имя слоя как строка/идентификатор ("voltages")
     * @param {Object} colorNode - AST-узел для строки цвета (например, LiteralNode со значением "#FF0000")
     * @param {Object|null} strokeWidthNode - Опциональный AST-узел для толщины линии (число)
     */
    constructor(diagramId, layerId, colorNode, loc, strokeWidthNode = null) {
        super(diagramId, loc);
        this.layerId = layerId;
        this.colorNode = colorNode;
        this.strokeWidthNode = strokeWidthNode;
    }

    internal_evaluate(context) {
        // 1. Ищем дескриптор диаграммы в таблице символов
        const symbol = evl_context.getSymbolByName(this.diagramId);
        if (!symbol || symbol.value.type !== "DiagramState") {
            throw new Error(`Runtime Error: Переменная '${this.diagramId}' не инициализирована как диаграмма.`);
        }
        const descriptor = symbol.value;

        // 2. Вычисляем значение цвета (извлекаем строку)
        const computedColor = this.colorNode.evaluate(evl_context);

        // 3. Вычисляем толщину линии, если узел передан, иначе оставляем по умолчанию (например, 2)
        let computedStroke = 2;
        if (this.strokeWidthNode) {
            computedStroke = this.strokeWidthNode.evaluate(evl_context);
        }

        // 4. Передаем управление в дескриптор, который сам выполнит валидацию CSS-цвета
        descriptor.addLayer(this.layerId, computedColor, computedStroke);

        return null; // Функция настройки слоя возвращает void (null)
    }
}