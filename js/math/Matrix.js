import MathType from './MathType.js';

export default class Matrix extends MathType {
  static typeId = Symbol.for('Math.Matrix');
  #rows; // Приватное хранилище: двумерный массив объектов MathType

  static #localConverters = new Map([
    [Symbol.for('Math.Matrix'), (val) => val],
    // Сюда можно будет добавить приведение из одномерного JS-массива в вектор-строку
    // ['object', (val) => Array.isArray(val) ? Matrix.fromArray(val) : ... ]
  ]);

  static get converters() { return Matrix.#localConverters; }
  /**
   * @param {MathType[][]} elements - Двумерный массив объектов, унаследованных от MathType
   */
  constructor(elements) {
    super();
    
    if (!Array.isArray(elements) || elements.length === 0) {
      throw new TypeError("[Matrix]: Данные должны быть непустым двумерным массивом.");
    }

    const expectedColCount = elements[0].length; // Берем эталон по первой строке
    
    this.#rows = elements.map((row, rowIndex) => {
      if (!Array.isArray(row)) {
        throw new TypeError(`[Matrix]: Строка ${rowIndex} не является массивом.`);
      }
      if (row.length !== expectedColCount) {
        throw new RangeError(`[Matrix]: Нарушена размерность. Строка ${rowIndex} имеет длину ${row.length} вместо ${expectedColCount}.`);
      }
      
      return row.map((cell, colIndex) => {
        // Матрица принимает ТОЛЬКО готовые объекты вашей системы
        if (cell instanceof MathType) {
          return cell;
        }
        throw new TypeError(`[Matrix]: Элемент [${rowIndex}][${colIndex}] должен быть наследником MathType.`);
      });
    });
  }

  // ==========================================
  // ГЕТТЕРЫ РАЗМЕРНОСТИ
  // ==========================================

  get rowCount() {
    return this.#rows.length;
  }

  get colCount() {
    return this.#rows[0].length;
  }

  get isSquare() {
    return this.rowCount === this.colCount;
  }

  get isVector() {
    return this.rowCount === 1 || this.colCount === 1;
  }

  /**
   * Получить элемент по индексам (0-indexed)
   */
  get(row, col) {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      throw new RangeError("[Matrix]: Индексы выходят за границы матрицы.");
    }
    return this.#rows[row][col];
  }

  /**
   * Возвращает копию внутренней структуры
   */
  getRawRows() {
    return this.#rows.map(row => [...row]);
  }

   // ==========================================
  // МАТЕМАТИЧЕСКИЕ ОПЕРАЦИИ (Поэлементные)
  // ==========================================

  /**
   * Унарный минус (инвертирует знаки всех элементов матрицы)
   * @returns {Matrix} Новая матрица с противоположными знаками
   */
  negate() {
    const negatedElements = this.#rows.map(row =>
      row.map(cell => cell.negate())
    );
    return new Matrix(negatedElements);
  }

  /**
   * Сложение матриц
   * @param {Matrix} other 
   * @returns {Matrix}
   */
  add(other) {
    // Приводим тип через вашу систему конвертеров (на случай, если передали что-то приводимое)
    const o = Matrix.from(other);

    // Проверяем совместимость размерностей
    if (this.rowCount !== o.rowCount || this.colCount !== o.colCount) {
      throw new RangeError(
        `[Matrix]: Невозможно сложить матрицы разных размеров: (${this.rowCount}x${this.colCount}) и (${o.rowCount}x${o.colCount}).`
      );
    }

    // Складываем поэлементно, используя полиморфизм MathType
    const resultElements = this.#rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => cell.add(o.get(rowIndex, colIndex)))
    );

    return new Matrix(resultElements);
  }

  /**
   * Вычитание матриц
   * @param {Matrix} other 
   * @returns {Matrix}
   */
  subtract(other) {
    const o = Matrix.from(other);

    if (this.rowCount !== o.rowCount || this.colCount !== o.colCount) {
      throw new RangeError(
        `[Matrix]: Невозможно вычесть матрицы разных размеров: (${this.rowCount}x${this.colCount}) и (${o.rowCount}x${o.colCount}).`
      );
    }

    // Вычитаем поэлементно
    const resultElements = this.#rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => cell.subtract(o.get(rowIndex, colIndex)))
    );

    return new Matrix(resultElements);
  }
   
  // ==========================================
  // МЕТОДЫ ОТОБРАЖЕНИЯ
  // ==========================================

  /**
   * Текстовое представление в стиле wsMaxima: [[1, 2], [3, 4]]
   */
  toString(settings) {
    const rowsStr = this.#rows.map(row => 
      `[${row.map(cell => cell.toString(settings)).join(', ')}]`
    );
    return `[${rowsStr.join(', ')}]`;
  }

  /**
   * Генерация TeX кода с учетом динамических настроек окружения
   */
  toRawTeX(settings, locale = new Intl.NumberFormat().resolvedOptions().locale) {
    // Извлекаем формат окружения из settings (например: 'bmatrix', 'pmatrix', 'matrix')
    // Если в settings этого поля еще нет, по умолчанию берем 'bmatrix' (квадратные скобки)
    const env = (settings && settings.matrixFormat) || 'bmatrix';

    // Формируем тело матрицы: элементы строки через &, сами строки через \\
    const body = this.#rows.map(row => 
      row.map(cell => cell.toRawTeX(settings, locale)).join(' & ')
    ).join(' \\\\ \n');

    return `\\begin{${env}}\n${body}\n\\end{${env}}`;
  }
}