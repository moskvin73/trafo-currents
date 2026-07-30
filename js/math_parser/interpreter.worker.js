import Parser from './MathParser.js.js'; // Подставьте ваши пути к файлам

self.onmessage = function (e) {
  const { type, codeText } = e.data;

  if (type === 'START') {
    try {
      // Инициализируем ваш парсер (внутри него создается context)
      const parser = new Parser(codeText); 
      
      // 1. Компиляция и Выполнение (запускает parse(), который выполняет run())
      parser.parse(); 

      // Проверяем ошибки компиляции или рантайма
      if (parser.errors.length > 0) {
        // Передаем ошибки в UI (ошибки обычно простые объекты, их передать легко)
        self.postMessage({ 
          type: 'ERROR', 
          errors: parser.errors.map(err => ({ message: err.message, loc: err.loc })) 
        });
        return;
      }

      // 2. Генерация LaTeX внутри воркера!
      // toTex() вернет массив простых объектов: [{type: 'expr', value: '$$...$$'}, ...]
      const texRenderData = parser.toTex();

      // 3. Отправляем в UI готовые для рендеринга данные
      self.postMessage({ 
        type: 'SUCCESS', 
        renderData: texRenderData 
      });

    } catch (err) {
      self.postMessage({ 
        type: 'CRASH', 
        message: `[КРИТИЧЕСКИЙ СБОЙ] ${err.message}` 
      });
    }
  }
};