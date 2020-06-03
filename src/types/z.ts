import ZComponent from "../component";
import ObservableMembrane from "observable-membrane";

declare global {
    interface Element {
        __z: ZComponent
        __z_inserted_me: boolean
        __z_original_classes: string[]
    }

    var __VERSION: string;
}

export interface Observable {
    data: any,
    membrane: ObservableMembrane
}

export interface NativeZAttr {
    type: string|null,
    action: string|null,
    expression: string
}

export type DirectiveHandler = (component: ZComponent, action: string|null, el: Element, expression: any, rawExpression: any = null) => void;