function exportTableToWordWithMathML(tableID, filename = 'table_export') {
    const originalTable = document.getElementById(tableID);
    if (!originalTable) return;

    // 1. Клонируем таблицу для работы в фоне
    const clonedTable = originalTable.cloneNode(true);

    // 2. ПРОГРАММНЫЙ ФИКС: Вытаскиваем MathML из MathJax и конвертируем в OMML для Word
    const mathJaxContainers = clonedTable.querySelectorAll('.MathJax, mjx-container, [data-mathml]');
    
    mathJaxContainers.forEach((container, index) => {
        const originalContainers = originalTable.querySelectorAll('.MathJax, mjx-container, [data-mathml]');
        const origContainer = originalContainers[index];
        
        let mathMLString = '';

        if (window.MathJax) {
            if (window.MathJax.version && window.MathJax.version.startsWith('3')) {
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
                try {
                    const elementJax = window.MathJax.Hub.getJaxFor(origContainer);
                    if (elementJax && elementJax.root) {
                        mathMLString = elementJax.root.toMathML("");
                    }
                } catch(e) {}
            }
        }

        if (!mathMLString) {
            const hiddenMath = origContainer.querySelector('.mathml, annotation-xml, math');
            if (hiddenMath) {
                mathMLString = hiddenMath.tagName.toLowerCase() === 'math' ? hiddenMath.outerHTML : hiddenMath.innerHTML;
            } else if (origContainer.getAttribute('data-mathml')) {
                mathMLString = origContainer.getAttribute('data-mathml');
            }
        }

        // --- ОБНОВЛЕННЫЙ БЛОК КОНВЕРТАЦИИ ФОРМУЛ (БЕЗ СDN И ВНЕШНИХ БИБЛИОТЕК) ---
        if (mathMLString) {
            mathMLString = mathMLString.trim();
            
            // Гарантируем наличие правильного неймспейса MathML перед обработкой
            if (!mathMLString.includes('xmlns=')) {
                mathMLString = mathMLString.replace('<math', '<math xmlns="http://www.w3.org/1998/Math/MathML"');
            } else {
                // Если неймспейс был битым/обрезанным, исправляем его на валидный
                mathMLString = mathMLString.replace(/xmlns=['"][^'"]+['"]/, 'xmlns="http://www.w3.org/1998/Math/MathML"');
            }

            // Вызываем нативную встроенную функцию конвертации
            const ommlString = convertMathMLToOMML(mathMLString);

            if (ommlString) {
                try {
                    // Создаем контейнер-обертку, явно указывая XML-пространства имен для Microsoft Word
                    const ommlWrapper = document.createElement('span');
                    ommlWrapper.setAttribute('xmlns:o', 'urn:schemas-microsoft-com:office:office');
                    ommlWrapper.setAttribute('xmlns:w', 'urn:schemas-microsoft-com:office:word');
                    ommlWrapper.setAttribute('xmlns:m', 'http://schemas.microsoft.com/office/2004/12/omml');
                    ommlWrapper.innerHTML = ommlString;
                    
                    // Заменяем MathJax-контейнер на готовый OMML код
                    container.parentNode.replaceChild(ommlWrapper, container);
                } catch(err) {
                    console.error("Ошибка вставки OMML в DOM: ", err);
                    useMathMLFallback(mathMLString, container);
                }
            } else {
                // Если встроенная конвертация не сработала, используем исправленный MathML как резервный вариант
                useMathMLFallback(mathMLString, container);
            }
        }
    });

    /**
     * Внутренняя функция: нативная XSLT-трансформация MathML в OMML прямо в браузере
     */
    function convertMathMLToOMML(mathMLStr) {
        try {
            const xslString = `<?xml version="1.0" encoding="utf-8"?>
            <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns:mml="http://www.w3.org/1998/Math/MathML">
                <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>
                <xsl:template match="@*|node()"><xsl:copy><xsl:apply-templates select="@*|node()"/></xsl:copy></xsl:template>
                <xsl:template match="mml:math"><m:oMathPara><m:oMath><xsl:apply-templates select="node()"/></m:oMath></m:oMathPara></xsl:template>
            </xsl:stylesheet>`;

            const parser = new DOMParser();
            const xslDoc = parser.parseFromString(xslString, "text/xml");
            const xmlDoc = parser.parseFromString(mathMLStr, "text/xml");

            const xsltProcessor = new XSLTProcessor();
            xsltProcessor.importStylesheet(xslDoc);
            
            const resultDocument = xsltProcessor.transformToFragment(xmlDoc, document);

            if (resultDocument && resultDocument.childNodes.length > 0) {
                const serializer = new XMLSerializer();
                return serializer.serializeToString(resultDocument);
            }
            return null;
        } catch (err) {
            console.error("Внутренняя ошибка XSLT-конвертации: ", err);
            return null;
        }
    }

    // Вспомогательная функция на случай отсутствия библиотеки / сбоя
    function useMathMLFallback(mmlStr, containerNode) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = mmlStr;
        const mathElement = wrapper.querySelector('math');
        if (mathElement) {
            containerNode.parentNode.replaceChild(mathElement, containerNode);
        }
    }
    // --- КОНЕЦ МОДИФИЦИРОВАННОГО БЛОКА ---

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
    const htmlHeader = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns:m='http://schemas.microsoft.com/office/2004/12/omml' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>`;
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