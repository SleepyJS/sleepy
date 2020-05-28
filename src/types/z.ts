import ZComponent from "../component";
import ObservableMembrane from "observable-membrane";

declare global {
    interface Element {
        __z: ZComponent
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