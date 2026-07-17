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
     // Создаем экземпляр нашего нового класса-описателя
    const descriptor = new DiagramDescriptor(this.mode, this.viewType);
    
    // Регистрируем в SymbolTableContext
    const id = context.scope_context.acquireId(this.diagramId);
    const sym = context.scope_context.getSymbolById(id);
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
}

export class PlotConfigNode extends ASTNode {
  constructor(diagramId, key, valueNode, loc) {
    super(loc);
        this.diagramId = diagramId;
        this.key = key;
        this.valueNode = valueNode;
  }

  internal_evaluate(context) {
    const symbol = context.scope_context.getSymbolByName(this.diagramId);
    if (!symbol || symbol.value.type !== "DiagramState") {
        throw new Error(`Переменная '${this.diagramId}' не инициализирована как диаграмма.`);
    }
    const descriptor = symbol.value;
    const computedValue = this.valueNode.internal_evaluate(context);
    descriptor.setConfig(this.key, computedValue);
    return null;  
  }
}