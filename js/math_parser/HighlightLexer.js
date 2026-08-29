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
    let htmltext = '';
    let token = lexer.next();
    while (token !== TokenType.EOF) {
        if (token >= TokenType.FIRST_RESERVED_CHARACTERS && token <= TokenType.LAST_RESERVED_CHARACTERS)
            htmltext += lexer.stringValue();
        else if (token >= TokenType.FIRST_RESERVED_CONSTANTS && token <= TokenType.LAST_RESERVED_CONSTANTS)
            htmltext += `<span class="token-rw-constants">&amp;${lexer.source.slice(lexer.tokenStart + 1, lexer.tokenEnd)}</span>`;
        else if (token >= TokenType.FIRST_RESERVED_WORDS && token <= TokenType.LAST_RESERVED_WORDS)
            htmltext += `<span class="token-rw-words">&amp;${lexer.stringValue()}</span>`;
        else switch (token) {
            case TokenType.COMMENT:
                htmltext += `<span class="token-comment">${htmlEscape(lexer.stringValue())}</span>`;
                break;
            case TokenType.SPACES:
                htmltext += lexer.stringValue();
                break;
            case TokenType.ERROR:
                htmltext += `<span class="token-error-code">${htmlEscape(lexer.stringValue())}</span>`;
                break;
            case TokenType.ERROR_STR:
                htmltext += `<span class="token-error-string">${htmlEscape(lexer.source.slice(lexer.tokenStart - 1, lexer.tokenEnd))}</span>`;
                break;
            case TokenType.TEXT_BLOCK:
                htmltext += `<span class="token-string">${htmlEscape(lexer.source.slice(lexer.tokenStart - 1, lexer.tokenEnd + 1))}</span>`;
                break;
            case TokenType.NUMBER:
                htmltext += `<span class="token-number">${lexer.stringValue()}</span>`;
                break;
            case TokenType.COMPLEX_NUMBER:
                htmltext += `<span class="token-complex-number">${lexer.stringValue()}</span>`;
                break;
            case TokenType.VARIABLE:
                htmltext += `<span class="token-varable">${lexer.stringValue()}</span>`;
                break;
            case TokenType.LT:       // <
                htmltext += '&lt;';
                break;
            case TokenType.GT:       // >
                htmltext += '&gt;';
                break;
            case TokenType.LTE:      // <=
                htmltext += '&lt;=';
                break;
            case TokenType.GTE:      // >=
                htmltext += '&gt;=';
                break;
            default: throw new Error(`[HighlightLerxer]: неизвестный токен ${token}`);
        }
        token = lexer.next();
    }
    return htmltext;
}