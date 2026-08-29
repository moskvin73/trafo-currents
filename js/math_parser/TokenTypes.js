// Просто пишем список названий по порядку
const tokenNames = [
  'EOF',

  'COMMENT',
  'SPACES',
  'ERROR',
  'ERROR_STR',
  'NUMBER',
  'COMPLEX_NUMBER',
  'VARIABLE',
  'TEXT_BLOCK',

  // Зарезервированные символы
  'PLUS',     // +
  'MINUS',    // -
  'MUL',      // *
  'DIV',      // /
  'POW',      // ** или ^
  'ASSIGN',   // ==
  'SEMICOLON',// ;
  'SILENT',   // $
  'COMMA',    // ,
  'EQU',      // ==
  'NOT_EQU',  // !=

  // Экронируемые символы
  'LT',       // <
  'GT',       // >
  'LTE',      // <=
  'GTE',      // >=

  // Cкобки
  'LPAREN',   // (
  'LSQUARE',  // [
  'RSQUARE',  // ]
  'RPAREN',   // )
  'LBRACE',   // {
  'RBRACE',   // }

  // Зарезервированные констаны начинающиеся на %
  'MATH_PI',
  'MATH_E',
  'MATH_PHI',
  'MATH_INF',
  'MATH_NAN',

  // Зарезервированные слова
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
  'RW_ERROR',
];

// Создаем пустой объект перечисления
export const TokenType = {};

// Автоматически заполняем его: { EOF: 0, NUMBER: 1, COMPLEX_NUMBER: 2, ... }
for (let i = 0; i < tokenNames.length; i++) {
  TokenType[tokenNames[i]] = i;
}

TokenType.FIRST_RESERVED_CHARACTERS = TokenType.PLUS;
TokenType.LAST_RESERVED_CHARACTERS = TokenType.NOT_EQU;

TokenType.FIRST_RESERVED_CONSTANTS = TokenType.MATH_PI;
TokenType.LAST_RESERVED_CONSTANTS = TokenType.MATH_NAN;

TokenType.FIRST_RESERVED_WORDS = TokenType.RW_PRINT;
TokenType.LAST_RESERVED_WORDS = TokenType.RW_ERROR;
// Замораживаем для оптимизации V8
Object.freeze(TokenType);