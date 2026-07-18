import ASTNode, { VariableNode } from './ASTNodes.js';
import DiagramDescriptor from '../views/DiagramDescriptor.js';
import ComplexNumber from '../math/ComplexNumber.js';
import { TYPE_UNIT } from './ConstantsDef.js';

export class PlotInitNode extends ASTNode {
  constructor(diagramId, mode, viewType, loc) {
    super(loc);
    this.diagramId = diagramId;
    this.mode = mode;
    this.viewType = viewType;
  }

  get type_unit() { return TYPE_UNIT.PLOT; }

  internal_evaluate(context) { 
    try
    {
        // Регистрируем в SymbolTableContext
        const id = context.scope_context.acquireId(this.diagramId);
        const sym = context.scope_context.getSymbolById(id);

        // Создаем экземпляр нашего нового класса-описателя
        const descriptor = new DiagramDescriptor(this.diagramId, this.mode, this.viewType);
        sym.value = descriptor;

        // Если режим window — сразу генерируем плавающее окно
        if (this.viewType === "window") {
            descriptor.createFloatingWindow();            
        }

        // запишите текущий контекст во временную глобальную переменную, чтобы функция ресайза могла его найти
        window.currentEvaluationContext = context.scope_context;
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

  get type_unit() { return TYPE_UNIT.EMPTY; }

  getDiagram(context) {
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
        const descriptor = this.getDiagram(context);
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
    constructor(diagramId, layerId, color, strokeWidthNode, loc) {
        super(diagramId, loc);
        this.layerId = layerId;
        this.color = color;
        this.strokeWidthNode = strokeWidthNode;
    }

    internal_evaluate(context) {
        try
        {
            const descriptor = this.getDiagram(context);
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
    constructor(diagramId, variableNode, layerId, loc) {
        super(diagramId, loc);
        this.variableNode = variableNode;
        this.layerId = layerId;
    }

    internal_evaluate(context) {
        try
        {
            if (this.variableNode instanceof VariableNode)
            {
                const descriptor = this.getDiagram(context);
                const vector_id = this.variableNode.name;
                const texLabel = ASTNode.formatIdentifierToTeX(vector_id);
                const value = ComplexNumber.from(this.variableNode.internal_evaluate(context));
                descriptor.addVector(vector_id, texLabel, this.layerId, value);
            } else {
                this.error(context, "Недопустимый узел значение вектора");
            }
        } catch(err) { this.error(context, err); }
        return this.errorValue();
    }
}