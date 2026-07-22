import MathType from './MathType.js';
import RealNumber from './RealNumber.js';

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

	  const expectedColCount = elements[0].length;
	  
	  this.#rows = elements.map((row, rowIndex) => {
		if (!Array.isArray(row)) {
		  throw new TypeError(`[Matrix]: Строка ${rowIndex} не является массивом.`);
		}
		if (row.length !== expectedColCount) {
		  throw new RangeError(`[Matrix]: Нарушена размерность. Строка ${rowIndex} имеет длину ${row.length} вместо ${expectedColCount}.`);
		}
		
		return row.map((cell, colIndex) => {
		  // Если это чистый примитив-число, упаковываем в RealNumber через его же фабрику
		  if (typeof cell === 'number') {
			return RealNumber.from(cell);
		  }
		  
		  // Если это уже объект MathType (RealNumber, ComplexNumber, Matrix) — оставляем как есть
		  if (cell instanceof MathType) {
			return cell;
		  }
		  
		  throw new TypeError(`[Matrix]: Элемент [${rowIndex}][${colIndex}] не поддерживается.`);
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