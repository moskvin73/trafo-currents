// 1. Настройка MathJax (остается прежней)
window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true
    },
    options: {
        ignoreHtmlClass: 'tex2jax_ignore',
        processHtmlClass: 'tex2jax_process'
    }
};

// 2. Функция обновления формул (остается прежней)
function updateFormula(elementId, newMathText) {
    if (typeof MathJax === 'undefined' || !MathJax.typesetPromise) {
        setTimeout(() => updateFormula(elementId, newMathText), 100);
        return;
    }
    const container = document.getElementById(elementId);
    if (!container) return;

    MathJax.typesetClear([container]);
    container.innerText = newMathText;
    MathJax.typesetPromise([container]).catch((err) => console.error(err));
}

// 3. Инженерная функция вывода чисел и красивых бесконечностей
const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    //if (el) el.innerText = val;

    let finalValue = '';
    let isMath = false; // Флаг: нужно ли подключать MathJax для этого значения

    // 1. Проверка на NaN
    if (Number.isNaN(val) || val === 'NaN') {
        finalValue = 'NaN';
    } 
    // 2. Проверка на положительную бесконечность
    else if (val === Infinity || val === '+Infinity' || val === 'Infinity') {
        finalValue = '$\\infty$'; // Команда TeX для бесконечности
        isMath = true;
    } 
    // 3. Проверка на отрицательную бесконечность
    else if (val === -Infinity || val === '-Infinity') {
        finalValue = '$-\\infty$'; // Команда TeX для минус бесконечности
        isMath = true;
    } 
    // 4. Обычные числа и строки (замена точки на запятую)
    else if (typeof val === 'number') {
        finalValue = val.toString().replace('.', ',');
    } else if (typeof val === 'string') {
        // Заменяем точки на запятые только в числах (например, 5.5 -> 5,5)
        finalValue = val.replace('.', ',');
        // ПРОВЕРКА: Ищем хотя бы одну пару знаков $ (например, $...$)
        // Регулярное выражение проверяет наличие текста, обернутого в доллары
        if (/\$.*?\$/.test(finalValue)) {
            isMath = true;
        }        
    } else {
        finalValue = val ?? '';
    }

    // Записываем результат в элемент
    el.innerText = finalValue;

    // Если это бесконечность, принудительно вызываем MathJax для этого элемента
    if (isMath && typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        MathJax.typesetClear([el]);
        MathJax.typesetPromise([el]).catch((err) => console.error('MathJax error:', err));
    }
};

// Автоматический перехват копирования для Microsoft Word
document.addEventListener('copy', function(e) {
     // 1. Получаем выделение пользователя
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    // 2. Создаем временный контейнер и копируем туда выделенный фрагмент
    const container = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
    }

    // 3. Находим все контейнеры MathJax внутри скопированного фрагмента
    const mathContainers = container.querySelectorAll('mjx-container');
    
    if (mathContainers.length > 0) {
        mathContainers.forEach(mjx => {
            // Ищем скрытый тег <math>, который MathJax всегда генерирует для доступности
            const nativeMathTag = mjx.querySelector('mjx-assistive-mml math');
            
            if (nativeMathTag) {
                // Извлекаем его и заменяем им весь огромный блок <mjx-container>
                mjx.parentNode.replaceChild(nativeMathTag, mjx);
            }
        });

        // 4. Записываем очищенный HTML с нативными формулами Word в буфер обмена
        e.clipboardData.setData('text/html', container.innerHTML);
        e.clipboardData.setData('text/plain', selection.toString());

        // Отменяем стандартное копирование браузера, так как мы подменили данные
        e.preventDefault();
        console.log(`Успешно перенесено формул в формат Word: ${mathContainers.length}`);
    }
});

// 4. Автоматическая загрузка MathJax с CDN
// Этот код сам создаст и вставит тег скрипта в документ
(function() {
    const script = document.createElement('script');
    script.id = 'MathJax-script';
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
})();
