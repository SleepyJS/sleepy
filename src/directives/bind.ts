import ZComponent from "../component";
import { isBooleanAttr } from "../utils";

export function processBindDirective(component: ZComponent, action: string | null, el: Element, expression: any) {
    if (action == null) return; // TODO: Throw error on no binding

    if (action == "value") {

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