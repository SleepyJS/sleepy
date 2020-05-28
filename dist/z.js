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

    const nativeZAttrRegex = /^z-(on|bind|text|html|model|if|for|show|cloak|ref)\b/;
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
        // For the cases when users pass only a function reference to the caller: `x-on:click="foo"`
        // Where "foo" is a function. Also, we'll pass the function the event instance when we call it.
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
        return nativeZAttrRegex.test(attr.name);
    }
    function getNativeZAttrs(el) {
        return Array.from(el.attributes)
            .filter(isNativeZAttr)
            .map((attr) => {
            const name = attr.name;
            const typeMatch = name.match(nativeZAttrRegex);
            const actionMatch = name.match(/:([a-zA-Z\-:]+)/);
            return {
                type: typeMatch ? typeMatch[1] : null,
                action: actionMatch ? actionMatch[1] : null,
                expression: attr.value
            };
        });
    }

    class ZComponent {
        constructor(element) {
            this.$el = element;
            const model = this.getModel();
            this.$data = model;
            this.membrane = model.__z_membrane;
            this.initialize();
        }
        findModel(modelName) {
            try {
                return saferEval(modelName, {});
            }
            catch (e) {
                return observe({}, this.modelUpdated.bind(this));
            }
        }
        getModel() {
            if (this.$el.hasAttribute('z-model')) {
                return this.findModel(this.$el.getAttribute('z-model'));
            }
            return observe({}, this.modelUpdated.bind(this));
        }
        ownModel() {
            this.$data.__z_components.push(this);
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
                this.initializeElement(node);
            }, (node) => node.__z = new ZComponent(node));
        }
        skipNestedComponents(el, callback, initializeFn = () => { }) {
            walk(el, (node) => {
                if (node.hasAttribute('z-model')) {
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
            this.resolveBoundAttrs(el, true);
        }
        updateElements(el) {
            this.skipNestedComponents(el, (node) => {
                if (node.isSameNode(this.$el))
                    return;
                this.updateElement(node);
            }, (el) => el.__z = new ZComponent(el));
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
            nativeAttrs.forEach((attr) => {
                switch (attr.type) {
                    case "text":
                        el.innerHTML = trySaferEval(attr.expression, this.$data);
                        break;
                }
            });
        }
    }

    let Z = /** @class */ (() => {
        class Z {
            async start() {
                this.discover();
            }
            discover() {
                document.querySelectorAll('z-component').forEach(this.initializeComponent);
            }
            initializeComponent(component) {
                component.__z = new ZComponent(component);
            }
            static observe(target) {
                const observable = observe(target, (target, key) => {
                    try {
                        target.__z_components.forEach((component) => component.modelUpdated(target, key));
                    }
                    catch (e) { }
                });
                return observable.data;
            }
        }
        Z.VERSION = "1.0.0";
        return Z;
    })();
    const z = new Z();
    document.addEventListener('DOMContentLoaded', () => z.start());

    return Z;

})));