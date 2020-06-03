import { Observable } from "./types/z";
import ObservableMembrane from "observable-membrane";
import ZComponent from "./component";

export function observe(target: any, changeCallback: (target: any, key: string | number | symbol) => void): Observable {
    const membrane = new ObservableMembrane({
        valueMutated(target, key) {
            if(typeof key === 'string' && key.startsWith('__z_')) return;

            if(target.__z_components) {
                target.__z_components.forEach((component: ZComponent) => {
                    component.modelUpdated(target, key);
                });
            }

            changeCallback(target, key);
        }
    });

    let data = membrane.getProxy(target);
    data.__z_membrane = membrane;
    data.__z_components = [];

    return {
        data,
        membrane
    }
}