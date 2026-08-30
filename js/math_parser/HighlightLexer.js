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
            chunks.push(<span class="token-rw-characters">${lexer.stringValue()}</span>`);
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
                    // Запоминаем тип скобки, её ID и индекс в массиве chunks, чтобы потом можно было пометить ошибку
                    bracketStack.push({ type: token, id: id, chunkIndex: chunks.length }); 
                    chunks.push(`<span class="token-bracket" data-bracket-id="${id}" data-index="${lexer.tokenStart}">${lexer.stringValue()}</span>`);
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
                        chunks.push(`<span class="token-bracket" data-bracket-id="${pairId}" data-index="${lexer.tokenStart}">${lexer.stringValue()}</span>`);
                    } else {
                        // Ошибка: закрывающая скобка не имеет пары
                        chunks.push(`<span class="token-bracket token-bracket-error" data-index="${lexer.tokenStart}">${lexer.stringValue()}</span>`);
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
    // ПОСТ-ОБРАБОТКА:
    // Если в стеке остались открывающие скобки, у которых нет закрывающих,
    // мы ретроспективно меняем их класс на ошибочный.
    while (bracketStack.length > 0) {
        const unmatched = bracketStack.pop();
        // Заменяем класс в сохраненном чанке на ошибку
        chunks[unmatched.chunkIndex] = chunks[unmatched.chunkIndex].replace('token-bracket', 'token-bracket token-bracket-error');
    }    
    return chunks.join(''); 
}