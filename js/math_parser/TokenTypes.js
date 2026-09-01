// Просто пишем список названий по порядку
const tokensConfig = [
  { name: 'EOF', hint: null },

  { name: 'NL', hint: null },
  { name: 'SPACES', hint: null },
  { name: 'COMMENT', hint: 'Комментарий' },
  { name: 'ERROR', hint: 'Лексическая ошибка' },
  { name: 'ERROR_STR', hint: 'Незакрытая строка' },
  { name: 'NUMBER', hint: 'Число' },
  { name: 'COMPLEX_NUMBER', hint: 'Комплексное число' },
  { name: 'VARIABLE', hint: 'Идентификатор / Переменная' },
  { name: 'TEXT_BLOCK', hint: 'Текстовый блок' },

  // Зарезервированные символы
  { name: 'PLUS', hint: 'Оператор сложения' },    // +
  { name: 'MINUS', hint: 'Оператор вычитания' },   // -
  { name: 'MUL', hint: 'Оператор умножения' },     // *
  { name: 'DIV', hint: 'Оператор деления' },     // /
  { name: 'POW', hint: 'Оператор возвидения в стпень' },     // ** или ^
  { name: 'ASSIGN', hint: 'Оператор присвоения' },  // =
  { name: 'SEMICOLON', hint: 'Оператор разделителя инструкций с отображением результата' }, // ;
  { name: 'SILENT', hint: 'Оператор разделителя инструкций без отображением результата' },   // $
  { name: 'COMMA', hint: 'Оператор последовательного вычисление выражений' },   // ,
  { name: 'EQU', hint: 'Оператор равенства' },     // ==
  { name: 'NOT_EQU', hint: 'Оператор не равенства' }, // !=

  // Экронируемые символы
  { name: 'LT', hint: 'Оператор меньше' },      // <
  { name: 'GT', hint: 'Оператор больше' },      // >
  { name: 'LTE', hint: 'Оператор меньше или равно' },     // <=
  { name: 'GTE', hint: 'Оператор больше или равно' },     // >=

  // Cкобки
  { name: 'LPAREN', hint: 'Открывающаяся скобка группировки выражений' },  // (
  { name: 'RPAREN', hint: 'Зарывающаяся скобка группировки выражений' },  // )
  { name: 'LSQUARE', hint: 'Начало составного оператора' }, // [
  { name: 'LBRACE', hint: 'Окончание составного оператора' },  // {
  { name: 'RSQUARE', hint: 'Начало оператора индексации' }, // ]
  { name: 'RBRACE', hint: 'Окончание  оператора индексации' },  // }

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

// Экспортируем подсказки и код для доступа по индексу токена: TokenDetails[6]
export const TokenDetails = new Array(tokensConfig.length);

// Автоматически заполняем его: { EOF: 0, NUMBER: 1, COMPLEX_NUMBER: 2, ... }
for (let i = 0; i < tokenNames.length; i++) {
  const item = tokensConfig[i];
  TokenType[item.name] = i;
  TokenDetails[i] = {
    name: item.name,
    hint: item.hint,
    action: item.action || null // Если кода нет, пишем null
  };
}

TokenType.FIRST_RESERVED_CHARACTERS = TokenType.PLUS;
TokenType.LAST_RESERVED_CHARACTERS = TokenType.NOT_EQU;

TokenType.FIRST_RESERVED_CONSTANTS = TokenType.MATH_PI;
TokenType.LAST_RESERVED_CONSTANTS = TokenType.MATH_NAN;

TokenType.FIRST_RESERVED_WORDS = TokenType.RW_PRINT;
TokenType.LAST_RESERVED_WORDS = TokenType.RW_ERROR;
// Замораживаем для оптимизации V8
Object.freeze(TokenType);
Object.freeze(TokenDetails);