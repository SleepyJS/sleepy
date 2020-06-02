import ZComponent from "./component";
import {domReady} from "./utils";

export default class ZComponentElement extends HTMLElement {
    constructor() {
        super();

        domReady().then(this.initialize.bind(this));
    }

    async initialize() {
        const parent: ZComponentElement|null = this.getParentComponent();

        if(!this.__z && !parent) {
            this.__z = new ZComponent(this);
        } else if (!this.__z && parent) {
            await this.parentInitialization(parent);
            this.__z = new ZComponent(this, parent.__z);
        }
    }

    getParentComponent(): ZComponentElement|null {
        let node = this.parentElement

        while (node) {
            if(node.tagName == "Z-COMPONENT")
                return node as ZComponentElement;

            node = node.parentElement;
        }

        return null;
    }

    private parentInitialization(parent: ZComponentElement) {
        return new Promise((resolve) => {
            if(parent.__z) return resolve();

            setTimeout(() => this.waitForParent(parent, resolve), 50);
        });
    }

    private waitForParent(parent: ZComponentElement, resolve: () => any) {
        if(parent.__z) return resolve();

        setTimeout(() => this.waitForParent(parent, resolve), 50);
    }
}