(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.Z = factory());
}(this, (function () { 'use strict';

    /**
     * Copyright (C) 2017 salesforce.com, inc.
     */
    const { isArray } = Array;
    const { getPrototypeOf, create: ObjectCreate, defineProperty: ObjectDefineProperty, defineProperties: ObjectDefineProperties, isExtensible, getOwnPropertyDescriptor, getOwnPropertyNames, getOwnPropertySymbols, preventExtensions, hasOwnProperty, } = Object;
    const { push: ArrayPush, concat: ArrayConcat, map: ArrayMap, } = Array.prototype;
    function isUndefined(obj) {
        return obj === undefined;
    }
    function isFunction(obj) {
        return typeof obj === 'function';
    }
    function isObject(obj) {
        return typeof obj === 'object';
    }
    const proxyToValueMap = new WeakMap();
    function registerProxy(proxy, value) {
        proxyToValueMap.set(proxy, value);
    }
    const unwrap = (replicaOrAny) => proxyToValueMap.get(replicaOrAny) || replicaOrAny;

    function wrapValue(membrane, value) {
        return membrane.valueIsObservable(value) ? membrane.getProxy(value) : value;
    }
    /**
     * Unwrap property descriptors will set value on original descriptor
     * We only need to unwrap if value is specified
     * @param descriptor external descrpitor provided to define new property on original value
     */
    function unwrapDescriptor(descriptor) {
        if (hasOwnProperty.call(descriptor, 'value')) {
            descriptor.value = unwrap(descriptor.value);
        }
        return descriptor;
    }
    function lockShadowTarget(membrane, shadowTarget, originalTarget) {
        const targetKeys = ArrayConcat.call(getOwnPropertyNames(originalTarget), getOwnPropertySymbols(originalTarget));
        targetKeys.forEach((key) => {
            let descriptor = getOwnPropertyDescriptor(originalTarget, key);
            // We do not need to wrap the descriptor if configurable
            // Because we can deal with wrapping it when user goes through
            // Get own property descriptor. There is also a chance that this descriptor
            // could change sometime in the future, so we can defer wrapping
            // until we need to
            if (!descriptor.configurable) {
                descriptor = wrapDescriptor(membrane, descriptor, wrapValue);
            }
            ObjectDefineProperty(shadowTarget, key, descriptor);
        });
        preventExtensions(shadowTarget);
    }
    class ReactiveProxyHandler {
        constructor(membrane, value) {
            this.originalTarget = value;
            this.membrane = membrane;
        }
        get(shadowTarget, key) {
            const { originalTarget, membrane } = this;
            const value = originalTarget[key];
            const { valueObserved } = membrane;
            valueObserved(originalTarget, key);
            return membrane.getProxy(value);
        }
        set(shadowTarget, key, value) {
            const { originalTarget, membrane: { valueMutated } } = this;
            const oldValue = originalTarget[key];
            if (oldValue !== value) {
                originalTarget[key] = value;
                valueMutated(originalTarget, key);
            }
            else if (key === 'length' && isArray(originalTarget)) {
                // fix for issue #236: push will add the new index, and by the time length
                // is updated, the internal length is already equal to the new length value
                // therefore, the oldValue is equal to the value. This is the forking logic
                // to support this use case.
                valueMutated(originalTarget, key);
            }
            return true;
        }
        deleteProperty(shadowTarget, key) {
            const { originalTarget, membrane: { valueMutated } } = this;
            delete originalTarget[key];
            valueMutated(originalTarget, key);
            return true;
        }
        apply(shadowTarget, thisArg, argArray) {
            /* No op */
        }
        construct(target, argArray, newTarget) {
            /* No op */
        }
        has(shadowTarget, key) {
            const { originalTarget, membrane: { valueObserved } } = this;
            valueObserved(originalTarget, key);
            return key in originalTarget;
        }
        ownKeys(shadowTarget) {
            const { originalTarget } = this;
            return ArrayConcat.call(getOwnPropertyNames(originalTarget), getOwnPropertySymbols(originalTarget));
        }
        isExtensible(shadowTarget) {
            const shadowIsExtensible = isExtensible(shadowTarget);
            if (!shadowIsExtensible) {
                return shadowIsExtensible;
            }
            const { originalTarget, membrane } = this;
            const targetIsExtensible = isExtensible(originalTarget);
            if (!targetIsExtensible) {
                lockShadowTarget(membrane, shadowTarget, originalTarget);
            }
            return targetIsExtensible;
        }
        setPrototypeOf(shadowTarget, prototype) {
        }
        getPrototypeOf(shadowTarget) {
            const { originalTarget } = this;
            return getPrototypeOf(originalTarget);
        }
        getOwnPropertyDescriptor(shadowTarget, key) {
            const { originalTarget, membrane } = this;
            const { valueObserved } = this.membrane;
            // keys looked up via hasOwnProperty need to be reactive
            valueObserved(originalTarget, key);
            let desc = getOwnPropertyDescriptor(originalTarget, key);
            if (isUndefined(desc)) {
                return desc;
            }
            const shadowDescriptor = getOwnPropertyDescriptor(shadowTarget, key);
            if (!isUndefined(shadowDescriptor)) {
                return shadowDescriptor;
            }
            // Note: by accessing the descriptor, the key is marked as observed
            // but access to the value, setter or getter (if available) cannot observe
            // mutations, just like regular methods, in which case we just do nothing.
            desc = wrapDescriptor(membrane, desc, wrapValue);
            if (!desc.configurable) {
                // If descriptor from original target is not configurable,
                // We must copy the wrapped descriptor over to the shadow target.
                // Otherwise, proxy will throw an invariant error.
                // This is our last chance to lock the value.
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor#Invariants
                ObjectDefineProperty(shadowTarget, key, desc);
            }
            return desc;
        }
        preventExtensions(shadowTarget) {
            const { originalTarget, membrane } = this;
            lockShadowTarget(membrane, shadowTarget, originalTarget);
            preventExtensions(originalTarget);
            return true;
        }
        defineProperty(shadowTarget, key, descriptor) {
            const { originalTarget, membrane } = this;
            const { valueMutated } = membrane;
            const { configurable } = descriptor;
            // We have to check for value in descriptor
            // because Object.freeze(proxy) calls this method
            // with only { configurable: false, writeable: false }
            // Additionally, method will only be called with writeable:false
            // if the descriptor has a value, as opposed to getter/setter
            // So we can just check if writable is present and then see if
            // value is present. This eliminates getter and setter descriptors
            if (hasOwnProperty.call(descriptor, 'writable') && !hasOwnProperty.call(descriptor, 'value')) {
                const originalDescriptor = getOwnPropertyDescriptor(originalTarget, key);
                descriptor.value = originalDescriptor.value;
            }
            ObjectDefineProperty(originalTarget, key, unwrapDescriptor(descriptor));
            if (configurable === false) {
                ObjectDefineProperty(shadowTarget, key, wrapDescriptor(membrane, descriptor, wrapValue));
            }
            valueMutated(originalTarget, key);
            return true;
        }
    }

    function wrapReadOnlyValue(membrane, value) {
        return membrane.valueIsObservable(value) ? membrane.getReadOnlyProxy(value) : value;
    }
    class ReadOnlyHandler {
        constructor(membrane, value) {
            this.originalTarget = value;
            this.membrane = membrane;
        }
        get(shadowTarget, key) {
            const { membrane, originalTarget } = this;
            const value = originalTarget[key];
            const { valueObserved } = membrane;
            valueObserved(originalTarget, key);
            return membrane.getReadOnlyProxy(value);
        }
        set(shadowTarget, key, value) {
            return false;
        }
        deleteProperty(shadowTarget, key) {
            return false;
        }
        apply(shadowTarget, thisArg, argArray) {
            /* No op */
        }
        construct(target, argArray, newTarget) {
            /* No op */
        }
        has(shadowTarget, key) {
            const { originalTarget, membrane: { valueObserved } } = this;
            valueObserved(originalTarget, key);
            return key in originalTarget;
        }
        ownKeys(shadowTarget) {
            const { originalTarget } = this;
            return ArrayConcat.call(getOwnPropertyNames(originalTarget), getOwnPropertySymbols(originalTarget));
        }
        setPrototypeOf(shadowTarget, prototype) {
        }
        getOwnPropertyDescriptor(shadowTarget, key) {
            const { originalTarget, membrane } = this;
            const { valueObserved } = membrane;
            // keys looked up via hasOwnProperty need to be reactive
            valueObserved(originalTarget, key);
            let desc = getOwnPropertyDescriptor(originalTarget, key);
            if (isUndefined(desc)) {
                return desc;
            }
            const shadowDescriptor = getOwnPropertyDescriptor(shadowTarget, key);
            if (!isUndefined(shadowDescriptor)) {
                return shadowDescriptor;
            }
            // Note: by accessing the descriptor, the key is marked as observed
            // but access to the value or getter (if available) cannot be observed,
            // just like regular methods, in which case we just do nothing.
            desc = wrapDescriptor(membrane, desc, wrapReadOnlyValue);
            if (hasOwnProperty.call(desc, 'set')) {
                desc.set = undefined; // readOnly membrane does not allow setters
            }
            if (!desc.configurable) {
                // If descriptor from original target is not configurable,
                // We must copy the wrapped descriptor over to the shadow target.
                // Otherwise, proxy will throw an invariant error.
                // This is our last chance to lock the value.
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor#Invariants
                ObjectDefineProperty(shadowTarget, key, desc);
            }
            return desc;
        }
        preventExtensions(shadowTarget) {
            return false;
        }
        defineProperty(shadowTarget, key, descriptor) {
            return false;
        }
    }
    function createShadowTarget(value) {
        let shadowTarget = undefined;
        if (isArray(value)) {
            shadowTarget = [];
        }
        else if (isObject(value)) {
            shadowTarget = {};
        }
        return shadowTarget;
    }
    const ObjectDotPrototype = Object.prototype;
    function defaultValueIsObservable(value) {
        // intentionally checking for null
        if (value === null) {
            return false;
        }
        // treat all non-object types, including undefined, as non-observable values
        if (typeof value !== 'object') {
            return false;
        }
        if (isArray(value)) {
            return true;
        }
        const proto = getPrototypeOf(value);
        return (proto === ObjectDotPrototype || proto === null || getPrototypeOf(proto) === null);
    }
    const defaultValueObserved = (obj, key) => {
        /* do nothing */
    };
    const defaultValueMutated = (obj, key) => {
        /* do nothing */
    };
    const defaultValueDistortion = (value) => value;
    function wrapDescriptor(membrane, descriptor, getValue) {
        const { set, get } = descriptor;
        if (hasOwnProperty.call(descriptor, 'value')) {
            descriptor.value = getValue(membrane, descriptor.value);
        }
        else {
            if (!isUndefined(get)) {
                descriptor.get = function () {
                    // invoking the original getter with the original target
                    return getValue(membrane, get.call(unwrap(this)));
                };
            }
            if (!isUndefined(set)) {
                descriptor.set = function (value) {
                    // At this point we don't have a clear indication of whether
                    // or not a valid mutation will occur, we don't have the key,
                    // and we are not sure why and how they are invoking this setter.
                    // Nevertheless we preserve the original semantics by invoking the
                    // original setter with the original target and the unwrapped value
                    set.call(unwrap(this), membrane.unwrapProxy(value));
                };
            }
        }
        return descriptor;
    }
    class ReactiveMembrane {
        constructor(options) {
            this.valueDistortion = defaultValueDistortion;
            this.valueMutated = defaultValueMutated;
            this.valueObserved = defaultValueObserved;
            this.valueIsObservable = defaultValueIsObservable;
            this.objectGraph = new WeakMap();
            if (!isUndefined(options)) {
                const { valueDistortion, valueMutated, valueObserved, valueIsObservable } = options;
                this.valueDistortion = isFunction(valueDistortion) ? valueDistortion : defaultValueDistortion;
                this.valueMutated = isFunction(valueMutated) ? valueMutated : defaultValueMutated;
                this.valueObserved = isFunction(valueObserved) ? valueObserved : defaultValueObserved;
                this.valueIsObservable = isFunction(valueIsObservable) ? valueIsObservable : defaultValueIsObservable;
            }
        }
        getProxy(value) {
            const unwrappedValue = unwrap(value);
            const distorted = this.valueDistortion(unwrappedValue);
            if (this.valueIsObservable(distorted)) {
                const o = this.getReactiveState(unwrappedValue, distorted);
                // when trying to extract the writable version of a readonly
                // we return the readonly.
                return o.readOnly === value ? value : o.reactive;
            }
            return distorted;
        }
        getReadOnlyProxy(value) {
            value = unwrap(value);
            const distorted = this.valueDistortion(value);
            if (this.valueIsObservable(distorted)) {
                return this.getReactiveState(value, distorted).readOnly;
            }
            return distorted;
        }
        unwrapProxy(p) {
            return unwrap(p);
        }
        getReactiveState(value, distortedValue) {
            const { objectGraph, } = this;
            let reactiveState = objectGraph.get(distortedValue);
            if (reactiveState) {
                return reactiveState;
            }
            const membrane = this;
            reactiveState = {
                get reactive() {
                    const reactiveHandler = new ReactiveProxyHandler(membrane, distortedValue);
                    // caching the reactive proxy after the first time it is accessed
                    const proxy = new Proxy(createShadowTarget(distortedValue), reactiveHandler);
                    registerProxy(proxy, value);
                    ObjectDefineProperty(this, 'reactive', { value: proxy });
                    return proxy;
                },
                get readOnly() {
                    const readOnlyHandler = new ReadOnlyHandler(membrane, distortedValue);
                    // caching the readOnly proxy after the first time it is accessed
                    const proxy = new Proxy(createShadowTarget(distortedValue), readOnlyHandler);
                    registerProxy(proxy, value);
                    ObjectDefineProperty(this, 'readOnly', { value: proxy });
                    return proxy;
                }
            };
            objectGraph.set(distortedValue, reactiveState);
            return reactiveState;
        }
    }
    /** version: 0.26.0 */

    function observe(target, changeCallback) {
        const membrane = new ReactiveMembrane({
            valueMutated(target, key) {
                if (typeof key === 'string' && key.startsWith('__z_'))
                    return;
                if (target.__z_components) {
                    target.__z_components.forEach((component) => {
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
        };
    }

    function saferEval(expression, dataContext, additionalHelperVariables = {}) {
        //@ts-ignore
        return (new Function(['$data', ...Object.keys(additionalHelperVariables)], `let __z_result; with($data) { __z_result = ${expression} }; return __z_result`))(dataContext, ...Object.values(additionalHelperVariables));
    }
    function trySaferEval(expression, dataContext, additionalHelperVariables = {}, defaultReturn = null) {
        try {
            return saferEval(expression, dataContext, additionalHelperVariables);
        }
        catch (e) {
            return defaultReturn;
        }
    }
    function saferEvalNoReturn(expression, dataContext, additionalHelperVariables = {}) {
        if (Object.keys(dataContext).includes(expression)) {
            //@ts-ignore
            let methodReference = (new Function(['dataContext', ...Object.keys(additionalHelperVariables)], `with(dataContext) { return ${expression} }`))(dataContext, ...Object.values(additionalHelperVariables));
            if (typeof methodReference === 'function') {
                //@ts-ignore
                return methodReference.call(dataContext, additionalHelperVariables['$event']);
            }
        }
        //@ts-ignore
        return (new Function(['dataContext', ...Object.keys(additionalHelperVariables)], `with(dataContext) { ${expression} }`))(dataContext, ...Object.values(additionalHelperVariables));
    }
    function walk(el, callback) {
        if (callback(el) === false)
            return;
        let node = el.firstElementChild;
        while (node) {
            walk(node, callback);
            node = node.nextElementSibling;
        }
    }
    function isNativeZAttr(attr) {
        return DirectiveRegistry.getHandlerRegex().test(replaceAtAndColon(attr.name));
    }
    function getNativeZAttrs(el) {
        return Array.from(el.attributes)
            .filter(isNativeZAttr)
            .map((attr) => {
            const name = replaceAtAndColon(attr.name);
            const typeMatch = name.match(DirectiveRegistry.getHandlerRegex());
            const actionMatch = name.match(/:([a-zA-Z\-:]+)/);
            return {
                type: typeMatch ? typeMatch[1] : null,
                action: actionMatch ? actionMatch[1] : null,
                expression: attr.value
            };
        });
    }
    function replaceAtAndColon(name) {
        if (name.startsWith('@')) {
            return name.replace('@', 'z-on:');
        }
        else if (name.startsWith(':')) {
            return name.replace(':', 'z-bind:');
        }
        return name;
    }
    function isBooleanAttr(attrName) {
        const booleanAttributes = [
            'disabled', 'checked', 'required', 'readonly', 'hidden', 'open', 'selected',
            'autofocus', 'itemscope', 'multiple', 'novalidate', 'allowfullscreen',
            'allowpaymentrequest', 'formnovalidate', 'autoplay', 'controls', 'loop',
            'muted', 'playsinline', 'default', 'ismap', 'reversed', 'async', 'defer',
            'nomodule'
        ];
        return booleanAttributes.includes(attrName);
    }
    function domReady() {
        return new Promise(resolve => {
            if (document.readyState == "loading") {
                document.addEventListener("DOMContentLoaded", resolve);
            }
            else {
                resolve();
            }
        });
    }

    function processBindDirective(component, action, el, expression) {
        if (action == null)
            return; // TODO: Throw error on no binding
        if (action == "value") {
            if (expression === undefined && expression.match(/\./).length) {
                expression = '';
            }
            const type = el.type;
            if (type == 'radio') {
                el.value = expression;
            }
            else if (type == 'checkbox') {
                if (Array.isArray(expression)) {
                    el.checked = expression.some(val => val == el.value);
                }
                else {
                    el.checked = !!expression;
                }
                if (typeof expression === 'string') {
                    el.value = expression;
                }
            }
            else if (el.tagName == 'SELECT') {
                const arrayWrappedValue = [].concat(expression).map(value => { return value + ''; });
                Array.from(el.options).forEach(option => {
                    option.selected = arrayWrappedValue.includes(option.value || option.text);
                });
            }
            else {
                if (el.value === expression)
                    return;
                el.value = expression;
            }
        }
        else if (action == "class") {
            if (Array.isArray(expression)) {
                const originalClasses = el.__z_original_classes ?? [];
                el.setAttribute('class', Array.from(new Set([...originalClasses, ...expression])).join(' '));
            }
            else if (typeof expression == 'object') {
                const keysSortedByBooleanValue = Object.keys(expression).sort((a, b) => expression[a] - expression[b]);
                keysSortedByBooleanValue.forEach(classNames => {
                    if (expression[classNames]) {
                        classNames.split(' ').filter(Boolean).forEach(className => el.classList.add(className));
                    }
                    else {
                        classNames.split(' ').filter(Boolean).forEach(className => el.classList.remove(className));
                    }
                });
            }
            else {
                const originalClasses = el.__z_original_classes ?? [];
                const newClasses = expression.split(' ').filter(Boolean);
                el.setAttribute('class', Array.from(new Set([...originalClasses, ...newClasses])).join(' '));
            }
        }
        else {
            if ([null, undefined, false].includes(expression)) {
                el.removeAttribute(action);
            }
            else {
                isBooleanAttr(action) ? el.setAttribute(action, action) : el.setAttribute(action, expression);
            }
        }
    }

    function processIfDirective(component, action, el, expression) {
        if (el.nodeName.toLowerCase() !== "template") {
            console.error('TODO: Implement catching error');
            return;
        }
        const elementHasAlreadyBeenAdded = el.nextElementSibling !== null && el.nextElementSibling.__z_inserted_me === true;
        if (expression && !elementHasAlreadyBeenAdded) {
            console.log('test');
            //@ts-ignore
            const clone = document.importNode(el.content, true);
            //@ts-ignore
            el.parentElement.insertBefore(clone, el.nextElementSibling);
            //@ts-ignore
            component.initializeElements(el.nextElementSibling);
            //@ts-ignore
            el.nextElementSibling.__z_inserted_me = true;
        }
        else if (!expression && elementHasAlreadyBeenAdded && el.nextElementSibling) {
            el.nextElementSibling.remove();
        }
    }

    function processTextDirective(component, action, el, expression) {
        //@ts-ignore
        el.innerText = expression;
    }
    function processHTMLDirective(component, action, el, expression) {
        //@ts-ignore
        el.innerHTML = expression;
    }

    const DEFAULT_DIRECTIVES = {
        'bind': processBindDirective,
        'html': processHTMLDirective,
        'if': processIfDirective,
        'text': processTextDirective
    };
    let DirectiveRegistry = /** @class */ (() => {
        class DirectiveRegistry {
            static registerDirective(directive, handler) {
                // TODO: Check handler doesn't exist 
                this.directives[directive] = handler;
            }
            static getHandler(directive) {
                return this.directives[directive];
            }
            static getHandlerRegex() {
                const keys = Object.keys(this.directives).join('|');
                return new RegExp(`^z-(on|${keys})\\b`);
            }
        }
        DirectiveRegistry.directives = DEFAULT_DIRECTIVES;
        return DirectiveRegistry;
    })();

    class ZComponent {
        constructor(element, parent = null) {
            this.$el = element;
            this.$parent = parent;
            const model = this.getModel();
            model.$el = this.$el;
            model.$parent = this.$parent ? this.$parent.$data : null;
            this.$data = model;
            this.membrane = model.__z_membrane;
            this.initialize();
        }
        findModel(modelName) {
            try {
                return saferEval(modelName, this.$parent && this.$parent.$data ? this.$parent.$data : {});
            }
            catch (e) {
                return observe({}, this.modelUpdated.bind(this));
            }
        }
        getModel() {
            if (this.$el.hasAttribute('z-with')) {
                const model = this.findModel(this.$el.getAttribute('z-with'));
                return !model || !model.__z_membrane ? observe(model, this.modelUpdated.bind(this)).data : model;
            }
            return observe({}, this.modelUpdated.bind(this)).data;
        }
        ownModel() {
            this.$data.__z_components.push(this);
            if (this.$parent)
                this.ownParentModels();
        }
        ownParentModels() {
            let parent = this.$parent;
            while (parent) {
                parent.$data.__z_components.push(this);
                parent = parent.$parent;
            }
        }
        unownModel() {
            this.$data.__z_components = this.$data.__z_components.filter((component) => component != this);
        }
        initialize() {
            this.ownModel();
            this.initializeElements(this.$el);
        }
        //@ts-ignore
        modelUpdated(target, key) {
            this.updateElements(this.$el);
        }
        initializeElements(el) {
            this.skipNestedComponents(el, (node) => {
                if (node.__z_inserted_me)
                    return false;
                this.initializeElement(node);
                return true;
            }, (node) => { });
        }
        skipNestedComponents(el, callback, initializeFn = () => { }) {
            walk(el, (node) => {
                if (node.hasAttribute('z-with') || node.nodeName == "Z-COMPONENT") {
                    if (!node.isSameNode(this.$el)) {
                        if (!node.__z)
                            initializeFn(node);
                        return false;
                    }
                }
                return callback(node);
            });
        }
        initializeElement(el) {
            this.resolveListeners(el);
            if (el.getAttribute('class') != null) {
                //@ts-ignore
                el.__z_original_classes = el.getAttribute('class').split(' ');
            }
            this.resolveBoundAttrs(el, true);
        }
        updateElements(el) {
            this.skipNestedComponents(el, (node) => {
                if (node.isSameNode(this.$el))
                    return;
                this.updateElement(node);
            }, (el) => { });
        }
        updateElement(el) {
            this.resolveBoundAttrs(el);
        }
        resolveListeners(el) {
            const nativeAttrs = getNativeZAttrs(el);
            nativeAttrs.forEach((attr) => {
                switch (attr.type) {
                    case "on":
                        if (attr.action)
                            el.addEventListener(attr.action, (e) => {
                                saferEvalNoReturn(attr.expression, this.$data, {
                                    ...{ '$event': e },
                                    $dispatch: this.getDispatchFunction(el),
                                });
                            });
                        break;
                }
            });
        }
        getDispatchFunction(el) {
            return (event, detail = {}) => {
                el.dispatchEvent(new CustomEvent(event, {
                    detail,
                    bubbles: true,
                }));
            };
        }
        //@ts-ignore
        resolveBoundAttrs(el, initialUpdate = false) {
            const nativeAttrs = getNativeZAttrs(el);
            nativeAttrs.filter(attr => attr.type != null).forEach((attr) => {
                //@ts-ignore
                const handler = DirectiveRegistry.getHandler(attr.type);
                if (handler) {
                    const evaluation = trySaferEval(attr.expression, this.$data);
                    handler(this, attr.action, el, evaluation);
                }
            });
        }
    }

    class ZComponentElement extends HTMLElement {
        constructor() {
            super();
            domReady().then(this.initialize.bind(this));
        }
        async initialize() {
            const parent = this.getParentComponent();
            if (!this.__z && !parent) {
                this.__z = new ZComponent(this);
            }
            else if (!this.__z && parent) {
                await this.parentInitialization(parent);
                this.__z = new ZComponent(this, parent.__z);
            }
        }
        getParentComponent() {
            let node = this.parentElement;
            while (node) {
                if (node.tagName == "Z-COMPONENT")
                    return node;
                node = node.parentElement;
            }
            return null;
        }
        parentInitialization(parent) {
            return new Promise((resolve) => {
                if (parent.__z)
                    return resolve();
                setTimeout(() => this.waitForParent(parent, resolve), 50);
            });
        }
        waitForParent(parent, resolve) {
            if (parent.__z)
                return resolve();
            setTimeout(() => this.waitForParent(parent, resolve), 50);
        }
    }

    let Z = /** @class */ (() => {
        class Z {
            static observe(target) {
                const observable = observe(target, (target, key) => {
                    try {
                        target.__z_components.forEach((component) => component.modelUpdated(target, key));
                    }
                    catch (e) { }
                });
                return observable.data;
            }
            static getDirectiveRegistry() {
                return DirectiveRegistry;
            }
        }
        Z.VERSION = "1.0.0";
        return Z;
    })();
    window.customElements.define('z-component', ZComponentElement);

    return Z;

})));
