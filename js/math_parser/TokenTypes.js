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
  VARIABLE: 11,      // Переменные
  TEXT_BLOCK: 12,    // "строка"
  COMMENT: 13,        // // комментарий
  SEMICOLON: 14, // ;
  SILENT: 15     // $ 
});