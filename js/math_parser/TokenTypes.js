// Просто пишем список названий по порядку
const tokenNames = [
  'EOF',
  'NUMBER',
  'COMPLEX_NUMBER',
  'PLUS',
  'MINUS',
  'MUL',
  'DIV',
  'POW',
  'ASSIGN',
  'LPAREN', // (
  'LSQUARE', // [
  'RSQUARE', // ]
  'PARENR', // )
  'LBRACE', // {
  'RBRACE', // }
  'VARIABLE',
  'TEXT_BLOCK',
  'COMMENT',
  'SEMICOLON',
  'SILENT',
  'COMMA',
  'MATH_PI',
  'MATH_E',
  'MATH_PHI',
  'MATH_INF',
  'MATH_NAN',
  'RW_PRINT',
  'RW_TRUE',
  'RW_FALSE',
  'RW_PLOT_INIT',
  'RW_PLOT_CONFIG',
  'RW_PLOT_LAYER',
  'RW_PLOT_VECTOR',
  'RW_PLOT_CHORD',
  'RW_LET',
];

// Создаем пустой объект перечисления
export const TokenType = {};

// Автоматически заполняем его: { EOF: 0, NUMBER: 1, COMPLEX_NUMBER: 2, ... }
for (let i = 0; i < tokenNames.length; i++) {
  TokenType[tokenNames[i]] = i;
}

// Замораживаем для оптимизации V8
Object.freeze(TokenType);