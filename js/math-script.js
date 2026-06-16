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

// 3. ДИНАМИЧЕСКАЯ ЗАГРУЗКА MATHJAX
// Этот код сам создаст и вставит тег скрипта в документ
(function() {
    const script = document.createElement('script');
    script.id = 'MathJax-script';
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
})();
