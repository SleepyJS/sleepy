import { observe } from "./observable";
import ObservableMembrane from "observable-membrane";
import { saferEval, walk, getNativeZAttrs, trySaferEval, debounce, saferEvalNoReturn } from "./utils";
import { NativeZAttr } from "./types/z";
import { throws } from "assert";

export default class ZComponent {
    private $el: Element;
    private $data: any;
    private membrane: ObservableMembrane;

    constructor(element: Element) {
        this.$el = element;

        const model = this.getModel();

        this.$data = model;
        this.membrane = model.__z_membrane;

        this.initialize();
    }

    private findModel(modelName: string | null): any {
        try {
            return saferEval(modelName, {});
        } catch (e) {
            return observe({}, this.modelUpdated.bind(this));
        }
    }

    private getModel(): any {
        if (this.$el.hasAttribute('z-model')) {
            return this.findModel(this.$el.getAttribute('z-model'));
        }

        return observe({}, this.modelUpdated.bind(this));
    }

    private ownModel(): void {
        this.$data.__z_components.push(this);
    }

    private initialize(): void {
        this.ownModel();
        this.initializeElements(this.$el);
    }

    //@ts-ignore
    public modelUpdated(target: any, key: string | number | symbol): void {
        this.updateElements(this.$el);
    }

    private initializeElements(el: Element): void {
        this.skipNestedComponents(el, (node: Element) => {
            this.initializeElement(node);
        }, (node: Element) => node.__z = new ZComponent(node));
    }

    private skipNestedComponents(el: Element, callback: (el: Element) => boolean | void, initializeFn: (el: Element) => void = () => { }): void {
        walk(el, (node: Element) => {
            if (node.hasAttribute('z-model')) {
                if (!node.isSameNode(this.$el)) {
                    if (!node.__z) initializeFn(node);

                    return false;
                }
            }

            return callback(node);
        })
    }

    private initializeElement(el: Element): void {
        this.resolveListeners(el);
        this.resolveBoundAttrs(el, true);
    }

    private updateElements(el: Element): void {
        this.skipNestedComponents(el, (node: Element) => {
            if (node.isSameNode(this.$el)) return;

            this.updateElement(node);
        }, (el: Element) => el.__z = new ZComponent(el));
    }

    private updateElement(el: Element): void {
        this.resolveBoundAttrs(el);
    }

    private resolveListeners(el: Element): void {
        const nativeAttrs = getNativeZAttrs(el);

        nativeAttrs.forEach((attr: NativeZAttr) => {
            switch (attr.type) {
                case "on":
                    if(attr.action)
                        el.addEventListener(attr.action, (e) => {
                            saferEvalNoReturn(attr.expression, this.$data, {
                                ...{'$event': e},
                                $dispatch: this.getDispatchFunction(el),
                            })
                        })
                    break;
                default:
                    break
            }
        })
    }

    private getDispatchFunction (el: Element): (event: string, detail: any) => any {
        return (event: string, detail = {}) => {
            el.dispatchEvent(new CustomEvent(event, {
                detail,
                bubbles: true,
            }))
        }
    }

    //@ts-ignore
    private resolveBoundAttrs(el: Element, initialUpdate: boolean = false): void {
        const nativeAttrs = getNativeZAttrs(el);

        nativeAttrs.forEach((attr: NativeZAttr) => {
            switch (attr.type) {
                case "text":
                    el.innerHTML = trySaferEval(attr.expression, this.$data);
                    break;

                case "model":
                    break;

                default:
                    break;
            }
        });
    }
}