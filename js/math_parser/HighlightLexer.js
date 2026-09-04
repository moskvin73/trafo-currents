import { TokenType, TokenDetails } from './TokenTypes.js';
import { MathLexer } from './MathLexer.js';
import { SymbolTableContext, SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';
import ASTNode, {
  IF_Node,
  Goto_Node,
  IsOpNode,
  ErrorNode,
  CastOpNode,
  NumberNode,
  UnaryOpNode, 
  UnaryOpNodePlus,
  UnaryOpNodeMinus,
  UnaryOpNodeNot,
  BinaryOpNode,
  OrNode,
  XorNode,
  AndNode,
  EquNode,
  NotEquNode,
  LtNode,
  GtNode,
  LteNode,
  GteNode,
  AddNode,
  SubNode,
  MulNode,
  DivNode,
  ModNode,
  PowNode,
  CallNode,
  RefNode, 
  AssignNode, 
  VariableNode, 
  PrintNode, 
  ProgramNode,
  MatrixNode,
  IndexNode,
  VarableCode,
  DefineVarableCodeNode,
  StatementNode,
  ConstantNode } from './ASTNodes.js';


export function htmlEscape(text) {
    return text
            .replace(/&/g, "&amp;")
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

export function HighlightLerxer(text, context) {
    // Проверяем, что text является строкой
    if (typeof text !== 'string') {
        throw new TypeError('Аргумент "text" должен быть строкой');
    }

    // Проверяем, что context является экземпляром класса SymbolTableContext
    if (!(context instanceof SymbolTableContext)) {
        throw new TypeError('Аргумент "context" должен быть экземпляром SymbolTableContext');
    }    
    const lexer = new MathLexer(text, [], 1, true);
    const chunks = [];
    const bracketStack = [];
    let bracketIdCounter = 0; 
    let token = lexer.next();
    let hint =  htmlEscape(TokenDetails[token].hint || '');
    while (token !== TokenType.EOF) {
        if (token >= TokenType.FIRST_RESERVED_CHARACTERS && token <= TokenType.LAST_RESERVED_CHARACTERS)
            chunks.push({ type: 'TEXT', html: `<span class="token-rw-characters" data-title="${hint}">${lexer.stringValue()}</span>`});
        else if (token >= TokenType.FIRST_RESERVED_CONSTANTS && token <= TokenType.LAST_RESERVED_CONSTANTS)
            chunks.push({ type: 'TEXT', html: `<span class="token-rw-constants" data-title="${hint}">${lexer.source.slice(lexer.tokenStart, lexer.tokenEnd)}</span>`});
        else if (token >= TokenType.FIRST_RESERVED_WORDS && token <= TokenType.LAST_RESERVED_WORDS)
            chunks.push({ type: 'TEXT', html: `<span class="token-rw-words" data-title="${hint}">${lexer.stringValue()}</span>`});
        else switch (token) {
                // --- Обработка скобок ---
                case TokenType.LPAREN:
                case TokenType.LSQUARE:
                case TokenType.LBRACE: {
                    const id = bracketIdCounter++;
                    // Запоминаем тип скобки, её ID и индекс в массиве chunks, чтобы потом можно было пометить ошибку
                    bracketStack.push({ type: token, id: id, chunkIndex: chunks.length }); 
                    chunks.push({ type: 'TEXT', html: `<span class="token-bracket" data-title="${hint}" data-bracket-id="${id}" data-index="${lexer.tokenStart}">${lexer.stringValue()}</span>`});
                    break;
                }
                case TokenType.RPAREN:
                case TokenType.RSQUARE:
                case TokenType.RBRACE: {
                    const expectedOpen = token === TokenType.RPAREN ? TokenType.LPAREN :
                                        token === TokenType.RSQUARE ? TokenType.LSQUARE : TokenType.LBRACE;
                    
                    let pairId = null;
                    
                    // Ищем подходящую открывающую скобку с конца стека
                    for (let i = bracketStack.length - 1; i >= 0; i--) {
                        if (bracketStack[i].type === expectedOpen) {
                            pairId = bracketStack[i].id;
                            // Удаляем найденную скобку и все ошибочные скобки после неё
                            // (Те, что были после неё, автоматически становятся непарными)
                            bracketStack.splice(i); 
                            break;
                        }
                    }
                    if (pairId !== null) {
                        chunks.push({ type: 'TEXT', html: `<span class="token-bracket" data-title="${hint}" data-bracket-id="${pairId}" data-index="${lexer.tokenStart}">${lexer.stringValue()}</span>`});
                    } else {
                        // Ошибка: закрывающая скобка не имеет пары
                        chunks.push({ type: 'TEXT', html: `<span class="token-bracket data-title="${hint}" token-bracket-error" data-index="${lexer.tokenStart}">${lexer.stringValue()}</span>`});
                    }                    
                    break;
                }
                // --- Конец обработки скобок ---

            case TokenType.COMMENT:
                chunks.push({ type: 'TEXT', html: `<span class="token-comment" data-title="${hint}">${htmlEscape(lexer.stringValue())}</span>`});
                break;
            case TokenType.SPACES:
                chunks.push({ type: 'TEXT', html: lexer.stringValue()});
                break;
            case TokenType.NL:    
                chunks.push({ type: 'NL', html: '<br>' });
                break;
            case TokenType.ERROR:
                chunks.push({ type: 'TEXT', html: `<span class="token-error-code" data-title="${hint}">${htmlEscape(lexer.stringValue())}</span>`});
                break;
            case TokenType.ERROR_STR:
                chunks.push({ type: 'TEXT', html: `<span class="token-error-string" data-title="${hint}">${htmlEscape(lexer.source.slice(lexer.tokenStart - 1, lexer.tokenEnd))}</span>`});
                break;
            case TokenType.TEXT_BLOCK:
                chunks.push({ type: 'TEXT', html: `<span class="token-string" data-title="${hint}">${htmlEscape(lexer.source.slice(lexer.tokenStart - 1, lexer.tokenEnd + 1))}</span>`});
                break;
            case TokenType.NUMBER:
                chunks.push({ type: 'TEXT', html: `<span class="token-number" data-title="${hint}">${lexer.stringValue()}</span>`});
                break;
            case TokenType.COMPLEX_NUMBER:
                chunks.push({ type: 'TEXT', html: `<span class="token-complex-number" data-title="${hint}">${lexer.stringValue()}</span>`});
                break;
            case TokenType.VARIABLE: {
                    const name = lexer.stringValue();
                    const id = context.getIdByName(name);
                    if (id) {
                        const sym = context.getParseSymbolById(id);
                        switch (sym.type) {
                            case SYM_UNDEFINED:
                                hint = 'Идентификатор объявлен, но значения еще нет';
                                break;
                            case SYM_VARIABLE: {
                                const value = sym.value;
                                if (value instanceof VarableCode)  {
                                    const str_parms = Array.from({ length: sym.value.paramsCount }, (_, i) => `param${i + 1}`).join(', '); 
                                    hint = `Переменная функции: ${name}(${str_parms})`;
                                }
                                else hint = 'Переменная';
                                break;
                            }
                            case SYM_BUILTIN: {
                                hint = 'Встроенная системная функция';
                                const v = sym.value;
                                break;
                            }
                        }
                    }
                    chunks.push({ type: 'TEXT', html: `<span class="token-varable" data-title="${hint}">${name}</span>`});
                }
                break;
            case TokenType.LT:       // <
                chunks.push({ type: 'TEXT', html: `<span class="token-rw-characters" data-title="${hint}">&lt;</span>`});
                break;
            case TokenType.GT:       // >
                chunks.push({ type: 'TEXT', html: `<span class="token-rw-characters" data-title="${hint}">&gt;</span>`});
                break;
            case TokenType.LTE:      // <=
                chunks.push({ type: 'TEXT', html: `<span class="token-rw-characters" data-title="${hint}">&lt;=</span>`});
                break;
            case TokenType.GTE:      // >=
                chunks.push({ type: 'TEXT', html: `<span class="token-rw-characters" data-title="${hint}">&gt;=</span>`});
                break;
            default: throw new Error(`[HighlightLerxer]: неизвестный токен ${token}`);
        }
        token = lexer.next();
        hint =  htmlEscape(TokenDetails[token].hint || '');
    }
    // ПОСТ-ОБРАБОТКА:
    // Если в стеке остались открывающие скобки, у которых нет закрывающих,
    // мы ретроспективно меняем их класс на ошибочный.
    while (bracketStack.length > 0) {
        const unmatched = bracketStack.pop();
        // Заменяем класс в сохраненном чанке на ошибку
        chunks[unmatched.chunkIndex].html  = chunks[unmatched.chunkIndex].html.replace('token-bracket', 'token-bracket token-bracket-error');
    }
    
    const lines = [];
    let currentLine = [];

    for (const chunk of chunks) {
        if (chunk.type === 'NL') {
            // Если строка пустая, вставляем <br>, иначе соединяем накопленные токены
            const lineContent = currentLine.length === 0 ? '<br>' : currentLine.join('');
            lines.push(`<div class="code-line">${lineContent}</div>`);
            currentLine = []; // Очищаем для следующей строки
        } else {
            currentLine.push(chunk.html);
        }
    }

    if (currentLine.length > 0)
        lines.push(`<div class="code-line">${currentLine.join('')}</div>`);
    else if (chunks.length > 0 && (chunks[chunks.length - 1].type === 'NL'))
        lines.push(`<div class="code-line"><br></div>`);   

    return lines.join(''); 
}