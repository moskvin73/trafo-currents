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

  /**
   * Универсальное повышение типа всех элементов матрицы до целевого числового класса.
   * @param {Function} TargetNumberClass - Класс, к которому нужно привести элементы (например, ComplexNumber)
   * @returns {Matrix} Новая матрица с элементами повышенного типа
   */
  castElementsTo(TargetNumberClass) {
    if (!TargetNumberClass || typeof TargetNumberClass.from !== 'function') {
      return this; // Если класс не имеет фабрики приведения, возвращаем как есть
    }

    const castedRows = this.getRawRows().map(row =>
      row.map(cell => {
        // Если элемент уже принадлежит целевому классу — оставляем, иначе повышаем
        return cell.constructor === TargetNumberClass ? cell : TargetNumberClass.from(cell);
      })
    );

    return new Matrix(castedRows);
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

  /**
   * Универсальное умножение матрицы (на скаляр или на другую матрицу)
   * @param {MathType|number} other 
   * @returns {Matrix}
   */
  multiply(other) {
    // 1. Проверяем, является ли "other" матрицей/вектором
    // Используем Symbol.for, чтобы избежать циклических импортов
    const isMatrix = typeof other === 'object' && other !== null && 
                     (other.constructor.typeId === Symbol.for('Math.Matrix') || other instanceof Matrix);

    if (!isMatrix) {
      // --- ВАРИАНТ А: Умножение матрицы на скаляр (RealNumber/ComplexNumber) ---
      // Мы не знаем, какой именно тип у other, но мы знаем, что у него есть метод multiply!
      // Поэтому мы просто берем каждый наш элемент и умножаем его на этот скаляр.
      const resultElements = this.getRawRows().map(row =>
        row.map(cell => cell.multiply(other))
      );
      return new Matrix(resultElements);
    }

    // --- ВАРИАНТ Б: Матричное умножение (Строка на Столбец) ---
    const o = Matrix.from(other);

    // Проверяем главное правило линейной алгебры: кол-во столбцов А должно быть равно кол-во строк В
    if (this.colCount !== o.rowCount) {
      throw new RangeError(
        `[Matrix]: Несовместимые размеры для матричного умножения: (${this.rowCount}x${this.colCount}) и (${o.rowCount}x${o.colCount}).`
      );
    }

    const A = this.getRawRows();
    const B = o.getRawRows();
    const resultElements = [];

    // Алгоритм умножения матриц
    for (let i = 0; i < this.rowCount; i++) {
      const resultRow = [];
      for (let j = 0; j < o.colCount; j++) {
        
        // Считаем скалярное произведение i-й строки матрицы А и j-го столбца матрицы В
        // Начинаем с произведения первых элементов
        let sum = A[i][0].multiply(B[0][j]);
        
        for (let k = 1; k < this.colCount; k++) {
          const product = A[i][k].multiply(B[k][j]);
          sum = sum.add(product); // Складываем через полиморфный метод .add()
        }
        
        resultRow.push(sum);
      }
      resultElements.push(resultRow);
    }

    return new Matrix(resultElements);
  }

  /**
   * Транспонирование матрицы (поворот: строки становятся столбцами)
   * @returns {Matrix} Новая прямоугольная транспонированная матрица
   */
  transpose() {
    const A = this.getRawRows();
    const resultElements = [];

    // Идём по СТОЛБЦАМ исходной матрицы (их количество станет количеством новых строк)
    for (let j = 0; j < this.colCount; j++) {
      const newRow = [];
      // Идём по СТРОКАМ исходной матрицы
      for (let i = 0; i < this.rowCount; i++) {
        newRow.push(A[i][j]);
      }
      resultElements.push(newRow);
    }

    return new Matrix(resultElements);
  }  
   
  /**
   * Вычисление определителя (детерминанта) квадратной матрицы
   */
  det() {
    if (!this.isSquare) {
      throw new RangeError("[Matrix]: Определитель можно вычислить только для квадратной матрицы.");
    }
    const n = this.rowCount;
    if (n === 1) return this.get(0, 0);
    if (n === 2) {
      return this.get(0, 0).multiply(this.get(1, 1)).subtract(this.get(0, 1).multiply(this.get(1, 0)));
    }

    // Делаем глубокую копию строк
    const M = this.getRawRows();
    const STABILITY_THRESHOLD = 1e-14;
    
    // Инициализируем определитель единицей того же типа, что и элементы
    let detValue = this.get(0, 0).constructor.from ? this.get(0, 0).constructor.from(1) : this.get(0,0).divide(this.get(0,0));
    let sign = 1;

    for (let i = 0; i < n; i++) {
      // Выбор главного элемента по столбцу для стабильности double precision
      let sel = i;
      for (let k = i + 1; k < n; k++) {
        if (M[k][i].abs() > M[sel][i].abs()) sel = k;
      }
      
      if (M[sel][i].abs() < STABILITY_THRESHOLD) {
        return this.get(0, 0).subtract(this.get(0, 0)); // Матрица вырождена, определитель = 0
      }

      // Физически меняем строки местами в копии матрицы
      if (sel !== i) {
        sign = -sign;
        const temp = M[i];
        M[i] = M[sel];
        M[sel] = temp;
      }

      const pivot = M[i][i];
      detValue = detValue.multiply(pivot); // Накапливаем определитель

      // Исключение элементов под диагональю
      for (let k = i + 1; k < n; k++) {
        const factor = M[k][i].divide(pivot);
        for (let j = i; j < n; j++) {
          M[k][j] = M[k][j].subtract(factor.multiply(M[i][j]));
        }
      }
    }

    if (sign < 0) detValue = detValue.negate();
    return detValue;
  }

  /**
   * Полное решение СЛАУ на основе вашего C++ алгоритма
   */
  static solveSystem(matrixM, vectorB) {
     if (!matrixM.isSquare) {
      throw new RangeError("[LinearAlgebra]: Матрица системы должна быть квадратной.");
    }
    if (matrixM.rowCount !== vectorB.rowCount || vectorB.colCount !== 1) {
      throw new RangeError("[LinearAlgebra]: Размерность вектора B должна совпадать с количеством строк матрицы M (N x 1).");
    }

    const n = matrixM.rowCount;
    const STABILITY_THRESHOLD = 1e-14;

    const M = matrixM.getRawRows();
    // ЖЕСТКАЯ РАСПАКОВКА: Гарантированно извлекаем объекты MathType из вектора-столбца в 1D массив
    const B = vectorB.getRawRows().map(row => row[0]); 

    for (let i = 0; i < n; i++) {
      let sel = i;
      for (let k = i + 1; k < n; k++) {
        if (M[k][i].abs() > M[sel][i].abs()) sel = k;
      }
      
      if (M[sel][i].abs() < STABILITY_THRESHOLD) {
        throw new Error("[LinearAlgebra]: Система вырождена или имеет бесконечно много решений.");
      }

      // Физически переставляем строки и элементы вектора B
      if (sel !== i) {
        const tempM = M[i]; M[i] = M[sel]; M[sel] = tempM;
        const tempB = B[i]; B[i] = B[sel]; B[sel] = tempB;
      }

      const pivot = M[i][i];

      for (let k = i + 1; k < n; k++) {
        const factor = M[k][i].divide(pivot);
        B[k] = B[k].subtract(factor.multiply(B[i]));
        for (let j = i; j < n; j++) {
          M[k][j] = M[k][j].subtract(factor.multiply(M[i][j]));
        }
      }
    }

    const resultElements = new Array(n);
    
    // Обратный ход СЛАУ
    for (let i = n - 1; i >= 0; i--) {
      let sum = B[i];
      for (let j = i + 1; j < n; j++) {
        sum = sum.subtract(M[i][j].multiply(resultElements[j]));
      }
      resultElements[i] = sum.divide(M[i][i]);
    }

    return Matrix.columnVector(resultElements);
  }
  
  // ==========================================
  // СТАТИЧЕСКИЕ МЕТОДЫ-ФАБРИКИ
  // ==========================================

  // Переменная для ленивой регистрации класса вещественных чисел
  static RealNumberRef = null;
  static registerRealNumberClass(cls) {
    this.RealNumberRef = cls;
  }

  /**
   * Создает единичную матрицу размера n x n
   * @param {number} n - Размерность матрицы
   * @returns {Matrix}
   */
  static identity(n) {
   // Принудительно округляем вниз до целого числа, отсекая дробную часть
    const size = Math.floor(n);

    if (size <= 0) {
      throw new RangeError("[Matrix]: Размерность единичной матрицы должна быть целым числом больше 0.");
    }
    
    const elements = [];
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const rawValue = (i === j ? 1 : 0);
        
        if (Matrix.RealNumberRef) {
          row.push(Matrix.RealNumberRef.from(rawValue));
        } else {
          row.push(this.converters.get(Symbol.for('Math.RealNumber'))?.(rawValue) || rawValue);
        }
      }
      elements.push(row);
    }
    return new Matrix(elements);
  }

  /**
   * Создает диагональную матрицу на основе массива готовых MathType объектов
   * @param {MathType[]} diagonalElements - Массив элементов главной диагонали
   * @returns {Matrix}
   */
  static diagonal(diagonalElements) {
    if (!Array.isArray(diagonalElements) || diagonalElements.length === 0) {
      throw new TypeError("[Matrix]: Для диагональной матрицы нужен непустой массив элементов.");
    }

    const n = diagonalElements.length;
    const elements = [];
    
    // БЕРЕМ КОНСТРУКТОР ПЕРВОГО ЭЛЕМЕНТА МАССИВА (например, RealNumber)
    const ElementClass = diagonalElements[0].constructor;
    
    // Создаем полиморфный ноль того же типа
    const zeroObject = ElementClass.from ? ElementClass.from(0) : diagonalElements[0].subtract(diagonalElements[0]);

    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        row.push(i === j ? diagonalElements[i] : zeroObject);
      }
      elements.push(row);
    }
    return new Matrix(elements);
  }

  /**
   * Создает вектор-столбец (матрицу размером N x 1) из одномерного массива
   * @param {MathType[]} vectorElements - Массив элементов столбца
   * @returns {Matrix}
   */
  static columnVector(vectorElements) {
     if (!Array.isArray(vectorElements) || vectorElements.length === 0) {
      throw new TypeError("[Matrix]: Для вектора-столбца нужен непустой массив элементов.");
    }
    
    // Элементы уже являются объектами MathType, просто оборачиваем их в строки
    const elements = vectorElements.map(cell => [cell]);
    return new Matrix(elements);
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