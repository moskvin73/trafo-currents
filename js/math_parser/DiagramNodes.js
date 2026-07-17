import ASTNode,  from './ASTNodes.js';
import ASTNode,  from '../views/DiagramDescriptor.js';
import { createFloatingWindowDOM },  from '../views/util.js';

export class PlotInitNode extends ASTNode {
  constructor(name, mode, viewType, loc) {
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
        descriptor.containerElement = createFloatingWindowDOM(this.diagramId);
        // Инициализируем графический движок VectorDiagram внутри созданного окна
        descriptor.instance = new VectorDiagram(descriptor.containerElement, descriptor.data);
    }

    return descriptor;     
  }
}