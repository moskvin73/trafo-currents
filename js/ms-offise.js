function exportTableToWordWithMathML(tableID, filename = 'table_export') {
    const originalTable = document.getElementById(tableID);
    if (!originalTable) {
        console.error(`Таблица с ID "${tableID}" не найдена!`);
        return;
    }

    // 1. Клонируем таблицу для работы с копией в памяти (не ломая оригинал)
    const clonedTable = originalTable.cloneNode(true);

    // 2. ПРОГРАММНЫЙ ФИКС ДЛЯ MATHJAX И ИНДЕКСОВ (MathML)
    // Находим все контейнеры формул на клонированной странице
    const mathJaxContainers = clonedTable.querySelectorAll('.MathJax, mjx-container, [data-mathml]');
    
    mathJaxContainers.forEach((container, index) => {
        // Ищем соответствующий живой контейнер в исходной таблице
        const originalContainers = originalTable.querySelectorAll('.MathJax, mjx-container, [data-mathml]');
        const origContainer = originalContainers[index];
        if (!origContainer) return;
        
        let mathMLString = '';

        // Проверяем наличие MathJax в глобальной области видимости
        if (window.MathJax) {
            if (window.MathJax.version && window.MathJax.version.startsWith('3')) {
                // ДЛЯ MATHJAX v3+
                try {
                    const mathItem = window.MathJax.startup.document.getMathId(origContainer.id || origContainer.querySelector('[id]')?.id);
                    if (mathItem) {
                        mathMLString = window.MathJax.startup.document.outputJax.mathml.toString(mathItem);
                    }
                } catch(e) {}
                
                if (!mathMLString) {
                    const mathNode = origContainer.querySelector('math');
                    if (mathNode) mathMLString = mathNode.outerHTML;
                }
            } else {
                // ДЛЯ MATHJAX v2+
                try {
                    const elementJax = window.MathJax.Hub.getJaxFor(origContainer);
                    if (elementJax && elementJax.root) {
                        mathMLString = elementJax.root.toMathML("");
                    }
                } catch(e) {}
            }
        }

        // Резервный поиск, если API MathJax не вернул строку
        if (!mathMLString) {
            const hiddenMath = origContainer.querySelector('.mathml, annotation-xml, math');
            if (hiddenMath) {
                mathMLString = hiddenMath.tagName.toLowerCase() === 'math' ? hiddenMath.outerHTML : hiddenMath.innerHTML;
            } else if (origContainer.getAttribute('data-mathml')) {
                mathMLString = origContainer.getAttribute('data-mathml');
            }
        }

        if (mathMLString) {
            // КРИТИЧЕСКИ ВАЖНО: убираем пробелы между тегами MathML, чтобы Word не читал их как обычный текст
            mathMLString = mathMLString.replace(/>\s+</g, '><').trim();

            const wrapper = document.createElement('div');
            wrapper.innerHTML = mathMLString;
            const mathElement = wrapper.querySelector('math');

            if (mathElement) {
                // Указываем обязательные для Word стандарты разметки
                mathElement.setAttribute('xmlns', 'http://w3.org');
                mathElement.setAttribute('display', 'inline');
                mathElement.style.fontFamily = '"Cambria Math", "MS Symbol", serif';
                
                // Обертка со специальным mso-классом, переводящим Word в режим математических полей
                const officeMathWrapper = document.createElement('span');
                officeMathWrapper.className = 'word-math-container';
                officeMathWrapper.appendChild(mathElement);

                container.parentNode.replaceChild(officeMathWrapper, container);
            }
        }
    });

    // 3. ПРОГРАММНОЕ КОПИРОВАНИЕ СТИЛЕЙ ЯЧЕЕК ИЗ БРАУЗЕРА
    const originalCells = originalTable.querySelectorAll('th, td');
    const clonedCells = clonedTable.querySelectorAll('th, td');

    originalCells.forEach((origCell, index) => {
        const clonedCell = clonedCells[index];
        if (!clonedCell) return;

        // Считываем финальный скомпилированный CSS из браузера
        const computedStyle = window.getComputedStyle(origCell);

        // Инлайним свойства, которые понимает Word
        clonedCell.style.backgroundColor = computedStyle.backgroundColor;
        clonedCell.style.color = computedStyle.color;
        clonedCell.style.fontWeight = computedStyle.fontWeight;
        clonedCell.style.fontSize = computedStyle.fontSize;
        clonedCell.style.textAlign = computedStyle.textAlign;
        clonedCell.style.padding = computedStyle.padding;
        
        // Рисуем явные границы, иначе Word скроет сетку таблицы
        clonedCell.style.border = "1px solid #cbd5e1"; 
    });

    // 4. ОЧИСТКА ФОРМ: заменяем элементы управления (input, select) на их чистый текст
    clonedTable.querySelectorAll('input, select').forEach(element => {
        let textValue = '';
        
        if (element.tagName.toLowerCase() === 'select') {
            // Берем текст активного пункта списка
            const selectedOption = element.options[element.selectedIndex];
            textValue = selectedOption ? selectedOption.textContent : '';
        } else {
            // Берем текущее введенное значение инпута
            textValue = element.value;
        }

        // Сохраняем выравнивание текста инпута (например, если был класс .align-left)
        const elementStyle = window.getComputedStyle(element);
        const textNode = document.createElement('span');
        textNode.textContent = textValue;
        textNode.style.textAlign = elementStyle.textAlign;
        
        if (elementStyle.textAlign === 'left') {
            textNode.style.display = 'block';
            textNode.style.width = '100%';
        }

        element.parentNode.replaceChild(textNode, element);
    });

    // Дополнительный перенос стилей для ваших мелких подписей ID (.sub-text)
    const originalSubTexts = originalTable.querySelectorAll('.sub-text');
    const clonedSubTexts = clonedTable.querySelectorAll('.sub-text');
    originalSubTexts.forEach((origSub, index) => {
        if (clonedSubTexts[index]) {
            const style = window.getComputedStyle(origSub);
            clonedSubTexts[index].style.fontSize = style.fontSize;
            clonedSubTexts[index].style.color = style.color;
            clonedSubTexts[index].style.marginLeft = style.marginLeft;
        }
    });

    // 5. ФОРМИРОВАНИЕ ФАЙЛА И СКАЧИВАНИЕ
    // Заголовок с объявлением Microsoft Office XML пространств имен для формул
    const htmlHeader = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns:m='http://microsoft.com' 
      xmlns='http://w3.org'>
<head>
<meta charset='utf-8'>
<!--[if gte mso 9]>
<xml>
 <o:DocumentProperties>
  <o:RelyOnVML/>
  <o:AllowPNG/>
 </o:DocumentProperties>
 <w:WordDocument>
  <w:View>Normal</w:View>
  <w:Zoom>100</w:Zoom>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
    /* Инструкции Word для обработки математического синтаксиса */
    math { display: inline-block; font-family: "Cambria Math"; }
    .word-math-container { mso-element: field-begin; }
</style>
</head>
<body>`;

    const htmlFooter = "</body></html>";
    
    // Базовая геометрия таблицы для Word
    clonedTable.style.borderCollapse = 'collapse';
    clonedTable.style.width = '100%';

    // Собираем документ воедино
    const totalHTML = htmlHeader + clonedTable.outerHTML + htmlFooter;

    // Создаем виртуальный файл в кодировке UTF-8 с BOM-маркером (\ufeff)
    const blob = new Blob(['\ufeff' + totalHTML], { type: 'application/msword' });
    
    // Скачиваем файл через искусственный клик по ссылке
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename + '.doc';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}