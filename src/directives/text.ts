import ZComponent from "../component";

export function processTextDirective(component: ZComponent, action: string|null, el: Element, expression: any) {
    //@ts-ignore
    el.innerText = expression;
}

export function processHTMLDirective(component: ZComponent, action: string|null, el: Element, expression: any) {
    //@ts-ignore
    el.innerHTML = expression;
}