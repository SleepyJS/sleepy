import ZComponent from "../component";
import { isBooleanAttr } from "../utils";

export function processBindDirective(component: ZComponent, action: string | null, el: Element, expression: any) {
    if (action == null) return; // TODO: Throw error on no binding

    if (action == "value") {
        if (expression === undefined && expression.match(/\./).length) {
            expression = ''
        }

        const type = (el as HTMLInputElement).type;

        if(type == 'radio') {
            (el as HTMLInputElement).value = expression;
        } else if (type == 'checkbox') {
            if(Array.isArray(expression)) {
                (el as HTMLInputElement).checked = expression.some(val => val == (el as HTMLInputElement).value)
            } else {
                (el as HTMLInputElement).checked = !!expression;
            }

            if (typeof expression === 'string') {
                (el as HTMLInputElement).value = expression
            }
        } else if(el.tagName == 'SELECT') {
            const arrayWrappedValue = [].concat(expression).map(value => { return value + '' })

            Array.from((el as HTMLSelectElement).options).forEach(option => {
                option.selected = arrayWrappedValue.includes(option.value || option.text)
            });
        } else {
            if ((el as HTMLInputElement).value === expression) return

            (el as HTMLInputElement).value = expression
        }
    } else if (action == "class") {
        if(Array.isArray(expression)) {
            const originalClasses = el.__z_original_classes ?? [];
            el.setAttribute('class', Array.from(new Set([...originalClasses, ...expression])).join(' '));
        } else if (typeof expression == 'object') {
            const keysSortedByBooleanValue = Object.keys(expression).sort((a, b) => expression[a] - expression[b]);
            
            keysSortedByBooleanValue.forEach(classNames => {
                if (expression[classNames]) {
                    classNames.split(' ').filter(Boolean).forEach(className => el.classList.add(className))
                } else {
                    classNames.split(' ').filter(Boolean).forEach(className => el.classList.remove(className))
                }
            })
        } else {
            const originalClasses = el.__z_original_classes ?? [];
            const newClasses = expression.split(' ').filter(Boolean);
            el.setAttribute('class', Array.from(new Set([...originalClasses, ...newClasses])).join(' '));
        }
    } else {
        if ([null, undefined, false].includes(expression)) {
            el.removeAttribute(action);
        } else {
            isBooleanAttr(action) ? el.setAttribute(action, action) : el.setAttribute(action, expression);
        }
    }
}