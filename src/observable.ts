import { Observable } from "./types/z";
import ObservableMembrane from "observable-membrane";

export function observe(target: any, changeCallback: (target: any, key: string | number | symbol) => void): Observable {
    const membrane = new ObservableMembrane({
        valueMutated(target, key) {
            if(typeof key === 'string' && key.startsWith('__z_')) return;

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