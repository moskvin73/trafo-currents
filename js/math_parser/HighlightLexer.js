import { TokenType } from './TokenTypes.js';
import { MathLexer } from './MathLexer.js';

export function htmlEscape(text) {
    return text
            .replace(/&/g, "&amp;")
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

export function HighlightLerxer(text) {
    const lexer = new MathLexer(text, [], 1, true);
    const chunks = [];
    const bracketStack = [];
    let bracketIdCounter = 0; 
    let token = lexer.next();
    while (token !== TokenType.EOF) {
        if (token >= TokenType.FIRST_RESERVED_CHARACTERS && token <= TokenType.LAST_RESERVED_CHARACTERS)
            chunks.push(lexer.stringValue());
        else if (token >= TokenType.FIRST_RESERVED_CONSTANTS && token <= TokenType.LAST_RESERVED_CONSTANTS)
            chunks.push(`<span class="token-rw-constants">${lexer.source.slice(lexer.tokenStart, lexer.tokenEnd)}</span>`);
        else if (token >= TokenType.FIRST_RESERVED_WORDS && token <= TokenType.LAST_RESERVED_WORDS)
            chunks.push(`<span class="token-rw-words">${lexer.stringValue()}</span>`);
        else switch (token) {
                // --- Обработка скобок ---
                case TokenType.LPAREN:
                case TokenType.LSQUARE:
                case TokenType.LBRACE: {
                    const id = bracketIdCounter++;
                    // Запоминаем тип скобки и её ID в стеке
                    bracketStack.push({ type: token, id: id }); 
                    chunks.push(`<span class="token-bracket" data-bracket-id="${id}">${lexer.stringValue()}</span>`);
                    break;
                }
                case TokenType.RPAREN:
                case TokenType.RSQUARE:
                case TokenType.RBRACE: {
                    // Ищем соответствующую открывающую скобку в стеке
                    const expectedOpen = token === TokenType.RPAREN ? TokenType.LPAREN :
                                         token === TokenType.RSQUARE ? TokenType.LSQUARE : TokenType.LBRACE;
                    
                    let pairId = null;
                    // Проверяем стек на корректность вложенности
                    if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1].type === expectedOpen) {
                        pairId = bracketStack.pop().id;
                    }

                    if (pairId !== null) {
                        chunks.push(`<span class="token-bracket" data-bracket-id="${pairId}">${lexer.stringValue()}</span>`);
                    } else {
                        // Если парная скобка не найдена (ошибка синтаксиса)
                        chunks.push(`<span class="token-bracket token-bracket-error">${lexer.stringValue()}</span>`);
                    }
                    break;
                }
                // --- Конец обработки скобок ---

            case TokenType.COMMENT:
                chunks.push(`<span class="token-comment">${htmlEscape(lexer.stringValue())}</span>`);
                break;
            case TokenType.SPACES:
                chunks.push(lexer.stringValue());
                break;
            case TokenType.ERROR:
                chunks.push(`<span class="token-error-code">${htmlEscape(lexer.stringValue())}</span>`);
                break;
            case TokenType.ERROR_STR:
                chunks.push(`<span class="token-error-string">${htmlEscape(lexer.source.slice(lexer.tokenStart - 1, lexer.tokenEnd))}</span>`);
                break;
            case TokenType.TEXT_BLOCK:
                chunks.push(`<span class="token-string">${htmlEscape(lexer.source.slice(lexer.tokenStart - 1, lexer.tokenEnd + 1))}</span>`);
                break;
            case TokenType.NUMBER:
                chunks.push(`<span class="token-number">${lexer.stringValue()}</span>`);
                break;
            case TokenType.COMPLEX_NUMBER:
                chunks.push(`<span class="token-complex-number">${lexer.stringValue()}</span>`);
                break;
            case TokenType.VARIABLE:
                chunks.push(`<span class="token-varable">${lexer.stringValue()}</span>`);
                break;
            case TokenType.LT:       // <
                chunks.push('&lt;');
                break;
            case TokenType.GT:       // >
                chunks.push('&gt;');
                break;
            case TokenType.LTE:      // <=
                chunks.push('&lt;=');
                break;
            case TokenType.GTE:      // >=
                chunks.push('&gt;=');
                break;
            default: throw new Error(`[HighlightLerxer]: неизвестный токен ${token}`);
        }
        token = lexer.next();
    }
    return chunks.join(''); 
}