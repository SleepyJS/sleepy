import ZComponent from "./component";
import { observe } from "./observable";

export default class Z {
    static VERSION: string = __VERSION;

    public async start(): Promise<void> {
        this.discover();
    }

    private discover(): void {
        document.querySelectorAll('z-component').forEach(this.initializeComponent);
    }

    private initializeComponent(component: Element): void {
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
}

const z = new Z();
document.addEventListener('DOMContentLoaded', () => z.start());