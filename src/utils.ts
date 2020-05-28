import { NativeZAttr } from "./types/z"

const nativeZAttrRegex = /^z-(on|bind|text|html|model|if|for|show|cloak|ref)\b/

export function saferEval(expression: any, dataContext: any, additionalHelperVariables = {}): any {
    //@ts-ignore
    return (new Function(['$data', ...Object.keys(additionalHelperVariables)], `let __z_result; with($data) { __z_result = ${expression} }; return __z_result`))(
        dataContext, ...Object.values(additionalHelperVariables)
    )
}

export function trySaferEval(expression: any, dataContext: any, additionalHelperVariables = {}, defaultReturn: any = null): any {
    try {
        return saferEval(expression, dataContext, additionalHelperVariables);
    } catch(e) {
        return defaultReturn;
    }
}

export function saferEvalNoReturn(expression: any, dataContext: any, additionalHelperVariables = {}) {
    // For the cases when users pass only a function reference to the caller: `x-on:click="foo"`
    // Where "foo" is a function. Also, we'll pass the function the event instance when we call it.
    if (Object.keys(dataContext).includes(expression)) {
        //@ts-ignore
        let methodReference = (new Function(['dataContext', ...Object.keys(additionalHelperVariables)], `with(dataContext) { return ${expression} }`))(
            dataContext, ...Object.values(additionalHelperVariables)
        )

        if (typeof methodReference === 'function') {
            //@ts-ignore
            return methodReference.call(dataContext, additionalHelperVariables['$event'])
        }
    }

    //@ts-ignore
    return (new Function(['dataContext', ...Object.keys(additionalHelperVariables)], `with(dataContext) { ${expression} }`))(
        dataContext, ...Object.values(additionalHelperVariables)
    )
}

export function walk(el: Element, callback: (el: Element) => boolean | void): void {
    if (callback(el) === false) return

    let node = el.firstElementChild

    while (node) {
        walk(node, callback)

        node = node.nextElementSibling
    }
}

export function isNativeZAttr(attr: Attr): boolean {
    return nativeZAttrRegex.test(attr.name);
}

export function getNativeZAttrs(el: Element): NativeZAttr[] {
    return Array.from(el.attributes)
        .filter(isNativeZAttr)
        .map((attr: Attr) => {
            const name = attr.name;
            const typeMatch = name.match(nativeZAttrRegex);
            const actionMatch = name.match(/:([a-zA-Z\-:]+)/);

            return {
                type: typeMatch ? typeMatch[1] : null,
                action: actionMatch ? actionMatch[1] : null,
                expression: attr.value
            }
        })
}

export function debounce(func: Function, wait: number): Function {
    let timeout: any = null;

    return function () {
        //@ts-ignore
        let context: any = this, args = arguments
        let later = function () {
            timeout = null
            func.apply(context, args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}