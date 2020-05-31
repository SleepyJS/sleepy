import { observe } from "./observable";
import ObservableMembrane from "observable-membrane";
import { saferEval, walk, getNativeZAttrs, trySaferEval, debounce, saferEvalNoReturn } from "./utils";
import { NativeZAttr } from "./types/z";
import { throws } from "assert";
import { processIfDirective } from "./directives/if";
import DirectiveRegistry from "./directives/directive-registry";

export default class ZComponent {
    private $el: Element;
    private $data: any;
    private membrane: ObservableMembrane;
    private $parent: ZComponent|null;

    constructor(element: Element, parent: ZComponent|null = null) {
        this.$el = element;

        this.$parent = parent;
        const model = this.getModel();
        model.$el = this.$el;
        model.$parent = this.$parent ? this.$parent.$data : null;

        this.$data = model;
        this.membrane = model.__z_membrane;

        this.initialize();
    }

    private findModel(modelName: string | null): any {
        try {
            return saferEval(modelName, this.$parent && this.$parent.$data ? this.$parent.$data : {});
        } catch (e) {
            return observe({}, this.modelUpdated.bind(this));
        }
    }

    private getModel(): any {
        if (this.$el.hasAttribute('z-model')) {
            const model = this.findModel(this.$el.getAttribute('z-model'));
                
            return !model || !model.__z_membrane ? observe(model, this.modelUpdated.bind(this)).data : model;
        }

        return observe({}, this.modelUpdated.bind(this)).data;
    }

    private ownModel(): void {
        this.$data.__z_components.push(this);
        if(this.$parent)
            this.$parent.$data.__z_components.push(this);
    }

    private unownModel(): void {
        this.$data.__z_components = this.$data.__z_components.filter((component: ZComponent) => component != this);
    }

    private initialize(): void {
        this.ownModel();
        this.initializeElements(this.$el);
    }

    //@ts-ignore
    public modelUpdated(target: any, key: string | number | symbol): void {
        this.updateElements(this.$el);
    }

    public initializeElements(el: Element): void {
        this.skipNestedComponents(el, (node: Element) => {
            this.initializeElement(node);
        }, (node: Element) => node.__z = new ZComponent(node, this));
    }

    private skipNestedComponents(el: Element, callback: (el: Element) => boolean | void, initializeFn: (el: Element) => void = () => { }): void {
        walk(el, (node: Element) => {
            if (node.hasAttribute('z-model') || node.nodeName == "Z-COMPONENT") {
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
        }, (el: Element) => el.__z = new ZComponent(el, this));
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

        nativeAttrs.filter(attr => attr.type != null).forEach((attr: NativeZAttr) => {
            //@ts-ignore
            const handler = DirectiveRegistry.getHandler(attr.type);

            if(handler) {
                const evaluation = trySaferEval(attr.expression, this.$data);
                handler(this, el, evaluation);
            }
        });
    }
}