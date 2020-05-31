import ZComponent from "./component";
import { observe } from "./observable";
import DirectiveRegistry from "./directives/directive-registry";

export default class Z {
    static VERSION: string = __VERSION;

    public async start(): Promise<void> {
        this.discover();
    }

    private discover(): void {
        document.querySelectorAll('z-component').forEach(this.initializeComponent);
    }

    private initializeComponent(component: Element): void {
        if(!component.__z)
            component.__z = new ZComponent(component);
    }

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

const z = new Z();
document.addEventListener('DOMContentLoaded', () => z.start());