import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';

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
        case 'sin':  return arg.sin();
        case 'cos':  return arg.cos();
        case 'tan':  return arg.tan();
        case 'exp':  return arg.exp();
        
        case 'sqrt':
          // Если на вход пришло отрицательное вещественное число — 
          // переводим расчет в комплексное поле, используя стандартный конструктор
          if (arg instanceof RealNumber && arg.value < 0) {
            return new ComplexNumber(arg.value, 0).sqrt();
          }
          return arg.sqrt();

        case 'log':
          if (arg instanceof RealNumber && arg.value <= 0) {
            return new ComplexNumber(arg.value, 0).log();
          }
          return arg.log();

        default:
          throw new Error(`[Semantic Error]: Функция "${name}" с одним аргументом не поддерживается на ${loc}`);
      }
    }

    // --- Двухаргументные функции (pow, solve...) ---
    if (args.length === 2) {
      const [arg1, arg2] = args;

      switch (name) {
        case 'pow':
          // Логика функции pow(base, power)
          // Если base отрицательный, а power дробный — продвигаем base до комплексного
          if (arg1 instanceof RealNumber && arg1.value < 0 && (arg2 instanceof RealNumber && !Number.isInteger(arg2.value))) {
            return new ComplexNumber(arg1.value, 0).pow(arg2);
          }
          return arg1.pow(arg2);

        default:
          throw new Error(`[Semantic Error]: Функция "${name}" с двумя аргументами не поддерживается на ${loc}`);
      }
    }

    // --- Задел на будущее для Линейной Алгебры (СЛАУ / Функции с переменным числом аргументов) ---
    // if (name === 'solve') { return LinearAlgebra.solve(args); }

    throw new Error(`[Semantic Error]: Неверное количество аргументов (${args.length}) для функции "${name}" на ${loc}`);
  }
};