import ZComponent from "../component";

export function processTextDirective(component: ZComponent, el: Element, expression: any) {
    //@ts-ignore
    el.innerText = expression;
}

export function processHTMLDirective(component: ZComponent, el: Element, expression: any) {
    //@ts-ignore
    el.innerHTML = expression;
}