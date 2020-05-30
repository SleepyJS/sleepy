import ZComponent from "../component";

export function processIfDirective(component: ZComponent, el: Element, expression: any) {
    if(el.nodeName.toLowerCase() !== "template") {
        console.error('TODO: Implement catching error');
        return;
    }

    const elementHasAlreadyBeenAdded = el.nextElementSibling !== null && el.nextElementSibling.__z_inserted_me === true;

    if(expression && !elementHasAlreadyBeenAdded) {
        console.log('test');
        //@ts-ignore
        const clone = document.importNode(el.content, true);

        //@ts-ignore
        el.parentElement.insertBefore(clone, el.nextElementSibling);
        //@ts-ignore
        component.initializeElements(el.nextElementSibling);
        //@ts-ignore
        el.nextElementSibling.__z_inserted_me = true
    } else if (!expression && elementHasAlreadyBeenAdded && el.nextElementSibling) {
        el.nextElementSibling.remove();
    }
}