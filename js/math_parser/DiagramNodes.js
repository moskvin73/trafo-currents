import ASTNode,  from './ASTNodes.js';
import ASTNode,  from '../views/DiagramDescriptor.js';


export class PlotInitNode extends ASTNode {
  constructor(name, mode, loc) {
    super(loc); 
    this.name = name; // Имя функции (строка)
    this.args = args; // Массив дочерних узлов ASTNode
  }

}