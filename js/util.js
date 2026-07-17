/**
 * Проверяет синтаксическую валидность CSS-строки цвета на уровне движка браузера.
 * Поддерживает: Hex, RGB/RGBA, HSL/HSLA, ключевые слова (red, blue и т.д.), transparent.
 * @param {string} colorStr - Строка цвета для проверки
 * @returns {boolean} true, если синтаксис верный, иначе false
 */
export function isValidCSSColor(colorStr) {
    if (typeof colorStr !== 'string') return false;
    
    const trimmed = colorStr.trim();
    if (!trimmed) return false;

    // 1. Проверяем через встроенное API браузера CSS.supports
    // Мы спрашиваем у браузера: "Понимаешь ли ты такой синтаксис для свойства color?"
    if (typeof CSS !== 'undefined' && CSS.supports) {
        return CSS.supports('color', trimmed);
    }

    // 2. Резервный вариант (Fallback): если код выполняется в старых браузерах 
    // или тестовой среде, где нет CSS.supports (например, в Node.js тестах)
    // Используем быстрое регулярное выражение для базовых форматов
    return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed) || 
           /^(rgb|hsl)a?\(.*\)$/i.test(trimmed) ||
           /^[a-z]+$/i.test(trimmed);
}