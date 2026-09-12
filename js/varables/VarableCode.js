import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';

export class VarableCode {
  // На этапе парсинга передаем statements и число — сколько у функции аргументов
  constructor(statements, paramsCount, localsCount, lexicalParentFrame) {
    this.statements = statements;
    this.paramsCount = paramsCount;
    this.localsCount = localsCount;
    this.lexicalParentFrame = lexicalParentFrame; 
  }

  toJSON() {
    if (this.lexicalParentFrame != null)
      throw new Error(`Попытка сохранить не корнивойю процедуру.`);
    return {
      statements: this.statements,
      paramsCount: this.paramsCount,
      localsCount: this.localsCount,
    };
  }

  static get dataTypeName() { return "VarableCode"; }

  static fromJSON(data) {
    const restoredstatements = data.statements.map(stm => restoreDataType(stm));
    return new VarableCode(
      restoredstatements,
      data.paramsCount,
      data.localsCount,
      null
    );
  }

  toRawTeX(settings) { return "\\text{code}"; }

  evaluate(context, args) {
    const scopeCtrl = context.scope_context;
    const frame = scopeCtrl.createFrame(this.localsCount, this.lexicalParentFrame);
    for (let i = 0; i < this.paramsCount; i++) {
        frame.symbols[i].value = args[i];
    }
    scopeCtrl.scopes.push(frame);
    return context.call_code(this.statements);
  }
}
registerDataType(VarableCode.dataTypeName, VarableCode.fromJSON);