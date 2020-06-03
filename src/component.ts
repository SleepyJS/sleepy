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
        if (this.$el.hasAttribute('z-with')) {
            const model = this.findModel(this.$el.getAttribute('z-with'));
                
            return !model || !model.__z_membrane ? observe(model, this.modelUpdated.bind(this)).data : model;
        }

        return observe({}, this.modelUpdated.bind(this)).data;
    }

    private ownModel(): void {
        this.$data.__z_components.push(this);

        if(this.$parent)
            this.ownParentModels();
    }

    private ownParentModels(): void {
        let parent = this.$parent;

        while(parent) {
            parent.$data.__z_components.push(this);

            parent = parent.$parent;
        }
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
            if(node.__z_inserted_me) return false;

            this.initializeElement(node);
            return true;
        }, (node: Element) => {});
    }

    private skipNestedComponents(el: Element, callback: (el: Element) => boolean | void, initializeFn: (el: Element) => void = () => { }): void {
        walk(el, (node: Element) => {
            if (node.hasAttribute('z-with') || node.nodeName == "Z-COMPONENT") {
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

        if(el.getAttribute('class') != null) {
            //@ts-ignore
            el.__z_original_classes = el.getAttribute('class').split(' ')
        }

        this.resolveBoundAttrs(el, true);
    }

    private updateElements(el: Element): void {
        this.skipNestedComponents(el, (node: Element) => {
            if (node.isSameNode(this.$el)) return;

            this.updateElement(node);
        }, (el: Element) => {});
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
                        this.registerListener(attr.action, attr.expression, el);
                    break;
                default:
                    break
            }
        })
    }

    public registerListener(event: string, expression: any, el: Element, extraVars: any = {}): void 
    {
        el.addEventListener(event, (e) => {
            saferEvalNoReturn(expression, this.$data, {
                ...{'$event': e},
                $dispatch: this.getDispatchFunction(el),
                ...extraVars
            });
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
                handler(this, attr.action, el, evaluation, attr.expression);
            }
        });
    }
}