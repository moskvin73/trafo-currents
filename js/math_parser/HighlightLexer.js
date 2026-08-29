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

}