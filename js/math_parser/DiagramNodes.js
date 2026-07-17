import ASTNode { VariableNode },  from './ASTNodes.js';
import DiagramDescriptor,  from '../views/DiagramDescriptor.js';
import { createFloatingWindowDOM },  from '../views/util.js';

export class PlotInitNode extends ASTNode {
  constructor(diagramId, mode, viewType, loc) {
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
     * @param {string} color - валидная строки цвета (например, LiteralNode со значением "#FF0000")
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

export class PlotVectorNode extends PlotDataNode {
    /**
     * @param {string} diagramId - Имя переменной диаграммы ("d1")
     * @param {string} variableNode - Имя слоя как строка/идентификатор ("voltages")
     * @param {string} layerId - Имя слоя как строка/идентификатор ("voltages")
     */
    constructor(diagramId, variableName, layerId, loc) {
        super(diagramId, loc);
        this.variableNode;
        this.layerId = layerId;
    }

    internal_evaluate(context) {
        try
        {
            if (variableNode instanceof VariableNode)
            {
                const descriptor = this.getDiagram();
                const vector_id = this.variableNode.name;
                const texLabel = ASTNode.formatIdentifierToTeX(vector_id);
                const value = this.variableNode.internal_evaluate(context);
                descriptor.addVector(vector_id, texLabel, this.layerId, value);
            } else {
                this.error(context, "Недопустимый узел значение вектора");
            }
        } catch(err) { this.error(context, err); }
        return this.errorValue();
    }
}