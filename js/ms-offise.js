function exportTableToWordWithMathML(tableID, filename = 'table_export') {
    const originalTable = document.getElementById(tableID);
    if (!originalTable) return;

    // 1. Клонируем таблицу для работы в фоне
    const clonedTable = originalTable.cloneNode(true);

    // 2. ПРОГРАММНЫЙ ФИКС: Вытаскиваем MathML из MathJax
    // Находим все контейнеры формул на клонированной странице
    const mathJaxContainers = clonedTable.querySelectorAll('.MathJax, mjx-container, [data-mathml]');
    
    mathJaxContainers.forEach((container, index) => {
        // Нам нужно найти реальный элемент в оригинальной таблице, 
        // так как у MathJax v3+ методы генерации привязаны к живым объектам в DOM
        const originalContainers = originalTable.querySelectorAll('.MathJax, mjx-container, [data-mathml]');
        const origContainer = originalContainers[index];
        
        let mathMLString = '';

        if (window.MathJax) {
            if (window.MathJax.version && window.MathJax.version.startsWith('3')) {
                // ДЛЯ MATHJAX v3+: получаем MathML через встроенный экспортер
                try {
                    const mathItem = window.MathJax.startup.document.getMathId(origContainer.id || origContainer.querySelector('[id]')?.id);
                    if (mathItem) {
                        mathMLString = window.MathJax.startup.document.outputJax.mathml.toString(mathItem);
                    }
                } catch(e) {}
                
                // Если через API не вышло, ищем скрытую разметку внутри MathML вывода
                if (!mathMLString) {
                    const mathNode = origContainer.querySelector('math');
                    if (mathNode) mathMLString = mathNode.outerHTML;
                }
            } else {
                // ДЛЯ MATHJAX v2+: получаем MathML через элемент Jax
                try {
                    const elementJax = window.MathJax.Hub.getJaxFor(origContainer);
                    if (elementJax && elementJax.root) {
                        mathMLString = elementJax.root.toMathML("");
                    }
                } catch(e) {}
            }
        }

        // Если MathJax API не ответил, пробуем достать строку MathML из скрытых атрибутов
        if (!mathMLString) {
            const hiddenMath = origContainer.querySelector('.mathml, annotation-xml, math');
            if (hiddenMath) {
                mathMLString = hiddenMath.tagName.toLowerCase() === 'math' ? hiddenMath.outerHTML : hiddenMath.innerHTML;
            } else if (origContainer.getAttribute('data-mathml')) {
                mathMLString = origContainer.getAttribute('data-mathml');
            }
        }

        // Если мы успешно добыли MathML код формулы
        if (mathMLString) {
            // Создаем временный элемент-контейнер и помещаем туда строку
            const wrapper = document.createElement('div');
            wrapper.innerHTML = mathMLString.trim();
            const mathElement = wrapper.querySelector('math');

            if (mathElement) {
                // ВАЖНО ДЛЯ WORD: Добавляем стандартный неймспейс MathML, чтобы Ворд его точно узнал
                if (!mathElement.getAttribute('xmlns')) {
                    mathElement.setAttribute('xmlns', 'http://w3.org');
                }
                
                // Заменяем сложный SVG-контейнер MathJax на чистый тег <math>
                container.parentNode.replaceChild(mathElement, container);
            }
        }
    });

    // 3. Копируем стили (как и раньше)
    const originalCells = originalTable.querySelectorAll('th, td');
    const clonedCells = clonedTable.querySelectorAll('th, td');
    originalCells.forEach((origCell, index) => {
        const clonedCell = clonedCells[index];
        const computedStyle = window.getComputedStyle(origCell);
        clonedCell.style.backgroundColor = computedStyle.backgroundColor;
        clonedCell.style.color = computedStyle.color;
        clonedCell.style.fontWeight = computedStyle.fontWeight;
        clonedCell.style.fontSize = computedStyle.fontSize;
        clonedCell.style.textAlign = computedStyle.textAlign;
        clonedCell.style.padding = computedStyle.padding;
        clonedCell.style.border = "1px solid #cbd5e1"; 
    });

    // 4. Заменяем инпуты и селекты на их текстовые значения
    clonedTable.querySelectorAll('input, select').forEach(element => {
        let textValue = '';
        if (element.tagName.toLowerCase() === 'select') {
            const selectedOption = element.options[element.selectedIndex];
            textValue = selectedOption ? selectedOption.textContent : '';
        } else {
            textValue = element.value;
        }
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

    // Обертка подписей ID (.sub-text)
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

    // 5. Генерируем финальный файл для скачивания
    const htmlHeader = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://microsoft.com' xmlns='http://w3.org'><head><meta charset='utf-8'></head><body>`;
    const htmlFooter = "</body></html>";
    
    clonedTable.style.borderCollapse = 'collapse';
    clonedTable.style.width = '100%';

    const totalHTML = htmlHeader + clonedTable.outerHTML + htmlFooter;

    const blob = new Blob(['\ufeff' + totalHTML], { type: 'application/msword' });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename + '.doc';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}