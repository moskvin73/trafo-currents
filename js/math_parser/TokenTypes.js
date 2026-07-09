export const TokenType = Object.freeze({
  EOF: 0,
  NUMBER: 1,         // Вещественное число
  COMPLEX_NUMBER: 2, // Комплексное число (1i, 4i)
  PLUS: 3,           // +
  MINUS: 4,          // -
  MUL: 5,            // *
  DIV: 6,            // /
  POW: 7,            // ^ или **
  ASSIGN: 8,         // =
  LPAREN: 9,         // (
  RPAREN: 10,        // )
  FUNCTION: 11,      // sin, cos, log...
  VARIABLE: 12,      // Переменные
  TEXT_BLOCK: 13,    // "строка"
  COMMENT: 14        // // комментарий
});