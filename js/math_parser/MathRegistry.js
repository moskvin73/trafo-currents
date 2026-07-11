import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import SemanticDispatcher from './SemanticDispatcher.js';

const dispatcher = new SemanticDispatcher();

export const MathRegistry = {
  /**
   * Главный диспетчер вызова аналитических функций
   * @param {string} name - Имя функции
   * @param {MathType[]} args - Массив уже ВЫЧИСЛЕННЫХ объектов MathType
   * @param {SourceLocation} loc - Координаты для вывода ошибок
   */
  execute(name, args, loc) {
    
    // ==========================================
    // 1. ОПРЕДЕЛЕНИЕ СИГНАТУРЫ ПО КОЛИЧЕСТВУ АРГУМЕНТОВ
    // ==========================================

    // --- Одноаргументные функции (sin, cos, sqrt, log...) ---
    if (args.length === 1) {
      const arg = args[0];

      switch (name) {
        case 'sqrt': return arg.sqrt();
        case 'lg': return arg.log10();
        case 'ln': return arg.log();
        case 'exp':  return arg.exp();

        case 'sin':  return arg.sin();
        case 'cos':  return arg.cos();
        case 'tan':  return arg.tan();
        case 'sinh':  return arg.sin();
        case 'cosh':  return arg.cos();
        case 'tanh':  return arg.tan();

        case 'arcsin':  return arg.arcsin();
        case 'arccos':  return arg.arccos();
        
        case 'arcsinh':  return arg.arcsinh();
        case 'arccosh':  return arg.arccosh();        
        default:
          throw new Error(`[Semantic Error]: Функция "${name}" с одним аргументом не поддерживается на ${loc}`);
      }
    }

    // --- Двухаргументные функции (pow, solve...) ---
    if (args.length === 2) {
      const [arg1, arg2] = args;

      const { l, r } = dispatcher.promoteTypes(arg1, arg2);
      switch (name) {
        case 'pow': return l.accuratePow(r);
        case 'log': return l.logBase(r);
        case 'sqrt': return l.sqrt(r);
        default:
          throw new Error(`[Semantic Error]: Функция "${name}" с двумя аргументами не поддерживается на ${loc}`);
      }
    }

    // --- Задел на будущее для Линейной Алгебры (СЛАУ / Функции с переменным числом аргументов) ---
    // if (name === 'solve') { return LinearAlgebra.solve(args); }

    throw new Error(`[Semantic Error]: Неверное количество аргументов (${args.length}) для функции "${name}" на ${loc}`);
  }
};