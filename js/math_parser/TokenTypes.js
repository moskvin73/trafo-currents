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
  'RPAREN', // )
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
  'RW_BOOL',
  'RW_REAL',
  'RW_COMPLEX',
  'RW_MATRIX',
  'RW_PLOT_INIT',
  'RW_PLOT_CONFIG',
  'RW_PLOT_LAYER',
  'RW_PLOT_VECTOR',
  'RW_PLOT_CHORD',
  'RW_LET',
  'RW_NOT',
  'RW_AND',
  'RW_OR',
  'RW_XOR',
  'RW_IF',
  'RW_IS',
  'RW_MOD',
  'RW_ELSE',
  'RW_WHILE',
  'RW_DO',
  'RW_FOR',
  'RW_RETUTN',
  'RW_BREAK',
  'RW_CONTINUE',
  'EQU', // ==
  'NOT_EQU', // !=
  'LT', // <
  'GT',  // >
  'LTE', // <=
  'GTE', // >=
  'RW_ERROR',
];

// Создаем пустой объект перечисления
export const TokenType = {};

// Автоматически заполняем его: { EOF: 0, NUMBER: 1, COMPLEX_NUMBER: 2, ... }
for (let i = 0; i < tokenNames.length; i++) {
  TokenType[tokenNames[i]] = i;
}

// Замораживаем для оптимизации V8
Object.freeze(TokenType);