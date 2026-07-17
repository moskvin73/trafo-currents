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
    catch(err) { this.error(context, err); }
    return this.errorValue();
  }
}

export class PlotLayerNode extends PlotDataNode {
    /**
     * @param {string} diagramId - Имя переменной диаграммы ("d1")
     * @param {string} layerId - Имя слоя как строка/идентификатор ("voltages")
     * @param {string} color - AST-узел для строки цвета (например, LiteralNode со значением "#FF0000")
     * @param {Object|null} strokeWidthNode - Опциональный AST-узел для толщины линии (число)
     */
    constructor(diagramId, layerId, color, loc, strokeWidthNode = null) {
        super(diagramId, loc);
        this.layerId = layerId;
        this.color = color;
        this.strokeWidthNode = strokeWidthNode;
    }

    internal_evaluate(context) {
        try
        {
            const descriptor = this.getDiagram();
            let computedStroke = 2;
            if (this.strokeWidthNode) {
                computedStroke = this.strokeWidthNode.internal_evaluate(context);
            }
            descriptor.addLayer(this.layerId, this.color, computedStroke);
        } catch(err) { this.error(context, err); }
        return this.errorValue();
    }
}