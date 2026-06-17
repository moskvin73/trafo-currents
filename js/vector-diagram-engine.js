/**
 * Универсальный движок отрисовки векторных диаграмм ТОЭ
 * @param {string} phaseKey - Активная фаза ('A', 'B', 'C')
 * @param {string} containerId - ID контейнера для вставки SVG
 * @param {Object} config - Конкретный JSON-объект с настройками и векторами
 */
function drawDiagram(phaseKey, containerId, config) {
    // 1. Подсветка кнопок управления внутри текущего блока
    // Ищем кнопки РЯДОМ с контейнером, чтобы не сломать кнопки других диаграмм на странице
    const parent = document.getElementById(containerId)?.parentElement;
    if (parent) {
        ['A', 'B', 'C'].forEach(p => {
            const btn = parent.querySelector(`#btn-phase-${p}`);
            if (btn) {
                btn.style.background = p === phaseKey ? '#2e7d32' : '#e0e0e0';
                btn.style.color = p === phaseKey ? 'white' : 'black';
            }
        });
    }

    // 2. Очистка точки монтирования
    const mountPoint = document.getElementById(containerId);
    if (!mountPoint) return;
    mountPoint.innerHTML = ''; 

    const cfg = config.settings;
    const svgNS = "http://w3.org";

    // 3. Создание SVG
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', cfg.width.toString());
    svg.setAttribute('height', cfg.height.toString());
    svg.style.background = '#f9f9f9';
    svg.style.border = '1px solid #ccc';
    svg.style.borderRadius = '8px';

    // 4. Генерация стрелок в <defs>
    const defs = document.createElementNS(svgNS, 'defs');
    const colors = { 'red': '#d32f2f', 'green': '#388e3c', 'blue': '#1976d2' };
    
    Object.keys(colors).forEach(cName => {
        const marker = document.createElementNS(svgNS, 'marker');
        marker.setAttribute('id', `arrow-${cName}`);
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '5'); marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', colors[cName]);
        
        marker.appendChild(path);
        defs.appendChild(marker);
    });
    svg.appendChild(defs);

    // 5. Координатная сетка ТОЭ (+1 вверх, +j влево)
    const gridLines = [
        { x1: 40, y1: cfg.cy, x2: cfg.width - 40, y2: cfg.cy },
        { x1: cfg.cx, y1: 40, x2: cfg.cx, y2: cfg.height - 40 }
    ];
    gridLines.forEach(l => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', l.x1.toString()); line.setAttribute('y1', l.y1.toString());
        line.setAttribute('x2', l.x2.toString()); line.setAttribute('y2', l.y2.toString());
        line.setAttribute('stroke', '#757575'); line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-dasharray', '4');
        svg.appendChild(line);
    });

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cfg.cx.toString()); circle.setAttribute('cy', cfg.cy.toString());
    circle.setAttribute('r', cfg.gridCircleRadius.toString());
    circle.setAttribute('stroke', '#bdbdbd'); circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', '1'); circle.setAttribute('stroke-dasharray', '2');
    svg.appendChild(circle);

    const axisLabels = [
        { x: cfg.cx + 12, y: 55, text: "+1" },
        { x: 45, y: cfg.cy - 10, text: "+j" }
    ];
    axisLabels.forEach(al => {
        const txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('x', al.x.toString()); txt.setAttribute('y', al.y.toString());
        txt.setAttribute('fill', '#757575'); txt.setAttribute('font-weight', 'bold');
        txt.setAttribute('font-size', '14px'); txt.textContent = al.text;
        svg.appendChild(txt);
    });

    // 6. Отрисовка векторов
    const currentPhase = config.phases[phaseKey];
    if (currentPhase && currentPhase.vectors) {
        currentPhase.vectors.forEach(v => {
            const length = v.isLV ? cfg.lvLength : cfg.hvLength;
            const rad = (v.angle * Math.PI) / 180;
            const x2 = cfg.cx - length * Math.sin(rad); 
            const y2 = cfg.cy - length * Math.cos(rad); 

            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', cfg.cx.toString()); line.setAttribute('y1', cfg.cy.toString());
            line.setAttribute('x2', x2.toString()); line.setAttribute('y2', y2.toString());
            line.setAttribute('stroke', v.color);
            line.setAttribute('stroke-width', v.isLV ? '2.5' : '3.5');
            if (v.isLV) line.setAttribute('stroke-dasharray', '5,4');

            const markerColor = v.color === '#d32f2f' ? 'red' : v.color === '#388e3c' ? 'green' : 'blue';
            line.setAttribute('marker-end', `url(#arrow-${markerColor})`);
            svg.appendChild(line);

            // Математическое смещение подписей
            const padding = v.isLV ? 15 : 25;
            let textX = cfg.cx - (length + padding) * Math.sin(rad);
            let textY = cfg.cy - (length + padding) * Math.cos(rad);

            if (Math.abs(Math.sin(rad)) < 0.1) {
                textX -= 15;
                if (Math.cos(rad) < 0) textY += 12;
            } else {
                if (Math.sin(rad) > 0) textX -= 45;
                if (Math.sin(rad) < 0) textX += 5;
                if (Math.cos(rad) < 0) textY += 12;
            }

            const foreignObj = document.createElementNS(svgNS, 'foreignObject');
            foreignObj.setAttribute('x', textX.toString());
            foreignObj.setAttribute('y', (textY - 15).toString());
            foreignObj.setAttribute('width', '60');
            foreignObj.setAttribute('height', '30');

            const mathDiv = document.createElement('div');
            mathDiv.style.color = '#333'; mathDiv.style.fontSize = '13px';
            mathDiv.style.fontFamily = 'sans-serif'; mathDiv.innerHTML = v.label;

            foreignObj.appendChild(mathDiv);
            svg.appendChild(foreignObj);

            // БЕЗОПАСНЫЙ ВЫЗОВ MATHJAX: проверяем, инициализирована ли библиотека
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise([mathDiv]).catch((err) => console.error(err));
            } else {
                // Если MathJax еще грузится, вешаем триггер на событие его готовности
                document.addEventListener('MathJaxReady', () => {
                    MathJax.typesetPromise([mathDiv]).catch((err) => console.error(err));
                });
            }
        });
    }

    mountPoint.appendChild(svg);
}
