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
    // 1. Проверяем, загружен ли MathJax
    if (typeof MathJax === 'undefined' || !MathJax.startup || !MathJax.startup.toMML) {
        return; // Если MathJax не готов, копируем как обычно
    }

    // 2. Получаем то, что пользователь выделил на странице
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    // Создаем временный контейнер, чтобы вытащить HTML выделенного фрагмента
    const container = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneNode(true));
    }

    // 3. Ищем все отрендеренные формулы MathJax внутри выделенного фрагмента
    // MathJax v3 помечает свои контейнеры тегом <mjx-container>
    const mathContainers = container.querySelectorAll('mjx-container');
    
    if (mathContainers.length > 0) {
        // Проходимся по каждой формуле и меняем её визуальный код на скрытый MathML
        mathContainers.forEach(mjx => {
            if (mjx.mjxRoot) {
                // Конвертируем внутреннее дерево MathJax в строку MathML
                const mathmlString = MathJax.startup.toMML(mjx.mjxRoot);
                
                // Создаем временный элемент, чтобы вставить чистый MathML
                const dummy = document.createElement('div');
                dummy.innerHTML = mathmlString;
                const mathmlElement = dummy.firstElementChild;

                // Заменяем сложную SVG-верстку браузера на чистый MathML-тег
                mjx.parentNode.replaceChild(mathmlElement, mjx);
            }
        });

        // 4. Перезаписываем данные в буфер обмена
        // Передаем измененный HTML, где вместо картинок теперь лежат формулы MathML
        e.clipboardData.setData('text/html', container.innerHTML);
        // Также сохраняем обычный текстовый вариант для блокнотов
        e.clipboardData.setData('text/plain', selection.toString());

        // Отменяем стандартное системное копирование, так как мы подменили буфер своими силами
        e.preventDefault();
        console.log(`Успешно обработано формул для Word: ${mathContainers.length}`);
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
