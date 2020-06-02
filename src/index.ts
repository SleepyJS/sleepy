import ZComponent from "./component";
import { observe } from "./observable";
import DirectiveRegistry from "./directives/directive-registry";
import ZComponentElement from "./element";

export default class Z {
    static VERSION: string = __VERSION;

    public static observe(target: any): any {
        const observable = observe(target, (target: any, key: string | number | symbol) => {
            try {
                target.__z_components.forEach((component: ZComponent) => component.modelUpdated(target, key));
            } catch(e) {}
        });

        return observable.data;
    }

    public static getDirectiveRegistry() {
        return DirectiveRegistry;
    }
}

window.customElements.define('z-component', ZComponentElement);