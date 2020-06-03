import ZComponent from "../component";
import { processBindDirective } from "./bind";

export function processModelDirective(component: ZComponent, action: string | null, el: Element, expression: any, rawExpression: any) {
    const event = (el.tagName.toLowerCase() === 'select')
        || ['checkbox', 'radio'].includes((el as HTMLInputElement).type)
        ? 'change' : 'input';

    const listenerExpression = `${rawExpression} = rightSideOfExpression($event, ${rawExpression})`;

    processBindDirective(component, 'value', el, expression);

    component.registerListener(event, listenerExpression, el, {
        rightSideOfExpression: generateModelAssignmentFunction(el as HTMLInputElement, expression)
    });
}

function generateModelAssignmentFunction(el: HTMLInputElement, expression: any) {
    if ((el as HTMLInputElement).type === 'radio') {
        if (!el.hasAttribute('name')) el.setAttribute('name', expression)
    }

    return (event: any, currentValue: any) => {
        if (event instanceof CustomEvent && event.detail) {
            return event.detail
        } else if (el.type === 'checkbox') {
            if (Array.isArray(currentValue)) {
                return event.target.checked ? currentValue.concat([event.target.value]) : currentValue.filter(i => i !== event.target.value)
            } else {
                return event.target.checked
            }
        } else if (el.tagName.toLowerCase() === 'select' && el.multiple) {
            return Array.from(event.target.selectedOptions).map((option: any) => {
                    return option.value || option.text
                })
        } else {
            const rawValue = event.target.value
            return rawValue
        }
    }
}