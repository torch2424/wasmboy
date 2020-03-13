
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var WasmBoyIframe = (function () {
    'use strict';

    function noop() { }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.19.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe,
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe$$1(run$$1, invalidate = noop) {
            const subscriber = [run$$1, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run$$1(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe: subscribe$$1 };
    }

    const isStarted = writable(false);
    const isLoaded = writable(false);
    const isPlaying = writable(false);

    const modalStore = writable(0);
    const hideModal = () => modalStore.set(0);
    const showLoadState = () => modalStore.set(1);
    const showAbout = () => modalStore.set(2);

    const saveState = writable(0);
    const triggerSaveState = () => saveState.update(value => value + 1);

    // Set the current status message
    let statusMessage;
    let statusTimeout;
    let statusReadableSet;
    const status = readable(
      {
        message: statusMessage,
        timeout: statusTimeout
      },
      set => {
        statusReadableSet = set;
        return () => {};
      }
    );
    const setStatus = (message, timeout) => {
      if (!timeout) {
        timeout = 2000;
      }

      if (statusReadableSet) {
        statusReadableSet({
          message,
          timeout
        });
      }
    };

    // Get our search params
    const params = new URLSearchParams(document.location.search.substring(1));
    const playPoster = writable(params.get('play-poster'));
    const romUrl = writable(params.get('rom-url'));
    const romName = writable(params.get('rom-name'));

    /* demo/iframe/components/icons/PlayIcon.svelte generated by Svelte v3.19.2 */

    const file = "demo/iframe/components/icons/PlayIcon.svelte";

    function create_fragment(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M8 5v14l11-7z");
    			attr_dev(path0, "fill", "#fff");
    			add_location(path0, file, 3, 2, 166);
    			attr_dev(path1, "d", "M0 0h24v24H0z");
    			attr_dev(path1, "fill", "none");
    			add_location(path1, file, 4, 2, 207);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "class", "svelte-1cmb9l6");
    			add_location(svg, file, 2, 0, 80);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PlayIcon> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("PlayIcon", $$slots, []);
    	return [];
    }

    class PlayIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PlayIcon",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* demo/iframe/components/PlayPoster.svelte generated by Svelte v3.19.2 */
    const file$1 = "demo/iframe/components/PlayPoster.svelte";

    // (11:2) {#if $playPoster}
    function create_if_block(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "play-poster__image svelte-4p8uqe");
    			if (img.src !== (img_src_value = /*$playPoster*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Wasm boy play poster");
    			add_location(img, file$1, 11, 4, 230);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$playPoster*/ 1 && img.src !== (img_src_value = /*$playPoster*/ ctx[0])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(11:2) {#if $playPoster}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let t0;
    	let div0;
    	let t1;
    	let button;
    	let current;
    	let dispose;
    	let if_block = /*$playPoster*/ ctx[0] && create_if_block(ctx);
    	const playicon = new PlayIcon({ $$inline: true });

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			button = element("button");
    			create_component(playicon.$$.fragment);
    			attr_dev(div0, "class", "play-poster__shade svelte-4p8uqe");
    			add_location(div0, file$1, 14, 2, 319);
    			attr_dev(button, "class", "play-poster__play-button svelte-4p8uqe");
    			add_location(button, file$1, 16, 2, 361);
    			attr_dev(div1, "class", "play-poster svelte-4p8uqe");
    			add_location(div1, file$1, 9, 0, 180);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			append_dev(div1, button);
    			mount_component(playicon, button, null);
    			current = true;
    			dispose = listen_dev(button, "click", handlePlay, false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$playPoster*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div1, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(playicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(playicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			destroy_component(playicon);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function handlePlay() {
    	isStarted.set(true);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $playPoster;
    	validate_store(playPoster, "playPoster");
    	component_subscribe($$self, playPoster, $$value => $$invalidate(0, $playPoster = $$value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PlayPoster> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("PlayPoster", $$slots, []);

    	$$self.$capture_state = () => ({
    		isStarted,
    		playPoster,
    		PlayIcon,
    		handlePlay,
    		$playPoster
    	});

    	return [$playPoster];
    }

    class PlayPoster extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PlayPoster",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const aa={name:"wasmboy-plugin REQUIRED",graphics:()=>{},audio:()=>{},saveState:()=>{},canvas:()=>{},breakpoint:()=>{},ready:()=>{},play:()=>{},pause:()=>{},loadedAndStarted:()=>{}};
    class ba{constructor(){this.plugins={};this.pluginIdCounter=0;}addPlugin(a){if(!a&&"object"!==typeof a)throw Error("Invalid Plugin Object");if(!a.name)throw Error('Added plugin must have a "name" property');const b=this.pluginIdCounter;this.plugins[this.pluginIdCounter]=a;this.pluginIdCounter++;return ()=>{this.removePlugin(b);}}removePlugin(a){delete this.plugins[a];}runHook(a){if(!aa[a.key]||"function"!==typeof aa[a.key])throw Error("No such hook as "+a.key);Object.keys(this.plugins).forEach((b)=>{b=
    this.plugins[b];if(b[a.key]){let c=void 0;try{c=b[a.key].apply(null,a.params);}catch(d){console.error(`There was an error running the '${a.key}' hook, on the ${b.name} plugin.`),console.error(d);}a.callback&&a.callback(c);}});}}
    const m=new ba,r={CONNECT:"CONNECT",INSTANTIATE_WASM:"INSTANTIATE_WASM",CLEAR_MEMORY:"CLEAR_MEMORY",CLEAR_MEMORY_DONE:"CLEAR_MEMORY_DONE",GET_MEMORY:"GET_MEMORY",SET_MEMORY:"SET_MEMORY",SET_MEMORY_DONE:"SET_MEMORY_DONE",GET_CONSTANTS:"GET_CONSTANTS",GET_CONSTANTS_DONE:"GET_CONSTANTS_DONE",CONFIG:"CONFIG",RESET_AUDIO_QUEUE:"RESET_AUDIO_QUEUE",PLAY:"PLAY",BREAKPOINT:"BREAKPOINT",PAUSE:"PAUSE",UPDATED:"UPDATED",CRASHED:"CRASHED",SET_JOYPAD_STATE:"SET_JOYPAD_STATE",AUDIO_LATENCY:"AUDIO_LATENCY",RUN_WASM_EXPORT:"RUN_WASM_EXPORT",
    GET_WASM_MEMORY_SECTION:"GET_WASM_MEMORY_SECTION",GET_WASM_CONSTANT:"GET_WASM_CONSTANT",FORCE_OUTPUT_FRAME:"FORCE_OUTPUT_FRAME",SET_SPEED:"SET_SPEED",IS_GBC:"IS_GBC"},ca={LIB:"LIB",GRAPHICS:"GRAPHICS",MEMORY:"MEMORY",CONTROLLER:"CONTROLLER",AUDIO:"AUDIO"},u={BOOT_ROM:"BOOT_ROM",CARTRIDGE_RAM:"CARTRIDGE_RAM",CARTRIDGE_ROM:"CARTRIDGE_ROM",CARTRIDGE_HEADER:"CARTRIDGE_HEADER",GAMEBOY_MEMORY:"GAMEBOY_MEMORY",PALETTE_MEMORY:"PALETTE_MEMORY",INTERNAL_STATE:"INTERNAL_STATE"};
    function C(a){return a.data?a.data:a}
    class da{constructor(){this.imageDataArray=this.canvasImageData=this.canvasContext=this.canvasElement=this.frameQueueRenderPromise=this.frameQueue=this.updateGraphicsCallback=this.worker=void 0;this.imageDataArrayChanged=!1;}initialize(a,b){this.updateGraphicsCallback=b;this.frameQueue=[];return (async()=>{this.canvasElement=a;this.canvasContext=this.canvasElement.getContext("2d");this.canvasElement.width=160;this.canvasElement.height=144;this.canvasImageData=this.canvasContext.createImageData(this.canvasElement.width,this.canvasElement.height);
    this.canvasElement.style="\n        image-rendering: optimizeSpeed;\n        image-rendering: -moz-crisp-edges;\n        image-rendering: -webkit-optimize-contrast;\n        image-rendering: -o-crisp-edges;\n        image-rendering: pixelated;\n        -ms-interpolation-mode: nearest-neighbor;\n      ";this.canvasContext.clearRect(0,0,this.canvasElement.width,this.canvasElement.height);m.runHook({key:"canvas",params:[this.canvasElement,this.canvasContext,this.canvasImageData],callback:(a)=>{a&&(a.canvasElement&&
    (this.canvasElement=a.canvasElement),a.canvasContext&&(this.canvasContext=a.canvasContext),a.canvasImageData&&(this.canvasImageData=a.canvasImageData));}});this.worker&&await this.worker.postMessage({type:r.GET_CONSTANTS});})()}setWorker(a){this.worker=a;this.worker.addMessageListener((a)=>{a=C(a);switch(a.message.type){case r.UPDATED:this.imageDataArray=new Uint8ClampedArray(a.message.imageDataArrayBuffer),this.imageDataArrayChanged=!0;}});}renderFrame(){this.imageDataArrayChanged&&(this.imageDataArrayChanged=
    !1,this.updateGraphicsCallback&&this.updateGraphicsCallback(this.imageDataArray),m.runHook({key:"graphics",params:[this.imageDataArray],callback:(a)=>{a&&(this.imageDataArray=a);}}),this.canvasImageData.data.set(this.imageDataArray),this.canvasContext.clearRect(0,0,this.canvasElement.width,this.canvasElement.height),this.canvasContext.putImageData(this.canvasImageData,0,0));}}const E=new da;
    function ea(a,b){b=b||{};var c=a.numberOfChannels,d=a.sampleRate;b=b.float32?3:1;var e=3===b?32:16;if(2===c){var f=a.getChannelData(0);a=a.getChannelData(1);for(var g=f.length+a.length,k=new Float32Array(g),l=0,n=0;l<g;)k[l++]=f[n],k[l++]=a[n],n++;f=k;}else f=a.getChannelData(0);k=e/8;l=c*k;a=new ArrayBuffer(44+f.length*k);g=new DataView(a);fa(g,0,"RIFF");g.setUint32(4,36+f.length*k,!0);fa(g,8,"WAVE");fa(g,12,"fmt ");g.setUint32(16,16,!0);g.setUint16(20,b,!0);g.setUint16(22,c,!0);g.setUint32(24,d,
    !0);g.setUint32(28,d*l,!0);g.setUint16(32,l,!0);g.setUint16(34,e,!0);fa(g,36,"data");g.setUint32(40,f.length*k,!0);if(1===b)for(c=44,d=0;d<f.length;d++,c+=2)b=Math.max(-1,Math.min(1,f[d])),g.setInt16(c,0>b?32768*b:32767*b,!0);else for(c=44,d=0;d<f.length;d++,c+=4)g.setFloat32(c,f[d],!0);return a}function fa(a,b,c){for(var d=0;d<c.length;d++)a.setUint8(b+d,c.charCodeAt(d));}
    class ha{constructor(a){this.id=a;this.audioPlaytime=this.audioBuffer=this.audioContext=void 0;this.audioSources=[];this.gainNode=void 0;this.recording=this.libMuted=this.muted=!1;this.recordingAnchor=this.recordingAudioBuffer=this.recordingRightBuffers=this.recordingLeftBuffers=void 0;}createAudioContextIfNone(){this.audioContext||"undefined"===typeof window||(this.audioContext=new (window.AudioContext||window.webkitAudioContext),!0===!!this.audioContext&&(this.gainNode=this.audioContext.createGain()));}getCurrentTime(){this.createAudioContextIfNone();
    if(this.audioContext)return this.audioContext.currentTime}getPlayTime(){return this.audioPlaytime}resumeAudioContext(){this.createAudioContextIfNone();this.audioContext&&"suspended"===this.audioContext.state&&(this.audioContext.resume(),this.audioPlaytime=this.audioContext.currentTime);}playAudio(a,b,c,d,e){if(this.audioContext){b=new Float32Array(b);c=new Float32Array(c);this.audioBuffer=this.audioContext.createBuffer(2,a,44100);this._setSamplesToAudioBuffer(this.audioBuffer,b,c);this.recording&&
    (this.recordingLeftBuffers.push(b),this.recordingRightBuffers.push(c));c=this.audioContext.createBufferSource();c.buffer=this.audioBuffer;c.playbackRate.setValueAtTime(d,this.audioContext.currentTime);var f=c;e&&(e=e(this.audioContext,f,this.id))&&(f=e);m.runHook({key:"audio",params:[this.audioContext,f,this.id],callback:(a)=>{a&&(f.connect(a),f=a);}});this.gainNode&&(f.connect(this.gainNode),f=this.gainNode);f.connect(this.audioContext.destination);e=this.audioContext.currentTime;b=e+.1;this.audioPlaytime=
    this.audioPlaytime||b;this.audioPlaytime<e&&(this.cancelAllAudio(),this.audioPlaytime=b);c.start(this.audioPlaytime);for(this.audioPlaytime+=a/(44100*d);this.audioSources[this.audioSources.length-1]&&this.audioSources[this.audioSources.length-1].playtime<=this.audioPlaytime;)this.audioSources[this.audioSources.length-1].source.stop(),this.audioSources.pop();this.audioSources.push({source:c,playTime:this.audioPlaytime});setTimeout(()=>{this.audioSources.shift();},this.audioPlaytime-this.audioContext.currentTime+
    500);}}cancelAllAudio(a){if(this.audioContext){for(let b=0;b<this.audioSources.length;b++)(a||this.audioSources[b].playTime>this.audioPlaytime)&&this.audioSources[b].source.stop();this.audioSources=[];this.audioPlaytime=this.audioContext.currentTime+.1;}}mute(){this.muted||(this._setGain(0),this.muted=!0);}unmute(){this.muted&&(this._setGain(1),this.muted=!1);}hasRecording(){return !!this.recordingAudioBuffer}startRecording(){this.recording||(this.recording=!0,this.recordingLeftBuffers=[],this.recordingRightBuffers=
    [],this.recordingAudioBuffer=void 0);}stopRecording(){if(this.recording){this.recording=!1;var a=(a)=>{let b=0;a.forEach((a)=>{b+=a.length;});const c=new Float32Array(b);let f=0;a.forEach((a)=>{c.set(a,f);f+=a.length;});return c},b=a(this.recordingLeftBuffers);a=a(this.recordingRightBuffers);this.recordingAudioBuffer=this.audioContext.createBuffer(2,b.length,44100);this._setSamplesToAudioBuffer(this.recordingAudioBuffer,b,a);this.recordingRightBuffer=this.recordingLeftBuffer=void 0;}}downloadRecordingAsWav(a){if(this.recordingAudioBuffer){this.recordingAnchor||
    (this.recordingAnchor=document.createElement("a"),document.body.appendChild(this.recordingAnchor),this.recordingAnchor.style="display: none");var b=ea(this.recordingAudioBuffer);b=new window.Blob([new DataView(b)],{type:"audio/wav"});b=window.URL.createObjectURL(b);this.recordingAnchor.href=b;a=a?`${a}.wav`:`wasmboy-${(new Date).toLocaleDateString(void 0,{month:"2-digit",day:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}.wav`;this.recordingAnchor.download=a;this.recordingAnchor.click();
    window.URL.revokeObjectURL(b);}}getRecordingAsWavBase64EncodedString(){if(this.recordingAudioBuffer){var a=ea(this.recordingAudioBuffer);return `data:audio/wav;base64,${this._arrayBufferToBase64(a)}`}}getRecordingAsAudioBuffer(){return this.recordingAudioBuffer}_libMute(){this._setGain(0);this.libMuted=!0;}_libUnmute(){this.libMuted&&(this._setGain(1),this.libMuted=!1);}_setGain(a){this.createAudioContextIfNone();this.gainNode&&this.gainNode.gain.setValueAtTime(a,this.audioContext.currentTime);}_setSamplesToAudioBuffer(a,
    b,c){a.copyToChannel?(a.copyToChannel(b,0,0),a.copyToChannel(c,1,0)):(a.getChannelData(0).set(b),a.getChannelData(1).set(c));}_arrayBufferToBase64(a){let b="";a=new Uint8Array(a);let c=a.byteLength;for(var d=0;d<c;d++)b+=String.fromCharCode(a[d]);return window.btoa(b)}}
    class la{constructor(){this.updateAudioCallback=this.worker=void 0;this.gbChannels={master:new ha("master"),channel1:new ha("channel1"),channel2:new ha("channel2"),channel3:new ha("channel3"),channel4:new ha("channel4")};this._createAudioContextIfNone();"undefined"!==typeof window&&(this.gbChannels.channel1._libMute(),this.gbChannels.channel2._libMute(),this.gbChannels.channel3._libMute(),this.gbChannels.channel4._libMute());this.averageTimeStretchFps=[];this.speed=1;this.WASMBOY_CHANNEL_4_OUTPUT_LOCATION=
    this.WASMBOY_CHANNEL_3_OUTPUT_LOCATION=this.WASMBOY_CHANNEL_2_OUTPUT_LOCATION=this.WASMBOY_CHANNEL_1_OUTPUT_LOCATION=this.WASMBOY_SOUND_OUTPUT_LOCATION=0;}initialize(a){return (async()=>{this.updateAudioCallback=a;this.averageTimeStretchFps=[];this.speed=1;this._createAudioContextIfNone();this.cancelAllAudio();return this.worker.postMessage({type:r.GET_CONSTANTS})})()}setWorker(a){this.worker=a;this.worker.addMessageListener((a)=>{a=C(a);switch(a.message.type){case r.UPDATED:{this.playAudio(a.message);
    a=0;let b=this.gbChannels.master.getCurrentTime(),d=this.gbChannels.master.getPlayTime();b&&0<b&&(a=d-b);this.worker.postMessageIgnoreResponse({type:r.AUDIO_LATENCY,latency:a});}}});}getAudioChannels(){return this.gbChannels}setSpeed(a){this.speed=a;this.cancelAllAudio(!0);this.resetTimeStretch();}resetTimeStretch(){this.averageTimeStretchFps=[];}playAudio(a){var b=a.fps,c=a.allowFastSpeedStretching;let d=a.numberOfSamples;var e=b||60;const f=Math.abs(b-this.averageTimeStretchFps[this.averageTimeStretchFps.length-
    1]);f&&15<=f&&this.resetTimeStretch();this.averageTimeStretchFps.push(b);171<this.averageTimeStretchFps.length&&this.averageTimeStretchFps.shift();57<=this.averageTimeStretchFps.length&&(e=this.averageTimeStretchFps.reduce((a,b)=>a+b),e=Math.floor(e/this.averageTimeStretchFps.length));b=1;(57>e||c)&&1===this.speed&&(b*=e/60,0>=b&&(b=.01));b*=this.speed;this.gbChannels.master.playAudio(d,a.audioBuffer.left,a.audioBuffer.right,b,this.updateAudioCallback);for(c=0;4>c;c++)e=c+1,a[`channel${e}Buffer`]&&
    this.gbChannels[`channel${e}`].playAudio(d,a[`channel${e}Buffer`].left,a[`channel${e}Buffer`].right,b,this.updateAudioCallback);a=!this.gbChannels.channel1.muted&&!this.gbChannels.channel2.muted&&!this.gbChannels.channel3.muted&&!this.gbChannels.channel4.muted;this.gbChannels.master.muted&&a?(this.gbChannels.master.unmute(),this.gbChannels.channel1._libMute(),this.gbChannels.channel2._libMute(),this.gbChannels.channel3._libMute(),this.gbChannels.channel4._libMute()):this.gbChannels.master.muted||
    a||(this.gbChannels.master.mute(),this.gbChannels.channel1._libUnmute(),this.gbChannels.channel2._libUnmute(),this.gbChannels.channel3._libUnmute(),this.gbChannels.channel4._libUnmute());}resumeAudioContext(){this._applyOnAllChannels("resumeAudioContext");}cancelAllAudio(a){this._applyOnAllChannels("cancelAllAudio",[a]);}_createAudioContextIfNone(){this._applyOnAllChannels("createAudioContextIfNone");}_applyOnAllChannels(a,b){Object.keys(this.gbChannels).forEach((c)=>{this.gbChannels[c][a].apply(this.gbChannels[c],
    b);});}}const G=new la;function ma(a,b){var c=Object.keys(a);if(Object.getOwnPropertySymbols){var d=Object.getOwnPropertySymbols(a);b&&(d=d.filter(function(b){return Object.getOwnPropertyDescriptor(a,b).enumerable}));c.push.apply(c,d);}return c}
    function I(a){for(var b=1;b<arguments.length;b++){var c=null!=arguments[b]?arguments[b]:{};b%2?ma(Object(c),!0).forEach(function(b){var d=c[b];b in a?Object.defineProperty(a,b,{value:d,enumerable:!0,configurable:!0,writable:!0}):a[b]=d;}):Object.getOwnPropertyDescriptors?Object.defineProperties(a,Object.getOwnPropertyDescriptors(c)):ma(Object(c)).forEach(function(b){Object.defineProperty(a,b,Object.getOwnPropertyDescriptor(c,b));});}return a}
    var na="undefined"!==typeof globalThis?globalThis:"undefined"!==typeof window?window:"undefined"!==typeof global?global:"undefined"!==typeof self?self:{};function oa(a,b){return b={exports:{}},a(b,b.exports),b.exports}
    var pa=oa(function(a){(function(){function b(a){return new Promise(function(b,c){a.onsuccess=function(){b(a.result);};a.onerror=function(){c(a.error);};})}function c(a,c,d){var e,f=new Promise(function(f,g){e=a[c].apply(a,d);b(e).then(f,g);});f.request=e;return f}function d(a,b,d){var e=c(a,b,d);return e.then(function(a){if(a)return new n(a,e.request)})}function e(a,b,c){c.forEach(function(c){Object.defineProperty(a.prototype,c,{get:function(){return this[b][c]},set:function(a){this[b][c]=a;}});});}function f(a,
    b,d,e){e.forEach(function(e){e in d.prototype&&(a.prototype[e]=function(){return c(this[b],e,arguments)});});}function g(a,b,c,d){d.forEach(function(d){d in c.prototype&&(a.prototype[d]=function(){return this[b][d].apply(this[b],arguments)});});}function k(a,b,c,e){e.forEach(function(e){e in c.prototype&&(a.prototype[e]=function(){return d(this[b],e,arguments)});});}function l(a){this._index=a;}function n(a,b){this._cursor=a;this._request=b;}function z(a){this._store=a;}function D(a){this._tx=a;this.complete=
    new Promise(function(b,c){a.oncomplete=function(){b();};a.onerror=function(){c(a.error);};a.onabort=function(){c(a.error);};});}function x(a,b,c){this._db=a;this.oldVersion=b;this.transaction=new D(c);}function A(a){this._db=a;}e(l,"_index",["name","keyPath","multiEntry","unique"]);f(l,"_index",IDBIndex,["get","getKey","getAll","getAllKeys","count"]);k(l,"_index",IDBIndex,["openCursor","openKeyCursor"]);e(n,"_cursor",["direction","key","primaryKey","value"]);f(n,"_cursor",IDBCursor,["update","delete"]);
    ["advance","continue","continuePrimaryKey"].forEach(function(a){a in IDBCursor.prototype&&(n.prototype[a]=function(){var c=this,d=arguments;return Promise.resolve().then(function(){c._cursor[a].apply(c._cursor,d);return b(c._request).then(function(a){if(a)return new n(a,c._request)})})});});z.prototype.createIndex=function(){return new l(this._store.createIndex.apply(this._store,arguments))};z.prototype.index=function(){return new l(this._store.index.apply(this._store,arguments))};e(z,"_store",["name",
    "keyPath","indexNames","autoIncrement"]);f(z,"_store",IDBObjectStore,"put add delete clear get getAll getKey getAllKeys count".split(" "));k(z,"_store",IDBObjectStore,["openCursor","openKeyCursor"]);g(z,"_store",IDBObjectStore,["deleteIndex"]);D.prototype.objectStore=function(){return new z(this._tx.objectStore.apply(this._tx,arguments))};e(D,"_tx",["objectStoreNames","mode"]);g(D,"_tx",IDBTransaction,["abort"]);x.prototype.createObjectStore=function(){return new z(this._db.createObjectStore.apply(this._db,
    arguments))};e(x,"_db",["name","version","objectStoreNames"]);g(x,"_db",IDBDatabase,["deleteObjectStore","close"]);A.prototype.transaction=function(){return new D(this._db.transaction.apply(this._db,arguments))};e(A,"_db",["name","version","objectStoreNames"]);g(A,"_db",IDBDatabase,["close"]);["openCursor","openKeyCursor"].forEach(function(a){[z,l].forEach(function(b){a in b.prototype&&(b.prototype[a.replace("open","iterate")]=function(){var b=Array.prototype.slice.call(arguments),c=b[b.length-1],
    d=this._store||this._index,e=d[a].apply(d,b.slice(0,-1));e.onsuccess=function(){c(e.result);};});});});[l,z].forEach(function(a){a.prototype.getAll||(a.prototype.getAll=function(a,b){var c=this,d=[];return new Promise(function(e){c.iterateCursor(a,function(a){a?(d.push(a.value),void 0!==b&&d.length==b?e(d):a.continue()):e(d);});})});});a.exports={open:function(a,b,d){a=c(indexedDB,"open",[a,b]);var e=a.request;e&&(e.onupgradeneeded=function(a){d&&d(new x(e.result,a.oldVersion,e.transaction));});return a.then(function(a){return new A(a)})},
    delete:function(a){return c(indexedDB,"deleteDatabase",[a])}};a.exports.default=a.exports;})();}),qa=oa(function(a){a.exports="undefined"!=typeof indexedDB?pa:{open:function(){return Promise.reject("IDB requires a browser environment")},delete:function(){return Promise.reject("IDB requires a browser environment")}};});let ta=!1;
    if("undefined"!==typeof window){const a=qa.open("wasmboy",1,(b)=>{b.createObjectStore("keyval");});ta={get(b){return a.then((a)=>a.transaction("keyval").objectStore("keyval").get(b))},set(b,c){return a.then((a)=>{a=a.transaction("keyval","readwrite");a.objectStore("keyval").put(c,b);return a.complete})},delete(b){return a.then((a)=>{a=a.transaction("keyval","readwrite");a.objectStore("keyval").delete(b);return a.complete})},clear(){return a.then((a)=>{a=a.transaction("keyval","readwrite");a.objectStore("keyval").clear();
    return a.complete})},keys(){return a.then((a)=>{a=a.transaction("keyval");const b=[],d=a.objectStore("keyval");(d.iterateKeyCursor||d.iterateCursor).call(d,(a)=>{a&&(b.push(a.key),a.continue());});return a.complete.then(()=>b)})}};}else ta={get:()=>{},set:()=>{},delete:()=>{},clear:()=>{},keys:()=>{}};const J=ta;
    let L={parse:function(a){let b=L.bin.readUshort,c=L.bin.readUint;var d;let e={};a=new Uint8Array(a);for(d=a.length-4;101010256!=c(a,d);)d--;d=d+4+4;let f=b(a,d);d+=2;b(a,d);d+=2;c(a,d);d+=4;d=c(a,d);for(let g=0;g<f;g++){c(a,d);d+=4;d+=4;d+=4;d+=4;c(a,d);d+=4;let f=c(a,d);d+=4;let g=c(a,d);d+=4;let n=b(a,d),z=b(a,d+2),D=b(a,d+4);d+=6;d+=8;let x=c(a,d);d+=4;d+=n+z+D;L._readLocal(a,x,e,f,g);}return e},_readLocal:function(a,b,c,d,e){var f=L.bin.readUshort,g=L.bin.readUint;g(a,b);b+=4;f(a,b);b+=2;f(a,b);
    b+=2;let k=f(a,b);b+=2;g(a,b);b+=4;g(a,b);b=b+4+8;g=f(a,b);b+=2;let l=f(a,b);b+=2;f=L.bin.readUTF8(a,b,g);b=b+g+l;a=new Uint8Array(a.buffer,b);if(0==k)c[f]=new Uint8Array(a.buffer.slice(b,b+d));else if(8==k)b=new Uint8Array(e),L.inflateRaw(a,b),c[f]=b;else throw"unknown compression method: "+k;},inflateRaw:function(a,b){return L.F.inflate(a,b)},inflate:function(a,b){return L.inflateRaw(new Uint8Array(a.buffer,a.byteOffset+2,a.length-6),b)},deflate:function(a,b){null==b&&(b={level:6});let c=0,d=new Uint8Array(50+
    Math.floor(1.1*a.length));d[c]=120;d[c+1]=156;c=L.F.deflateRaw(a,d,c+2,b.level);a=L.adler(a,0,a.length);d[c+0]=a>>>24&255;d[c+1]=a>>>16&255;d[c+2]=a>>>8&255;d[c+3]=a>>>0&255;return new Uint8Array(d.buffer,0,c+4)},deflateRaw:function(a,b){null==b&&(b={level:6});let c=new Uint8Array(50+Math.floor(1.1*a.length)),d;d=L.F.deflateRaw(a,c,d,b.level);return new Uint8Array(c.buffer,0,d)},encode:function(a){var b=0;let c=L.bin.writeUint,d=L.bin.writeUshort;var e={};for(var f in a){var g=!L._noNeed(f),k=a[f];
    let b=L.crc.crc(k,0,k.length);e[f]={cpr:g,usize:k.length,crc:b,file:g?L.deflateRaw(k):k};}for(let a in e)b+=e[a].file.length+30+46+2*L.bin.sizeUTF8(a);a=new Uint8Array(b+22);b=0;f=[];for(var l in e)g=e[l],f.push(b),b=L._writeHeader(a,b,l,g,0);l=0;g=b;for(let c in e)k=e[c],f.push(b),b=L._writeHeader(a,b,c,k,1,f[l++]);e=b-g;c(a,b,101010256);b=b+4+4;d(a,b,l);b+=2;d(a,b,l);b+=2;c(a,b,e);c(a,b+4,g);return a.buffer},_noNeed:function(a){a=a.split(".").pop().toLowerCase();return -1!="png,jpg,jpeg,zip".indexOf(a)},
    _writeHeader:function(a,b,c,d,e,f){let g=L.bin.writeUint,k=L.bin.writeUshort,l=d.file;g(a,b,0==e?67324752:33639248);b+=4;1==e&&(b+=2);k(a,b,20);b+=2;k(a,b,0);b+=2;k(a,b,d.cpr?8:0);b+=2;g(a,b,0);b+=4;g(a,b,d.crc);b+=4;g(a,b,l.length);b+=4;g(a,b,d.usize);b+=4;k(a,b,L.bin.sizeUTF8(c));b+=2;k(a,b,0);b+=2;1==e&&(b=b+2+2+6,g(a,b,f),b+=4);c=L.bin.writeUTF8(a,b,c);b+=c;0==e&&(a.set(l,b),b+=l.length);return b}};var ua;
    {let a=new Uint32Array(256);for(let b=0;256>b;b++){let c=b;for(let a=0;8>a;a++)c=c&1?3988292384^c>>>1:c>>>1;a[b]=c;}ua=a;}L.crc={table:ua,update:function(a,b,c,d){for(let e=0;e<d;e++)a=L.crc.table[(a^b[c+e])&255]^a>>>8;return a},crc:function(a,b,c){return L.crc.update(4294967295,a,b,c)^4294967295}};L.adler=function(a,b,c){let d=1,e=0,f=b;for(b+=c;f<b;){for(c=Math.min(f+5552,b);f<c;)d+=a[f++],e+=d;d%=65521;e%=65521;}return e<<16|d};
    L.bin={readUshort:function(a,b){return a[b]|a[b+1]<<8},writeUshort:function(a,b,c){a[b]=c&255;a[b+1]=c>>8&255;},readUint:function(a,b){return 16777216*a[b+3]+(a[b+2]<<16|a[b+1]<<8|a[b])},writeUint:function(a,b,c){a[b]=c&255;a[b+1]=c>>8&255;a[b+2]=c>>16&255;a[b+3]=c>>24&255;},readASCII:function(a,b,c){let d="";for(let e=0;e<c;e++)d+=String.fromCharCode(a[b+e]);return d},writeASCII:function(a,b,c){for(let d=0;d<c.length;d++)a[b+d]=c.charCodeAt(d);},pad:function(a){return 2>a.length?"0"+a:a},readUTF8:function(a,
    b,c){let d="",e;for(let e=0;e<c;e++)d+="%"+L.bin.pad(a[b+e].toString(16));try{e=decodeURIComponent(d);}catch(f){return L.bin.readASCII(a,b,c)}return e},writeUTF8:function(a,b,c){let d=c.length,e=0;for(let f=0;f<d;f++){let d=c.charCodeAt(f);if(0==(d&4294967168))a[b+e]=d,e++;else if(0==(d&4294965248))a[b+e]=192|d>>6,a[b+e+1]=128|d>>0&63,e+=2;else if(0==(d&4294901760))a[b+e]=224|d>>12,a[b+e+1]=128|d>>6&63,a[b+e+2]=128|d>>0&63,e+=3;else if(0==(d&4292870144))a[b+e]=240|d>>18,a[b+e+1]=128|d>>12&63,a[b+e+
    2]=128|d>>6&63,a[b+e+3]=128|d>>0&63,e+=4;else throw"e";}return e},sizeUTF8:function(a){let b=a.length,c=0;for(let d=0;d<b;d++){let b=a.charCodeAt(d);if(0==(b&4294967168))c++;else if(0==(b&4294965248))c+=2;else if(0==(b&4294901760))c+=3;else if(0==(b&4292870144))c+=4;else throw"e";}return c}};L.F={};
    L.F.deflateRaw=function(a,b,c,d){var e=[[0,0,0,0,0],[4,4,8,4,0],[4,5,16,8,0],[4,6,16,16,0],[4,10,16,32,0],[8,16,32,32,0],[8,16,128,128,0],[8,32,128,256,0],[32,128,258,1024,1],[32,258,258,4096,1]][d];let f=L.F.U,g=L.F._goodIndex;var k=L.F._putsE;let l=0;c<<=3;let n=0,z=a.length;if(0==d){for(;l<z;)e=Math.min(65535,z-l),k(b,c,l+e==z?1:0),c=L.F._copyExact(a,l,e,b,c+8),l+=e;return c>>>3}k=f.lits;d=f.strt;let D=f.prev,x=0,A=0,t=0,w=0;let v=0;2<z&&(v=L.F._hash(a,0),d[v]=0);for(l=0;l<z;l++){var B=v;if(l+
    1<z-2){v=L.F._hash(a,l+1);var p=l+1&32767;D[p]=d[v];d[v]=p;}if(n<=l){if(14E3<x||26697<A)n<l&&(k[x]=l-n,x+=2,n=l),c=L.F._writeBlock(l==z-1||n==z?1:0,k,x,w,a,t,l-t,b,c),x=A=w=0,t=l;p=0;l<z-2&&(p=L.F._bestMatch(a,l,D,B,Math.min(e[2],z-l),e[3]));if(0!=p){B=p>>>16;p&=65535;let a=g(B,f.of0);f.lhst[257+a]++;let b=g(p,f.df0);f.dhst[b]++;w+=f.exb[a]+f.dxb[b];k[x]=B<<23|l-n;k[x+1]=p<<16|a<<8|b;x+=2;n=l+B;}else f.lhst[a[l]]++;A++;}}if(t!=l||0==a.length)n<l&&(k[x]=l-n,x+=2),c=L.F._writeBlock(1,k,x,w,a,t,l-t,b,c);
    for(;0!=(c&7);)c++;return c>>>3};L.F._bestMatch=function(a,b,c,d,e,f){var g=b&32767;let k=c[g],l=g-k+32768&32767;if(k==g||d!=L.F._hash(a,b-l))return 0;let n=d=0,z=Math.min(32767,b);for(;l<=z&&0!=--f&&k!=g;){if(0==d||a[b+d]==a[b+d-l])if(g=L.F._howLong(a,b,l),g>d){d=g;n=l;if(d>=e)break;l+2<g&&(g=l+2);let a=0;for(let d=0;d<g-2;d++){let e=b-l+d+32768&32767,f=e-c[e]+32768&32767;f>a&&(a=f,k=e);}}g=k;k=c[g];l+=g-k+32768&32767;}return d<<16|n};
    L.F._howLong=function(a,b,c){if(a[b]!=a[b-c]||a[b+1]!=a[b+1-c]||a[b+2]!=a[b+2-c])return 0;let d=b,e=Math.min(a.length,b+258);for(b+=3;b<e&&a[b]==a[b-c];)b++;return b-d};L.F._hash=function(a,b){return (a[b]<<8|a[b+1])+(a[b+2]<<4)&65535};L.saved=0;
    L.F._writeBlock=function(a,b,c,d,e,f,g,k,l){let n=L.F.U,z=L.F._putsF,D=L.F._putsE;let x,A,t,w;n.lhst[256]++;var v=L.F.getTrees();var B=v[0];x=v[1];A=v[2];t=v[3];w=v[4];var p=v[5];var M=v[6];v=v[7];var H=(0==(l+3&7)?0:8-(l+3&7))+32+(g<<3);let O=d+L.F.contSize(n.fltree,n.lhst)+L.F.contSize(n.fdtree,n.dhst);d=d+L.F.contSize(n.ltree,n.lhst)+L.F.contSize(n.dtree,n.dhst);d+=14+3*p+L.F.contSize(n.itree,n.ihst)+(2*n.ihst[16]+3*n.ihst[17]+7*n.ihst[18]);for(var F=0;286>F;F++)n.lhst[F]=0;for(F=0;30>F;F++)n.dhst[F]=
    0;for(F=0;19>F;F++)n.ihst[F]=0;H=H<O&&H<d?0:O<d?1:2;z(k,l,a);z(k,l+1,H);l+=3;if(0==H){for(;0!=(l&7);)l++;l=L.F._copyExact(e,f,g,k,l);}else{let d,F;1==H&&(d=n.fltree,F=n.fdtree);if(2==H){L.F.makeCodes(n.ltree,B);L.F.revCodes(n.ltree,B);L.F.makeCodes(n.dtree,x);L.F.revCodes(n.dtree,x);L.F.makeCodes(n.itree,A);L.F.revCodes(n.itree,A);d=n.ltree;F=n.dtree;D(k,l,t-257);l+=5;D(k,l,w-1);l+=5;D(k,l,p-4);l+=4;for(a=0;a<p;a++)D(k,l+3*a,n.itree[(n.ordr[a]<<1)+1]);l=L.F._codeTiny(M,n.itree,k,l+3*p);l=L.F._codeTiny(v,
    n.itree,k,l);}for(p=0;p<c;p+=2){a=b[p];M=a>>>23;for(a=f+(a&8388607);f<a;)l=L.F._writeLit(e[f++],d,k,l);0!=M&&(B=b[p+1],a=B>>16,g=B>>8&255,B&=255,l=L.F._writeLit(257+g,d,k,l),D(k,l,M-n.of0[g]),l+=n.exb[g],l=L.F._writeLit(B,F,k,l),z(k,l,a-n.df0[B]),l+=n.dxb[B],f+=M);}l=L.F._writeLit(256,d,k,l);}return l};L.F._copyExact=function(a,b,c,d,e){let f=e>>>3;d[f]=c;d[f+1]=c>>>8;d[f+2]=255-d[f];d[f+3]=255-d[f+1];f+=4;d.set(new Uint8Array(a.buffer,b,c),f);return e+(c+4<<3)};
    L.F.getTrees=function(){let a=L.F.U,b=L.F._hufTree(a.lhst,a.ltree,15),c=L.F._hufTree(a.dhst,a.dtree,15),d=[],e=L.F._lenCodes(a.ltree,d),f=[],g=L.F._lenCodes(a.dtree,f);for(var k=0;k<d.length;k+=2)a.ihst[d[k]]++;for(k=0;k<f.length;k+=2)a.ihst[f[k]]++;k=L.F._hufTree(a.ihst,a.itree,7);let l=19;for(;4<l&&0==a.itree[(a.ordr[l-1]<<1)+1];)l--;return [b,c,k,e,g,l,d,f]};L.F.getSecond=function(a){let b=[];for(let c=0;c<a.length;c+=2)b.push(a[c+1]);return b};
    L.F.nonZero=function(a){let b="";for(let c=0;c<a.length;c+=2)0!=a[c+1]&&(b+=(c>>1)+",");return b};L.F.contSize=function(a,b){let c=0;for(let d=0;d<b.length;d++)c+=b[d]*a[(d<<1)+1];return c};L.F._codeTiny=function(a,b,c,d){for(let e=0;e<a.length;e+=2){let f=a[e],g=a[e+1];d=L.F._writeLit(f,b,c,d);let k=16==f?2:17==f?3:7;15<f&&(L.F._putsE(c,d,g,k),d+=k);}return d};
    L.F._lenCodes=function(a,b){let c=a.length;for(;2!=c&&0==a[c-1];)c-=2;for(let f=0;f<c;f+=2){var d=a[f+1],e=f+3<c?a[f+3]:-1;let g=f+5<c?a[f+5]:-1,k=0==f?-1:a[f-1];if(0==d&&e==d&&g==d){for(e=f+5;e+2<c&&a[e+2]==d;)e+=2;d=Math.min(e+1-f>>>1,138);11>d?b.push(17,d-3):b.push(18,d-11);f+=2*d-2;}else if(d==k&&e==d&&g==d){for(e=f+5;e+2<c&&a[e+2]==d;)e+=2;d=Math.min(e+1-f>>>1,6);b.push(16,d-3);f+=2*d-2;}else b.push(d,0);}return c>>>1};
    L.F._hufTree=function(a,b,c){var d=[],e=a.length,f=b.length,g=0;for(g=0;g<f;g+=2)b[g]=0,b[g+1]=0;for(g=0;g<e;g++)0!=a[g]&&d.push({lit:g,f:a[g]});a=d.length;e=d.slice(0);if(0==a)return 0;if(1==a)return c=d[0].lit,d=0==c?1:0,b[(c<<1)+1]=1,b[(d<<1)+1]=1;d.sort(function(a,b){return a.f-b.f});g=d[0];f=d[1];let k=0,l=1,n=2;for(d[0]={lit:-1,f:g.f+f.f,l:g,r:f,d:0};l!=a-1;)g=k!=l&&(n==a||d[k].f<d[n].f)?d[k++]:d[n++],f=k!=l&&(n==a||d[k].f<d[n].f)?d[k++]:d[n++],d[l++]={lit:-1,f:g.f+f.f,l:g,r:f};d=L.F.setDepth(d[l-
    1],0);d>c&&(L.F.restrictDepth(e,c,d),d=c);for(g=0;g<a;g++)b[(e[g].lit<<1)+1]=e[g].d;return d};L.F.setDepth=function(a,b){return -1!=a.lit?a.d=b:Math.max(L.F.setDepth(a.l,b+1),L.F.setDepth(a.r,b+1))};L.F.restrictDepth=function(a,b,c){let d=0,e=1<<c-b,f=0;a.sort(function(a,b){return b.d==a.d?a.f-b.f:b.d-a.d});for(d=0;d<a.length;d++)if(a[d].d>b){let g=a[d].d;a[d].d=b;f+=e-(1<<c-g);}else break;for(f>>>=c-b;0<f;)c=a[d].d,c<b?(a[d].d++,f-=1<<b-c-1):d++;for(;0<=d;d--)a[d].d==b&&0>f&&(a[d].d--,f++);0!=f&&console.log("debt left");};
    L.F._goodIndex=function(a,b){let c=0;b[c|16]<=a&&(c|=16);b[c|8]<=a&&(c|=8);b[c|4]<=a&&(c|=4);b[c|2]<=a&&(c|=2);b[c|1]<=a&&(c|=1);return c};L.F._writeLit=function(a,b,c,d){L.F._putsF(c,d,b[a<<1]);return d+b[(a<<1)+1]};
    L.F.inflate=function(a,b){if(3==a[0]&&0==a[1])return b?b:new Uint8Array(0);var c=L.F;let d=c._bitsF,e=c._bitsE,f=c._decodeTiny,g=c.makeCodes,k=c.codes2map,l=c._get17;c=c.U;let n=null==b;n&&(b=new Uint8Array(a.length>>2<<3));let z=0;var D,x;let A=x=D=0;for(var t=0,w;0==z;){z=d(a,t,1);var v=d(a,t+1,2);t+=3;if(0==v)0!=(t&7)&&(t+=8-(t&7)),t=(t>>>3)+4,v=a[t-4]|a[t-3]<<8,n&&(b=L.F._check(b,A+v)),b.set(new Uint8Array(a.buffer,a.byteOffset+t,v),A),t=t+v<<3,A+=v;else{n&&(b=L.F._check(b,A+131072));if(1==v){var B=
    c.flmap;w=c.fdmap;D=511;x=31;}if(2==v){D=e(a,t,5)+257;x=e(a,t+5,5)+1;B=e(a,t+10,4)+4;t+=14;for(w=0;38>w;w+=2)c.itree[w]=0,c.itree[w+1]=0;v=1;for(w=0;w<B;w++){var p=e(a,t+3*w,3);c.itree[(c.ordr[w]<<1)+1]=p;p>v&&(v=p);}t+=3*B;g(c.itree,v);k(c.itree,v,c.imap);B=c.lmap;w=c.dmap;p=f(c.imap,(1<<v)-1,D,a,t,c.ltree);D=(1<<(p>>>24))-1;t+=p&16777215;g(c.ltree,p>>>24);k(c.ltree,p>>>24,B);v=f(c.imap,(1<<v)-1,x,a,t,c.dtree);x=(1<<(v>>>24))-1;t+=v&16777215;g(c.dtree,v>>>24);k(c.dtree,v>>>24,w);}for(;;)if(v=B[l(a,
    t)&D],t+=v&15,p=v>>>4,0==p>>>8)b[A++]=p;else if(256==p)break;else{v=A+p-254;264<p&&(p=c.ldef[p-257],v=A+(p>>>3)+e(a,t,p&7),t+=p&7);p=w[l(a,t)&x];t+=p&15;p=c.ddef[p>>>4];let f=(p>>>4)+d(a,t,p&15);for(t+=p&15;A<v;)b[A]=b[A++-f],b[A]=b[A++-f],b[A]=b[A++-f],b[A]=b[A++-f];A=v;}}}return b.length==A?b:b.slice(0,A)};L.F._check=function(a,b){let c=a.length;if(b<=c)return a;b=new Uint8Array(c<<1);for(let d=0;d<c;d+=4)b[d]=a[d],b[d+1]=a[d+1],b[d+2]=a[d+2],b[d+3]=a[d+3];return b};
    L.F._decodeTiny=function(a,b,c,d,e,f){let g=e,k=L.F._bitsE,l=L.F._get17,n=c<<1,z=c=0;for(;c<n;){var D=a[l(d,e)&b];e+=D&15;var x=D>>>4;if(15>=x)f[c]=0,f[c+1]=x,x>z&&(z=x),c+=2;else{let a=D=0;16==x?(a=3+k(d,e,2)<<1,e+=2,D=f[c-1]):17==x?(a=3+k(d,e,3)<<1,e+=3):18==x&&(a=11+k(d,e,7)<<1,e+=7);for(x=c+a;c<x;)f[c]=0,f[c+1]=D,c+=2;}}for(a=f.length;c<a;)f[c+1]=0,c+=2;return z<<24|e-g};
    L.F.makeCodes=function(a,b){var c=L.F.U;let d=a.length;var e;let f;var g=c.bl_count;for(e=0;e<=b;e++)g[e]=0;for(e=1;e<d;e+=2)g[a[e]]++;c=c.next_code;e=0;g[0]=0;for(f=1;f<=b;f++)e=e+g[f-1]<<1,c[f]=e;for(b=0;b<d;b+=2)g=a[b+1],0!=g&&(a[b]=c[g],c[g]++);};L.F.codes2map=function(a,b,c){let d=a.length,e=L.F.U.rev15;for(let k=0;k<d;k+=2)if(0!=a[k+1]){var f=a[k+1];let d=k>>1<<4|f;var g=b-f;f=a[k]<<g;for(g=f+(1<<g);f!=g;)c[e[f]>>>15-b]=d,f++;}};
    L.F.revCodes=function(a,b){let c=L.F.U.rev15,d=15-b;for(let e=0;e<a.length;e+=2)a[e]=c[a[e]<<b-a[e+1]]>>>d;};L.F._putsE=function(a,b,c){c<<=b&7;b>>>=3;a[b]|=c;a[b+1]|=c>>>8;};L.F._putsF=function(a,b,c){c<<=b&7;b>>>=3;a[b]|=c;a[b+1]|=c>>>8;a[b+2]|=c>>>16;};L.F._bitsE=function(a,b,c){return (a[b>>>3]|a[(b>>>3)+1]<<8)>>>(b&7)&(1<<c)-1};L.F._bitsF=function(a,b,c){return (a[b>>>3]|a[(b>>>3)+1]<<8|a[(b>>>3)+2]<<16)>>>(b&7)&(1<<c)-1};
    L.F._get17=function(a,b){return (a[b>>>3]|a[(b>>>3)+1]<<8|a[(b>>>3)+2]<<16)>>>(b&7)};L.F._get25=function(a,b){return (a[b>>>3]|a[(b>>>3)+1]<<8|a[(b>>>3)+2]<<16|a[(b>>>3)+3]<<24)>>>(b&7)};
    L.F.U={next_code:new Uint16Array(16),bl_count:new Uint16Array(16),ordr:[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],of0:[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,999,999,999],exb:[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0],ldef:new Uint16Array(32),df0:[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,65535,65535],dxb:[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,
    10,11,11,12,12,13,13,0,0],ddef:new Uint32Array(32),flmap:new Uint16Array(512),fltree:[],fdmap:new Uint16Array(32),fdtree:[],lmap:new Uint16Array(32768),ltree:[],dmap:new Uint16Array(32768),dtree:[],imap:new Uint16Array(512),itree:[],rev15:new Uint16Array(32768),lhst:new Uint32Array(286),dhst:new Uint32Array(30),ihst:new Uint32Array(19),lits:new Uint32Array(15E3),strt:new Uint16Array(65536),prev:new Uint16Array(32768)};
    {let a=L.F.U;for(let b=0;32768>b;b++){let c=b;c=(c&2863311530)>>>1|(c&1431655765)<<1;c=(c&3435973836)>>>2|(c&858993459)<<2;c=(c&4042322160)>>>4|(c&252645135)<<4;c=(c&4278255360)>>>8|(c&16711935)<<8;a.rev15[b]=(c>>>16|c<<16)>>>17;}for(let b=0;32>b;b++)a.ldef[b]=a.of0[b]<<3|a.exb[b],a.ddef[b]=a.df0[b]<<4|a.dxb[b];let b=0;for(;143>=b;b++)a.fltree.push(0,8);for(;255>=b;b++)a.fltree.push(0,9);for(;279>=b;b++)a.fltree.push(0,7);for(;287>=b;b++)a.fltree.push(0,8);L.F.makeCodes(a.fltree,9);L.F.codes2map(a.fltree,
    9,a.flmap);L.F.revCodes(a.fltree,9);for(b=0;32>b;b++)a.fdtree.push(0,5);L.F.makeCodes(a.fdtree,5);L.F.codes2map(a.fdtree,5,a.fdmap);L.F.revCodes(a.fdtree,5);for(let b=0;19>b;b++)a.itree.push(0,0);for(let b=0;286>b;b++)a.ltree.push(0,0);for(let b=0;30>b;b++)a.dtree.push(0,0);}
    const xa=(a,b)=>(async()=>{if(ArrayBuffer.isView(a)&&a.constructor===Uint8Array)return {ROM:a};if("object"===typeof a&&a.size){var c=await va(a);a.name.toLowerCase().endsWith(".zip")&&(c=await wa(c));return {ROM:c,name:a.name}}c={};b&&b.headers&&(c.headers=b.headers);var d=await fetch(a,c).then((a)=>a.ok?a.arrayBuffer():Promise.reject(a));c=a;b&&b.fileName&&(c=b.fileName);d=new Uint8Array(d);c.toLowerCase().endsWith(".zip")&&(d=await wa(d));return {ROM:d,name:c}})(),va=async(a)=>await new Promise((b)=>
    {const c=new FileReader;c.onload=()=>{const a=new Uint8Array(c.result);b(a);};c.readAsArrayBuffer(a);}),wa=async(a)=>{const b=await L.parse(a);let c=!1;Object.keys(b).some((a)=>{const d=a.toLowerCase();return d.includes(".gb")||d.includes(".gbc")||d.includes(".bin")?(c=b[a],!0):!1});if(!c)throw Error("Could not find a ROM in zip...");return c},ya={wasmboyMemory:{wasmBoyInternalState:[],wasmBoyPaletteMemory:[],gameBoyMemory:[],cartridgeRam:[]},date:void 0,isAuto:void 0};
    function Da(){let a=Object.assign({},ya);a.wasmboyMemory.wasmBoyInternalState=this.internalState;a.wasmboyMemory.wasmBoyPaletteMemory=this.paletteMemory;a.wasmboyMemory.gameBoyMemory=this.gameboyMemory;a.wasmboyMemory.cartridgeRam=this.cartridgeRam;a.date=Date.now();a.isAuto=!1;this.saveStateCallback&&this.saveStateCallback(a);m.runHook({key:"saveState",params:[a]});return a}
    function Ea(){if(!this.internalState)return null;const a=Da.bind(this)(),b=Object.keys(a.wasmboyMemory);for(let c=0;c<b.length;c++)a.wasmboyMemory[b[c]]=Array.prototype.slice.call(a.wasmboyMemory[b[c]]);a.isAuto=!0;localStorage.setItem(this.WASMBOY_UNLOAD_STORAGE,JSON.stringify({header:Array.prototype.slice.call(this.cartridgeHeader),cartridgeRam:Array.prototype.slice.call(this.cartridgeRam),saveState:a}));return null}
    function Fa(){return (async()=>{var a=localStorage.getItem(this.WASMBOY_UNLOAD_STORAGE);if(a){var b=JSON.parse(a);localStorage.removeItem(this.WASMBOY_UNLOAD_STORAGE);a=new Uint8Array(b.header);const c=new Uint8Array(b.cartridgeRam);if(b=b.saveState){const a=Object.keys(b.wasmboyMemory);for(let c=0;c<a.length;c++)b.wasmboyMemory[a[c]]=new Uint8Array(b.wasmboyMemory[a[c]]);}await this.saveCartridgeRam(a,c);await this.saveState(a,b);}})()}
    function Ga(){window.addEventListener("beforeunload",()=>{Ea.bind(this)();},!1);window.addEventListener("unload",()=>{Ea.bind(this)();},!1);window.addEventListener("pagehide",()=>{Ea.bind(this)();},!1);document.addEventListener("visibilitychange",()=>{"hidden"===document.visibilityState&&Ea.bind(this)();});return Fa.bind(this)()}
    class Ha{constructor(){this.saveStateCallback=this.maxNumberOfAutoSaveStates=this.worker=void 0;this.loadedCartridgeMemoryState={ROM:!1,RAM:!1,BOOT:!1};this.internalState=this.paletteMemory=this.gameboyMemory=this.cartridgeRam=this.cartridgeHeader=this.cartridgeRomFileName=this.cartridgeRom=this.bootRom=void 0;this.WASMBOY_UNLOAD_STORAGE="WASMBOY_UNLOAD_STORAGE";this.WASMBOY_PALETTE_MEMORY_LOCATION=this.WASMBOY_PALETTE_MEMORY_SIZE=this.WASMBOY_INTERNAL_MEMORY_LOCATION=this.WASMBOY_INTERNAL_MEMORY_SIZE=
    this.WASMBOY_INTERNAL_STATE_LOCATION=this.WASMBOY_INTERNAL_STATE_SIZE=this.WASMBOY_GAME_RAM_BANKS_LOCATION=this.WASMBOY_GAME_BYTES_LOCATION=0;this.SUPPORTED_BOOT_ROM_TYPES={GB:"GB",GBC:"GBC"};}initialize(a,b,c){this.maxNumberOfAutoSaveStates=b;this.saveStateCallback=c;return (async()=>{await this._initializeConstants();a||await Ga.call(this);})()}setWorker(a){this.worker=a;this.worker.addMessageListener((a)=>{a=C(a);switch(a.message.type){case r.UPDATED:{const b=Object.keys(a.message);delete b.type;
    b.includes(u.BOOT_ROM)&&(this.bootRom=new Uint8Array(a.message[u.BOOT_ROM]));b.includes(u.CARTRIDGE_ROM)&&(this.cartridgeRom=new Uint8Array(a.message[u.CARTRIDGE_ROM]));b.includes(u.CARTRIDGE_RAM)&&(this.cartridgeRam=new Uint8Array(a.message[u.CARTRIDGE_RAM]));b.includes(u.GAMEBOY_MEMORY)&&(this.gameboyMemory=new Uint8Array(a.message[u.GAMEBOY_MEMORY]));b.includes(u.PALETTE_MEMORY)&&(this.paletteMemory=new Uint8Array(a.message[u.PALETTE_MEMORY]));b.includes(u.INTERNAL_STATE)&&(this.internalState=
    new Uint8Array(a.message[u.INTERNAL_STATE]));}}});}getSavedMemory(){return (async()=>{const a=[],b=await J.keys();for(let c=0;c<b.length;c++){const d=await J.get(b[c]);a.push(d);}return a})()}getLoadedCartridgeMemoryState(){return this.loadedCartridgeMemoryState}clearMemory(){return this.worker.postMessage({type:r.CLEAR_MEMORY}).then(()=>{this.loadedCartridgeMemoryState.ROM=!1;this.loadedCartridgeMemoryState.RAM=!1;this.internalState=this.paletteMemory=this.gameboyMemory=this.cartridgeRam=this.cartridgeHeader=
    this.cartridgeRom=void 0;})}isValidBootROMType(a){return Object.keys(this.SUPPORTED_BOOT_ROM_TYPES).some((b)=>this.SUPPORTED_BOOT_ROM_TYPES[b]===a)}async addBootROM(a,b,c,d){a=a.toUpperCase();if(!this.isValidBootROMType(a))throw Error("Invalid Boot ROM type");b=await xa(b,c);d&&(delete d.name,delete d.ROM);c="Game Boy";this.SUPPORTED_BOOT_ROM_TYPES.GBC===a&&(c="Game Boy Color");d=I({ROM:b.ROM,name:c,type:a,date:Date.now()},d);await J.set("boot-rom-"+a,d);}async getBootROMs(){const a=[];for(let b in this.SUPPORTED_BOOT_ROM_TYPES){const c=
    await J.get("boot-rom-"+b);c&&a.push(c);}return a}async loadBootROMIfAvailable(a){if(J){a=a.toUpperCase();if(!this.isValidBootROMType(a))throw Error("Invalid Boot ROM type");if(a=await J.get("boot-rom-"+a)){var b={};b[u.BOOT_ROM]=a.ROM.buffer;await this.worker.postMessage(I({type:r.SET_MEMORY},b)).then(()=>{this.loadedCartridgeMemoryState.BOOT=!0;});await this.worker.postMessage({type:r.GET_MEMORY,memoryTypes:[u.BOOT_ROM]}).then((a)=>{a=C(a);this.bootRom=new Uint8Array(a.message[u.BOOT_ROM]);});}}}loadCartridgeRom(a,
    b){return (async()=>{const c={};c[u.CARTRIDGE_ROM]=a.buffer;await this.worker.postMessage(I({type:r.SET_MEMORY},c)).then(()=>{this.loadedCartridgeMemoryState.ROM=!0;});await this.worker.postMessage({type:r.GET_MEMORY,memoryTypes:[u.CARTRIDGE_ROM,u.CARTRIDGE_HEADER]}).then((a)=>{a=C(a);this.cartridgeRom=new Uint8Array(a.message[u.CARTRIDGE_ROM]);this.cartridgeRomFileName=b;this.cartridgeHeader=new Uint8Array(a.message[u.CARTRIDGE_HEADER]);});})()}saveLoadedCartridge(a){return (async()=>{if(!this.cartridgeHeader)throw Error("Error parsing the cartridge header");
    let b=await J.get(this.cartridgeHeader);b||(b={});const c=await this.getCartridgeInfo();a&&(delete a.ROM,delete a.header);b.cartridgeRom=I({ROM:this.cartridgeRom,header:this.cartridgeHeader,fileName:this.cartridgeRomFileName||"Unknown",date:Date.now()},a);b.cartridgeInfo=c;this.cartridgeRam&&await this.saveCartridgeRam();await J.set(this.cartridgeHeader,b);return b})()}deleteSavedCartridge(a){return (async()=>{const b=a.cartridgeInfo.header;if(!b)throw Error("Error parsing the cartridge header");let c=
    await J.get(b);if(!c)throw Error("Could not find the passed cartridge");delete c.cartridgeRom;await J.set(b,c);return c})()}saveCartridgeRam(a,b){return (async()=>{let c,d;a&&b?(c=a,d=b):(c=this.cartridgeHeader,d=this.cartridgeRam);if(!c||!d)throw Error("Error parsing the cartridgeRam or cartridge header");let e=await J.get(c);e||(e={});e.cartridgeRam=d;await J.set(c,e);})()}loadCartridgeRam(){return (async()=>{var a=this.cartridgeHeader;if(!a)throw Error("Error parsing the cartridge header");const b=
    await J.get(a);b&&b.cartridgeRam&&(a={},a[u.CARTRIDGE_RAM]=b.cartridgeRam.buffer,await this.worker.postMessage(I({type:r.SET_MEMORY},a)).then(()=>{this.loadedCartridgeMemoryState.RAM=!0;this.cartridgeRam=b.cartridgeRam;}));})()}saveState(a,b){return (async()=>{let c,d;a&&b?(c=b,d=a):(c=Da.call(this),d=this.cartridgeHeader);if(!d)throw Error("Error parsing the cartridge header");let e=await J.get(d);e||(e={});e.saveStates||(e.saveStates=[]);if(c.isAuto&&this.maxNumberOfAutoSaveStates&&0<this.maxNumberOfAutoSaveStates){const a=
    [];e.saveStates.forEach((b)=>{b.isAuto&&a.push(b);});for(a.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);0<a.length&&a.length+1>this.maxNumberOfAutoSaveStates;){var f=a.shift();f=this._indexOfSaveStateIndexInSaveStates(f,e.saveStates);e.saveStates.splice(f,1);}0<this.maxNumberOfAutoSaveStates&&e.saveStates.push(c);}else e.saveStates.push(c);await J.set(d,e);return c})()}loadState(a){return (async()=>{var b=this.cartridgeHeader;if(!b)throw Error("Error getting the cartridge header");if(!a){b=await J.get(b);
    if(!b||!b.saveStates)throw Error("No Save State passed, and no cartridge object found");saverState=b.saveStates[0];}b={};b[u.CARTRIDGE_RAM]=a.wasmboyMemory.cartridgeRam.buffer;b[u.GAMEBOY_MEMORY]=a.wasmboyMemory.gameBoyMemory.buffer;b[u.PALETTE_MEMORY]=a.wasmboyMemory.wasmBoyPaletteMemory.buffer;b[u.INTERNAL_STATE]=a.wasmboyMemory.wasmBoyInternalState.buffer;await this.worker.postMessage(I({type:r.SET_MEMORY},b),[b[u.CARTRIDGE_RAM],b[u.GAMEBOY_MEMORY],b[u.PALETTE_MEMORY],b[u.INTERNAL_STATE]]);await this.worker.postMessage({type:r.GET_MEMORY,
    memoryTypes:[u.CARTRIDGE_RAM,u.GAMEBOY_MEMORY,u.PALETTE_MEMORY,u.INTERNAL_STATE]}).then((a)=>{a=C(a);this.cartridgeRam=a.message[u.CARTRIDGE_RAM];this.gameboyMemory=a.message[u.GAMEBOY_MEMORY];this.paletteMemory=a.message[u.PALETTE_MEMORY];this.internalState=a.message[u.INTERNAL_STATE];});})()}deleteState(a,b){return (async()=>{if(!a)throw Error("You must provide a save state to delete");if(b)var c=b;else this.cartridgeHeader&&(c=this.cartridgeHeader);if(c){var d=await J.get(c);if(d&&d.saveStates){var e=
    this._indexOfSaveStateIndexInSaveStates(a,d.saveStates);if(0>e)throw Error("Could not find the passed save state for the related cartridge...");d.saveStates.splice(e,1);await J.set(c,d);return a}throw Error("No save states found for the Cartridge...");}throw Error("Please load a ROM, or pass a Cartridge header...");})()}getCartridgeObject(){return J.get(this.cartridgeHeader)}getCartridgeInfo(){return this.loadedCartridgeMemoryState.ROM?(async()=>{const a={};a.header=this.cartridgeHeader;a.ROM=this.cartridgeRom;
    a.RAM=this.cartridgeRam;a.nintendoLogo=a.ROM.slice(260,308);a.title=a.ROM.slice(308,324);a.titleAsString=String.fromCharCode.apply(null,a.title);a.manufacturerCode=a.ROM.slice(319,323);a.CGBFlag=a.ROM[323];a.newLicenseeCode=a.ROM.slice(324,326);a.SGBFlag=a.ROM[326];a.cartridgeType=a.ROM[327];a.ROMSize=a.ROM[328];a.RAMSize=a.ROM[329];a.destinationCode=a.ROM[330];a.oldLicenseeCode=a.ROM[331];a.maskROMVersionNumber=a.ROM[332];a.headerChecksum=a.ROM[333];a.globalChecksum=a.ROM.slice(334,336);return a})():
    Promise.reject("No ROM has been loaded")}_initializeConstants(){return this.worker.postMessage({type:r.GET_CONSTANTS}).then((a)=>{const b=C(a);Object.keys(this).forEach((a)=>{void 0!==b.message[a]&&(this[a]=b.message[a]);});})}_indexOfSaveStateIndexInSaveStates(a,b){let c=b.indexOf(a);0>c&&b.some((b,e)=>JSON.stringify(Object.keys(a))===JSON.stringify(Object.keys(b))&&a.date===b.date&&a.isAuto===b.isAuto?(c=e,!0):!1);return c}}const N=new Ha;
    function Ia(a){for(var b=1;b<arguments.length;b++){var c=null!=arguments[b]?arguments[b]:{},d=Object.keys(c);"function"===typeof Object.getOwnPropertySymbols&&(d=d.concat(Object.getOwnPropertySymbols(c).filter(function(a){return Object.getOwnPropertyDescriptor(c,a).enumerable})));d.forEach(function(b){var d=c[b];b in a?Object.defineProperty(a,b,{value:d,enumerable:!0,configurable:!0,writable:!0}):a[b]=d;});}return a}
    let P={DPAD_UP:"DPAD_UP",DPAD_RIGHT:"DPAD_RIGHT",DPAD_DOWN:"DPAD_DOWN",DPAD_LEFT:"DPAD_LEFT",LEFT_ANALOG_HORIZONTAL_AXIS:"LEFT_ANALOG_HORIZONTAL_AXIS",LEFT_ANALOG_VERTICAL_AXIS:"LEFT_ANALOG_VERTICAL_AXIS",LEFT_ANALOG_UP:"LEFT_ANALOG_UP",LEFT_ANALOG_RIGHT:"LEFT_ANALOG_RIGHT",LEFT_ANALOG_DOWN:"LEFT_ANALOG_DOWN",LEFT_ANALOG_LEFT:"LEFT_ANALOG_LEFT",RIGHT_ANALOG_HORIZONTAL_AXIS:"RIGHT_ANALOG_HORIZONTAL_AXIS",RIGHT_ANALOG_VERTICAL_AXIS:"RIGHT_ANALOG_VERTICAL_AXIS",RIGHT_ANALOG_UP:"RIGHT_ANALOG_UP",RIGHT_ANALOG_RIGHT:"RIGHT_ANALOG_RIGHT",
    RIGHT_ANALOG_DOWN:"RIGHT_ANALOG_DOWN",RIGHT_ANALOG_LEFT:"RIGHT_ANALOG_LEFT",A:"A",B:"B",X:"X",Y:"Y",LEFT_TRIGGER:"LEFT_TRIGGER",LEFT_BUMPER:"LEFT_BUMPER",RIGHT_TRIGGER:"RIGHT_TRIGGER",RIGHT_BUMPER:"RIGHT_BUMPER",SELECT:"SELECT",START:"START",SPECIAL:"SPECIAL"};class La{constructor(){}enable(){throw Error("enable() must be overridden");}disable(){throw Error("disable() must be overridden");}getState(){throw Error("getState() must be overridden");}}
    let Ma="input textarea button select option optgroup label datalist".split(" "),Na=["Alt","Control","Meta","OS"];
    class Oa extends La{constructor(){super();this.keymap={};Object.keys(P).forEach((a)=>{this.keymap[a]={keys:[],value:void 0};});this.enableIgnoreWhenInputElementFocused();this.enableIgnoreWhenModifierState();this._boundUpdateKeymapValues=this._updateKeymapValues.bind(this);}enable(){if("undefined"===typeof window)throw Error("Keyboard can only be used with a browser environment");window.addEventListener("keyup",this._boundUpdateKeymapValues);window.addEventListener("keydown",this._boundUpdateKeymapValues);}disable(){if("undefined"===
    typeof window)throw Error("Keyboard can only be used with a browser environment");window.removeEventListener("keyup",this._boundUpdateKeymapValues);window.removeEventListener("keydown",this._boundUpdateKeymapValues);}getState(){let a=Ia({},P);Object.keys(this.keymap).forEach((b)=>{a[b]=this.keymap[b].value;});Object.keys(a).forEach((b)=>{"string"===typeof a[b]&&delete a[b];});return a}enableIgnoreWhenInputElementFocused(){this.ignoreWhenInputElementFocused=!0;}disableIgnoreWhenInputElementFocused(){this.ignoreWhenInputElementFocused=
    !1;}enableIgnoreWhenModifierState(){this.ignoreOnModifierState=!0;}disableIgnoreWhenModifierState(){this.ignoreOnModifierState=!1;}setKeysToResponsiveGamepadInput(a,b){if(!a||!b||0===a.length)throw Error("Could not set the specificed keyboard keys to input");"string"===typeof a&&(a=[a]);this.keymap[b].keys=a;}_isFocusedOnInputElement(){return Ma.some((a)=>document.activeElement&&document.activeElement.tagName.toLowerCase()===a.toLowerCase()?!0:!1)}_isInModifierState(a){return Na.some((b)=>a.getModifierState(b)||
    a.code===b)}_updateKeymapValues(a){this.ignoreWhenInputElementFocused&&this._isFocusedOnInputElement()||this.ignoreOnModifierState&&this._isInModifierState(a)||(a.preventDefault(),Object.keys(this.keymap).some((b)=>this.keymap[b].keys.some((c)=>c===a.code?(this.keymap[b].value="keydown"===a.type?!0:!1,!0):!1)));}}
    class Pa extends La{constructor(){super();this.gamepadAnalogStickDeadZone=.25;this.keymap={};}enable(){}disable(){}getState(a){let b=this._getGamepads();a||(a=0);let c=b[a];if(!c)return !1;Object.keys(this.keymap).forEach((a)=>{if(this.keymap[a].buttons)this.keymap[a].value=this.keymap[a].buttons.some((a)=>this._isButtonPressed(c,a));else if(this.keymap[a].axis){let b=this._getAnalogStickAxis(c,this.keymap[a].axis);this.keymap[a].value=b;}});let d=Ia({},P);Object.keys(this.keymap).forEach((a)=>{d[a]=
    this.keymap[a].value;});d[P.LEFT_ANALOG_DOWN]=d.LEFT_ANALOG_VERTICAL_AXIS>this.gamepadAnalogStickDeadZone;d[P.LEFT_ANALOG_UP]=d.LEFT_ANALOG_VERTICAL_AXIS<-1*this.gamepadAnalogStickDeadZone;d[P.LEFT_ANALOG_RIGHT]=d.LEFT_ANALOG_HORIZONTAL_AXIS>this.gamepadAnalogStickDeadZone;d[P.LEFT_ANALOG_LEFT]=d.LEFT_ANALOG_HORIZONTAL_AXIS<-1*this.gamepadAnalogStickDeadZone;d[P.RIGHT_ANALOG_DOWN]=d.RIGHT_ANALOG_VERTICAL_AXIS>this.gamepadAnalogStickDeadZone;d[P.RIGHT_ANALOG_UP]=d.RIGHT_ANALOG_VERTICAL_AXIS<-1*this.gamepadAnalogStickDeadZone;
    d[P.RIGHT_ANALOG_RIGHT]=d.RIGHT_ANALOG_HORIZONTAL_AXIS>this.gamepadAnalogStickDeadZone;d[P.RIGHT_ANALOG_LEFT]=d.RIGHT_ANALOG_HORIZONTAL_AXIS<-1*this.gamepadAnalogStickDeadZone;Object.keys(d).forEach((a)=>{"string"===typeof d[a]&&delete d[a];});return d}setGamepadButtonsToResponsiveGamepadInput(a,b){if(!a||!b||0===a.length)throw Error("Could not set the specificed buttons to input");"number"===typeof a&&(a=[a]);this.keymap[b]={};this.keymap[b].buttons=a;}setGamepadAxisToResponsiveGamepadInput(a,b){if(void 0===
    a||!b)throw Error("Could not set the specificed buttons to input");if("number"===typeof axes)throw Error("Must pass in an axis id");this.keymap[b]={};this.keymap[b].axis=a;}_isButtonPressed(a,b){return a.buttons[b]?a.buttons[b].pressed:!1}_getGamepads(){return navigator.getGamepads?navigator.getGamepads():[]}_getAnalogStickAxis(a,b){return a?a.axes[b]||0:0}}let Qa="touchstart touchmove touchend mousedown mousemove mouseup mouseleave".split(" ");
    class Ra{constructor(a){if(!a)throw Error("Touch inputs require an element.");this.listeners=[];this.element=a;this._addTouchStyles();this.boundingClientRect=void 0;this._updateElementBoundingClientRect();this.active=!1;this.boundUpdateElementRect=this._updateElementBoundingClientRect.bind(this);this.boundTouchEvent=this._touchEvent.bind(this);}remove(){this._removeTouchStyles();this.stopListening();this.element=void 0;}listen(){if(!this.element)throw Error("You must supply an element first with add()");
    window.addEventListener("resize",this.boundUpdateElementRect);Qa.forEach((a)=>{this.element.addEventListener(a,this.boundTouchEvent);});}stopListening(){if(!this.element)throw Error("You must supply an element first with add()");window.removeEventListener("resize",this.boundUpdateElementRect);Qa.forEach((a)=>{this.element.removeEventListener(a,this.boundTouchEvent);});}_touchEvent(a){if(a&&(!a.type.includes("touch")||a.touches)){a.preventDefault();var b="touchstart"===a.type||"touchmove"===a.type||"mousedown"===
    a.type,c="mousemove"===a.type,d=!b&&!c;this._updateActiveStatus(b,d);this._updateTouchStyles(b,c,d);if(this.onTouchEvent)this.onTouchEvent(a,b,c,d);}}_updateElementBoundingClientRect(){this.boundingClientRect=this.element.getBoundingClientRect();}_addTouchStyles(){this.element.style.userSelect="none";}_removeTouchStyles(){this.element.style.userSelect="";}_updateTouchStyles(a,b){b||(a?this.element.classList.add("active"):this.element.classList.remove("active"));}_updateActiveStatus(a,b){this.active&&b?
    this.active=!1:!this.active&&a&&(this.active=!0);}}function Sa(a,b){let c;a.type.includes("touch")?c=a.touches[0]:a.type.includes("mouse")&&(c=a);return {rectCenterX:(b.right-b.left)/2,rectCenterY:(b.bottom-b.top)/2,touchX:c.clientX-b.left,touchY:c.clientY-b.top}}
    class $a extends Ra{constructor(a,b){super(a);this.config=b?b:{allowMultipleDirections:!1};this._resetState();}_resetState(){this.state={DPAD_UP:!1,DPAD_RIGHT:!1,DPAD_DOWN:!1,DPAD_LEFT:!1};}onTouchEvent(a){if(this.active){var {rectCenterX:a,rectCenterY:b,touchX:c,touchY:d}=Sa(a,this.boundingClientRect);if(!(c>a+this.boundingClientRect.width/2+50)){this._resetState();var e=this.boundingClientRect.width/20,f=this.boundingClientRect.height/20;this.config.allowMultipleDirections?(this.setHorizontalState(c,
    e),this.setVerticalState(d,f)):Math.abs(a-c)+this.boundingClientRect.width/8>Math.abs(b-d)?this.setHorizontalState(c,e):this.setVerticalState(d);}}else this._resetState();}setHorizontalState(a,b){b&&Math.abs(this.boundingClientRect.width/2-a)<=b||(a<this.boundingClientRect.width/2?this.state.DPAD_LEFT=!0:this.state.DPAD_RIGHT=!0);}setVerticalState(a,b){b&&Math.abs(this.boundingClientRect.height/2-a)<b||(a<this.boundingClientRect.height/2?this.state.DPAD_UP=!0:this.state.DPAD_DOWN=!0);}}
    class ab extends Ra{constructor(a){super(a);this._resetState();}_resetState(){this.state={HORIZONTAL_AXIS:0,VERTICAL_AXIS:0,UP:!1,RIGHT:!1,DOWN:!1,LEFT:!1};this.element.style.transform="translate(0px, 0px)";this.deadzone=.5;}onTouchEvent(a){if(this.active){var {rectCenterX:a,rectCenterY:b,touchX:c,touchY:d}=Sa(a,this.boundingClientRect);c=(c-a)/a;1<c?c=1:-1>c&&(c=-1);d=(d-b)/b;1<d?d=1:-1>d&&(d=-1);this.element.style.transform=`translate(${a*c/2}px, ${b*d/2}px)`;this.state.HORIZONTAL_AXIS=c;this.state.VERTICAL_AXIS=
    d;this.state.UP=!1;this.state.RIGHT=!1;this.state.DOWN=!1;this.state.LEFT=!1;Math.abs(c)>this.deadzone&&(0<c?this.state.RIGHT=!0:0>c&&(this.state.LEFT=!0));Math.abs(d)>this.deadzone&&(0<d?this.state.DOWN=!0:0>d&&(this.state.UP=!0));}else this._resetState();}}class bb extends Ra{constructor(a,b){super(a);this.input=b;}}let cb={LEFT:"LEFT",RIGHT:"RIGHT"};
    class db extends La{constructor(){super();this.enabled=!1;this.dpads=[];this.leftAnalogs=[];this.rightAnalogs=[];this.buttons=[];}enable(){if("undefined"===typeof window)throw Error("TouchInput can only be used with a browser environment");this.enabled=!0;this.dpads.forEach((a)=>a.listen());this.leftAnalogs.forEach((a)=>a.listen());this.rightAnalogs.forEach((a)=>a.listen());this.buttons.forEach((a)=>a.listen());}disable(){if("undefined"===typeof window)throw Error("TouchInput can only be used with a browser environment");
    this.enabled=!1;this.dpads.forEach((a)=>a.stopListening());this.leftAnalogs.forEach((a)=>a.stopListening());this.rightAnalogs.forEach((a)=>a.stopListening());this.buttons.forEach((a)=>a.stopListening());}getState(){let a=Ia({},P);this.buttons.forEach((b)=>{a[b.input]=b.active;});this.dpads.forEach((b)=>{Object.keys(b.state).forEach((c)=>{a[c]=b.state[c]||a[c];});});0<this.leftAnalogs.length&&(a.LEFT_ANALOG_HORIZONTAL_AXIS=this.leftAnalogs[0].state.HORIZONTAL_AXIS,a.LEFT_ANALOG_VERTICAL_AXIS=this.leftAnalogs[0].state.VERTICAL_AXIS,
    a.LEFT_ANALOG_UP=this.leftAnalogs[0].state.UP,a.LEFT_ANALOG_RIGHT=this.leftAnalogs[0].state.RIGHT,a.LEFT_ANALOG_DOWN=this.leftAnalogs[0].state.DOWN,a.LEFT_ANALOG_LEFT=this.leftAnalogs[0].state.LEFT);0<this.rightAnalogs.length&&(a.RIGHT_ANALOG_HORIZONTAL_AXIS=this.rightAnalogs[0].state.HORIZONTAL_AXIS,a.RIGHT_ANALOG_VERTICAL_AXIS=this.rightAnalogs[0].state.VERTICAL_AXIS,a.RIGHT_ANALOG_UP=this.rightAnalogs[0].state.UP,a.RIGHT_ANALOG_RIGHT=this.rightAnalogs[0].state.RIGHT,a.RIGHT_ANALOG_DOWN=this.rightAnalogs[0].state.DOWN,
    a.RIGHT_ANALOG_LEFT=this.rightAnalogs[0].state.LEFT);Object.keys(a).forEach((b)=>{"string"===typeof a[b]&&delete a[b];});return a}addButtonInput(a,b){let c=new bb(a,b);this.enabled&&c.listen();this.buttons.push(c);return ()=>{c.stopListening();this.buttons.splice(this.buttons.indexOf(c),1);}}addDpadInput(a,b){let c=new $a(a,b);this.enabled&&c.listen();this.dpads.push(c);return ()=>{c.stopListening();this.dpads.splice(this.dpads.indexOf(c),1);}}addLeftAnalogInput(a){this.addAnalogInput(a,cb.LEFT);}addRightAnalogInput(a){this.addAnalogInput(a,
    cb.RIGHT);}addAnalogInput(a,b){let c=new ab(a);this.enabled&&c.listen();if(b===cb.LEFT)return this.leftAnalogs.push(c),()=>{c.stopListening();this.leftAnalogs.splice(this.leftAnalogs.indexOf(c),1);};this.rightAnalogs.push(c);return ()=>{c.stopListening();this.rightAnalogs.splice(this.rightAnalogs.indexOf(c),1);}}}
    class eb{constructor(){this.RESPONSIVE_GAMEPAD_INPUTS=P;this._enabled=!1;this._multipleDirectionInput=!0;this.Keyboard=new Oa;this.Gamepad=new Pa;this.TouchInput=new db;this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowUp","Numpad8"],P.DPAD_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyW"],P.LEFT_ANALOG_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyI"],P.RIGHT_ANALOG_UP);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([12],P.DPAD_UP);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowRight",
    "Numpad6"],P.DPAD_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyD"],P.LEFT_ANALOG_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyL"],P.RIGHT_ANALOG_RIGHT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([15],P.DPAD_RIGHT);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowDown","Numpad5","Numpad2"],P.DPAD_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyS"],P.LEFT_ANALOG_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyK"],P.RIGHT_ANALOG_DOWN);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([13],
    P.DPAD_DOWN);this.Keyboard.setKeysToResponsiveGamepadInput(["ArrowLeft","Numpad4"],P.DPAD_LEFT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyA"],P.LEFT_ANALOG_LEFT);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyJ"],P.RIGHT_ANALOG_LEFT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([14],P.DPAD_LEFT);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([0],P.LEFT_ANALOG_HORIZONTAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([1],P.LEFT_ANALOG_VERTICAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([2],
    P.RIGHT_ANALOG_HORIZONTAL_AXIS);this.Gamepad.setGamepadAxisToResponsiveGamepadInput([3],P.RIGHT_ANALOG_VERTICAL_AXIS);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyX","Semicolon","Numpad7"],P.A);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([0],P.A);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyZ","Escape","Quote","Backspace","Numpad9"],P.B);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([1],P.B);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyC"],P.X);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([2],
    P.X);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyV"],P.Y);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([3],P.Y);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyQ"],P.LEFT_TRIGGER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([6],P.LEFT_TRIGGER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyE"],P.LEFT_BUMPER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([4],P.LEFT_BUMPER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyU"],P.RIGHT_TRIGGER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([7],
    P.RIGHT_TRIGGER);this.Keyboard.setKeysToResponsiveGamepadInput(["KeyO"],P.RIGHT_BUMPER);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([5],P.RIGHT_BUMPER);this.Keyboard.setKeysToResponsiveGamepadInput(["Enter","Numpad3"],P.START);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([9],P.START);this.Keyboard.setKeysToResponsiveGamepadInput(["ShiftRight","ShiftLeft","Tab","Numpad1"],P.SELECT);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([8],P.SELECT);this.Keyboard.setKeysToResponsiveGamepadInput(["Space",
    "Backslash","Backquote"],P.SPECIAL);this.Gamepad.setGamepadButtonsToResponsiveGamepadInput([16],P.SPECIAL);this.plugins=[];this.inputChangeMap={};this.inputChangeOldState={};this.cancelInputChangeListener=void 0;}getVersion(){return "1.0.0"}enable(){this.Keyboard.enable();this.Gamepad.enable();this.TouchInput.enable();0<Object.keys(this.inputChangeMap).length&&this._startInputChangeInterval();this._enabled=!0;}disable(){this.Keyboard.disable();this.Gamepad.disable();this.TouchInput.disable();this.cancelInputChangeListener&&
    (this.cancelInputChangeListener(),this.cancelInputChangeListener=void 0);this._enabled=!1;}isEnabled(){return this._enabled}addPlugin(a){this.plugins.push(a);if(a.onAddPlugin)a.onAddPlugin();return ()=>{if(a.onRemovePlugin)a.onRemovePlugin();this.plugins.splice(this.plugins.indexOf(a),1);}}getState(){if(!this._enabled)return {};let a=Ia({},P),b=this.Gamepad.getState(),c=this.TouchInput.getState(),d=this.Keyboard.getState();a=Ia({},P);Object.keys(a).forEach((e)=>{a[e]=b[e]||c[e]||d[e];});["LEFT","RIGHT"].forEach((b)=>
    {[P[`${b}_ANALOG_HORIZONTAL_AXIS`],P[`${b}_ANALOG_VERTICAL_AXIS`]].forEach((c,d)=>{if("number"!==typeof a[c]){if(0===d||2===d)a[c]=a[P[`${b}_ANALOG_RIGHT`]]?1:a[P[`${b}_ANALOG_LEFT`]]?-1:0;if(1===d||3===d)a[c]=a[P[`${b}_ANALOG_UP`]]?-1:a[P[`${b}_ANALOG_DOWN`]]?1:0;}});});a.UP=a.DPAD_UP||a.LEFT_ANALOG_UP;a.RIGHT=a.DPAD_RIGHT||a.LEFT_ANALOG_RIGHT;a.DOWN=a.DPAD_DOWN||a.LEFT_ANALOG_DOWN;a.LEFT=a.DPAD_LEFT||a.LEFT_ANALOG_LEFT;Object.keys(a).forEach((b)=>{if(void 0===a[b]||"string"===typeof a[b])a[b]=!1;});
    this.plugins.forEach((b)=>{b.onGetState&&(b=b.onGetState(a))&&(this.state=b);});return a}onInputsChange(a,b){"string"===typeof a&&(a=[a]);this.inputChangeMap[a]={codes:a,callback:b};this.cancelInputChangeListener||this._startInputChangeInterval();return ()=>{delete this.inputChangeMap[a];}}_startInputChangeInterval(){let a=setInterval(this._inputChangeIntervalHandler.bind(this),16);this.cancelInputChangeListener=()=>clearInterval(a);}_inputChangeIntervalHandler(){let a=this.getState(),b=[];Object.keys(a).forEach((c)=>
    {a[c]!==this.inputChangeOldState[c]&&b.push(c);});Object.keys(this.inputChangeMap).forEach((c)=>{this.inputChangeMap[c].codes.some((a)=>b.includes(a))&&this.inputChangeMap[c].callback(a);});this.inputChangeOldState=a;}}let fb=new eb;function gb(){return {onGetState:(a)=>{const b=a.B;a.A=a.A||a.X;a.B=b||a.Y;return a}}}
    class hb{constructor(){this.worker=void 0;this.isEnabled=!1;this.ResponsiveGamepad=fb;fb.addPlugin(gb());}initialize(){this.isEnabled||this.enableDefaultJoypad();return Promise.resolve()}setWorker(a){this.worker=a;}updateController(){if(!this.isEnabled)return {};const a=fb.getState();this.setJoypadState(a);return a}setJoypadState(a){this.worker.postMessageIgnoreResponse({type:r.SET_JOYPAD_STATE,setJoypadStateParamsAsArray:[a.UP?1:0,a.RIGHT?1:0,a.DOWN?1:0,a.LEFT?1:0,a.A?1:0,a.B?1:0,a.SELECT?1:0,a.START?
    1:0]});}enableDefaultJoypad(){this.isEnabled=!0;fb.enable();}disableDefaultJoypad(){this.isEnabled=!1;fb.disable();}}const Q=new hb;let ib=0;const jb=()=>{var a=Math.random().toString(36).replace(/[^a-z]+/g,"").substr(2,10);ib++;a=`${a}-${ib}`;1E5<ib&&(ib=0);return a};function kb(a,b,c){b||(b=jb());return {workerId:c,messageId:b,message:a}}
    class lb{constructor(a,b){this.id=jb();b&&(this.id=b);this.messageListeners=[];a=atob(a.split(",")[1]);let c;try{c=new Blob([a],{type:"application/javascript"});}catch(d){window.BlobBuilder=window.BlobBuilder||window.WebKitBlobBuilder||window.MozBlobBuilder,c=new BlobBuilder,c.append(a),c=c.getBlob();}this.worker=new Worker(URL.createObjectURL(c));this.worker.onmessage=this._onMessageHandler.bind(this);}postMessageIgnoreResponse(a,b){a=kb(a,void 0,this.id);this.worker.postMessage(a,b);}postMessage(a,
    b){const c=kb(a,void 0,this.id),d=c.messageId,e=new Promise((b,c)=>{let e=setTimeout(()=>{console.warn("Message dropped",a);this.removeMessageListener(d);c();},1E3);this.addMessageListener((a,c)=>{a=C(a);a.messageId===d&&(clearTimeout(e),e=void 0,this.removeMessageListener(c.id),b(a));});});this.worker.postMessage(c,b);return e}addMessageListener(a){this.messageListeners.push({id:jb(),callback:a});}removeMessageListener(a){let b;this.messageListeners.some((c,d)=>c.id===a?(b=d,!0):!1);void 0!==b&&this.messageListeners.splice(b,
    1);}_onMessageHandler(a){this.messageListeners.forEach((b)=>{b.callback(a,b);});}}
    const mb=async()=>{const a=new lb("data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG4oYSl7cmV0dXJuIGEuZGF0YT9hLmRhdGE6YX1mdW5jdGlvbiBrKGEsYil7cD9zZWxmLnBvc3RNZXNzYWdlKGEsYik6di5wb3N0TWVzc2FnZShhLGIpfWZ1bmN0aW9uIHEoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihwKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKHApc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIHYub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGQpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLHQrKyxiPWAke2J9LSR7dH1gLDFFNTx0JiYodD0wKSk7cmV0dXJue3dvcmtlcklkOmQsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1mdW5jdGlvbiBKKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkZSQU1FX0xPQ0FUSU9OLnZhbHVlT2YoKSxhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfU0laRS52YWx1ZU9mKCksYS5ncmFwaGljc1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX0NVUlJFTlRfRlJBTUVfT1VUUFVUX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuRlJBTUVfTE9DQVRJT04udmFsdWVPZigpfSxiLm1lc3NhZ2VJZCkpfX1mdW5jdGlvbiBLKGEsYil7Yj1uKGIpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkdFVF9DT05TVEFOVFM6YS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzFfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTsKYS5XQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT049YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5DSEFOTkVMXzJfQlVGRkVSX0xPQ0FUSU9OLnZhbHVlT2YoKTthLldBU01CT1lfQ0hBTk5FTF8zX09VVFBVVF9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLkNIQU5ORUxfM19CVUZGRVJfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0hBTk5FTF80X0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCk7YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLkdFVF9DT05TVEFOVFNfRE9ORSxXQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkFVRElPX0JVRkZFUl9MT0NBVElPTi52YWx1ZU9mKCl9LGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLkFVRElPX0xBVEVOQ1k6YS5jdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzPQpiLm1lc3NhZ2UubGF0ZW5jeX19ZnVuY3Rpb24gTChhLGIpe2I9bihiKTtzd2l0Y2goYi5tZXNzYWdlLnR5cGUpe2Nhc2UgZi5TRVRfSk9ZUEFEX1NUQVRFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuc2V0Sm95cGFkU3RhdGUuYXBwbHkoYSxiLm1lc3NhZ2Uuc2V0Sm95cGFkU3RhdGVQYXJhbXNBc0FycmF5KX19ZnVuY3Rpb24gQShhKXtpZighYS53YXNtQnl0ZU1lbW9yeSlyZXR1cm4gbmV3IFVpbnQ4QXJyYXk7bGV0IGI9YS53YXNtQnl0ZU1lbW9yeVthLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTiszMjddLGQ9dm9pZCAwO2lmKDA9PT1iKXJldHVybiBuZXcgVWludDhBcnJheTsxPD1iJiYzPj1iP2Q9MzI3Njg6NTw9YiYmNj49Yj9kPTIwNDg6MTU8PWImJjE5Pj1iP2Q9MzI3Njg6MjU8PWImJjMwPj1iJiYoZD0xMzEwNzIpO3JldHVybiBkP2Eud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OLGEuV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTisKZCk6bmV3IFVpbnQ4QXJyYXl9ZnVuY3Rpb24gQihhKXthLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpO3JldHVybiBhLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkUpfWZ1bmN0aW9uIE0oYSxiKXtiPW4oYik7c3dpdGNoKGIubWVzc2FnZS50eXBlKXtjYXNlIGYuQ0xFQVJfTUVNT1JZOmZvcih2YXIgZD0wO2Q8PWEud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2QrKylhLndhc21CeXRlTWVtb3J5W2RdPTA7ZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKDApO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuQ0xFQVJfTUVNT1JZX0RPTkUsd2FzbUJ5dGVNZW1vcnk6ZC5idWZmZXJ9LGIubWVzc2FnZUlkKSxbZC5idWZmZXJdKTticmVhaztjYXNlIGYuR0VUX0NPTlNUQU5UUzphLldBU01CT1lfQk9PVF9ST01fTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JBTV9MT0NBVElPTi52YWx1ZU9mKCk7YS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU9YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTj1hLndhc21JbnN0YW5jZS5leHBvcnRzLldBU01CT1lfU1RBVEVfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRT1hLndhc21JbnN0YW5jZS5leHBvcnRzLkdBTUVCT1lfSU5URVJOQUxfTUVNT1JZX1NJWkUudmFsdWVPZigpO2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT049CmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04udmFsdWVPZigpO2EuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCk7YS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfTE9DQVRJT04udmFsdWVPZigpO2EubWVtb3J5V29ya2VyUG9ydC5wb3N0TWVzc2FnZShoKHt0eXBlOmYuR0VUX0NPTlNUQU5UU19ET05FLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5CT09UX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuQ0FSVFJJREdFX1JPTV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9HQU1FX1JBTV9CQU5LU19MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkNBUlRSSURHRV9SQU1fTE9DQVRJT04udmFsdWVPZigpLApXQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX1NJWkU6YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX1NJWkUudmFsdWVPZigpLFdBU01CT1lfSU5URVJOQUxfU1RBVEVfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5XQVNNQk9ZX1NUQVRFX0xPQ0FUSU9OLnZhbHVlT2YoKSxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0FNRUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT046YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5HQU1FQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTi52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9TSVpFOmEud2FzbUluc3RhbmNlLmV4cG9ydHMuR0JDX1BBTEVUVEVfU0laRS52YWx1ZU9mKCksV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTjphLndhc21JbnN0YW5jZS5leHBvcnRzLkdCQ19QQUxFVFRFX0xPQ0FUSU9OLnZhbHVlT2YoKX0sCmIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlNFVF9NRU1PUlk6ZD1PYmplY3Qua2V5cyhiLm1lc3NhZ2UpO2QuaW5jbHVkZXMoZy5CT09UX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkJPT1RfUk9NXSksYS5XQVNNQk9ZX0JPT1RfUk9NX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuQ0FSVFJJREdFX1JPTSkmJmEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLkNBUlRSSURHRV9ST01dKSxhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTik7ZC5pbmNsdWRlcyhnLkNBUlRSSURHRV9SQU0pJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5DQVJUUklER0VfUkFNXSksYS5XQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuR0FNRUJPWV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5HQU1FQk9ZX01FTU9SWV0pLAphLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OKTtkLmluY2x1ZGVzKGcuUEFMRVRURV9NRU1PUlkpJiZhLndhc21CeXRlTWVtb3J5LnNldChuZXcgVWludDhBcnJheShiLm1lc3NhZ2VbZy5QQUxFVFRFX01FTU9SWV0pLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTik7ZC5pbmNsdWRlcyhnLklOVEVSTkFMX1NUQVRFKSYmKGEud2FzbUJ5dGVNZW1vcnkuc2V0KG5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtnLklOVEVSTkFMX1NUQVRFXSksYS5XQVNNQk9ZX0lOVEVSTkFMX1NUQVRFX0xPQ0FUSU9OKSxhLndhc21JbnN0YW5jZS5leHBvcnRzLmxvYWRTdGF0ZSgpKTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaCh7dHlwZTpmLlNFVF9NRU1PUllfRE9ORX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuR0VUX01FTU9SWTp7ZD17dHlwZTpmLkdFVF9NRU1PUll9O2NvbnN0IGw9W107dmFyIGM9Yi5tZXNzYWdlLm1lbW9yeVR5cGVzO2lmKGMuaW5jbHVkZXMoZy5CT09UX1JPTSkpe2lmKGEud2FzbUJ5dGVNZW1vcnkpe3ZhciBlPQphLndhc21JbnN0YW5jZS5leHBvcnRzLkJPT1RfUk9NX0xPQ0FUSU9OLnZhbHVlT2YoKTtlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlK2Eud2FzbUluc3RhbmNlLmV4cG9ydHMuQk9PVF9ST01fU0laRS52YWx1ZU9mKCkpfWVsc2UgZT1uZXcgVWludDhBcnJheTtlPWUuYnVmZmVyO2RbZy5CT09UX1JPTV09ZTtsLnB1c2goZSl9aWYoYy5pbmNsdWRlcyhnLkNBUlRSSURHRV9ST00pKXtpZihhLndhc21CeXRlTWVtb3J5KXtlPWEud2FzbUJ5dGVNZW1vcnlbYS5XQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT04rMzI3XTt2YXIgbT12b2lkIDA7MD09PWU/bT0zMjc2ODoxPD1lJiYzPj1lP209MjA5NzE1Mjo1PD1lJiY2Pj1lP209MjYyMTQ0OjE1PD1lJiYxOT49ZT9tPTIwOTcxNTI6MjU8PWUmJjMwPj1lJiYobT04Mzg4NjA4KTtlPW0/YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTixhLldBU01CT1lfR0FNRV9CWVRFU19MT0NBVElPTittKToKbmV3IFVpbnQ4QXJyYXl9ZWxzZSBlPW5ldyBVaW50OEFycmF5O2U9ZS5idWZmZXI7ZFtnLkNBUlRSSURHRV9ST01dPWU7bC5wdXNoKGUpfWMuaW5jbHVkZXMoZy5DQVJUUklER0VfUkFNKSYmKGU9QShhKS5idWZmZXIsZFtnLkNBUlRSSURHRV9SQU1dPWUsbC5wdXNoKGUpKTtjLmluY2x1ZGVzKGcuQ0FSVFJJREdFX0hFQURFUikmJihhLndhc21CeXRlTWVtb3J5PyhlPWEuV0FTTUJPWV9HQU1FX0JZVEVTX0xPQ0FUSU9OKzMwOCxlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoZSxlKzI3KSk6ZT1uZXcgVWludDhBcnJheSxlPWUuYnVmZmVyLGRbZy5DQVJUUklER0VfSEVBREVSXT1lLGwucHVzaChlKSk7Yy5pbmNsdWRlcyhnLkdBTUVCT1lfTUVNT1JZKSYmKGU9YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfTE9DQVRJT04rYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9TSVpFKS5idWZmZXIsCmRbZy5HQU1FQk9ZX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5QQUxFVFRFX01FTU9SWSkmJihlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OLGEuV0FTTUJPWV9QQUxFVFRFX01FTU9SWV9MT0NBVElPTithLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyLGRbZy5QQUxFVFRFX01FTU9SWV09ZSxsLnB1c2goZSkpO2MuaW5jbHVkZXMoZy5JTlRFUk5BTF9TVEFURSkmJihhLndhc21JbnN0YW5jZS5leHBvcnRzLnNhdmVTdGF0ZSgpLGM9QihhKS5idWZmZXIsZFtnLklOVEVSTkFMX1NUQVRFXT1jLGwucHVzaChjKSk7YS5tZW1vcnlXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoZCxiLm1lc3NhZ2VJZCksbCl9fX1mdW5jdGlvbiBOKGEpe2NvbnN0IGI9InVuZGVmaW5lZCIhPT10eXBlb2Ygd2luZG93P3BlcmZvcm1hbmNlLm5vdygpOkRhdGUubm93KCk7Zm9yKDthLmZwc1RpbWVTdGFtcHNbMF08Yi0xRTM7KWEuZnBzVGltZVN0YW1wcy5zaGlmdCgpOwphLmZwc1RpbWVTdGFtcHMucHVzaChiKTthLnRpbWVTdGFtcHNVbnRpbFJlYWR5LS07MD5hLnRpbWVTdGFtcHNVbnRpbFJlYWR5JiYoYS50aW1lU3RhbXBzVW50aWxSZWFkeT0wKTtyZXR1cm4gYn1mdW5jdGlvbiB3KGEpe2EudGltZVN0YW1wc1VudGlsUmVhZHk9OTA+PWEub3B0aW9ucy5nYW1lYm95RnJhbWVSYXRlPzEuMjUqTWF0aC5mbG9vcihhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk6MTIwfWZ1bmN0aW9uIEMoYSl7Y29uc3QgYj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTixhLldBU01CT1lfQ1VSUkVOVF9GUkFNRV9PVVRQVVRfTE9DQVRJT04rYS5XQVNNQk9ZX0NVUlJFTlRfRlJBTUVfU0laRSkuYnVmZmVyO2EuZ3JhcGhpY3NXb3JrZXJQb3J0LnBvc3RNZXNzYWdlKGgoe3R5cGU6Zi5VUERBVEVELGdyYXBoaWNzRnJhbWVCdWZmZXI6Yn0pLFtiXSl9ZnVuY3Rpb24gRChhKXt2YXIgYj0oInVuZGVmaW5lZCIhPT0KdHlwZW9mIHdpbmRvdz9wZXJmb3JtYW5jZS5ub3coKTpEYXRlLm5vdygpKS1hLmZwc1RpbWVTdGFtcHNbYS5mcHNUaW1lU3RhbXBzLmxlbmd0aC0xXTtiPUUtYjswPmImJihiPTApO2Euc3BlZWQmJjA8YS5zcGVlZCYmKGIvPWEuc3BlZWQpO2EudXBkYXRlSWQ9c2V0VGltZW91dCgoKT0+e0YoYSl9LE1hdGguZmxvb3IoYikpfWZ1bmN0aW9uIEYoYSxiKXtpZihhLnBhdXNlZClyZXR1cm4hMDt2b2lkIDAhPT1iJiYoRT1iKTtyPWEuZ2V0RlBTKCk7dT1hLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSsxO2Euc3BlZWQmJjA8YS5zcGVlZCYmKHUqPWEuc3BlZWQpO2lmKHI+dSlyZXR1cm4gYS5mcHNUaW1lU3RhbXBzLnNoaWZ0KCksRChhKSwhMDtOKGEpO2NvbnN0IGM9IWEub3B0aW9ucy5oZWFkbGVzcyYmIWEucGF1c2VGcHNUaHJvdHRsZSYmYS5vcHRpb25zLmlzQXVkaW9FbmFibGVkOyhuZXcgUHJvbWlzZSgoYik9PntsZXQgZDtjP3goYSxiKTooZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmV4ZWN1dGVGcmFtZSgpLApiKGQpKX0pKS50aGVuKChiKT0+e2lmKDA8PWIpe2soaCh7dHlwZTpmLlVQREFURUQsZnBzOnJ9KSk7bGV0IGM9ITE7YS5vcHRpb25zLmZyYW1lU2tpcCYmMDxhLm9wdGlvbnMuZnJhbWVTa2lwJiYoYS5mcmFtZVNraXBDb3VudGVyKyssYS5mcmFtZVNraXBDb3VudGVyPD1hLm9wdGlvbnMuZnJhbWVTa2lwP2M9ITA6YS5mcmFtZVNraXBDb3VudGVyPTApO2N8fEMoYSk7Y29uc3QgZD17dHlwZTpmLlVQREFURUR9O2RbZy5DQVJUUklER0VfUkFNXT1BKGEpLmJ1ZmZlcjtkW2cuR0FNRUJPWV9NRU1PUlldPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTixhLldBU01CT1lfSU5URVJOQUxfTUVNT1JZX0xPQ0FUSU9OK2EuV0FTTUJPWV9JTlRFUk5BTF9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5QQUxFVFRFX01FTU9SWV09YS53YXNtQnl0ZU1lbW9yeS5zbGljZShhLldBU01CT1lfUEFMRVRURV9NRU1PUllfTE9DQVRJT04sYS5XQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OKwphLldBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRSkuYnVmZmVyO2RbZy5JTlRFUk5BTF9TVEFURV09QihhKS5idWZmZXI7T2JqZWN0LmtleXMoZCkuZm9yRWFjaCgoYSk9Pnt2b2lkIDA9PT1kW2FdJiYoZFthXT0obmV3IFVpbnQ4QXJyYXkpLmJ1ZmZlcil9KTthLm1lbW9yeVdvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChkKSxbZFtnLkNBUlRSSURHRV9SQU1dLGRbZy5HQU1FQk9ZX01FTU9SWV0sZFtnLlBBTEVUVEVfTUVNT1JZXSxkW2cuSU5URVJOQUxfU1RBVEVdXSk7Mj09PWI/ayhoKHt0eXBlOmYuQlJFQUtQT0lOVH0pKTpEKGEpfWVsc2UgayhoKHt0eXBlOmYuQ1JBU0hFRH0pKSxhLnBhdXNlZD0hMH0pfWZ1bmN0aW9uIHgoYSxiKXt2YXIgZD0tMTtkPWEud2FzbUluc3RhbmNlLmV4cG9ydHMuZXhlY3V0ZUZyYW1lQW5kQ2hlY2tBdWRpbygxMDI0KTsxIT09ZCYmYihkKTtpZigxPT09ZCl7ZD1hLndhc21JbnN0YW5jZS5leHBvcnRzLmdldE51bWJlck9mU2FtcGxlc0luQXVkaW9CdWZmZXIoKTsKY29uc3QgYz1yPj11Oy4yNTxhLmN1cnJlbnRBdWRpb0xhdGVuY3lJblNlY29uZHMmJmM/KEcoYSxkKSxzZXRUaW1lb3V0KCgpPT57dyhhKTt4KGEsYil9LE1hdGguZmxvb3IoTWF0aC5mbG9vcigxRTMqKGEuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcy0uMjUpKS8xMCkpKTooRyhhLGQpLHgoYSxiKSl9fWZ1bmN0aW9uIEcoYSxiKXt2YXIgZD1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT04sYS5XQVNNQk9ZX1NPVU5EX09VVFBVVF9MT0NBVElPTisyKmIpLmJ1ZmZlcjtjb25zdCBjPXt0eXBlOmYuVVBEQVRFRCxhdWRpb0J1ZmZlcjpkLG51bWJlck9mU2FtcGxlczpiLGZwczpyLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzo2MDxhLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZX07ZD1bZF07aWYoYS5vcHRpb25zJiZhLm9wdGlvbnMuZW5hYmxlQXVkaW9EZWJ1Z2dpbmcpe3ZhciBlPWEud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYS5XQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT04sCmEuV0FTTUJPWV9DSEFOTkVMXzFfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDFCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzJfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDJCdWZmZXI9ZTtkLnB1c2goZSk7ZT1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzNfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDNCdWZmZXI9ZTtkLnB1c2goZSk7Yj1hLndhc21CeXRlTWVtb3J5LnNsaWNlKGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OLGEuV0FTTUJPWV9DSEFOTkVMXzRfT1VUUFVUX0xPQ0FUSU9OKzIqYikuYnVmZmVyO2MuY2hhbm5lbDRCdWZmZXI9YjtkLnB1c2goYil9YS5hdWRpb1dvcmtlclBvcnQucG9zdE1lc3NhZ2UoaChjKSwKZCk7YS53YXNtSW5zdGFuY2UuZXhwb3J0cy5jbGVhckF1ZGlvQnVmZmVyKCl9Y29uc3QgcD0idW5kZWZpbmVkIiE9PXR5cGVvZiBzZWxmO2xldCB2O3B8fCh2PXJlcXVpcmUoIndvcmtlcl90aHJlYWRzIikucGFyZW50UG9ydCk7Y29uc3QgZj17Q09OTkVDVDoiQ09OTkVDVCIsSU5TVEFOVElBVEVfV0FTTToiSU5TVEFOVElBVEVfV0FTTSIsQ0xFQVJfTUVNT1JZOiJDTEVBUl9NRU1PUlkiLENMRUFSX01FTU9SWV9ET05FOiJDTEVBUl9NRU1PUllfRE9ORSIsR0VUX01FTU9SWToiR0VUX01FTU9SWSIsU0VUX01FTU9SWToiU0VUX01FTU9SWSIsU0VUX01FTU9SWV9ET05FOiJTRVRfTUVNT1JZX0RPTkUiLEdFVF9DT05TVEFOVFM6IkdFVF9DT05TVEFOVFMiLEdFVF9DT05TVEFOVFNfRE9ORToiR0VUX0NPTlNUQU5UU19ET05FIixDT05GSUc6IkNPTkZJRyIsUkVTRVRfQVVESU9fUVVFVUU6IlJFU0VUX0FVRElPX1FVRVVFIixQTEFZOiJQTEFZIixCUkVBS1BPSU5UOiJCUkVBS1BPSU5UIixQQVVTRToiUEFVU0UiLApVUERBVEVEOiJVUERBVEVEIixDUkFTSEVEOiJDUkFTSEVEIixTRVRfSk9ZUEFEX1NUQVRFOiJTRVRfSk9ZUEFEX1NUQVRFIixBVURJT19MQVRFTkNZOiJBVURJT19MQVRFTkNZIixSVU5fV0FTTV9FWFBPUlQ6IlJVTl9XQVNNX0VYUE9SVCIsR0VUX1dBU01fTUVNT1JZX1NFQ1RJT046IkdFVF9XQVNNX01FTU9SWV9TRUNUSU9OIixHRVRfV0FTTV9DT05TVEFOVDoiR0VUX1dBU01fQ09OU1RBTlQiLEZPUkNFX09VVFBVVF9GUkFNRToiRk9SQ0VfT1VUUFVUX0ZSQU1FIixTRVRfU1BFRUQ6IlNFVF9TUEVFRCIsSVNfR0JDOiJJU19HQkMifSxnPXtCT09UX1JPTToiQk9PVF9ST00iLENBUlRSSURHRV9SQU06IkNBUlRSSURHRV9SQU0iLENBUlRSSURHRV9ST006IkNBUlRSSURHRV9ST00iLENBUlRSSURHRV9IRUFERVI6IkNBUlRSSURHRV9IRUFERVIiLEdBTUVCT1lfTUVNT1JZOiJHQU1FQk9ZX01FTU9SWSIsUEFMRVRURV9NRU1PUlk6IlBBTEVUVEVfTUVNT1JZIixJTlRFUk5BTF9TVEFURToiSU5URVJOQUxfU1RBVEUifTsKbGV0IHQ9MCx5PXt9O2NvbnN0IEg9KGEsYik9PntsZXQgYz0iW1dhc21Cb3ldIjstOTk5OSE9PWEmJihjKz1gIDB4JHthLnRvU3RyaW5nKDE2KX0gYCk7LTk5OTkhPT1iJiYoYys9YCAweCR7Yi50b1N0cmluZygxNil9IGApO2NvbnNvbGUubG9nKGMpfSx6PXtpbmRleDp7Y29uc29sZUxvZzpILGNvbnNvbGVMb2dUaW1lb3V0OihhLGIsYyk9Pnt5W2FdfHwoeVthXT0hMCxIKGEsYiksc2V0VGltZW91dCgoKT0+e2RlbGV0ZSB5W2FdfSxjKSl9fSxlbnY6e2Fib3J0OigpPT57Y29uc29sZS5lcnJvcigiQXNzZW1ibHlTY3JpcHQgSW1wb3J0IE9iamVjdCBBYm9ydGVkISIpfX19LEk9YXN5bmMoYSk9PntsZXQgYj12b2lkIDA7cmV0dXJuIGI9V2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmc/YXdhaXQgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcoZmV0Y2goYSkseik6YXdhaXQgKGFzeW5jKCk9Pntjb25zdCBiPWF3YWl0IGZldGNoKGEpLnRoZW4oKGEpPT5hLmFycmF5QnVmZmVyKCkpOwpyZXR1cm4gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoYix6KX0pKCl9LE89YXN5bmMoYSk9PnthPUJ1ZmZlci5mcm9tKGEuc3BsaXQoIiwiKVsxXSwiYmFzZTY0Iik7cmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGEseil9LFA9YXN5bmMoYSk9PnthPShhP2F3YWl0IEkoImRhdGE6YXBwbGljYXRpb24vd2FzbTtiYXNlNjQsQUdGemJRRUFBQUFCaUFFUllBSi9md0YvWUFBQVlBTi9mMzhCZjJBRWYzOS9md0JnQW45L0FHQUJmd0YvWUFGL0FHQURmMzkvQUdBS2YzOS9mMzkvZjM5L2Z3QmdBQUYvWUFaL2YzOS9mMzhBWUFkL2YzOS9mMzkvQVg5Z0IzOS9mMzkvZjM4QVlBUi9mMzkvQVg5Z0NIOS9mMzkvZjM5L0FHQUZmMzkvZjM4QmYyQU5mMzkvZjM5L2YzOS9mMzkvZndGL0FnMEJBMlZ1ZGdWaFltOXlkQUFEQS84Qi9RRUVCQWNCQlFBR0JBWUdCZ0VFQndBQUJnVUZCd2NHQVFZR0JnRUZCUUVFQVFFR0JnRUJBUUVCQVFFR0FRRUdCZ0VCQVFFSUNRRUJBUUVCQVFFQkJnWUJBUUVCQVFFQkFRa0pDUWtQQUFJQUVBc01DZ29IQkFZQkFRWUJBUUVCQmdFQkFRRUZCUUFGQlFrQkJRVUFEUVlHQmdFRkNRVUZCQVlHQmdZR0FRWUJCZ0VHQVFZQUJna0pCZ1FGQUFZQkFRWUFCQWNCQUFFR0FRWUdDUWtFQkFZRUJnWUdCQVFIQlFVRkJRVUZCUVVGQkFZR0JRWUdCUVlHQlFZR0JRVUZCUVVGQlFVRkJRVUFCUVVGQlFVRkJna0pDUVVKQlFrSkNRVUVCZ1lPQmdFR0FRWUJDUWtKQ1FrSkNRa0pDUWtKQmdFQkNRa0pDUUVCQkFRQkJRWUFCUU1CQUFFRzdRdWJBbjhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BRUVBQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFJQzM4QVFZQVFDMzhBUVlDQUFRdC9BRUdBa0FFTGZ3QkJnSUFDQzM4QVFZQ1FBd3QvQUVHQWdBRUxmd0JCZ0JBTGZ3QkJnSUFFQzM4QVFZQ1FCQXQvQUVHQUFRdC9BRUdBa1FRTGZ3QkJnTGdCQzM4QVFZREpCUXQvQUVHQTJBVUxmd0JCZ0tFTEMzOEFRWUNBREF0L0FFR0FvUmNMZndCQmdJQUpDMzhBUVlDaElBdC9BRUdBK0FBTGZ3QkJnSkFFQzM4QVFZQ0pIUXQvQUVHQW1TRUxmd0JCZ0lBSUMzOEFRWUNaS1F0L0FFR0FnQWdMZndCQmdKa3hDMzhBUVlDQUNBdC9BRUdBbVRrTGZ3QkJnSUFJQzM4QVFZQ1p3UUFMZndCQmdJQUlDMzhBUVlDWnlRQUxmd0JCZ0lBSUMzOEFRWUNaMFFBTGZ3QkJnQlFMZndCQmdLM1JBQXQvQUVHQWlQZ0RDMzhBUVlDMXlRUUxmd0JCLy84REMzOEFRUUFMZndCQmdMWE5CQXQvQUVHVUFRdC9BVUVBQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVg4TGZ3RkJmd3QvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRVBDMzhCUVE4TGZ3RkJEd3QvQVVFUEMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCL3dBTGZ3RkIvd0FMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCZnd0L0FVRi9DMzhCUVg4TGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFRdC9BVUVCQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFZQ28xcmtIQzM4QlFRQUxmd0ZCQUF0L0FVR0FxTmE1Qnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVHQUFndC9BVUVBQ3dmd0VHVUdiV1Z0YjNKNUFnQUhYMTloYkd4dll3QVFDRjlmY21WMFlXbHVBQklKWDE5eVpXeGxZWE5sQUJvSlgxOWpiMnhzWldOMEFBd0xYMTl5ZEhScFgySmhjMlVEbVFJR1kyOXVabWxuQURRT2FHRnpRMjl5WlZOMFlYSjBaV1FBTlFsellYWmxVM1JoZEdVQVBBbHNiMkZrVTNSaGRHVUFSd1ZwYzBkQ1F3QklFbWRsZEZOMFpYQnpVR1Z5VTNSbGNGTmxkQUJKQzJkbGRGTjBaWEJUWlhSekFFb0laMlYwVTNSbGNITUFTeFZsZUdWamRYUmxUWFZzZEdsd2JHVkdjbUZ0WlhNQTFBRU1aWGhsWTNWMFpVWnlZVzFsQU5NQkNWOWZjMlYwWVhKbll3RDhBUmxsZUdWamRYUmxSbkpoYldWQmJtUkRhR1ZqYTBGMVpHbHZBUHNCRldWNFpXTjFkR1ZWYm5ScGJFTnZibVJwZEdsdmJnRDlBUXRsZUdWamRYUmxVM1JsY0FEUUFSUm5aWFJEZVdOc1pYTlFaWEpEZVdOc1pWTmxkQURWQVF4blpYUkRlV05zWlZObGRITUExZ0VKWjJWMFEzbGpiR1Z6QU5jQkRuTmxkRXB2ZVhCaFpGTjBZWFJsQU53QkgyZGxkRTUxYldKbGNrOW1VMkZ0Y0d4bGMwbHVRWFZrYVc5Q2RXWm1aWElBMFFFUVkyeGxZWEpCZFdScGIwSjFabVpsY2dCREhITmxkRTFoYm5WaGJFTnZiRzl5YVhwaGRHbHZibEJoYkdWMGRHVUFJaGRYUVZOTlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXhFMWRCVTAxQ1QxbGZUVVZOVDFKWlgxTkpXa1VETWhKWFFWTk5RazlaWDFkQlUwMWZVRUZIUlZNRE14NUJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVEU5RFFWUkpUMDREQlJwQlUxTkZUVUpNV1ZORFVrbFFWRjlOUlUxUFVsbGZVMGxhUlFNR0ZsZEJVMDFDVDFsZlUxUkJWRVZmVEU5RFFWUkpUMDREQnhKWFFWTk5RazlaWDFOVVFWUkZYMU5KV2tVRENDQkhRVTFGUWs5WlgwbE9WRVZTVGtGTVgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNUEhFZEJUVVZDVDFsZlNVNVVSVkpPUVV4ZlRVVk5UMUpaWDFOSldrVURFQkpXU1VSRlQxOVNRVTFmVEU5RFFWUkpUMDREQ1E1V1NVUkZUMTlTUVUxZlUwbGFSUU1LRVZkUFVrdGZVa0ZOWDB4UFEwRlVTVTlPQXdzTlYwOVNTMTlTUVUxZlUwbGFSUU1NSms5VVNFVlNYMGRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgweFBRMEZVU1U5T0F3MGlUMVJJUlZKZlIwRk5SVUpQV1Y5SlRsUkZVazVCVEY5TlJVMVBVbGxmVTBsYVJRTU9HRWRTUVZCSVNVTlRYMDlWVkZCVlZGOU1UME5CVkVsUFRnTWRGRWRTUVZCSVNVTlRYMDlWVkZCVlZGOVRTVnBGQXg0VVIwSkRYMUJCVEVWVVZFVmZURTlEUVZSSlQwNERFUkJIUWtOZlVFRk1SVlJVUlY5VFNWcEZBeElZUWtkZlVGSkpUMUpKVkZsZlRVRlFYMHhQUTBGVVNVOU9BeE1VUWtkZlVGSkpUMUpKVkZsZlRVRlFYMU5KV2tVREZBNUdVa0ZOUlY5TVQwTkJWRWxQVGdNVkNrWlNRVTFGWDFOSldrVURGaGRDUVVOTFIxSlBWVTVFWDAxQlVGOU1UME5CVkVsUFRnTVhFMEpCUTB0SFVrOVZUa1JmVFVGUVgxTkpXa1VER0JKVVNVeEZYMFJCVkVGZlRFOURRVlJKVDA0REdRNVVTVXhGWDBSQlZFRmZVMGxhUlFNYUVrOUJUVjlVU1V4RlUxOU1UME5CVkVsUFRnTWJEazlCVFY5VVNVeEZVMTlUU1ZwRkF4d1ZRVlZFU1U5ZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXljUlFWVkVTVTlmUWxWR1JrVlNYMU5KV2tVREtCbERTRUZPVGtWTVh6RmZRbFZHUmtWU1gweFBRMEZVU1U5T0F4OFZRMGhCVGs1RlRGOHhYMEpWUmtaRlVsOVRTVnBGQXlBWlEwaEJUazVGVEY4eVgwSlZSa1pGVWw5TVQwTkJWRWxQVGdNaEZVTklRVTVPUlV4Zk1sOUNWVVpHUlZKZlUwbGFSUU1pR1VOSVFVNU9SVXhmTTE5Q1ZVWkdSVkpmVEU5RFFWUkpUMDRESXhWRFNFRk9Ua1ZNWHpOZlFsVkdSa1ZTWDFOSldrVURKQmxEU0VGT1RrVk1YelJmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeVVWUTBoQlRrNUZURjgwWDBKVlJrWkZVbDlUU1ZwRkF5WVdRMEZTVkZKSlJFZEZYMUpCVFY5TVQwTkJWRWxQVGdNcEVrTkJVbFJTU1VSSFJWOVNRVTFmVTBsYVJRTXFFVUpQVDFSZlVrOU5YMHhQUTBGVVNVOU9BeXNOUWs5UFZGOVNUMDFmVTBsYVJRTXNGa05CVWxSU1NVUkhSVjlTVDAxZlRFOURRVlJKVDA0RExSSkRRVkpVVWtsRVIwVmZVazlOWDFOSldrVURMaDFFUlVKVlIxOUhRVTFGUWs5WlgwMUZUVTlTV1Y5TVQwTkJWRWxQVGdNdkdVUkZRbFZIWDBkQlRVVkNUMWxmVFVWTlQxSlpYMU5KV2tVRE1DRm5aWFJYWVhOdFFtOTVUMlptYzJWMFJuSnZiVWRoYldWQ2IzbFBabVp6WlhRQUhCdHpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUEzUUVkY21WelpYUlFjbTluY21GdFEyOTFiblJsY2tKeVpXRnJjRzlwYm5RQTNnRVpjMlYwVW1WaFpFZGlUV1Z0YjNKNVFuSmxZV3R3YjJsdWRBRGZBUnR5WlhObGRGSmxZV1JIWWsxbGJXOXllVUp5WldGcmNHOXBiblFBNEFFYWMyVjBWM0pwZEdWSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRRRWNjbVZ6WlhSWGNtbDBaVWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURpQVF4blpYUlNaV2RwYzNSbGNrRUE0d0VNWjJWMFVtVm5hWE4wWlhKQ0FPUUJER2RsZEZKbFoybHpkR1Z5UXdEbEFReG5aWFJTWldkcGMzUmxja1FBNWdFTVoyVjBVbVZuYVhOMFpYSkZBT2NCREdkbGRGSmxaMmx6ZEdWeVNBRG9BUXhuWlhSU1pXZHBjM1JsY2t3QTZRRU1aMlYwVW1WbmFYTjBaWEpHQU9vQkVXZGxkRkJ5YjJkeVlXMURiM1Z1ZEdWeUFPc0JEMmRsZEZOMFlXTnJVRzlwYm5SbGNnRHNBUmxuWlhSUGNHTnZaR1ZCZEZCeWIyZHlZVzFEYjNWdWRHVnlBTzBCQldkbGRFeFpBTzRCSFdSeVlYZENZV05yWjNKdmRXNWtUV0Z3Vkc5WFlYTnRUV1Z0YjNKNUFPOEJHR1J5WVhkVWFXeGxSR0YwWVZSdlYyRnpiVTFsYlc5eWVRRHdBUk5rY21GM1QyRnRWRzlYWVhOdFRXVnRiM0o1QVBFQkJtZGxkRVJKVmdEeUFRZG5aWFJVU1UxQkFQTUJCbWRsZEZSTlFRRDBBUVpuWlhSVVFVTUE5UUVUZFhCa1lYUmxSR1ZpZFdkSFFrMWxiVzl5ZVFEMkFRZ0M5d0VLaFpzQy9RR2dBZ0VFZnlBQktBSUFJZ05CQVhGRkJFQkJBRUVZUVpVQ1FRMFFBQUFMSUFOQmZIRWlBa0VRVHdSL0lBSkI4UC8vL3dOSkJVRUFDMFVFUUVFQVFSaEJsd0pCRFJBQUFBc2dBa0dBQWtrRWZ5QUNRUVIySVFKQkFBVWdBa0VmSUFKbmF5SURRUVJyZGtFUWN5RUNJQU5CQjJzTElnTkJGMGtFZnlBQ1FSQkpCVUVBQzBVRVFFRUFRUmhCcEFKQkRSQUFBQXNnQVNnQ0ZDRUVJQUVvQWhBaUJRUkFJQVVnQkRZQ0ZBc2dCQVJBSUFRZ0JUWUNFQXNnQTBFRWRDQUNha0VDZENBQWFpZ0NZQ0FCUmdSQUlBTkJCSFFnQW1wQkFuUWdBR29nQkRZQ1lDQUVSUVJBSUFOQkFuUWdBR29nQTBFQ2RDQUFhaWdDQkVFQklBSjBRWDl6Y1NJQk5nSUVJQUZGQkVBZ0FDQUFLQUlBUVFFZ0EzUkJmM054TmdJQUN3c0xDLzBEQVFaL0lBRkZCRUJCQUVFWVFjMEJRUTBRQUFBTElBRW9BZ0FpQTBFQmNVVUVRRUVBUVJoQnp3RkJEUkFBQUFzZ0FVRVFhaUFCS0FJQVFYeHhhaUlFS0FJQUlnVkJBWEVFUUNBRFFYeHhRUkJxSUFWQmZIRnFJZ0pCOFAvLy93TkpCRUFnQUNBRUVBRWdBU0FEUVFOeElBSnlJZ00yQWdBZ0FVRVFhaUFCS0FJQVFYeHhhaUlFS0FJQUlRVUxDeUFEUVFKeEJFQWdBVUVFYXlnQ0FDSUNLQUlBSWdaQkFYRkZCRUJCQUVFWVFlUUJRUThRQUFBTElBWkJmSEZCRUdvZ0EwRjhjV29pQjBIdy8vLy9BMGtFZnlBQUlBSVFBU0FDSUFaQkEzRWdCM0lpQXpZQ0FDQUNCU0FCQ3lFQkN5QUVJQVZCQW5JMkFnQWdBMEY4Y1NJQ1FSQlBCSDhnQWtIdy8vLy9BMGtGUVFBTFJRUkFRUUJCR0VIekFVRU5FQUFBQ3lBRUlBRkJFR29nQW1wSEJFQkJBRUVZUWZRQlFRMFFBQUFMSUFSQkJHc2dBVFlDQUNBQ1FZQUNTUVIvSUFKQkJIWWhCRUVBQlNBQ1FSOGdBbWRySWdKQkJHdDJRUkJ6SVFRZ0FrRUhhd3NpQTBFWFNRUi9JQVJCRUVrRlFRQUxSUVJBUVFCQkdFR0VBa0VORUFBQUN5QURRUVIwSUFScVFRSjBJQUJxS0FKZ0lRSWdBVUVBTmdJUUlBRWdBallDRkNBQ0JFQWdBaUFCTmdJUUN5QURRUVIwSUFScVFRSjBJQUJxSUFFMkFtQWdBQ0FBS0FJQVFRRWdBM1J5TmdJQUlBTkJBblFnQUdvZ0EwRUNkQ0FBYWlnQ0JFRUJJQVIwY2pZQ0JBdkxBUUVDZnlBQ1FROXhSVUVBSUFGQkQzRkZRUUFnQVNBQ1RSc2JSUVJBUVFCQkdFR0NBMEVFRUFBQUN5QUFLQUtnRENJREJFQWdBU0FEUVJCcVNRUkFRUUJCR0VHTUEwRVBFQUFBQ3lBQlFSQnJJQU5HQkVBZ0F5Z0NBQ0VFSUFGQkVHc2hBUXNGSUFFZ0FFR2tER3BKQkVCQkFFRVlRWmdEUVFRUUFBQUxDeUFDSUFGcklnSkJNRWtFUUE4TElBRWdCRUVDY1NBQ1FTQnJRUUZ5Y2pZQ0FDQUJRUUEyQWhBZ0FVRUFOZ0lVSUFFZ0FtcEJFR3NpQWtFQ05nSUFJQUFnQWpZQ29Bd2dBQ0FCRUFJTGx3RUJBbjlCQVQ4QUlnQktCSDlCQVNBQWEwQUFRUUJJQlVFQUN3UkFBQXRCb0FKQkFEWUNBRUhBRGtFQU5nSUFRUUFoQUFOQUFrQWdBRUVYVHcwQUlBQkJBblJCb0FKcVFRQTJBZ1JCQUNFQkEwQUNRQ0FCUVJCUERRQWdBRUVFZENBQmFrRUNkRUdnQW1wQkFEWUNZQ0FCUVFGcUlRRU1BUXNMSUFCQkFXb2hBQXdCQ3d0Qm9BSkIwQTQvQUVFUWRCQURRYUFDSkFBTExRQWdBRUh3Ly8vL0EwOEVRRUhJQUVFWVFja0RRUjBRQUFBTElBQkJEMnBCY0hFaUFFRVFJQUJCRUVzYkM5MEJBUUYvSUFGQmdBSkpCSDhnQVVFRWRpRUJRUUFGSUFGQitQLy8vd0ZKQkVCQkFVRWJJQUZuYTNRZ0FXcEJBV3NoQVFzZ0FVRWZJQUZuYXlJQ1FRUnJka0VRY3lFQklBSkJCMnNMSWdKQkYwa0VmeUFCUVJCSkJVRUFDMFVFUUVFQVFSaEIwZ0pCRFJBQUFBc2dBa0VDZENBQWFpZ0NCRUYvSUFGMGNTSUJCSDhnQVdnZ0FrRUVkR3BCQW5RZ0FHb29BbUFGSUFBb0FnQkJmeUFDUVFGcWRIRWlBUVIvSUFGb0lnRkJBblFnQUdvb0FnUWlBa1VFUUVFQVFSaEIzd0pCRVJBQUFBc2dBbWdnQVVFRWRHcEJBblFnQUdvb0FtQUZRUUFMQ3dzN0FRRi9JQUFvQWdRaUFVR0FnSUNBQjNGQmdJQ0FnQUZIQkVBZ0FDQUJRZi8vLy85NGNVR0FnSUNBQVhJMkFnUWdBRUVRYWtFQ0VQa0JDd3N0QVFGL0lBRW9BZ0FpQWtFQmNRUkFRUUJCR0VHekJFRUNFQUFBQ3lBQklBSkJBWEkyQWdBZ0FDQUJFQUlMSFFBZ0FDQUFLQUlFUWYvLy8vOTRjVFlDQkNBQVFSQnFRUVFRK1FFTFR3RUJmeUFBS0FJRUlnRkJnSUNBZ0FkeFFZQ0FnSUFCUmdSQUlBRkIvLy8vL3dCeFFRQkxCRUFnQUJBSkJTQUFJQUZCLy8vLy8zaHhRWUNBZ0lBQ2NqWUNCQ0FBUVJCcVFRTVErUUVMQ3d0S0FRRi9JQUFvQWdRaUFVR0FnSUNBQjNGQmdJQ0FnQUpHQkg4Z0FVR0FnSUNBZUhGRkJVRUFDd1JBSUFBZ0FVSC8vLy8vZUhFMkFnUWdBRUVRYWtFRkVQa0JJd0FnQUJBSUN3dnpBUUVHZnlNQ0lnVWlBaUVESXdNaEFBTkFBa0FnQXlBQVR3MEFJQU1vQWdBaUJDZ0NCQ0lCUVlDQWdJQUhjVUdBZ0lDQUEwWUVmeUFCUWYvLy8vOEFjVUVBU3dWQkFBc0VRQ0FFRUFjZ0FpQUVOZ0lBSUFKQkJHb2hBZ1ZCQUNBQlFmLy8vLzhBY1VVZ0FVR0FnSUNBQjNFYkJFQWpBQ0FFRUFnRklBUWdBVUgvLy8vL0IzRTJBZ1FMQ3lBRFFRUnFJUU1NQVFzTElBSWtBeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBRUFvZ0FFRUVhaUVBREFFTEN5QUZJUUFEUUFKQUlBQWdBazhOQUNBQUtBSUFJZ0VnQVNnQ0JFSC8vLy8vQjNFMkFnUWdBUkFMSUFCQkJHb2hBQXdCQ3dzZ0JTUURDMjhCQVg4L0FDSUNJQUZCK1AvLy93RkpCSDlCQVVFYklBRm5hM1JCQVdzZ0FXb0ZJQUVMUVJBZ0FDZ0NvQXdnQWtFUWRFRVFhMGQwYWtILy93TnFRWUNBZkhGQkVIWWlBU0FDSUFGS0cwQUFRUUJJQkVBZ0FVQUFRUUJJQkVBQUN3c2dBQ0FDUVJCMFB3QkJFSFFRQXd1SEFRRUNmeUFCS0FJQUlRTWdBa0VQY1FSQVFRQkJHRUh0QWtFTkVBQUFDeUFEUVh4eElBSnJJZ1JCSUU4RVFDQUJJQU5CQW5FZ0FuSTJBZ0FnQVVFUWFpQUNhaUlCSUFSQkVHdEJBWEkyQWdBZ0FDQUJFQUlGSUFFZ0EwRitjVFlDQUNBQlFSQnFJQUVvQWdCQmZIRnFJQUZCRUdvZ0FTZ0NBRUY4Y1dvb0FnQkJmWEUyQWdBTEM1RUJBUUovSXdFRVFFRUFRUmhCNWdOQkRSQUFBQXNnQUNBQkVBVWlBeEFHSWdKRkJFQkJBU1FCRUF4QkFDUUJJQUFnQXhBR0lnSkZCRUFnQUNBREVBMGdBQ0FERUFZaUFrVUVRRUVBUVJoQjhnTkJFeEFBQUFzTEN5QUNLQUlBUVh4eElBTkpCRUJCQUVFWVFmb0RRUTBRQUFBTElBSkJBRFlDQkNBQ0lBRTJBZ3dnQUNBQ0VBRWdBQ0FDSUFNUURpQUNDeUlCQVg4akFDSUNCSDhnQWdVUUJDTUFDeUFBRUE4aUFDQUJOZ0lJSUFCQkVHb0xVUUVCZnlBQUtBSUVJZ0ZCZ0lDQWdIOXhJQUZCQVdwQmdJQ0FnSDl4UndSQVFRQkJnQUZCNkFCQkFoQUFBQXNnQUNBQlFRRnFOZ0lFSUFBb0FnQkJBWEVFUUVFQVFZQUJRZXNBUVEwUUFBQUxDeFFBSUFCQm5BSkxCRUFnQUVFUWF4QVJDeUFBQ3ljQUlBQkJnQUlvQWdCTEJFQkJzQUZCNkFGQkZrRWJFQUFBQ3lBQVFRTjBRWVFDYWlnQ0FBdkVEQUVEZndOQUlBRkJBM0ZCQUNBQ0d3UkFJQUFpQTBFQmFpRUFJQUVpQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFGcklRSU1BUXNMSUFCQkEzRkZCRUFEUUNBQ1FSQkpSUVJBSUFBZ0FTZ0NBRFlDQUNBQVFRUnFJQUZCQkdvb0FnQTJBZ0FnQUVFSWFpQUJRUWhxS0FJQU5nSUFJQUJCREdvZ0FVRU1haWdDQURZQ0FDQUJRUkJxSVFFZ0FFRVFhaUVBSUFKQkVHc2hBZ3dCQ3dzZ0FrRUljUVJBSUFBZ0FTZ0NBRFlDQUNBQVFRUnFJQUZCQkdvb0FnQTJBZ0FnQVVFSWFpRUJJQUJCQ0dvaEFBc2dBa0VFY1FSQUlBQWdBU2dDQURZQ0FDQUJRUVJxSVFFZ0FFRUVhaUVBQ3lBQ1FRSnhCRUFnQUNBQkx3RUFPd0VBSUFGQkFtb2hBU0FBUVFKcUlRQUxJQUpCQVhFRVFDQUFJQUV0QUFBNkFBQUxEd3NnQWtFZ1R3UkFBa0FDUUFKQUlBQkJBM0VpQTBFQlJ3UkFJQU5CQWtZTkFTQURRUU5HRFFJTUF3c2dBU2dDQUNFRklBQWdBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUEwRUJhaUVBSUFGQkFXb2lCRUVCYWlFQklBTWdCQzBBQURvQUFDQUNRUU5ySVFJRFFDQUNRUkZKUlFSQUlBQWdBVUVCYWlnQ0FDSURRUWgwSUFWQkdIWnlOZ0lBSUFCQkJHb2dBMEVZZGlBQlFRVnFLQUlBSWdOQkNIUnlOZ0lBSUFCQkNHb2dBMEVZZGlBQlFRbHFLQUlBSWdOQkNIUnlOZ0lBSUFCQkRHb2dBVUVOYWlnQ0FDSUZRUWgwSUFOQkdIWnlOZ0lBSUFGQkVHb2hBU0FBUVJCcUlRQWdBa0VRYXlFQ0RBRUxDd3dDQ3lBQktBSUFJUVVnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFKcklRSURRQ0FDUVJKSlJRUkFJQUFnQVVFQ2FpZ0NBQ0lEUVJCMElBVkJFSFp5TmdJQUlBQkJCR29nQTBFUWRpQUJRUVpxS0FJQUlnTkJFSFJ5TmdJQUlBQkJDR29nQTBFUWRpQUJRUXBxS0FJQUlnTkJFSFJ5TmdJQUlBQkJER29nQVVFT2FpZ0NBQ0lGUVJCMElBTkJFSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3QkN5QUJLQUlBSVFVZ0FDSURRUUZxSVFBZ0FTSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUlBSkJBV3NoQWdOQUlBSkJFMGxGQkVBZ0FDQUJRUU5xS0FJQUlnTkJHSFFnQlVFSWRuSTJBZ0FnQUVFRWFpQURRUWgySUFGQkIyb29BZ0FpQTBFWWRISTJBZ0FnQUVFSWFpQURRUWgySUFGQkMyb29BZ0FpQTBFWWRISTJBZ0FnQUVFTWFpQUJRUTlxS0FJQUlnVkJHSFFnQTBFSWRuSTJBZ0FnQVVFUWFpRUJJQUJCRUdvaEFDQUNRUkJySVFJTUFRc0xDd3NnQWtFUWNRUkFJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSURRUUZxSVFBZ0FVRUJhaUlFUVFGcUlRRWdBeUFFTFFBQU9nQUFDeUFDUVFoeEJFQWdBQ0FCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQXNnQWtFRWNRUkFJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRSnhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQXNnQWtFQmNRUkFJQUFnQVMwQUFEb0FBQXNMMGdJQkFuOENRQ0FDSVFNZ0FDQUJSZzBBUVFFZ0FDQURhaUFCVFNBQklBTnFJQUJOR3dSQUlBQWdBU0FERUJRTUFRc2dBQ0FCU1FSQUlBRkJCM0VnQUVFSGNVWUVRQU5BSUFCQkIzRUVRQ0FEUlEwRUlBTkJBV3NoQXlBQUlnSkJBV29oQUNBQklnUkJBV29oQVNBQ0lBUXRBQUE2QUFBTUFRc0xBMEFnQTBFSVNVVUVRQ0FBSUFFcEF3QTNBd0FnQTBFSWF5RURJQUJCQ0dvaEFDQUJRUWhxSVFFTUFRc0xDd05BSUFNRVFDQUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQWdBMEVCYXlFRERBRUxDd1VnQVVFSGNTQUFRUWR4UmdSQUEwQWdBQ0FEYWtFSGNRUkFJQU5GRFFRZ0FDQURRUUZySWdOcUlBRWdBMm90QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBTkJDR3NpQTJvZ0FTQURhaWtEQURjREFBd0JDd3NMQTBBZ0F3UkFJQUFnQTBFQmF5SURhaUFCSUFOcUxRQUFPZ0FBREFFTEN3c0xDemdBSXdCRkJFQkJBRUVZUWRFRVFRMFFBQUFMSUFCQkQzRkZRUUFnQUJ0RkJFQkJBRUVZUWRJRVFRSVFBQUFMSXdBZ0FFRVFheEFJQzBVQkJIOGpBeU1DSWdGcklnSkJBWFFpQUVHQUFpQUFRWUFDU3hzaUEwRUFFQkFpQUNBQklBSVFGU0FCQkVBZ0FSQVdDeUFBSkFJZ0FDQUNhaVFESUFBZ0Eyb2tCQXNpQVFGL0l3TWlBU01FVHdSQUVCY2pBeUVCQ3lBQklBQTJBZ0FnQVVFRWFpUURDN1lCQVFKL0lBQW9BZ1FpQWtILy8vLy9BSEVoQVNBQUtBSUFRUUZ4QkVCQkFFR0FBVUh6QUVFTkVBQUFDeUFCUVFGR0JFQWdBRUVRYWtFQkVQa0JJQUpCZ0lDQWdIaHhCRUFnQUVHQWdJQ0FlRFlDQkFVakFDQUFFQWdMQlNBQlFRQk5CRUJCQUVHQUFVSDhBRUVQRUFBQUN5QUFLQUlJRUJOQkVIRUVRQ0FBSUFGQkFXc2dBa0dBZ0lDQWYzRnlOZ0lFQlNBQUlBRkJBV3RCZ0lDQWdIdHlOZ0lFSUFKQmdJQ0FnSGh4UlFSQUlBQVFHQXNMQ3dzU0FDQUFRWndDU3dSQUlBQkJFR3NRR1FzTFV3QkI4dVhMQnlRK1FhREJnZ1VrUDBIWXNPRUNKRUJCaUpBZ0pFRkI4dVhMQnlSQ1FhREJnZ1VrUTBIWXNPRUNKRVJCaUpBZ0pFVkI4dVhMQnlSR1FhREJnZ1VrUjBIWXNPRUNKRWhCaUpBZ0pFa0xsd0lCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQkRIVWlBUVJBSUFGQkFVWU5BUUpBSUFGQkFtc09EQUlDQXdNREF3UUVCUVVHQndBTERBY0xJNEFDQkVBamdRSUVRQ0FBUVlBQ1NBMEpJQUJCZ0JKSVFRQWdBRUgvQTBvYkRRa0ZRUUFnQUVHQUFrZ2pnUUliRFFrTEN3c2dBRUdBcmRFQWFnOExJQUJCQVNQeUFTSUFRUUFnQUVVaitnRWJHMEVPZEdwQmdLM1FBR29QQ3lBQVFZQ1FmbW9qZ1FJRWYwSFAvZ01RSFVFQmNRVkJBQXRCRFhScUR3c2dBQ1B6QVVFTmRHcEJnTm5HQUdvUEN5QUFRWUNRZm1vUEMwRUFJUUVDZnlPQkFnUkFRZkQrQXhBZFFRZHhJUUVMSUFGQkFVZ0xCSDlCQVFVZ0FRdEJESFFnQUdwQmdQQjlhZzhMSUFCQmdGQnFEd3NnQUVHQW1kRUFhZ3NKQUNBQUVCd3RBQUFMd3dFQVFRQWtnZ0pCQUNTREFrRUFKSVFDUVFBa2hRSkJBQ1NHQWtFQUpJY0NRUUFraUFKQkFDU0pBa0VBSklvQ1FRQWtpd0pCQUNTTUFrRUFKSTBDUVFBa2pnSkJBQ1NQQWtFQUpKQUNRUUFra1FJamdBSUVRQThMSTRFQ0JFQkJFU1NEQWtHQUFTU0tBa0VBSklRQ1FRQWtoUUpCL3dFa2hnSkIxZ0FraHdKQkFDU0lBa0VOSklrQ0JVRUJKSU1DUWJBQkpJb0NRUUFraEFKQkV5U0ZBa0VBSklZQ1FkZ0JKSWNDUVFFa2lBSkJ6UUFraVFJTFFZQUNKSXdDUWY3L0F5U0xBZ3NMQUNBQUVCd2dBVG9BQUF0ekFRRi9RUUFrOUFGQkFTVDFBVUhIQWhBZElnQkZKUFlCSUFCQkEweEJBQ0FBUVFGT0d5VDNBU0FBUVFaTVFRQWdBRUVGVGhzaytBRWdBRUVUVEVFQUlBQkJEMDRiSlBrQklBQkJIa3hCQUNBQVFSbE9HeVQ2QVVFQkpQSUJRUUFrOHdGQnovNERRUUFRSDBIdy9nTkJBUkFmQ3k4QVFkSCtBMEgvQVJBZlFkTCtBMEgvQVJBZlFkUCtBMEgvQVJBZlFkVCtBMEgvQVJBZlFkWCtBMEgvQVJBZkM3QUlBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUFFUUNBQVFRRkdEUUVDUUNBQVFRSnJEZ3NEQkFVR0J3Z0pDZ3NNRFFBTERBMExRZkxseXdja1BrR2d3WUlGSkQ5QjJMRGhBaVJBUVlpUUlDUkJRZkxseXdja1FrR2d3WUlGSkVOQjJMRGhBaVJFUVlpUUlDUkZRZkxseXdja1JrR2d3WUlGSkVkQjJMRGhBaVJJUVlpUUlDUkpEQXdMUWYvLy93Y2tQa0hqMnY0SEpEOUJnT0tRQkNSQVFRQWtRVUgvLy84SEpFSkI0OXIrQnlSRFFZRGlrQVFrUkVFQUpFVkIvLy8vQnlSR1FlUGEvZ2NrUjBHQTRwQUVKRWhCQUNSSkRBc0xRZi8vL3dja1BrR0VpZjRISkQ5QnV2VFFCQ1JBUVFBa1FVSC8vLzhISkVKQnNmN3ZBeVJEUVlDSUFpUkVRUUFrUlVILy8vOEhKRVpCLzh1T0F5UkhRZjhCSkVoQkFDUkpEQW9MUWNYTi93Y2tQa0dFdWJvR0pEOUJxZGFSQkNSQVFZamk2QUlrUVVILy8vOEhKRUpCNDlyK0J5UkRRWURpa0FRa1JFRUFKRVZCLy8vL0J5UkdRZVBhL2dja1IwR0E0cEFFSkVoQkFDUkpEQWtMUWYvLy93Y2tQa0dBL3NzQ0pEOUJnSVQ5QnlSQVFRQWtRVUgvLy84SEpFSkJnUDdMQWlSRFFZQ0UvUWNrUkVFQUpFVkIvLy8vQnlSR1FZRCt5d0lrUjBHQWhQMEhKRWhCQUNSSkRBZ0xRZi8vL3dja1BrR3gvdThESkQ5QnhjY0JKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVRUUFrUlVILy8vOEhKRVpCaEluK0J5UkhRYnIwMEFRa1NFRUFKRWtNQnd0QkFDUStRWVNKQWlRL1FZQzgvd2NrUUVILy8vOEhKRUZCQUNSQ1FZU0pBaVJEUVlDOC93Y2tSRUgvLy84SEpFVkJBQ1JHUVlTSkFpUkhRWUM4L3dja1NFSC8vLzhISkVrTUJndEJwZi8vQnlRK1FaU3AvZ2NrUDBIL3FkSUVKRUJCQUNSQlFhWC8vd2NrUWtHVXFmNEhKRU5CLzZuU0JDUkVRUUFrUlVHbC8vOEhKRVpCbEtuK0J5UkhRZitwMGdRa1NFRUFKRWtNQlF0Qi8vLy9CeVErUVlEKy93Y2tQMEdBZ1B3SEpFQkJBQ1JCUWYvLy93Y2tRa0dBL3Y4SEpFTkJnSUQ4QnlSRVFRQWtSVUgvLy84SEpFWkJnUDcvQnlSSFFZQ0EvQWNrU0VFQUpFa01CQXRCLy8vL0J5UStRWUQrL3dja1AwR0FsTzBESkVCQkFDUkJRZi8vL3dja1FrSC95NDRESkVOQi93RWtSRUVBSkVWQi8vLy9CeVJHUWJIKzd3TWtSMEdBaUFJa1NFRUFKRWtNQXd0Qi8vLy9CeVErUWYvTGpnTWtQMEgvQVNSQVFRQWtRVUgvLy84SEpFSkJoSW4rQnlSRFFicjAwQVFrUkVFQUpFVkIvLy8vQnlSR1FiSCs3d01rUjBHQWlBSWtTRUVBSkVrTUFndEIvLy8vQnlRK1FkNlpzZ1FrUDBHTXBja0NKRUJCQUNSQlFmLy8vd2NrUWtHRWlmNEhKRU5CdXZUUUJDUkVRUUFrUlVILy8vOEhKRVpCNDlyK0J5UkhRWURpa0FRa1NFRUFKRWtNQVF0Qi8vLy9CeVErUWFYTGxnVWtQMEhTcE1rQ0pFQkJBQ1JCUWYvLy93Y2tRa0dseTVZRkpFTkIwcVRKQWlSRVFRQWtSVUgvLy84SEpFWkJwY3VXQlNSSFFkS2t5UUlrU0VFQUpFa0xDOW9JQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlnQlJ3UkFJQUJCNFFCR0RRRWdBRUVVUmcwQ0lBQkJ4Z0JHRFFNZ0FFSFpBRVlOQkNBQVFjWUJSZzBFSUFCQmhnRkdEUVVnQUVHb0FVWU5CU0FBUWI4QlJnMEdJQUJCemdGR0RRWWdBRUhSQVVZTkJpQUFRZkFCUmcwR0lBQkJKMFlOQnlBQVFja0FSZzBISUFCQjNBQkdEUWNnQUVHekFVWU5CeUFBUWNrQlJnMElJQUJCOEFCR0RRa2dBRUhHQUVZTkNpQUFRZE1CUmcwTERBd0xRZis1bGdVa1BrR0EvdjhISkQ5QmdNWUJKRUJCQUNSQlFmKzVsZ1VrUWtHQS92OEhKRU5CZ01ZQkpFUkJBQ1JGUWYrNWxnVWtSa0dBL3Y4SEpFZEJnTVlCSkVoQkFDUkpEQXNMUWYvLy93Y2tQa0gveTQ0REpEOUIvd0VrUUVFQUpFRkIvLy8vQnlSQ1FZU0ovZ2NrUTBHNjlOQUVKRVJCQUNSRlFmLy8vd2NrUmtIL3k0NERKRWRCL3dFa1NFRUFKRWtNQ2d0Qi8vLy9CeVErUVlTSi9nY2tQMEc2OU5BRUpFQkJBQ1JCUWYvLy93Y2tRa0d4L3U4REpFTkJnSWdDSkVSQkFDUkZRZi8vL3dja1JrR0VpZjRISkVkQnV2VFFCQ1JJUVFBa1NRd0pDMEgvNjlZRkpENUJsUC8vQnlRL1FjSzB0UVVrUUVFQUpFRkJBQ1JDUWYvLy93Y2tRMEdFaWY0SEpFUkJ1dlRRQkNSRlFRQWtSa0gvLy84SEpFZEJoSW4rQnlSSVFicjAwQVFrU1F3SUMwSC8vLzhISkQ1QmhOdTJCU1EvUWZ2bWlRSWtRRUVBSkVGQi8vLy9CeVJDUVlEbS9RY2tRMEdBaE5FRUpFUkJBQ1JGUWYvLy93Y2tSa0gvKytvQ0pFZEJnSUQ4QnlSSVFmOEJKRWtNQnd0Qm5QLy9CeVErUWYvcjBnUWtQMEh6cUk0REpFQkJ1dlFBSkVGQndvci9CeVJDUVlDcy93Y2tRMEdBOU5BRUpFUkJnSUNvQWlSRlFmLy8vd2NrUmtHRWlmNEhKRWRCdXZUUUJDUklRUUFrU1F3R0MwR0EvcThESkQ1Qi8vLy9CeVEvUWNxay9RY2tRRUVBSkVGQi8vLy9CeVJDUWYvLy93Y2tRMEgveTQ0REpFUkIvd0VrUlVILy8vOEhKRVpCNDlyK0J5UkhRWURpa0FRa1NFRUFKRWtNQlF0Qi83bVdCU1ErUVlEKy93Y2tQMEdBeGdFa1FFRUFKRUZCMHNiOUJ5UkNRWUNBMkFZa1EwR0FnSXdESkVSQkFDUkZRZjhCSkVaQi8vLy9CeVJIUWZ2Ky93Y2tTRUgvaVFJa1NRd0VDMEhPLy84SEpENUI3OStQQXlRL1FiR0k4Z1FrUUVIYXRPa0NKRUZCLy8vL0J5UkNRWURtL1Fja1EwR0FoTkVFSkVSQkFDUkZRZi8vL3dja1JrSC95NDRESkVkQi93RWtTRUVBSkVrTUF3dEIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHQS9nTWtRMEdBaU1ZQkpFUkJnSlFCSkVWQi8vLy9CeVJHUWYvTGpnTWtSMEgvQVNSSVFRQWtTUXdDQzBILy8vOEhKRDVCLzh1T0F5US9RZjhCSkVCQkFDUkJRWUQrL3dja1FrR0FnUHdISkVOQmdJQ01BeVJFUVFBa1JVSC8vLzhISkVaQnNmN3ZBeVJIUVlDSUFpUklRUUFrU1F3QkMwSC8vLzhISkQ1QmhOdTJCU1EvUWZ2bWlRSWtRRUVBSkVGQi8vLy9CeVJDUWVQYS9nY2tRMEhqMnY0SEpFUkJBQ1JGUWYvLy93Y2tSa0gveTQ0REpFZEIvd0VrU0VFQUpFa0xDMG9CQW45QkFCQWlJNEVDQkVBUEN5T0FBZ1JBSTRFQ1JRUkFEd3NMUWJRQ0lRQURRQUpBSUFCQnd3SktEUUFnQUJBZElBRnFJUUVnQUVFQmFpRUFEQUVMQ3lBQlFmOEJjUkFqQzl3QkFFRUFKT3NCUVFBazdBRkJBQ1R0QVVFQUpPNEJRUUFrN3dGQkFDVHdBVUVBSlBFQlFaQUJKTzBCSTRFQ0JFQkJ3ZjREUVlFQkVCOUJ4UDREUVpBQkVCOUJ4LzREUWZ3QkVCOEZRY0grQTBHRkFSQWZRY2IrQTBIL0FSQWZRY2YrQTBIOEFSQWZRY2orQTBIL0FSQWZRY24rQTBIL0FSQWZDMEdRQVNUdEFVSEEvZ05Ca0FFUUgwSFAvZ05CQUJBZlFmRCtBMEVCRUI4amdBSUVRQ09CQWdSQVFRQWs3UUZCd1A0RFFRQVFIMEhCL2dOQmdBRVFIMEhFL2dOQkFCQWZCVUVBSk8wQlFjRCtBMEVBRUI5QndmNERRWVFCRUI4TEN4QWtDMjBBSTRFQ0JFQkI2UDREUWNBQkVCOUI2ZjREUWY4QkVCOUI2djREUWNFQkVCOUI2LzREUVEwUUh3VkI2UDREUWY4QkVCOUI2ZjREUWY4QkVCOUI2djREUWY4QkVCOUI2LzREUWY4QkVCOExJNEVDUVFBamdBSWJCRUJCNmY0RFFTQVFIMEhyL2dOQmlnRVFId3NMVmdCQmtQNERRWUFCRUI5QmtmNERRYjhCRUI5Qmt2NERRZk1CRUI5QmsvNERRY0VCRUI5QmxQNERRYjhCRUI4amdBSUVRRUdSL2dOQlB4QWZRWkwrQTBFQUVCOUJrLzREUVFBUUgwR1UvZ05CdUFFUUh3c0xMQUJCbGY0RFFmOEJFQjlCbHY0RFFUOFFIMEdYL2dOQkFCQWZRWmorQTBFQUVCOUJtZjREUWJnQkVCOExNd0JCbXY0RFFmOEFFQjlCbS80RFFmOEJFQjlCblA0RFFaOEJFQjlCbmY0RFFRQVFIMEdlL2dOQnVBRVFIMEVCSklZQkN5MEFRWi8rQTBIL0FSQWZRYUQrQTBIL0FSQWZRYUgrQTBFQUVCOUJvdjREUVFBUUgwR2ovZ05CdndFUUh3dGNBQ0FBUVlBQmNVRUFSeVN0QVNBQVFjQUFjVUVBUnlTc0FTQUFRU0J4UVFCSEpLc0JJQUJCRUhGQkFFY2txZ0VnQUVFSWNVRUFSeVN4QVNBQVFRUnhRUUJISkxBQklBQkJBbkZCQUVja3J3RWdBRUVCY1VFQVJ5U3VBUXRGQUVFUEpKb0JRUThrbXdGQkR5U2NBVUVQSkowQlFRQWtuZ0ZCQUNTZkFVRUFKS0FCUVFBa29RRkIvd0Frb2dGQi93QWtvd0ZCQVNTa0FVRUJKS1VCUVFBa3BnRUx2UUVBUVFBa3B3RkJBQ1NvQVVFQUpLa0JRUUVrcWdGQkFTU3JBVUVCSkt3QlFRRWtyUUZCQVNTdUFVRUJKSzhCUVFFa3NBRkJBU1N4QVVFQkpMSUJRUUFrc3dGQkFDUzBBVUVBSkxVQlFRQWt0Z0VRSnhBb0VDa1FLa0drL2dOQjl3QVFIMEVISktnQlFRY2txUUZCcGY0RFFmTUJFQjlCOHdFUUswR20vZ05COFFFUUgwRUJKTElCSTRBQ0JFQkJwUDREUVFBUUgwRUFKS2dCUVFBa3FRRkJwZjREUVFBUUgwRUFFQ3RCcHY0RFFmQUFFQjlCQUNTeUFRc1FMQXMrQUNBQVFRRnhRUUJISkxvQklBQkJBbkZCQUVja3V3RWdBRUVFY1VFQVJ5UzhBU0FBUVFoeFFRQkhKTDBCSUFCQkVIRkJBRWNrdmdFZ0FDUzVBUXMrQUNBQVFRRnhRUUJISk1BQklBQkJBbkZCQUVja3dRRWdBRUVFY1VFQVJ5VENBU0FBUVFoeFFRQkhKTU1CSUFCQkVIRkJBRWNreEFFZ0FDUy9BUXQ0QUVFQUpNVUJRUUFreGdGQkFDVEhBVUVBSk1vQlFRQWt5d0ZCQUNUTUFVRUFKTWdCUVFBa3lRRWpnUUlFUUVHRS9nTkJIaEFmUWFBOUpNWUJCVUdFL2dOQnF3RVFIMEhNMXdJa3hnRUxRWWYrQTBINEFSQWZRZmdCSk13Qkk0QUNCRUFqZ1FKRkJFQkJoUDREUVFBUUgwRUVKTVlCQ3dzTFF3QkJBQ1ROQVVFQUpNNEJJNEVDQkVCQmd2NERRZndBRUI5QkFDVFBBVUVBSk5BQlFRQWswUUVGUVlMK0EwSCtBQkFmUVFBa3p3RkJBU1RRQVVFQUpORUJDd3QxQUNPQkFnUkFRZkQrQTBINEFSQWZRYy8rQTBIK0FSQWZRYzMrQTBIK0FCQWZRWUQrQTBIUEFSQWZRWS8rQTBIaEFSQWZRZXorQTBIK0FSQWZRZlgrQTBHUEFSQWZCVUh3L2dOQi93RVFIMEhQL2dOQi93RVFIMEhOL2dOQi93RVFIMEdBL2dOQnp3RVFIMEdQL2dOQjRRRVFId3NMbGdFQkFYOUJ3d0lRSFNJQVFjQUJSZ1IvUVFFRklBQkJnQUZHUVFBak5Sc0xCRUJCQVNTQkFnVkJBQ1NCQWd0QkFDU1lBa0dBcU5hNUJ5U1NBa0VBSkpNQ1FRQWtsQUpCZ0tqV3VRY2tsUUpCQUNTV0FrRUFKSmNDSXpRRVFFRUJKSUFDQlVFQUpJQUNDeEFlRUNBUUlSQWxFQ1lRTFVFQUVDNUIvLzhESTdrQkVCOUI0UUVRTDBHUC9nTWp2d0VRSHhBd0VERVFNZ3RLQUNBQVFRQktKRFFnQVVFQVNpUTFJQUpCQUVva05pQURRUUJLSkRjZ0JFRUFTaVE0SUFWQkFFb2tPU0FHUVFCS0pEb2dCMEVBU2lRN0lBaEJBRW9rUENBSlFRQktKRDBRTXdzRkFDT1lBZ3U1QVFCQmdBZ2pnd0k2QUFCQmdRZ2poQUk2QUFCQmdnZ2poUUk2QUFCQmd3Z2poZ0k2QUFCQmhBZ2pod0k2QUFCQmhRZ2ppQUk2QUFCQmhnZ2ppUUk2QUFCQmh3Z2ppZ0k2QUFCQmlBZ2ppd0k3QVFCQmlnZ2pqQUk3QVFCQmpBZ2pqUUkyQWdCQmtRZ2pqZ0pCQUVjNkFBQkJrZ2dqandKQkFFYzZBQUJCa3dnamtBSkJBRWM2QUFCQmxBZ2prUUpCQUVjNkFBQkJsUWdqZ0FKQkFFYzZBQUJCbGdnamdRSkJBRWM2QUFCQmx3Z2pnZ0pCQUVjNkFBQUxhQUJCeUFrajhnRTdBUUJCeWdrajh3RTdBUUJCekFrajlBRkJBRWM2QUFCQnpRa2o5UUZCQUVjNkFBQkJ6Z2tqOWdGQkFFYzZBQUJCendrajl3RkJBRWM2QUFCQjBBa2orQUZCQUVjNkFBQkIwUWtqK1FGQkFFYzZBQUJCMGdraitnRkJBRWM2QUFBTE5RQkIrZ2tqeFFFMkFnQkIvZ2tqeGdFMkFnQkJnZ29qeUFGQkFFYzZBQUJCaFFvanlRRkJBRWM2QUFCQmhmNERJOGNCRUI4TFl3QkIzZ29qV0VFQVJ6b0FBRUhmQ2lOYk5nSUFRZU1LSTF3MkFnQkI1d29qWGpZQ0FFSHNDaU5mTmdJQVFmRUtJMkE2QUFCQjhnb2pZVG9BQUVIM0NpTmlRUUJIT2dBQVFmZ0tJMk0yQWdCQi9Rb2paRHNCQUVIL0NpTmRRUUJIT2dBQUMwZ0FRWkFMSTI5QkFFYzZBQUJCa1FzamNqWUNBRUdWQ3lOek5nSUFRWmtMSTNVMkFnQkJuZ3NqZGpZQ0FFR2pDeU4zT2dBQVFhUUxJM2c2QUFCQnBRc2pkRUVBUnpvQUFBdEhBRUgwQ3lPUkFVRUFSem9BQUVIMUN5T1RBVFlDQUVINUN5T1VBVFlDQUVIOUN5T1dBVFlDQUVHQ0RDT1hBVFlDQUVHSERDT1pBVHNCQUVHSkRDT1ZBVUVBUnpvQUFBdUhBUUFRTmtHeUNDUHNBVFlDQUVHMkNDUGhBVG9BQUVIRS9nTWo3UUVRSDBIa0NDTzNBVUVBUnpvQUFFSGxDQ080QVVFQVJ6b0FBQkEzRURoQnJBb2pzd0UyQWdCQnNBb2p0QUU2QUFCQnNRb2p0UUU2QUFBUU9SQTZRY0lMSTM5QkFFYzZBQUJCd3dzamdnRTJBZ0JCeHdzamd3RTJBZ0JCeXdzamhBRTdBUUFRTzBFQUpKZ0NDN2tCQUVHQUNDMEFBQ1NEQWtHQkNDMEFBQ1NFQWtHQ0NDMEFBQ1NGQWtHRENDMEFBQ1NHQWtHRUNDMEFBQ1NIQWtHRkNDMEFBQ1NJQWtHR0NDMEFBQ1NKQWtHSENDMEFBQ1NLQWtHSUNDOEJBQ1NMQWtHS0NDOEJBQ1NNQWtHTUNDZ0NBQ1NOQWtHUkNDMEFBRUVBU2lTT0FrR1NDQzBBQUVFQVNpU1BBa0dUQ0MwQUFFRUFTaVNRQWtHVUNDMEFBRUVBU2lTUkFrR1ZDQzBBQUVFQVNpU0FBa0dXQ0MwQUFFRUFTaVNCQWtHWENDMEFBRUVBU2lTQ0FndGVBUUYvUVFBazdBRkJBQ1R0QVVIRS9nTkJBQkFmUWNIK0F4QWRRWHh4SVFGQkFDVGhBVUhCL2dNZ0FSQWZJQUFFUUFKQVFRQWhBQU5BSUFCQmdOZ0ZUZzBCSUFCQmdNa0Zha0gvQVRvQUFDQUFRUUZxSVFBTUFBQUxBQXNMQzRJQkFRRi9JK01CSVFFZ0FFR0FBWEZCQUVjazR3RWdBRUhBQUhGQkFFY2s1QUVnQUVFZ2NVRUFSeVRsQVNBQVFSQnhRUUJISk9ZQklBQkJDSEZCQUVjazV3RWdBRUVFY1VFQVJ5VG9BU0FBUVFKeFFRQkhKT2tCSUFCQkFYRkJBRWNrNmdFajR3RkZRUUFnQVJzRVFFRUJFRDRMUVFBajR3RWdBUnNFUUVFQUVENExDeW9BUWVRSUxRQUFRUUJLSkxjQlFlVUlMUUFBUVFCS0pMZ0JRZi8vQXhBZEVDNUJqLzRERUIwUUx3dG9BRUhJQ1M4QkFDVHlBVUhLQ1M4QkFDVHpBVUhNQ1MwQUFFRUFTaVQwQVVITkNTMEFBRUVBU2lUMUFVSE9DUzBBQUVFQVNpVDJBVUhQQ1MwQUFFRUFTaVQzQVVIUUNTMEFBRUVBU2lUNEFVSFJDUzBBQUVFQVNpVDVBVUhTQ1MwQUFFRUFTaVQ2QVF0SEFFSDZDU2dDQUNURkFVSCtDU2dDQUNUR0FVR0NDaTBBQUVFQVNpVElBVUdGQ2kwQUFFRUFTaVRKQVVHRi9nTVFIU1RIQVVHRy9nTVFIU1RLQVVHSC9nTVFIU1RNQVFzSEFFRUFKTFlCQzJNQVFkNEtMUUFBUVFCS0pGaEIzd29vQWdBa1cwSGpDaWdDQUNSY1FlY0tLQUlBSkY1QjdBb29BZ0FrWDBIeENpMEFBQ1JnUWZJS0xRQUFKR0ZCOXdvdEFBQkJBRW9rWWtINENpZ0NBQ1JqUWYwS0x3RUFKR1JCL3dvdEFBQkJBRW9rWFF0SUFFR1FDeTBBQUVFQVNpUnZRWkVMS0FJQUpISkJsUXNvQWdBa2MwR1pDeWdDQUNSMVFaNExLQUlBSkhaQm93c3RBQUFrZDBHa0N5MEFBQ1I0UWJFTExRQUFRUUJLSkhRTFJ3QkI5QXN0QUFCQkFFb2trUUZCOVFzb0FnQWtrd0ZCK1Fzb0FnQWtsQUZCL1Fzb0FnQWtsZ0ZCZ2d3b0FnQWtsd0ZCaHd3dkFRQWttUUZCaVF3dEFBQkJBRW9rbFFFTHpBRUJBWDhRUFVHeUNDZ0NBQ1RzQVVHMkNDMEFBQ1RoQVVIRS9nTVFIU1R0QVVIQS9nTVFIUkEvRUVCQmdQNERFQjFCL3dGekpOb0JJOW9CSWdCQkVIRkJBRWNrMndFZ0FFRWdjVUVBUnlUY0FSQkJFRUpCckFvb0FnQWtzd0ZCc0FvdEFBQWt0QUZCc1FvdEFBQWt0UUZCQUNTMkFSQkVFRVZCd2dzdEFBQkJBRW9rZjBIREN5Z0NBQ1NDQVVISEN5Z0NBQ1NEQVVITEN5OEJBQ1NFQVJCR1FRQWttQUpCZ0tqV3VRY2trZ0pCQUNTVEFrRUFKSlFDUVlDbzFya0hKSlVDUVFBa2xnSkJBQ1NYQWdzRkFDT0JBZ3NGQUNPVkFnc0ZBQ09XQWdzRkFDT1hBZ3V5QWdFR2Z5TkxJZ1VnQUVaQkFDTktJQVJHUVFBZ0FFRUlTa0VBSUFGQkFFb2JHeHNFUUNBRFFRRnJFQjFCSUhGQkFFY2hDQ0FERUIxQklIRkJBRWNoQ1VFQUlRTURRQ0FEUVFoSUJFQkJCeUFEYXlBRElBZ2dDVWNiSWdjZ0FHb2lBMEdnQVV3RVFDQUJRYUFCYkNBRGFrRURiRUdBeVFWcUlnUXRBQUFoQ2lBRUlBbzZBQUFnQVVHZ0FXd2dBMnBCQTJ4Qmdja0ZhaUFFTFFBQk9nQUFJQUZCb0FGc0lBTnFRUU5zUVlMSkJXb2dCQzBBQWpvQUFDQUJRYUFCYkNBRGFrR0FrUVJxSUFCQkFDQUhhMnNnQVVHZ0FXeHFRZmlRQkdvdEFBQWlBMEVEY1NJRVFRUnlJQVFnQTBFRWNSczZBQUFnQmtFQmFpRUdDeUFIUVFGcUlRTU1BUXNMQlNBRUpFb0xJQUFnQlU0RVFDQUFRUWhxSWdFZ0FrRUhjU0lDYWlBQklBQWdBa2diSVFVTElBVWtTeUFHQ3lrQUlBQkJnSkFDUmdSQUlBRkJnQUZySUFGQmdBRnFJQUZCZ0FGeEd5RUJDeUFCUVFSMElBQnFDMG9BSUFCQkEzUWdBVUVCZEdvaUFFRUJha0UvY1NJQlFVQnJJQUVnQWh0QmdKQUVhaTBBQUNFQklBQkJQM0VpQUVGQWF5QUFJQUliUVlDUUJHb3RBQUFnQVVIL0FYRkJDSFJ5QzhnQkFDQUJFQjBnQUVFQmRIVkJBM0VoQUNBQlFjaitBMFlFUUNOQ0lRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUXlFQkRBSUxJMFFoQVF3QkN5TkZJUUVMQlNBQlFjbitBMFlFUUNOR0lRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUnlFQkRBSUxJMGdoQVF3QkN5TkpJUUVMQlNNK0lRRUNRQ0FBUlEwQUFrQUNRQUpBQWtBZ0FFRUJhdzREQVFJREFBc01Bd3NqUHlFQkRBSUxJMEFoQVF3QkN5TkJJUUVMQ3dzZ0FRdU1Bd0VHZnlBQklBQVFUU0FGUVFGMGFpSUFRWUNRZm1vZ0FrRUJjVUVOZENJQmFpMEFBQ0VSSUFCQmdaQithaUFCYWkwQUFDRVNJQU1oQUFOQUlBQWdCRXdFUUNBQUlBTnJJQVpxSWc0Z0NFZ0VRRUVBSVFVQ2YwRUJRUWNnQUdzZ0FFRUJJQXRCSUhGRklBdEJBRWdiR3lJQmRDQVNjUVJBUVFJaEJRc2dCVUVCYWdzZ0JVRUJJQUYwSUJGeEd5RUNJNEVDQkg5QkFTQU1RUUJPSUF0QkFFNGJCVUVBQ3dSL0lBdEJCM0VoQVNBTVFRQk9JZ1VFUUNBTVFRZHhJUUVMSUFFZ0FpQUZFRTRpQlVFZmNVRURkQ0VCSUFWQjRBZHhRUVYxUVFOMElROGdCVUdBK0FGeFFRcDFRUU4wQlNBQ1FjZitBeUFLSUFwQkFFd2JJZ29RVHlJRlFZQ0EvQWR4UVJCMUlRRWdCVUdBL2dOeFFRaDFJUThnQlVIL0FYRUxJUVVnQnlBSWJDQU9ha0VEYkNBSmFpSVFJQUU2QUFBZ0VFRUJhaUFQT2dBQUlCQkJBbW9nQlRvQUFDQUhRYUFCYkNBT2FrR0FrUVJxSUFKQkEzRWlBVUVFY2lBQklBdEJnQUZ4UVFBZ0MwRUFUaHNiT2dBQUlBMUJBV29oRFFzZ0FFRUJhaUVBREFFTEN5QU5DMzRCQTM4Z0EwRUhjU0VEUVFBZ0FpQUNRUU4xUVFOMGF5QUFHeUVIUWFBQklBQnJRUWNnQUVFSWFrR2dBVW9iSVFoQmZ5RUNJNEVDQkVBZ0JFR0EwSDVxTFFBQUlnSkJDSEZCQUVjaENTQUNRY0FBY1FSQVFRY2dBMnNoQXdzTElBWWdCU0FKSUFjZ0NDQURJQUFnQVVHZ0FVR0F5UVZCQUNBQ1FYOFFVQXVoQWdFQmZ5QURRUWR4SVFNZ0JTQUdFRTBnQkVHQTBINXFMUUFBSWdSQndBQnhCSDlCQnlBRGF3VWdBd3RCQVhScUlnVkJnSkIrYWlBRVFRaHhRUUJISWdaQkRYUnFMUUFBSVFjZ0FrRUhjU0VEUVFBaEFpQUJRYUFCYkNBQWFrRURiRUdBeVFWcUlBUkJCM0VDZnlBRlFZR1FmbW9nQmtFQmNVRU5kR290QUFCQkFTQURRUWNnQTJzZ0JFRWdjUnNpQTNSeEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0EzUWdCM0ViSWdOQkFCQk9JZ0pCSDNGQkEzUTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFDUWVBSGNVRUZkVUVEZERvQUFDQUJRYUFCYkNBQWFrRURiRUdDeVFWcUlBSkJnUGdCY1VFS2RVRURkRG9BQUNBQlFhQUJiQ0FBYWtHQWtRUnFJQU5CQTNFaUFFRUVjaUFBSUFSQmdBRnhHem9BQUF2RUFRQWdCQ0FGRUUwZ0EwRUhjVUVCZEdvaUJFR0FrSDVxTFFBQUlRVkJBQ0VESUFGQm9BRnNJQUJxUVFOc1FZREpCV29DZnlBRVFZR1FmbW90QUFCQkFVRUhJQUpCQjNGcklnSjBjUVJBUVFJaEF3c2dBMEVCYWdzZ0EwRUJJQUowSUFWeEd5SURRY2YrQXhCUElnSkJnSUQ4QjNGQkVIVTZBQUFnQVVHZ0FXd2dBR3BCQTJ4Qmdja0ZhaUFDUVlEK0EzRkJDSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnc2tGYWlBQ09nQUFJQUZCb0FGc0lBQnFRWUNSQkdvZ0EwRURjVG9BQUF2VUFRRUdmeUFEUVFOMUlRb0RRQ0FFUWFBQlNBUkFJQVFnQldvaUJrR0FBazRFUUNBR1FZQUNheUVHQ3lBS1FRVjBJQUpxSUFaQkEzVnFJZ2hCZ0pCK2FpMEFBQ0VIUVFBaENTTThCRUFnQkNBQUlBWWdDQ0FIRUV3aUMwRUFTZ1JBUVFFaENTQUxRUUZySUFScUlRUUxDeUFKUlVFQUl6c2JCRUFnQkNBQUlBWWdBeUFJSUFFZ0J4QlJJZ1pCQUVvRVFDQUdRUUZySUFScUlRUUxCU0FKUlFSQUk0RUNCRUFnQkNBQUlBWWdBeUFJSUFFZ0J4QlNCU0FFSUFBZ0JpQURJQUVnQnhCVEN3c0xJQVJCQVdvaEJBd0JDd3NMTWdFRGZ5UHdBU0VESUFBajhRRWlCRWdFUUE4TFFRQWdBMEVIYXlJRGF5RUZJQUFnQVNBQ0lBQWdCR3NnQXlBRkVGUUxvQVVCRDM4Q1FFRW5JUVlEUUNBR1FRQklEUUVnQmtFQ2RDSUZRWUQ4QTJvaUF4QWRJUUlnQTBFQmFoQWRJUWNnQTBFQ2FoQWRJUU1nQWtFUWF5RUVJQWRCQ0dzaEMwRUlJUUlnQVFSQVFSQWhBaUFESUFOQkFYRnJJUU1MSUFBZ0FpQUVha2hCQUNBQUlBUk9Hd1JBSUFWQmcvd0RhaEFkSWdWQmdBRnhRUUJISVF3Z0JVRWdjVUVBUnlFTlFZQ0FBaUFERUUwZ0FpQUFJQVJySWdOclFRRnJJQU1nQlVIQUFIRWJRUUYwYWlJRFFZQ1FmbW9nQlVFSWNVRUFSeU9CQWlJQ0lBSWJRUUZ4UVExMElnSnFMUUFBSVE0Z0EwR0JrSDVxSUFKcUxRQUFJUTlCQnlFREEwQWdBMEVBVGdSQVFRQWhBZ0ovUVFGQkFDQURRUWRyYXlBRElBMGJJZ1IwSUE5eEJFQkJBaUVDQ3lBQ1FRRnFDeUFDUVFFZ0JIUWdEbkViSWdRRVFFRUhJQU5ySUF0cUlnSkJBRTRFZnlBQ1FhQUJUQVZCQUFzRVFFRUFJUWRCQUNFS0krb0JSU09CQWlJSUlBZ2JJZ2hGQkVBZ0FFR2dBV3dnQW1wQmdKRUVhaTBBQUNJSklSQWdDVUVEY1NJSlFRQkxRUUFnREJzRVFFRUJJUWNGUVFGQkFDQUpRUUJMUVFBZ0VFRUVjVUVBSTRFQ0d4c2JJUW9MQzBFQlFRQWdDa1VnQnhzZ0NCc0VRQ09CQWdSQUlBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JVRUhjU0FFUVFFUVRpSUVRUjl4UVFOME9nQUFJQUJCb0FGc0lBSnFRUU5zUVlISkJXb2dCRUhnQjNGQkJYVkJBM1E2QUFBZ0FFR2dBV3dnQW1wQkEyeEJnc2tGYWlBRVFZRDRBWEZCQ25WQkEzUTZBQUFGSUFCQm9BRnNJQUpxUVFOc1FZREpCV29nQkVISi9nTkJ5UDRESUFWQkVIRWJFRThpQkVHQWdQd0hjVUVRZFRvQUFDQUFRYUFCYkNBQ2FrRURiRUdCeVFWcUlBUkJnUDREY1VFSWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQ3lRVnFJQVE2QUFBTEN3c0xJQU5CQVdzaEF3d0JDd3NMSUFaQkFXc2hCZ3dBQUFzQUN3dGtBUUYvUVlDQUFrR0FrQUlqNWdFYklRRkJBU1BxQVNPQkFoc0VRQ0FBSUFGQmdMZ0NRWUN3QWlQbkFSc2o3d0VnQUdwQi93RnhRUUFqN2dFUVZBc2o1UUVFUUNBQUlBRkJnTGdDUVlDd0FpUGtBUnNRVlFzajZRRUVRQ0FBSStnQkVGWUxDeVVCQVg4Q1FBTkFJQUJCa0FGS0RRRWdBRUgvQVhFUVZ5QUFRUUZxSVFBTUFBQUxBQXNMUmdFQ2Z3TkFJQUZCa0FGT1JRUkFRUUFoQUFOQUlBQkJvQUZJQkVBZ0FVR2dBV3dnQUdwQmdKRUVha0VBT2dBQUlBQkJBV29oQUF3QkN3c2dBVUVCYWlFQkRBRUxDd3NiQUVHUC9nTVFIVUVCSUFCMGNpSUFKTDhCUVkvK0F5QUFFQjhMQ3dCQkFTVEJBVUVCRUZvTExnRUJmd0ovSTNVaUFFRUFTZ1IvSTIwRlFRQUxCRUFnQUVFQmF5RUFDeUFBUlFzRVFFRUFKRzhMSUFBa2RRc3dBUUYvQW44amd3RWlBRUVBU2dSL0kzMEZRUUFMQkVBZ0FFRUJheUVBQ3lBQVJRc0VRRUVBSkg4TElBQWtnd0VMTWdFQmZ3Si9JNVlCSWdCQkFFb0VmeU9RQVFWQkFBc0VRQ0FBUVFGcklRQUxJQUJGQ3dSQVFRQWtrUUVMSUFBa2xnRUxSd0VDZnlBQUpHUkJsUDRERUIxQitBRnhJUUZCay80RElBQkIvd0Z4SWdJUUgwR1UvZ01nQVNBQVFRaDFRUWR4SWdCeUVCOGdBaVJWSUFBa1Z5TlZJMWRCQ0hSeUpGb0xvZ0VCQW44allrVkJBU05ZR3dSQUR3c2pZMEVCYXlJQVFRQk1CRUFqVFFSQUkwMGtZd0ovSTJRaUFTTlBkU0VBUVFFalRnUi9RUUVrWlNBQklBQnJCU0FBSUFGcUN5SUFRZjhQU2cwQUdrRUFDd1JBUVFBa1dBc2pUMEVBU2dSQUlBQVFYd0ovSTJRaUFTTlBkU0VBUVFFalRnUi9RUUVrWlNBQklBQnJCU0FBSUFGcUMwSC9EMG9OQUJwQkFBc0VRRUVBSkZnTEN3VkJDQ1JqQ3dVZ0FDUmpDd3RUQVFKL0kxeEJBV3NpQVVFQVRBUkFJMVFFUUNOVUlnRUVmeU5kQlVFQUN3UkFJMThoQUNBQVFRRnFJQUJCQVdzalV4dEJEM0VpQUVFUFNBUkFJQUFrWHdWQkFDUmRDd3NGUVFnaEFRc0xJQUVrWEF0VEFRSi9JM05CQVdzaUFVRUFUQVJBSTJzRVFDTnJJZ0VFZnlOMEJVRUFDd1JBSTNZaEFDQUFRUUZxSUFCQkFXc2phaHRCRDNFaUFFRVBTQVJBSUFBa2RnVkJBQ1IwQ3dzRlFRZ2hBUXNMSUFFa2N3dGNBUUovSTVRQlFRRnJJZ0ZCQUV3RVFDT01BUVJBSTR3QklnRUVmeU9WQVFWQkFBc0VRQ09YQVNFQUlBQkJBV29nQUVFQmF5T0xBUnRCRDNFaUFFRVBTQVJBSUFBa2x3RUZRUUFrbFFFTEN3VkJDQ0VCQ3dzZ0FTU1VBUXVwQWdFQ2YwR0F3QUFqZ2dKMElnRWhBaU96QVNBQWFpSUFJQUZPQkVBZ0FDQUNheVN6QVFKQUFrQUNRQUpBQWtBanRRRkJBV3BCQjNFaUFBUkFJQUJCQWtZTkFRSkFJQUJCQkdzT0JBTUFCQVVBQ3d3RkN5TmVJZ0ZCQUVvRWZ5TldCVUVBQ3dSQUlBRkJBV3NpQVVVRVFFRUFKRmdMQ3lBQkpGNFFYQkJkRUY0TUJBc2pYaUlCUVFCS0JIOGpWZ1ZCQUFzRVFDQUJRUUZySWdGRkJFQkJBQ1JZQ3dzZ0FTUmVFRndRWFJCZUVHQU1Bd3NqWGlJQlFRQktCSDhqVmdWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSWUN3c2dBU1JlRUZ3UVhSQmVEQUlMSTE0aUFVRUFTZ1IvSTFZRlFRQUxCRUFnQVVFQmF5SUJSUVJBUVFBa1dBc0xJQUVrWGhCY0VGMFFYaEJnREFFTEVHRVFZaEJqQ3lBQUpMVUJRUUVQQlNBQUpMTUJDMEVBQzNRQkFYOENRQUpBQWtBQ1FDQUFRUUZIQkVBQ1FDQUFRUUpyRGdNQ0F3UUFDd3dFQ3lOWklnQWpuZ0ZISVFFZ0FDU2VBU0FCRHdzamNDSUFJNThCUnlFQklBQWtud0VnQVE4TEk0QUJJZ0Fqb0FGSElRRWdBQ1NnQVNBQkR3c2prZ0VpQUNPaEFVY2hBU0FBSktFQklBRVBDMEVBQzFVQUFrQUNRQUpBSUFCQkFVY0VRQ0FBUVFKR0RRRWdBRUVEUmcwQ0RBTUxRUUVnQVhSQmdRRnhRUUJIRHd0QkFTQUJkRUdIQVhGQkFFY1BDMEVCSUFGMFFmNEFjVUVBUnc4TFFRRWdBWFJCQVhGQkFFY0xjd0VCZnlOYklBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBaldtdEJBblFpQVVFQ2RDQUJJNElDR3lSYkkxc2dBRUVmZFNJQklBQWdBV3B6YXlFQUkyRkJBV3BCQjNFa1lRd0JDd3NnQUNSYkkxbEJBQ05ZR3dSL0kxOUJEM0VGUVE4UEN5TlFJMkVRWmdSL1FRRUZRWDhMYkVFUGFndHNBUUYvSTNJZ0FHc2hBQU5BSUFCQkFFd0VRRUdBRUNOeGEwRUNkQ09DQW5Ra2NpTnlJQUJCSDNVaUFTQUFJQUZxYzJzaEFDTjRRUUZxUVFkeEpIZ01BUXNMSUFBa2NpTndRUUFqYnhzRWZ5TjJRUTl4QlVFUER3c2paeU40RUdZRWYwRUJCVUYvQzJ4QkQyb0xEd0FqaEFGQkFYVkJzUDREYWhBZEN5c0JBWDhqaEFGQkFXb2hBQU5BSUFCQklFaEZCRUFnQUVFZ2F5RUFEQUVMQ3lBQUpJUUJFR2traHdFTDVnRUJBMzhqZ0FGRlFRRWpmeHNFUUVFUER3c2poUUVoQWlPR0FRUkFRWnorQXhBZFFRVjFRUTl4SWdJa2hRRkJBQ1NHQVFzamh3RWpoQUZCQVhGRlFRSjBkVUVQY1NFQkFrQUNRQUpBQWtBZ0FnUkFJQUpCQVVZTkFTQUNRUUpHRFFJTUF3c2dBVUVFZFNFQkRBTUxRUUVoQXd3Q0N5QUJRUUYxSVFGQkFpRUREQUVMSUFGQkFuVWhBVUVFSVFNTElBTkJBRW9FZnlBQklBTnRCVUVBQzBFUGFpRUJJNElCSUFCcklRQURRQ0FBUVFCTUJFQkJnQkFqZ1FGclFRRjBJNElDZENTQ0FTT0NBU0FBUVI5MUlnSWdBQ0FDYW5OcklRQVFhZ3dCQ3dzZ0FDU0NBU0FCQzQ4QkFRSi9JNU1CSUFCcklnQkJBRXdFUUNPWUFTT05BWFFqZ2dKMElBQkJIM1VpQVNBQUlBRnFjMnNoQUNPWkFTSUJRUUYxSWdJZ0FVRUJjU0FDUVFGeGN5SUJRUTUwY2lJQ1FiOS9jU0FCUVFaMGNpQUNJNDRCR3lTWkFRdEJBQ0FBSUFCQkFFZ2JKSk1CSTVJQlFRQWprUUViQkg4amx3RkJEM0VGUVE4UEMwRi9RUUVqbVFGQkFYRWJiRUVQYWdzd0FDQUFRVHhHQkVCQi93QVBDeUFBUVR4clFhQ05CbXdnQVd4QkEzVkJvSTBHYlVFOGFrR2dqUVpzUVl6eEFtMExsd0VCQVg5QkFDU2tBU0FBUVE4anFnRWJJQUZCRHlPckFSdHFJQUpCRHlPc0FSdHFJQU5CRHlPdEFSdHFJUVFnQUVFUEk2NEJHeUFCUVE4anJ3RWJhaUVBSUFBZ0FrRVBJN0FCRzJvaEFTQURRUThqc1FFYklRTkJBQ1NsQVVFQUpLWUJJQVFqcUFGQkFXb1FiU0VBSUFFZ0Eyb2pxUUZCQVdvUWJTRUJJQUFrb2dFZ0FTU2pBU0FCUWY4QmNTQUFRZjhCY1VFSWRISUwvd0lCQlg4alRDQUFhaUlDSkV3ald5QUNhMEVBVENJQ1JRUkFRUUVRWlNFQ0N5Tm1JQUJxSWdFa1ppTnlJQUZyUVFCTUlnRkZCRUJCQWhCbElRRUxJM2tnQUdva2VVRUFJNElCSTNsclFRQktJNFlCRzBVaUJFVUVRRUVERUdVaEJBc2ppQUVnQUdva2lBRWprd0VqaUFGclFRQk1JZ1ZGQkVCQkJCQmxJUVVMSUFJRVFDTk1JUU5CQUNSTUlBTVFaeVNhQVFzZ0FRUkFJMlloQTBFQUpHWWdBeEJvSkpzQkN5QUVCRUFqZVNFRFFRQWtlU0FERUdza25BRUxJQVVFUUNPSUFTRURRUUFraUFFZ0F4QnNKSjBCQzBFQklBVkJBU0FFUVFFZ0FTQUNHeHNiQkVCQkFTU21BUXRCZ0lDQUFpT0NBblJCeE5nQ2JTSUNJUUVqdEFFZ0FHb2lBQ0FDVGdSQUlBQWdBV3NoQUVFQkk2VUJRUUVqcEFFanBnRWJHd1JBSTVvQkk1c0JJNXdCSTUwQkVHNGFCU0FBSkxRQkN5TzJBU0lDUVFGMFFZQ1p3UUJxSWdFam9nRkJBbW82QUFBZ0FVRUJhaU9qQVVFQ2Fqb0FBQ0FDUVFGcUlnRkIvLzhEVGdSL0lBRkJBV3NGSUFFTEpMWUJDeUFBSkxRQkM2VURBUVovSUFBUVp5RUJJQUFRYUNFQ0lBQVFheUVFSUFBUWJDRUZJQUVrbWdFZ0FpU2JBU0FFSkp3QklBVWtuUUVqdEFFZ0FHb2lBRUdBZ0lBQ0k0SUNkRUhFMkFKdFRnUkFJQUJCZ0lDQUFpT0NBblJCeE5nQ2JXc2hBQ0FCSUFJZ0JDQUZFRzRoQXlPMkFVRUJkRUdBbWNFQWFpSUdJQU5CZ1A0RGNVRUlkVUVDYWpvQUFDQUdRUUZxSUFOQi93RnhRUUpxT2dBQUl6MEVRQ0FCUVE5QkQwRVBFRzRoQVNPMkFVRUJkRUdBbVNGcUlnTWdBVUdBL2dOeFFRaDFRUUpxT2dBQUlBTkJBV29nQVVIL0FYRkJBbW82QUFCQkR5QUNRUTlCRHhCdUlRRWp0Z0ZCQVhSQmdKa3BhaUlDSUFGQmdQNERjVUVJZFVFQ2Fqb0FBQ0FDUVFGcUlBRkIvd0Z4UVFKcU9nQUFRUTlCRHlBRVFROFFiaUVCSTdZQlFRRjBRWUNaTVdvaUFpQUJRWUQrQTNGQkNIVkJBbW82QUFBZ0FrRUJhaUFCUWY4QmNVRUNham9BQUVFUFFROUJEeUFGRUc0aEFTTzJBVUVCZEVHQW1UbHFJZ0lnQVVHQS9nTnhRUWgxUVFKcU9nQUFJQUpCQVdvZ0FVSC9BWEZCQW1vNkFBQUxJN1lCUVFGcUlnRkIvLzhEVGdSL0lBRkJBV3NGSUFFTEpMWUJDeUFBSkxRQkN4NEJBWDhnQUJCa0lRRWdBVVZCQUNNNkd3UkFJQUFRYndVZ0FCQndDd3N2QVFKL1FkY0FJNElDZENFQkk2Y0JJUUFEUUNBQUlBRk9CRUFnQVJCeElBQWdBV3NoQUF3QkN3c2dBQ1NuQVF1a0F3QUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RFJ3UkFJQUJCbGY0RFJnMEJBa0FnQUVHUi9nTnJEaFlHQ3hBVUFBY01FUlVEQ0EwU0ZnUUpEaE1YQlFvUEFBc01Gd3RCa1A0REVCMUJnQUZ5RHd0QmxmNERFQjFCL3dGeUR3dEJtdjRERUIxQi93QnlEd3RCbi80REVCMUIvd0Z5RHd0QnBQNERFQjBQQzBHUi9nTVFIVUUvY2c4TFFaYitBeEFkUVQ5eUR3dEJtLzRERUIxQi93RnlEd3RCb1A0REVCMUIvd0Z5RHd0QnBmNERFQjBQQzBHUy9nTVFIUThMUVpmK0F4QWREd3RCblA0REVCMUJud0Z5RHd0Qm9mNERFQjBQQzBHQUFVRUFJN0lCR3lFQUlBQkJBWElnQUVGK2NTTllHeUVBSUFCQkFuSWdBRUY5Y1NOdkd5RUFJQUJCQkhJZ0FFRjdjU04vR3lFQUlBQkJDSElnQUVGM2NTT1JBUnRCOEFCeUR3dEJrLzRERUIxQi93RnlEd3RCbVA0REVCMUIvd0Z5RHd0Qm5mNERFQjFCL3dGeUR3dEJvdjRERUIwUEMwR1UvZ01RSFVHL0FYSVBDMEdaL2dNUUhVRy9BWElQQzBHZS9nTVFIVUcvQVhJUEMwR2ovZ01RSFVHL0FYSVBDMEYvQzV3QkFRRi9JOW9CSVFBajJ3RUVRQ0FBUVh0eElBQkJCSElqMGdFYklRQWdBRUYrY1NBQVFRRnlJOVVCR3lFQUlBQkJkM0VnQUVFSWNpUFRBUnNoQUNBQVFYMXhJQUJCQW5JajFBRWJJUUFGSTl3QkJFQWdBRUYrY1NBQVFRRnlJOVlCR3lFQUlBQkJmWEVnQUVFQ2NpUFhBUnNoQUNBQVFYdHhJQUJCQkhJajJBRWJJUUFnQUVGM2NTQUFRUWh5STlrQkd5RUFDd3NnQUVId0FYSUwxQUlBSUFCQmdJQUNTQVJBUVg4UEN5QUFRWURBQWtoQkFDQUFRWUNBQWs0YkJFQkJmdzhMSUFCQmdQd0RTRUVBSUFCQmdNQURUaHNFUUNBQVFZQkFhaEFkRHdzZ0FFR2YvUU5NUVFBZ0FFR0EvQU5PR3dSQVFmOEJRWDhqNFFGQkFrZ2JEd3NnQUVITi9nTkdCRUJCL3dFaEFFSE4vZ01RSFVFQmNVVUVRRUgrQVNFQUN5T0NBa1VFUUNBQVFmOStjU0VBQ3lBQUR3c2dBRUhFL2dOR0JFQWdBQ1B0QVJBZkkrMEJEd3NnQUVHbS9nTk1RUUFnQUVHUS9nTk9Hd1JBRUhJZ0FCQnpEd3NnQUVHdi9nTk1RUUFnQUVHbi9nTk9Hd1JBUWY4QkR3c2dBRUcvL2dOTVFRQWdBRUd3L2dOT0d3UkFFSElqZndSQUVHa1BDMEYvRHdzZ0FFR0UvZ05HQkVBZ0FDUEdBVUdBL2dOeFFRaDFJZ0FRSHlBQUR3c2dBRUdGL2dOR0JFQWdBQ1BIQVJBZkk4Y0JEd3NnQUVHUC9nTkdCRUFqdndGQjRBRnlEd3NnQUVHQS9nTkdCRUFRZEE4TFFYOExLUUVCZnlQZUFTQUFSZ1JBUVFFazRBRUxJQUFRZFNJQlFYOUdCSDhnQUJBZEJTQUJRZjhCY1FzTHBBSUJBMzhqOWdFRVFBOExJL2NCSVFNaitBRWhBaUFBUWY4L1RBUkFJQUlFZnlBQlFSQnhSUVZCQUF0RkJFQWdBVUVQY1NJQUJFQWdBRUVLUmdSQVFRRWs5QUVMQlVFQUpQUUJDd3NGSUFCQi8vOEFUQVJBSS9vQklnUUVmeUFBUWYvZkFFd0ZRUUVMQkVBZ0FVRVBjU1B5QVNBQ0d5RUFJQU1FZnlBQlFSOXhJUUVnQUVIZ0FYRUZJL2tCQkg4Z0FVSC9BSEVoQVNBQVFZQUJjUVZCQUNBQUlBUWJDd3NoQUNBQUlBRnlKUElCQlNQeUFVSC9BWEVnQVVFQVNrRUlkSElrOGdFTEJVRUFJQUJCLzc4QlRDQUNHd1JBSS9VQlFRQWdBeHNFUUNQeUFVRWZjU0FCUWVBQmNYSWs4Z0VQQ3lBQlFROXhJQUZCQTNFaitnRWJKUE1CQlVFQUlBQkIvLzhCVENBQ0d3UkFJQU1FUUNBQlFRRnhRUUJISlBVQkN3c0xDd3NMT0FFQmZ5Tk9JUUVnQUVId0FIRkJCSFVrVFNBQVFRaHhRUUJISkU0Z0FFRUhjU1JQSTJWQkFDTk9SVUVBSUFFYkd3UkFRUUFrV0FzTFpRQWpXQVJBUVFBalhTTlVHd1JBSTE5QkFXcEJEM0VrWHdzalV5QUFRUWh4UVFCSFJ3UkFRUkFqWDJ0QkQzRWtYd3NMSUFCQkJIVkJEM0VrVWlBQVFRaHhRUUJISkZNZ0FFRUhjU1JVSUFCQitBRnhRUUJLSWdBa1dTQUFSUVJBUVFBa1dBc0xaUUFqYndSQVFRQWpkQ05yR3dSQUkzWkJBV3BCRDNFa2Rnc2phaUFBUVFoeFFRQkhSd1JBUVJBamRtdEJEM0VrZGdzTElBQkJCSFZCRDNFa2FTQUFRUWh4UVFCSEpHb2dBRUVIY1NScklBQkIrQUZ4UVFCS0lnQWtjQ0FBUlFSQUlBQWtid3NMY2dBamtRRUVRRUVBSTVVQkk0d0JHd1JBSTVjQlFRRnFRUTl4SkpjQkN5T0xBU0FBUVFoeFFRQkhSd1JBUVJBamx3RnJRUTl4SkpjQkN3c2dBRUVFZFVFUGNTU0tBU0FBUVFoeFFRQkhKSXNCSUFCQkIzRWtqQUVnQUVINEFYRkJBRW9pQUNTU0FTQUFSUVJBSUFBa2tRRUxDemdBSUFCQkJIVWtqUUVnQUVFSWNVRUFSeVNPQVNBQVFRZHhJZ0FrandFZ0FFRUJkQ0lBUVFGSUJFQkJBU0VBQ3lBQVFRTjBKSmdCQzZvQkFRSi9RUUVrV0NOZVJRUkFRY0FBSkY0TFFZQVFJMXByUVFKMElnQkJBblFnQUNPQ0Foc2tXeU5VQkVBalZDUmNCVUVJSkZ3TFFRRWtYU05TSkY4aldpUmtJMDBFUUNOTkpHTUZRUWdrWXd0QkFTTlBRUUJLSWdBalRVRUFTaHNrWWtFQUpHVWdBQVIvQW44alpDSUFJMDkxSVFGQkFTTk9CSDlCQVNSbElBQWdBV3NGSUFBZ0FXb0xRZjhQU2cwQUdrRUFDd1ZCQUFzRVFFRUFKRmdMSTFsRkJFQkJBQ1JZQ3d1U0FRRUNmeUFBUVFkeElnRWtWeU5WSUFGQkNIUnlKRm9qdFFGQkFYRkJBVVloQWlOV1JTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFalhrRUFUQnNFUUNOZVFRRnJKRjVCQUNOZVJTQUFRWUFCY1JzRVFFRUFKRmdMQ3dzZ0FFSEFBSEZCQUVja1ZpQUFRWUFCY1FSQUVIMGpWa0VBUVFBalhrSEFBRVlnQWhzYkJFQWpYa0VCYXlSZUN3c0xRQUJCQVNSdkkzVkZCRUJCd0FBa2RRdEJnQkFqY1d0QkFuUWpnZ0owSkhJamF3UkFJMnNrY3dWQkNDUnpDMEVCSkhRamFTUjJJM0JGQkVCQkFDUnZDd3VTQVFFQ2Z5QUFRUWR4SWdFa2JpTnNJQUZCQ0hSeUpIRWp0UUZCQVhGQkFVWWhBaU50UlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqZFVFQVRCc0VRQ04xUVFGckpIVkJBQ04xUlNBQVFZQUJjUnNFUUVFQUpHOExDd3NnQUVIQUFIRkJBRWNrYlNBQVFZQUJjUVJBRUg4amJVRUFRUUFqZFVIQUFFWWdBaHNiQkVBamRVRUJheVIxQ3dzTFBRQkJBU1IvSTRNQlJRUkFRWUFDSklNQkMwR0FFQ09CQVd0QkFYUWpnZ0owSklJQkk0SUJRUVpxSklJQlFRQWtoQUVqZ0FGRkJFQkJBQ1IvQ3d1UEFRRUJmeUFBUVFkeElnRWtmaU44SUFGQkNIUnlKSUVCSTdVQlFRRnhRUUZHSWdGRkJFQkJBRUVBSUFCQndBQnhJMzBiSTRNQlFRQk1Hd1JBSTRNQlFRRnJKSU1CUVFBamd3RkZJQUJCZ0FGeEd3UkFRUUFrZndzTEN5QUFRY0FBY1VFQVJ5UjlJQUJCZ0FGeEJFQVFnUUVqZlVFQVFRQWpnd0ZCZ0FKR0lBRWJHd1JBSTRNQlFRRnJKSU1CQ3dzTFVnQkJBU1NSQVNPV0FVVUVRRUhBQUNTV0FRc2ptQUVqalFGMEk0SUNkQ1NUQVNPTUFRUkFJNHdCSkpRQkJVRUlKSlFCQzBFQkpKVUJJNG9CSkpjQlFmLy9BU1NaQVNPU0FVVUVRRUVBSkpFQkN3dUxBUUVDZnlPMUFVRUJjVUVCUmlFQ0k1QUJSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBa1VFUUVFQUlBRWpsZ0ZCQUV3YkJFQWpsZ0ZCQVdza2xnRkJBQ09XQVVVZ0FFR0FBWEViQkVCQkFDU1JBUXNMQ3lBQVFjQUFjVUVBUnlTUUFTQUFRWUFCY1FSQUVJTUJJNUFCUVFCQkFDT1dBVUhBQUVZZ0Foc2JCRUFqbGdGQkFXc2tsZ0VMQ3d1ZEJBQWpzZ0ZGUVFBZ0FFR20vZ05IR3dSQVFRQVBDd0pBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCa1A0RFJ3UkFJQUJCbXY0RFJnMEJBa0FnQUVHUi9nTnJEaFlEQndzUEFBUUlEQkFBQlFrTkVRQUdDZzRTRXhRVkFBc01GUXNnQVJCNERCVUxRUUFnQVVHQUFYRkJBRWNpQUNPQUFSc0VRRUVBSkljQkN5QUFKSUFCSUFCRkJFQWdBQ1IvQ3d3VUN5QUJRUVoxUVFOeEpGQWdBVUUvY1NSUlFjQUFJMUZySkY0TUV3c2dBVUVHZFVFRGNTUm5JQUZCUDNFa2FFSEFBQ05vYXlSMURCSUxJQUVrZWtHQUFpTjZheVNEQVF3UkN5QUJRVDl4SklrQlFjQUFJNGtCYXlTV0FRd1FDeUFCRUhrTUR3c2dBUkI2REE0TFFRRWtoZ0VnQVVFRmRVRVBjU1I3REEwTElBRVFld3dNQ3lBQkpGVWpWMEVJZENBQmNpUmFEQXNMSUFFa2JDTnVRUWgwSUFGeUpIRU1DZ3NnQVNSOEkzNUJDSFFnQVhJa2dRRU1DUXNnQVJCOERBZ0xJQUVRZmd3SEN5QUJFSUFCREFZTElBRVFnZ0VNQlFzZ0FSQ0VBUXdFQ3lBQlFRUjFRUWR4SktnQklBRkJCM0VrcVFGQkFTU2tBUXdEQ3lBQkVDdEJBU1NsQVF3Q0N5T3lBU0lBQkg5QkFBVWdBVUdBQVhFTEJFQkJCeVMxQVVFQUpHRkJBQ1I0Q3lBQlFZQUJjVVZCQUNBQUd3UkFBa0JCa1A0RElRQURRQ0FBUWFiK0EwNE5BU0FBUVFBUWtnRWdBRUVCYWlFQURBQUFDd0FMQ3lBQlFZQUJjVUVBUnlTeUFRd0JDMEVCRHd0QkFRczhBUUYvSUFCQkNIUWhBVUVBSVFBRFFBSkFJQUJCbndGS0RRQWdBRUdBL0FOcUlBQWdBV29RSFJBZklBQkJBV29oQUF3QkN3dEJoQVVrK3dFTEpRRUJmMEhSL2dNUUhTRUFRZEwrQXhBZFFmOEJjU0FBUWY4QmNVRUlkSEpCOFA4RGNRc3BBUUYvUWRQK0F4QWRJUUJCMVA0REVCMUIvd0Z4SUFCQi93RnhRUWgwY2tId1AzRkJnSUFDYWd1R0FRRURmeU9CQWtVRVFBOExJQUJCZ0FGeFJVRUFJL3dCR3dSQVFRQWsvQUZCMWY0RFFkWCtBeEFkUVlBQmNoQWZEd3NRaHdFaEFSQ0lBU0VDSUFCQi8zNXhRUUZxUVFSMElRTWdBRUdBQVhFRVFFRUJKUHdCSUFNay9RRWdBU1QrQVNBQ0pQOEJRZFgrQXlBQVFmOStjUkFmQlNBQklBSWdBeENUQVVIVi9nTkIvd0VRSHdzTFdRRUVmMEVCUWV2K0F5SURJQUJHSUFCQjZmNERSaHNFUUNBQVFRRnJJZ1FRSFVHL2YzRWlBa0UvY1NJRlFVQnJJQVVnQUNBRFJodEJnSkFFYWlBQk9nQUFJQUpCZ0FGeEJFQWdCQ0FDUVFGcVFZQUJjaEFmQ3dzTE1RQUNRQUpBQWtBQ1FDQUFCRUFDUUNBQVFRRnJEZ01DQXdRQUN3d0VDMEVKRHd0QkF3OExRUVVQQzBFSER3dEJBQXNmQUNBQVFRRWp6QUVRaXdFaUFIUnhCSDlCQVNBQWRDQUJjVVVGUVFBTEM0WUJBUVIvQTBBZ0FpQUFTQVJBSUFKQkJHb2hBaVBHQVNJQlFRUnFRZi8vQTNFaUF5VEdBU1BMQVFSQUk4a0JJUVFqeUFFRVFDUEtBU1RIQVVFQkpNSUJRUUlRV2tFQUpNZ0JRUUVreVFFRklBUUVRRUVBSk1rQkN3c2dBU0FERUl3QkJFQWp4d0ZCQVdvaUFVSC9BVW9FUUVFQkpNZ0JRUUFoQVFzZ0FTVEhBUXNMREFFTEN3c05BQ1BGQVJDTkFVRUFKTVVCQzBZQkFYOGp4Z0VoQUVFQUpNWUJRWVQrQTBFQUVCOGp5d0VFZnlBQVFRQVFqQUVGUVFBTEJFQWp4d0ZCQVdvaUFFSC9BVW9FUUVFQkpNZ0JRUUFoQUFzZ0FDVEhBUXNMZkFFRGZ5UExBU0VCSUFCQkJIRkJBRWNreXdFZ0FFRURjU0VDSUFGRkJFQWp6QUVRaXdFaEFTQUNFSXNCSVFNanhnRWhBQ1BMQVFSL1FRRWdBWFFnQUhFRlFRRWdBM1FnQUhGQkFFRUJJQUYwSUFCeEd3c0VRQ1BIQVVFQmFpSUFRZjhCU2dSQVFRRWt5QUZCQUNFQUN5QUFKTWNCQ3dzZ0FpVE1BUXZJQmdFQmZ3SkFBa0FnQUVITi9nTkdCRUJCemY0RElBRkJBWEVRSHd3QkN5QUFRZEQrQTBaQkFDT0FBaHNFUUVFQUpJQUNRZjhCSkl3Q0RBSUxJQUJCZ0lBQ1NBUkFJQUFnQVJCM0RBRUxJQUJCZ01BQ1NFRUFJQUJCZ0lBQ1Roc05BU0FBUVlEOEEwaEJBQ0FBUVlEQUEwNGJCRUFnQUVHQVFHb2dBUkFmREFJTElBQkJuLzBEVEVFQUlBQkJnUHdEVGhzRVFDUGhBVUVDVGc4TElBQkIvLzBEVEVFQUlBQkJvUDBEVGhzTkFDQUFRWUwrQTBZRVFDQUJRUUZ4UVFCSEpNOEJJQUZCQW5GQkFFY2swQUVnQVVHQUFYRkJBRWNrMFFGQkFROExJQUJCcHY0RFRFRUFJQUJCa1A0RFRoc0VRQkJ5SUFBZ0FSQ0ZBUThMSUFCQnYvNERURUVBSUFCQnNQNERUaHNFUUJCeUkzOEVRQ09FQVVFQmRVR3cvZ05xSUFFUUh3d0NDd3dDQ3lBQVFjditBMHhCQUNBQVFjRCtBMDRiQkVBZ0FFSEEvZ05HQkVBZ0FSQS9EQU1MSUFCQndmNERSZ1JBUWNIK0F5QUJRZmdCY1VIQi9nTVFIVUVIY1hKQmdBRnlFQjhNQWdzZ0FFSEUvZ05HQkVCQkFDVHRBU0FBUVFBUUh3d0NDeUFBUWNYK0EwWUVRQ0FCSk9JQkRBTUxJQUJCeHY0RFJnUkFJQUVRaGdFTUF3c0NRQUpBQWtBQ1FDQUFRY1ArQTBjRVFDQUFRY0wrQTJzT0NnRUVCQVFFQkFRRUF3SUVDeUFCSk80QkRBWUxJQUVrN3dFTUJRc2dBU1R3QVF3RUN5QUJKUEVCREFNTERBSUxJQUJCMWY0RFJnUkFJQUVRaVFFTUFRdEJBU0FBUWMvK0EwWWdBRUh3L2dOR0d3UkFJL3dCQkVBai9nRWlBa0dBZ0FGT0JIOGdBa0gvL3dGTUJVRUFDd1IvUVFFRklBSkIvNzhEVEVFQUlBSkJnS0FEVGhzTERRSUxDeUFBUWV2K0EweEJBQ0FBUWVqK0EwNGJCRUFnQUNBQkVJb0JEQUlMSUFCQmgvNERURUVBSUFCQmhQNERUaHNFUUJDT0FRSkFBa0FDUUFKQUlBQkJoUDREUndSQUlBQkJoZjREYXc0REFRSURCQXNRandFTUJRc0NRQ1BMQVFSQUk4a0JEUUVqeUFFRVFFRUFKTWdCQ3dzZ0FTVEhBUXNNQlFzZ0FTVEtBU1BKQVVFQUk4c0JHd1JBSUFFa3h3RkJBQ1RKQVFzTUJBc2dBUkNRQVF3REN3d0NDeUFBUVlEK0EwWUVRQ0FCUWY4QmN5VGFBU1BhQVNJQ1FSQnhRUUJISk5zQklBSkJJSEZCQUVjazNBRUxJQUJCai80RFJnUkFJQUVRTHd3Q0N5QUFRZi8vQTBZRVFDQUJFQzRNQWd0QkFROExRUUFQQzBFQkN5QUFJOThCSUFCR0JFQkJBU1RnQVFzZ0FDQUJFSkVCQkVBZ0FDQUJFQjhMQzF3QkEzOERRQUpBSUFNZ0FrNE5BQ0FBSUFOcUVIWWhCU0FCSUFOcUlRUURRQ0FFUWYrL0FreEZCRUFnQkVHQVFHb2hCQXdCQ3dzZ0JDQUZFSklCSUFOQkFXb2hBd3dCQ3dzait3RkJJQ09DQW5RZ0FrRUVkV3hxSlBzQkMzUUJBbjhqL0FGRkJFQVBDMEVRSVFBai9nRWovd0VDZnlQOUFTSUJRUkJJQkVBZ0FTRUFDeUFBQ3hDVEFTUCtBU0FBYWlUK0FTUC9BU0FBYWlUL0FTQUJJQUJySWdBay9RRkIxZjRESVFFZ0FFRUFUQVJBUVFBay9BRWdBVUgvQVJBZkJTQUJJQUJCQkhWQkFXdEIvMzV4RUI4TEN6TUFJKzBCSStJQlJrRUFJQUJCQVVaQkFTQUFHeHNFUUNBQlFRUnlJZ0ZCd0FCeEJFQVFXd3NGSUFGQmUzRWhBUXNnQVF1QkFnRUZmeVBqQVVVRVFBOExJK0VCSVFBZ0FDUHRBU0lDUVpBQlRnUi9RUUVGUWZnQ0k0SUNkQ0lCSVFNajdBRWlCQ0FCVGdSL1FRSUZRUU5CQUNBRUlBTk9Hd3NMSWdGSEJFQkJ3ZjRERUIwaEFDQUJKT0VCUVFBaEFnSkFBa0FDUUFKQUlBRUVRQ0FCUVFGckRnTUJBZ01FQ3lBQVFYeHhJZ0JCQ0hGQkFFY2hBZ3dEQ3lBQVFYMXhRUUZ5SWdCQkVIRkJBRWNoQWd3Q0N5QUFRWDV4UVFKeUlnQkJJSEZCQUVjaEFnd0JDeUFBUVFOeUlRQUxJQUlFUUJCYkN5QUJSUVJBRUpRQkN5QUJRUUZHQkVCQkFTVEFBVUVBRUZvTFFjSCtBeUFCSUFBUWxRRVFId1VnQWtHWkFVWUVRRUhCL2dNZ0FVSEIvZ01RSFJDVkFSQWZDd3NMb0FFQkFYOGo0d0VFUUNQc0FTQUFhaVRzQVNNNUlRRURRQ1BzQVVFRUk0SUNJZ0IwUWNnRElBQjBJKzBCUVprQlJodE9CRUFqN0FGQkJDT0NBaUlBZEVISUF5QUFkQ1B0QVVHWkFVWWJheVRzQVNQdEFTSUFRWkFCUmdSQUlBRUVRQkJZQlNBQUVGY0xFRmxCZnlSS1FYOGtTd1VnQUVHUUFVZ0VRQ0FCUlFSQUlBQVFWd3NMQzBFQUlBQkJBV29nQUVHWkFVb2JKTzBCREFFTEN3c1FsZ0VMT0FFQmYwRUVJNElDSWdCMFFjZ0RJQUIwSSswQlFaa0JSaHNoQUFOQUkrc0JJQUJPQkVBZ0FCQ1hBU1ByQVNBQWF5VHJBUXdCQ3dzTHNnRUJBMzhqMFFGRkJFQVBDd05BSUFNZ0FFZ0VRQ0FEUVFScUlRTUNmeVBOQVNJQ1FRUnFJZ0ZCLy84RFNnUkFJQUZCZ0lBRWF5RUJDeUFCQ3lUTkFTQUNRUUZCQWtFSEk5QUJHeUlDZEhFRWYwRUJJQUowSUFGeFJRVkJBQXNFUUVHQi9nTkJnZjRERUIxQkFYUkJBV3BCL3dGeEVCOGp6Z0ZCQVdvaUFVRUlSZ1JBUVFBa3pnRkJBU1REQVVFREVGcEJndjREUVlMK0F4QWRRZjkrY1JBZlFRQWswUUVGSUFFa3pnRUxDd3dCQ3dzTGxRRUFJL3NCUVFCS0JFQWord0VnQUdvaEFFRUFKUHNCQ3lPTkFpQUFhaVNOQWlPUkFrVUVRQ00zQkVBajZ3RWdBR29rNndFUW1BRUZJQUFRbHdFTEl6WUVRQ09uQVNBQWFpU25BUkJ5QlNBQUVIRUxJQUFRbVFFTEl6Z0VRQ1BGQVNBQWFpVEZBUkNPQVFVZ0FCQ05BUXNqbEFJZ0FHb2lBQ09TQWs0RVFDT1RBa0VCYWlTVEFpQUFJNUlDYXlFQUN5QUFKSlFDQ3d3QVFRUVFtZ0VqakFJUUhRc3BBUUYvUVFRUW1nRWpqQUpCQVdwQi8vOERjUkFkSVFBUW13RkIvd0Z4SUFCQi93RnhRUWgwY2dzT0FFRUVFSm9CSUFBZ0FSQ1NBUXN3QUVFQklBQjBRZjhCY1NFQUlBRkJBRW9FUUNPS0FpQUFja0gvQVhFa2lnSUZJNG9DSUFCQi93RnpjU1NLQWdzTENRQkJCU0FBRUo0QkN6b0JBWDhnQVVFQVRnUkFJQUJCRDNFZ0FVRVBjV3BCRUhGQkFFY1Fud0VGSUFGQkgzVWlBaUFCSUFKcWMwRVBjU0FBUVE5eFN4Q2ZBUXNMQ1FCQkJ5QUFFSjRCQ3drQVFRWWdBQkNlQVFzSkFFRUVJQUFRbmdFTFB3RUNmeUFCUVlEK0EzRkJDSFVoQWlBQlFmOEJjU0lCSVFNZ0FDQUJFSkVCQkVBZ0FDQURFQjhMSUFCQkFXb2lBQ0FDRUpFQkJFQWdBQ0FDRUI4TEN3NEFRUWdRbWdFZ0FDQUJFS1FCQzFvQUlBSUVRQ0FBUWYvL0EzRWlBQ0FCYWlBQUlBRnpjeUlBUVJCeFFRQkhFSjhCSUFCQmdBSnhRUUJIRUtNQkJTQUFJQUZxUWYvL0EzRWlBaUFBUWYvL0EzRkpFS01CSUFBZ0FYTWdBbk5CZ0NCeFFRQkhFSjhCQ3dzTEFFRUVFSm9CSUFBUWRndXBCUUVCZndKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc01GUXNRbkFGQi8vOERjU0lBUVlEK0EzRkJDSFVraEFJZ0FFSC9BWEVraFFJTUR3c2poUUpCL3dGeEk0UUNRZjhCY1VFSWRISWpnd0lRblFFTUV3c2poUUpCL3dGeEk0UUNRZjhCY1VFSWRISkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtoQUlNRXdzamhBSWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtoQUlNRFFzamhBSWlBRUYvRUtBQklBQkJBV3RCL3dGeElnQWtoQUlNRFFzUW13RkIvd0Z4SklRQ0RBMExJNE1DSWdCQmdBRnhRWUFCUmhDakFTQUFRUUYwSUFCQi93RnhRUWQyY2tIL0FYRWtnd0lNRFFzUW5BRkIvLzhEY1NPTEFoQ2xBUXdJQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQUk0VUNRZjhCY1NPRUFrSC9BWEZCQ0hSeUlnRkJBQkNtQVNBQUlBRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJZ0NJQUJCL3dGeEpJa0NRUUFRb2dGQkNBOExJNFVDUWY4QmNTT0VBa0gvQVhGQkNIUnlFS2NCUWY4QmNTU0RBZ3dMQ3lPRkFrSC9BWEVqaEFKQi93RnhRUWgwY2tFQmEwSC8vd054SWdCQmdQNERjVUVJZFNTRUFnd0xDeU9GQWlJQVFRRVFvQUVnQUVFQmFrSC9BWEVpQUNTRkFnd0ZDeU9GQWlJQVFYOFFvQUVnQUVFQmEwSC9BWEVpQUNTRkFnd0ZDeENiQVVIL0FYRWtoUUlNQlFzamd3SWlBRUVCY1VFQVN4Q2pBU0FBUVFkMElBQkIvd0Z4UVFGMmNrSC9BWEVrZ3dJTUJRdEJmdzhMSTR3Q1FRSnFRZi8vQTNFa2pBSU1CQXNnQUVVUW9RRkJBQkNpQVF3REN5QUFSUkNoQVVFQkVLSUJEQUlMSTR3Q1FRRnFRZi8vQTNFa2pBSU1BUXRCQUJDaEFVRUFFS0lCUVFBUW53RUxRUVFQQ3lBQVFmOEJjU1NGQWtFSUM1a0dBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUkJIQkVBZ0FFRVJSZzBCQWtBZ0FFRVNhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPQkFnUkFRYzMrQXhDbkFVSC9BWEVpQUVFQmNRUkFRYzMrQXlBQVFYNXhJZ0JCZ0FGeEJIOUJBQ1NDQWlBQVFmOStjUVZCQVNTQ0FpQUFRWUFCY2dzUW5RRkJ4QUFQQ3d0QkFTU1JBZ3dRQ3hDY0FVSC8vd054SWdCQmdQNERjVUVJZFNTR0FpQUFRZjhCY1NTSEFpT01Ba0VDYWtILy93TnhKSXdDREJFTEk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeUk0TUNFSjBCREJBTEk0Y0NRZjhCY1NPR0FrSC9BWEZCQ0hSeVFRRnFRZi8vQTNFaUFFR0EvZ054UVFoMUpJWUNEQkFMSTRZQ0lnQkJBUkNnQVNBQVFRRnFRZjhCY1NTR0FpT0dBa1VRb1FGQkFCQ2lBUXdPQ3lPR0FpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFa2hnSWpoZ0pGRUtFQlFRRVFvZ0VNRFFzUW13RkIvd0Z4SklZQ0RBb0xJNE1DSWdGQmdBRnhRWUFCUmlFQUk0b0NRUVIyUVFGeElBRkJBWFJ5UWY4QmNTU0RBZ3dLQ3hDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01Ba0VJRHdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFDT0hBa0gvQVhFamhnSkIvd0Z4UVFoMGNpSUJRUUFRcGdFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBa0VBRUtJQlFRZ1BDeU9IQWtIL0FYRWpoZ0pCL3dGeFFRaDBjaENuQVVIL0FYRWtnd0lNQ0Fzamh3SkIvd0Z4STRZQ1FmOEJjVUVJZEhKQkFXdEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2hnSU1DQXNqaHdJaUFFRUJFS0FCSUFCQkFXcEIvd0Z4SWdBa2h3SWdBRVVRb1FGQkFCQ2lBUXdHQ3lPSEFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0hBaUFBUlJDaEFVRUJFS0lCREFVTEVKc0JRZjhCY1NTSEFnd0NDeU9EQWlJQlFRRnhRUUZHSVFBamlnSkJCSFpCQVhGQkIzUWdBVUgvQVhGQkFYWnlKSU1DREFJTFFYOFBDeU9NQWtFQmFrSC8vd054Skl3Q0RBRUxJQUFRb3dGQkFCQ2hBVUVBRUtJQlFRQVFud0VMUVFRUEN5QUFRZjhCY1NTSEFrRUlDL1VHQVFKL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFRWdSd1JBSUFCQklVWU5BUUpBSUFCQkltc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqaWdKQkIzWkJBWEVFUUNPTUFrRUJha0gvL3dOeEpJd0NCUkNiQVNFQUk0d0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTTUFndEJDQThMRUp3QlFmLy9BM0VpQUVHQS9nTnhRUWgxSklnQ0lBQkIvd0Z4SklrQ0k0d0NRUUpxUWYvL0EzRWtqQUlNRkFzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFDT0RBaENkQVF3UEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNrRUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBZ3dOQ3lPSUFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0lBZ3dPQ3lPSUFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0lBZ3dPQ3hDYkFVSC9BWEVraUFJTURndEJCa0VBSTRvQ0lnSkJCWFpCQVhGQkFFc2JJZ0JCNEFCeUlBQWdBa0VFZGtFQmNVRUFTeHNoQUNPREFpRUJJQUpCQm5aQkFYRkJBRXNFZnlBQklBQnJRZjhCY1FVZ0FTQUFRUVp5SUFBZ0FVRVBjVUVKU3hzaUFFSGdBSElnQUNBQlFaa0JTeHNpQUdwQi93RnhDeUlCUlJDaEFTQUFRZUFBY1VFQVJ4Q2pBVUVBRUo4QklBRWtnd0lNRGdzamlnSkJCM1pCQVhGQkFFc0VRQkNiQVNFQUk0d0NJQUJCR0hSQkdIVnFRZi8vQTNGQkFXcEIvLzhEY1NTTUFnVWpqQUpCQVdwQi8vOERjU1NNQWd0QkNBOExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJZ0FnQUVILy93TnhRUUFRcGdFZ0FFRUJkRUgvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBa0VBRUtJQlFRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlBRUtjQlFmOEJjU1NEQWd3SEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0lBZ3dGQ3lPSkFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0pBZ3dHQ3lPSkFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0pBZ3dHQ3hDYkFVSC9BWEVraVFJTUJnc2pnd0pCZjNOQi93RnhKSU1DUVFFUW9nRkJBUkNmQVF3R0MwRi9Ed3NnQUVIL0FYRWtpUUpCQ0E4TElBQkJBV3BCLy84RGNTSUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUlNQXdzZ0FFVVFvUUZCQUJDaUFRd0NDeUFBUlJDaEFVRUJFS0lCREFFTEk0d0NRUUZxUWYvL0EzRWtqQUlMUVFRTDhRVUJBWDhDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFUQkhCRUFnQUVFeFJnMEJBa0FnQUVFeWF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9LQWtFRWRrRUJjUVJBSTR3Q1FRRnFRZi8vQTNFa2pBSUZFSnNCSVFBampBSWdBRUVZZEVFWWRXcEIvLzhEY1VFQmFrSC8vd054Skl3Q0MwRUlEd3NRbkFGQi8vOERjU1NMQWlPTUFrRUNha0gvL3dOeEpJd0NEQkVMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5SWdBamd3SVFuUUVNRGdzaml3SkJBV3BCLy84RGNTU0xBa0VJRHdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BU0lCUVFFUW9BRWdBVUVCYWtIL0FYRWlBVVVRb1FGQkFCQ2lBU0FBSUFFUW5RRU1EZ3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElpQUJDbkFTSUJRWDhRb0FFZ0FVRUJhMEgvQVhFaUFVVVFvUUZCQVJDaUFTQUFJQUVRblFFTURRc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFtd0ZCL3dGeEVKMEJEQXNMUVFBUW9nRkJBQkNmQVVFQkVLTUJEQXNMSTRvQ1FRUjJRUUZ4UVFGR0JFQVFtd0VoQUNPTUFpQUFRUmgwUVJoMWFrSC8vd054UVFGcVFmLy9BM0VrakFJRkk0d0NRUUZxUWYvL0EzRWtqQUlMUVFnUEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpSUFJNHNDUVFBUXBnRWppd0lnQUdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFKQkFCQ2lBVUVJRHdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BVUgvQVhFa2d3SU1CZ3NqaXdKQkFXdEIvLzhEY1NTTEFrRUlEd3NqZ3dJaUFFRUJFS0FCSUFCQkFXcEIvd0Z4SWdBa2d3SWdBRVVRb1FGQkFCQ2lBUXdHQ3lPREFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0RBaUFBUlJDaEFVRUJFS0lCREFVTEVKc0JRZjhCY1NTREFnd0RDMEVBRUtJQlFRQVFud0VqaWdKQkJIWkJBWEZCQUUwUW93RU1Bd3RCZnc4TElBQkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUlNQVFzampBSkJBV3BCLy84RGNTU01BZ3RCQkF1Q0FnQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFjQUFSd1JBSUFCQndRQkdEUUVDUUNBQVFjSUFhdzRPQXdRRkJnY0lDUkVLQ3d3TkRnOEFDd3dQQ3d3UEN5T0ZBaVNFQWd3T0N5T0dBaVNFQWd3TkN5T0hBaVNFQWd3TUN5T0lBaVNFQWd3TEN5T0pBaVNFQWd3S0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2hBSU1DUXNqZ3dJa2hBSU1DQXNqaEFJa2hRSU1Cd3NqaGdJa2hRSU1CZ3NqaHdJa2hRSU1CUXNqaUFJa2hRSU1CQXNqaVFJa2hRSU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdGQi93RnhKSVVDREFJTEk0TUNKSVVDREFFTFFYOFBDMEVFQy8wQkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUWRBQVJ3UkFJQUJCMFFCR0RRRUNRQ0FBUWRJQWF3NE9FQU1FQlFZSENBa0tFQXNNRFE0QUN3d09DeU9FQWlTR0Fnd09DeU9GQWlTR0Fnd05DeU9IQWlTR0Fnd01DeU9JQWlTR0Fnd0xDeU9KQWlTR0Fnd0tDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtoZ0lNQ1Fzamd3SWtoZ0lNQ0FzamhBSWtod0lNQndzamhRSWtod0lNQmdzamhnSWtod0lNQlFzamlBSWtod0lNQkFzamlRSWtod0lNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RkIvd0Z4SkljQ0RBSUxJNE1DSkljQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFlQUFSd1JBSUFCQjRRQkdEUUVDUUNBQVFlSUFhdzRPQXdRUUJRWUhDQWtLQ3d3UURRNEFDd3dPQ3lPRUFpU0lBZ3dPQ3lPRkFpU0lBZ3dOQ3lPR0FpU0lBZ3dNQ3lPSEFpU0lBZ3dMQ3lPSkFpU0lBZ3dLQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFVSC9BWEVraUFJTUNRc2pnd0lraUFJTUNBc2poQUlraVFJTUJ3c2poUUlraVFJTUJnc2poZ0lraVFJTUJRc2pod0lraVFJTUJBc2ppQUlraVFJTUF3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFwd0ZCL3dGeEpJa0NEQUlMSTRNQ0pJa0NEQUVMUVg4UEMwRUVDNXNEQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFCSEJFQWdBRUh4QUVZTkFRSkFJQUJCOGdCckRnNERCQVVHQndnSkNnc01EUTRQRVFBTERBOExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNFFDRUowQkRBOExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNFVDRUowQkRBNExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNFlDRUowQkRBMExJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNGNDRUowQkRBd0xJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNGdDRUowQkRBc0xJNGtDUWY4QmNTT0lBa0gvQVhGQkNIUnlJNGtDRUowQkRBb0xJL3dCUlFSQUFrQWp0d0VFUUVFQkpJNENEQUVMSTdrQkk3OEJjVUVmY1VVRVFFRUJKSThDREFFTFFRRWtrQUlMQ3d3SkN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpT0RBaENkQVF3SUN5T0VBaVNEQWd3SEN5T0ZBaVNEQWd3R0N5T0dBaVNEQWd3RkN5T0hBaVNEQWd3RUN5T0lBaVNEQWd3REN5T0pBaVNEQWd3Q0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2d3SU1BUXRCZnc4TFFRUUxOd0VCZnlBQlFRQk9CRUFnQUVIL0FYRWdBQ0FCYWtIL0FYRkxFS01CQlNBQlFSOTFJZ0lnQVNBQ2FuTWdBRUgvQVhGS0VLTUJDd3MwQVFKL0k0TUNJZ0VnQUVIL0FYRWlBaENnQVNBQklBSVFzQUVnQUNBQmFrSC9BWEVpQUNTREFpQUFSUkNoQVVFQUVLSUJDMWdCQW44amd3SWlBU0FBYWlPS0FrRUVka0VCY1dwQi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVjUW53RWdBRUgvQVhFZ0FXb2ppZ0pCQkhaQkFYRnFRWUFDY1VFQVN4Q2pBU0FDSklNQ0lBSkZFS0VCUVFBUW9nRUxpd0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVlBQlJ3UkFJQUJCZ1FGR0RRRUNRQ0FBUVlJQmF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9FQWhDeEFRd1FDeU9GQWhDeEFRd1BDeU9HQWhDeEFRd09DeU9IQWhDeEFRd05DeU9JQWhDeEFRd01DeU9KQWhDeEFRd0xDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDeEFRd0tDeU9EQWhDeEFRd0pDeU9FQWhDeUFRd0lDeU9GQWhDeUFRd0hDeU9HQWhDeUFRd0dDeU9IQWhDeUFRd0ZDeU9JQWhDeUFRd0VDeU9KQWhDeUFRd0RDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDeUFRd0NDeU9EQWhDeUFRd0JDMEYvRHd0QkJBczNBUUovSTRNQ0lnRWdBRUgvQVhGQmYyd2lBaENnQVNBQklBSVFzQUVnQVNBQWEwSC9BWEVpQUNTREFpQUFSUkNoQVVFQkVLSUJDMWdCQW44amd3SWlBU0FBYXlPS0FrRUVka0VCY1d0Qi93RnhJZ0lnQUNBQmMzTkJFSEZCQUVjUW53RWdBU0FBUWY4QmNXc2ppZ0pCQkhaQkFYRnJRWUFDY1VFQVN4Q2pBU0FDSklNQ0lBSkZFS0VCUVFFUW9nRUxpd0lBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVpBQlJ3UkFJQUJCa1FGR0RRRUNRQ0FBUVpJQmF3NE9Bd1FGQmdjSUNRb0xEQTBPRHhBQUN3d1FDeU9FQWhDMEFRd1FDeU9GQWhDMEFRd1BDeU9HQWhDMEFRd09DeU9IQWhDMEFRd05DeU9JQWhDMEFRd01DeU9KQWhDMEFRd0xDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDMEFRd0tDeU9EQWhDMEFRd0pDeU9FQWhDMUFRd0lDeU9GQWhDMUFRd0hDeU9HQWhDMUFRd0dDeU9IQWhDMUFRd0ZDeU9JQWhDMUFRd0VDeU9KQWhDMUFRd0RDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVJDMUFRd0NDeU9EQWhDMUFRd0JDMEYvRHd0QkJBc2lBQ09EQWlBQWNTSUFKSU1DSUFCRkVLRUJRUUFRb2dGQkFSQ2ZBVUVBRUtNQkN5WUFJNE1DSUFCelFmOEJjU0lBSklNQ0lBQkZFS0VCUVFBUW9nRkJBQkNmQVVFQUVLTUJDNHNDQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVHZ0FVY0VRQ0FBUWFFQlJnMEJBa0FnQUVHaUFXc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNqaEFJUXR3RU1FQXNqaFFJUXR3RU1Ed3NqaGdJUXR3RU1EZ3NqaHdJUXR3RU1EUXNqaUFJUXR3RU1EQXNqaVFJUXR3RU1Dd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdFUXR3RU1DZ3NqZ3dJUXR3RU1DUXNqaEFJUXVBRU1DQXNqaFFJUXVBRU1Cd3NqaGdJUXVBRU1CZ3NqaHdJUXVBRU1CUXNqaUFJUXVBRU1CQXNqaVFJUXVBRU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdFUXVBRU1BZ3NqZ3dJUXVBRU1BUXRCZnc4TFFRUUxKZ0FqZ3dJZ0FISkIvd0Z4SWdBa2d3SWdBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VMTEFFQmZ5T0RBaUlCSUFCQi93RnhRWDlzSWdBUW9BRWdBU0FBRUxBQklBQWdBV3BGRUtFQlFRRVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFiQUJSd1JBSUFCQnNRRkdEUUVDUUNBQVFiSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQzZBUXdRQ3lPRkFoQzZBUXdQQ3lPR0FoQzZBUXdPQ3lPSEFoQzZBUXdOQ3lPSUFoQzZBUXdNQ3lPSkFoQzZBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzZBUXdLQ3lPREFoQzZBUXdKQ3lPRUFoQzdBUXdJQ3lPRkFoQzdBUXdIQ3lPR0FoQzdBUXdHQ3lPSEFoQzdBUXdGQ3lPSUFoQzdBUXdFQ3lPSkFoQzdBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzdBUXdDQ3lPREFoQzdBUXdCQzBGL0R3dEJCQXM3QVFGL0lBQVFkU0lCUVg5R0JIOGdBQkFkQlNBQkMwSC9BWEVnQUVFQmFpSUJFSFVpQUVGL1JnUi9JQUVRSFFVZ0FBdEIvd0Z4UVFoMGNnc01BRUVJRUpvQklBQVF2UUVMTkFBZ0FFR0FBWEZCZ0FGR0VLTUJJQUJCQVhRZ0FFSC9BWEZCQjNaeVFmOEJjU0lBUlJDaEFVRUFFS0lCUVFBUW53RWdBQXN5QUNBQVFRRnhRUUJMRUtNQklBQkJCM1FnQUVIL0FYRkJBWFp5UWY4QmNTSUFSUkNoQVVFQUVLSUJRUUFRbndFZ0FBczRBUUYvSTRvQ1FRUjJRUUZ4SUFCQkFYUnlRZjhCY1NFQklBQkJnQUZ4UVlBQlJoQ2pBU0FCUlJDaEFVRUFFS0lCUVFBUW53RWdBUXM1QVFGL0k0b0NRUVIyUVFGeFFRZDBJQUJCL3dGeFFRRjJjaUVCSUFCQkFYRkJBVVlRb3dFZ0FVVVFvUUZCQUJDaUFVRUFFSjhCSUFFTEtnQWdBRUdBQVhGQmdBRkdFS01CSUFCQkFYUkIvd0Z4SWdCRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBQ3owQkFYOGdBRUgvQVhGQkFYWWlBVUdBQVhJZ0FTQUFRWUFCY1VHQUFVWWJJZ0ZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFRUUZ4UVFGR0VLTUJJQUVMS3dBZ0FFRVBjVUVFZENBQVFmQUJjVUVFZG5JaUFFVVFvUUZCQUJDaUFVRUFFSjhCUVFBUW93RWdBQXNxQVFGL0lBQkIvd0Z4UVFGMklnRkZFS0VCUVFBUW9nRkJBQkNmQVNBQVFRRnhRUUZHRUtNQklBRUxIZ0JCQVNBQWRDQUJjVUgvQVhGRkVLRUJRUUFRb2dGQkFSQ2ZBU0FCQzhnSUFRVi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRUWR4SWdRRVFDQUVRUUZHRFFFQ1FDQUVRUUpyRGdZREJBVUdCd2dBQ3d3SUN5T0VBaUVCREFjTEk0VUNJUUVNQmdzamhnSWhBUXdGQ3lPSEFpRUJEQVFMSTRnQ0lRRU1Bd3NqaVFJaEFRd0NDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVNFQkRBRUxJNE1DSVFFTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVId0FYRkJCSFVpQlFSQUlBVkJBVVlOQVFKQUlBVkJBbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzZ0FFRUhUQVIvSUFFUXZ3RWhBa0VCQlNBQVFROU1CSDhnQVJEQUFTRUNRUUVGUVFBTEN5RUREQThMSUFCQkYwd0VmeUFCRU1FQklRSkJBUVVnQUVFZlRBUi9JQUVRd2dFaEFrRUJCVUVBQ3dzaEF3d09DeUFBUVNkTUJIOGdBUkREQVNFQ1FRRUZJQUJCTDB3RWZ5QUJFTVFCSVFKQkFRVkJBQXNMSVFNTURRc2dBRUUzVEFSL0lBRVF4UUVoQWtFQkJTQUFRVDlNQkg4Z0FSREdBU0VDUVFFRlFRQUxDeUVEREF3TElBQkJ4d0JNQkg5QkFDQUJFTWNCSVFKQkFRVWdBRUhQQUV3RWYwRUJJQUVReHdFaEFrRUJCVUVBQ3dzaEF3d0xDeUFBUWRjQVRBUi9RUUlnQVJESEFTRUNRUUVGSUFCQjN3Qk1CSDlCQXlBQkVNY0JJUUpCQVFWQkFBc0xJUU1NQ2dzZ0FFSG5BRXdFZjBFRUlBRVF4d0VoQWtFQkJTQUFRZThBVEFSL1FRVWdBUkRIQVNFQ1FRRUZRUUFMQ3lFRERBa0xJQUJCOXdCTUJIOUJCaUFCRU1jQklRSkJBUVVnQUVIL0FFd0VmMEVISUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dJQ3lBQVFZY0JUQVIvSUFGQmZuRWhBa0VCQlNBQVFZOEJUQVIvSUFGQmZYRWhBa0VCQlVFQUN3c2hBd3dIQ3lBQVFaY0JUQVIvSUFGQmUzRWhBa0VCQlNBQVFaOEJUQVIvSUFGQmQzRWhBa0VCQlVFQUN3c2hBd3dHQ3lBQVFhY0JUQVIvSUFGQmIzRWhBa0VCQlNBQVFhOEJUQVIvSUFGQlgzRWhBa0VCQlVFQUN3c2hBd3dGQ3lBQVFiY0JUQVIvSUFGQnYzOXhJUUpCQVFVZ0FFRy9BVXdFZnlBQlFmOStjU0VDUVFFRlFRQUxDeUVEREFRTElBQkJ4d0ZNQkg4Z0FVRUJjaUVDUVFFRklBQkJ6d0ZNQkg4Z0FVRUNjaUVDUVFFRlFRQUxDeUVEREFNTElBQkIxd0ZNQkg4Z0FVRUVjaUVDUVFFRklBQkIzd0ZNQkg4Z0FVRUljaUVDUVFFRlFRQUxDeUVEREFJTElBQkI1d0ZNQkg4Z0FVRVFjaUVDUVFFRklBQkI3d0ZNQkg4Z0FVRWdjaUVDUVFFRlFRQUxDeUVEREFFTElBQkI5d0ZNQkg4Z0FVSEFBSEloQWtFQkJTQUFRZjhCVEFSL0lBRkJnQUZ5SVFKQkFRVkJBQXNMSVFNTEFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBRUJFQWdCRUVCUmcwQkFrQWdCRUVDYXc0R0F3UUZCZ2NJQUFzTUNBc2dBaVNFQWd3SEN5QUNKSVVDREFZTElBSWtoZ0lNQlFzZ0FpU0hBZ3dFQ3lBQ0pJZ0NEQU1MSUFJa2lRSU1BZ3RCQVNBRlFRZEtJQVZCQkVnYkJFQWppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWdBaENkQVFzTUFRc2dBaVNEQWd0QkJFRi9JQU1iQzdzRUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUVIQUFVY0VRQ0FBUWNFQlJnMEJBa0FnQUVIQ0FXc09EZ01TQkFVR0J3Z0pDZ3NNRVEwT0FBc01EZ3NqaWdKQkIzWkJBWEVORVF3T0N5T0xBaEMrQVVILy93TnhJUUFqaXdKQkFtcEIvLzhEY1NTTEFpQUFRWUQrQTNGQkNIVWtoQUlnQUVIL0FYRWtoUUpCQkE4TEk0b0NRUWQyUVFGeERSRU1EZ3NqaWdKQkIzWkJBWEVORUF3TUN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT0ZBa0gvQVhFamhBSkIvd0Z4UVFoMGNoQ2xBUXdOQ3hDYkFSQ3hBUXdOQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVBSkl3Q0RBc0xJNG9DUVFkMlFRRnhRUUZIRFFvTUJ3c2ppd0lpQUJDK0FVSC8vd054Skl3Q0lBQkJBbXBCLy84RGNTU0xBZ3dKQ3lPS0FrRUhka0VCY1VFQlJnMEhEQW9MRUpzQlFmOEJjUkRJQVNFQUk0d0NRUUZxUWYvL0EzRWtqQUlnQUE4TEk0b0NRUWQyUVFGeFFRRkhEUWdqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqakFKQkFtcEIvLzhEY1JDbEFRd0ZDeENiQVJDeUFRd0dDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWhDbEFVRUlKSXdDREFRTFFYOFBDeU9MQWlJQUVMNEJRZi8vQTNFa2pBSWdBRUVDYWtILy93TnhKSXNDUVF3UEN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01Ba0VDYWtILy93TnhFS1VCQ3hDY0FVSC8vd054Skl3Q0MwRUlEd3NqakFKQkFXcEIvLzhEY1NTTUFrRUVEd3NqakFKQkFtcEIvLzhEY1NTTUFrRU1DNkFFQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkIwQUZIQkVBZ0FFSFJBVVlOQVFKQUlBQkIwZ0ZyRGc0REFBUUZCZ2NJQ1FvQUN3QU1EUUFMREEwTEk0b0NRUVIyUVFGeERROE1EUXNqaXdJaUFSQytBVUgvL3dOeElRQWdBVUVDYWtILy93TnhKSXNDSUFCQmdQNERjVUVJZFNTR0FpQUFRZjhCY1NTSEFrRUVEd3NqaWdKQkJIWkJBWEVORHd3TUN5T0tBa0VFZGtFQmNRME9JNHNDUVFKclFmLy9BM0VpQUNTTEFpQUFJNHdDUVFKcVFmLy9BM0VRcFFFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpod0pCL3dGeEk0WUNRZjhCY1VFSWRISVFwUUVNQ3dzUW13RVF0QUVNQ3dzaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSVFwUUZCRUNTTUFnd0pDeU9LQWtFRWRrRUJjVUVCUncwSURBWUxJNHNDSWdBUXZnRkIvLzhEY1NTTUFrRUJKTGdCSUFCQkFtcEIvLzhEY1NTTEFnd0hDeU9LQWtFRWRrRUJjVUVCUmcwRkRBZ0xJNG9DUVFSMlFRRnhRUUZIRFFjaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSkJBbXBCLy84RGNSQ2xBUXdFQ3hDYkFSQzFBUXdGQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVZSkl3Q0RBTUxRWDhQQ3lPTEFpSUFFTDRCUWYvL0EzRWtqQUlnQUVFQ2FrSC8vd054SklzQ1FRd1BDeENjQVVILy93TnhKSXdDQzBFSUR3c2pqQUpCQVdwQi8vOERjU1NNQWtFRUR3c2pqQUpCQW1wQi8vOERjU1NNQWtFTUM3RURBUUYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCNEFGSEJFQWdBRUhoQVVZTkFRSkFJQUJCNGdGckRnNERBQUFFQlFZSENBa0FBQUFLQ3dBTERBc0xFSnNCUWY4QmNVR0EvZ05xSTRNQ0VKMEJEQXNMSTRzQ0lnRVF2Z0ZCLy84RGNTRUFJQUZCQW1wQi8vOERjU1NMQWlBQVFZRCtBM0ZCQ0hVa2lBSWdBRUgvQVhFa2lRSkJCQThMSTRVQ1FZRCtBMm9qZ3dJUW5RRkJCQThMSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5RUtVQlFRZ1BDeENiQVJDM0FRd0hDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWhDbEFVRWdKSXdDUVFnUEN4Q2JBVUVZZEVFWWRTRUFJNHNDSUFCQkFSQ21BU09MQWlBQWFrSC8vd054SklzQ1FRQVFvUUZCQUJDaUFTT01Ba0VCYWtILy93TnhKSXdDUVF3UEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpU01Ba0VFRHdzUW5BRkIvLzhEY1NPREFoQ2RBU09NQWtFQ2FrSC8vd054Skl3Q1FRUVBDeENiQVJDNEFRd0NDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWhDbEFVRW9KSXdDUVFnUEMwRi9Ed3NqakFKQkFXcEIvLzhEY1NTTUFrRUVDK2NEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCOEFGSEJFQWdBRUh4QVVZTkFRSkFJQUJCOGdGckRnNERCQUFGQmdjSUNRb0xBQUFNRFFBTERBMExFSnNCUWY4QmNVR0EvZ05xRUtjQlFmOEJjU1NEQWd3TkN5T0xBaUlCRUw0QlFmLy9BM0VoQUNBQlFRSnFRZi8vQTNFa2l3SWdBRUdBL2dOeFFRaDFKSU1DSUFCQi93RnhKSW9DREEwTEk0VUNRWUQrQTJvUXB3RkIvd0Z4SklNQ0RBd0xRUUFrdHdFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWppZ0pCL3dGeEk0TUNRZjhCY1VFSWRISVFwUUZCQ0E4TEVKc0JFTG9CREFnTEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0d0NFS1VCUVRBa2pBSkJDQThMRUpzQlFSaDBRUmgxSVFBaml3SWhBVUVBRUtFQlFRQVFvZ0VnQVNBQVFRRVFwZ0VnQUNBQmFrSC8vd054SWdCQmdQNERjVUVJZFNTSUFpQUFRZjhCY1NTSkFpT01Ba0VCYWtILy93TnhKSXdDUVFnUEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpU0xBa0VJRHdzUW5BRkIvLzhEY1JDbkFVSC9BWEVrZ3dJampBSkJBbXBCLy84RGNTU01BZ3dGQzBFQkpMZ0JEQVFMRUpzQkVMc0JEQUlMSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTR3Q0VLVUJRVGdrakFKQkNBOExRWDhQQ3lPTUFrRUJha0gvL3dOeEpJd0NDMEVFQzlnQkFRRi9JNHdDUVFGcVFmLy9BM0VoQVNPUUFnUkFJQUZCQVd0Qi8vOERjU0VCQ3lBQkpJd0NBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRnhRUVIxSWdFRVFDQUJRUUZyRGc0QkFnTUVCUVlIQ0FrS0N3d05EZzhMSUFBUXFBRVBDeUFBRUtrQkR3c2dBQkNxQVE4TElBQVFxd0VQQ3lBQUVLd0JEd3NnQUJDdEFROExJQUFRcmdFUEN5QUFFSzhCRHdzZ0FCQ3pBUThMSUFBUXRnRVBDeUFBRUxrQkR3c2dBQkM4QVE4TElBQVF5UUVQQ3lBQUVNb0JEd3NnQUJETEFROExJQUFRekFFTHZnRUJBbjlCQUNTM0FVR1AvZ01RSFVFQklBQjBRWDl6Y1NJQkpMOEJRWS8rQXlBQkVCOGppd0pCQW10Qi8vOERjU1NMQWlPTEFpSUJJNHdDSWdKQi93RnhFQjhnQVVFQmFpQUNRWUQrQTNGQkNIVVFId0pBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQXdNRUJRQUxEQVVMUVFBa3dBRkJ3QUFrakFJTUJBdEJBQ1RCQVVISUFDU01BZ3dEQzBFQUpNSUJRZEFBSkl3Q0RBSUxRUUFrd3dGQjJBQWtqQUlNQVF0QkFDVEVBVUhnQUNTTUFnc0w2UUVCQW44anVBRUVRRUVCSkxjQlFRQWt1QUVMSTdrQkk3OEJjVUVmY1VFQVNnUkFJNDhDUlVFQUk3Y0JHd1IvSThBQlFRQWp1Z0ViQkg5QkFCRE9BVUVCQlNQQkFVRUFJN3NCR3dSL1FRRVF6Z0ZCQVFVandnRkJBQ084QVJzRWYwRUNFTTRCUVFFRkk4TUJRUUFqdlFFYkJIOUJBeERPQVVFQkJTUEVBVUVBSTc0Qkd3Ui9RUVFRemdGQkFRVkJBQXNMQ3dzTEJVRUFDd1JBUVFFamp3SWpqZ0liQkg5QkFDU1BBa0VBSkk0Q1FRQWtrQUpCQUNTUkFrRVlCVUVVQ3lFQUMwRUJJNDhDSTQ0Q0d3UkFRUUFrandKQkFDU09Ba0VBSkpBQ1FRQWtrUUlMSUFBUEMwRUFDN1lCQVFKL1FRRWttQUlqa0FJRVFDT01BaEFkUWY4QmNSRE5BUkNhQVVFQUpJOENRUUFramdKQkFDU1FBa0VBSkpFQ0N4RFBBU0lBUVFCS0JFQWdBQkNhQVF0QkJDRUFRUUFqa1FKRlFRRWpqd0lqamdJYkd3UkFJNHdDRUIxQi93RnhFTTBCSVFBTEk0b0NRZkFCY1NTS0FpQUFRUUJNQkVBZ0FBOExJQUFRbWdFamx3SkJBV29pQVNPVkFrNEVmeU9XQWtFQmFpU1dBaUFCSTVVQ2F3VWdBUXNrbHdJampBSWozUUZHQkVCQkFTVGdBUXNnQUFzRkFDTzJBUXV1QVFFRGZ5QUFRWDlCZ0FnZ0FFRUFTQnNnQUVFQVNoc2hBa0VBSVFBRFFDUGdBVVZCQUNBQlJVRUFRUUFnQUVVZ0F4c2JHd1JBRU5BQlFRQklCRUJCQVNFREJTT05Ba0hRcEFRamdnSjBUZ1JBUVFFaEFBVkJBU0FCSTdZQklBSk9RUUFnQWtGL1Noc2JJUUVMQ3d3QkN3c2dBQVJBSTQwQ1FkQ2tCQ09DQW5SckpJMENRUUFQQ3lBQkJFQkJBUThMSStBQkJFQkJBQ1RnQVVFQ0R3c2pqQUpCQVd0Qi8vOERjU1NNQWtGL0N3Y0FRWDhRMGdFTE5BRUNmd05BSUFGQkFFNUJBQ0FDSUFCSUd3UkFRWDhRMGdFaEFTQUNRUUZxSVFJTUFRc0xJQUZCQUVnRVFDQUJEd3RCQUFzRkFDT1NBZ3NGQUNPVEFnc0ZBQ09VQWd0YkFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0JnTUVCUVlIQ0FBTERBZ0xJOUlCRHdzajFRRVBDeVBUQVE4TEk5UUJEd3NqMWdFUEN5UFhBUThMSTlnQkR3c2oyUUVQQzBFQUM0Y0JBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09CZ01FQlFZSENBQUxEQWdMSUFGQkFFY2swZ0VNQndzZ0FVRUFSeVRWQVF3R0N5QUJRUUJISk5NQkRBVUxJQUZCQUVjazFBRU1CQXNnQVVFQVJ5VFdBUXdEQ3lBQlFRQkhKTmNCREFJTElBRkJBRWNrMkFFTUFRc2dBVUVBUnlUWkFRc0xVUUVCZjBFQUpKRUNJQUFRMkFGRkJFQkJBU0VCQ3lBQVFRRVEyUUVnQVFSQVFRRkJBVUVBUVFGQkFDQUFRUU5NR3lJQVFRQWoyd0ViR3lBQVJVRUFJOXdCR3hzRVFFRUJKTVFCUVFRUVdnc0xDd2tBSUFCQkFCRFpBUXVhQVFBZ0FFRUFTZ1JBUVFBUTJnRUZRUUFRMndFTElBRkJBRW9FUUVFQkVOb0JCVUVCRU5zQkN5QUNRUUJLQkVCQkFoRGFBUVZCQWhEYkFRc2dBMEVBU2dSQVFRTVEyZ0VGUVFNUTJ3RUxJQVJCQUVvRVFFRUVFTm9CQlVFRUVOc0JDeUFGUVFCS0JFQkJCUkRhQVFWQkJSRGJBUXNnQmtFQVNnUkFRUVlRMmdFRlFRWVEyd0VMSUFkQkFFb0VRRUVIRU5vQkJVRUhFTnNCQ3dzSEFDQUFKTjBCQ3djQVFYOGszUUVMQndBZ0FDVGVBUXNIQUVGL0pONEJDd2NBSUFBazN3RUxCd0JCZnlUZkFRc0ZBQ09EQWdzRkFDT0VBZ3NGQUNPRkFnc0ZBQ09HQWdzRkFDT0hBZ3NGQUNPSUFnc0ZBQ09KQWdzRkFDT0tBZ3NGQUNPTUFnc0ZBQ09MQWdzTEFDT01BaEFkUWY4QmNRc0ZBQ1B0QVF1ckF3RUtmMEdBZ0FKQmdKQUNJK1lCR3lFSVFZQzRBa0dBc0FJajV3RWJJUWtEUUNBRlFZQUNTQVJBUVFBaEJBTkFJQVJCZ0FKSUJFQWdDQ0FGUVFOMVFRVjBJQWxxSUFSQkEzVnFJZ0pCZ0pCK2FpMEFBQkJOSVFZZ0JVRUlieUVCUVFjZ0JFRUliMnNoQjBFQUlRTUNmeUFBUVFCS1FRQWpnUUliQkVBZ0FrR0EwSDVxTFFBQUlRTUxJQU5Cd0FCeEN3UkFRUWNnQVdzaEFRdEJBQ0VDSUFGQkFYUWdCbW9pQmtHQWtINXFRUUZCQUNBRFFRaHhHeUlDUVExMGFpMEFBQ0VLUVFBaEFTQUdRWUdRZm1vZ0FrRU5kR290QUFCQkFTQUhkSEVFUUVFQ0lRRUxJQUZCQVdvZ0FVRUJJQWQwSUFweEd5RUJJQVZCQ0hRZ0JHcEJBMndoQWlBQVFRQktRUUFqZ1FJYkJFQWdBa0dBb1F0cUlnSWdBMEVIY1NBQlFRQVFUaUlCUVI5eFFRTjBPZ0FBSUFKQkFXb2dBVUhnQjNGQkJYVkJBM1E2QUFBZ0FrRUNhaUFCUVlENEFYRkJDblZCQTNRNkFBQUZJQUpCZ0tFTGFpSURJQUZCeC80REVFOGlBVUdBZ1B3SGNVRVFkVG9BQUNBRFFRRnFJQUZCZ1A0RGNVRUlkVG9BQUNBRFFRSnFJQUU2QUFBTElBUkJBV29oQkF3QkN3c2dCVUVCYWlFRkRBRUxDd3ZWQXdFTWZ3TkFJQVJCRjA1RkJFQkJBQ0VEQTBBZ0EwRWZTQVJBUVFGQkFDQURRUTlLSWdjYklRa2dCRUVQYXlBRUlBUkJEMG9pQUJ0QkJIUWlCU0FEUVE5cmFpQURJQVZxSUFjYklRaEJnSkFDUVlDQUFpQUFHeUVLUWNmK0F5RUhRWDhoQmtGL0lRVkJBQ0VCQTBBZ0FVRUlTQVJBUVFBaEFBTkFJQUJCQlVnRVFDQUFRUU4wSUFGcVFRSjBJZ0pCZ3Z3RGFoQWRJQWhHQkVBZ0FrR0QvQU5xRUIwaEFrRUJRUUFnQWtFSWNVRUFJNEVDR3hzZ0NVWUVRRUVJSVFGQkJTRUFJQUlpQlVFUWNRUi9RY24rQXdWQnlQNERDeUVIQ3dzZ0FFRUJhaUVBREFFTEN5QUJRUUZxSVFFTUFRc0xJQVZCQUVoQkFDT0JBaHNFUUVHQXVBSkJnTEFDSStjQkd5RUxRWDhoQUVFQUlRSURRQ0FDUVNCSUJFQkJBQ0VCQTBBZ0FVRWdTQVJBSUFGQkJYUWdDMm9nQW1vaUJrR0FrSDVxTFFBQUlBaEdCRUJCSUNFQ1FTQWhBU0FHSVFBTElBRkJBV29oQVF3QkN3c2dBa0VCYWlFQ0RBRUxDeUFBUVFCT0JIOGdBRUdBMEg1cUxRQUFCVUYvQ3lFR0MwRUFJUUFEUUNBQVFRaElCRUFnQ0NBS0lBbEJBRUVISUFBZ0EwRURkQ0FFUVFOMElBQnFRZmdCUVlDaEZ5QUhJQVlnQlJCUUdpQUFRUUZxSVFBTUFRc0xJQU5CQVdvaEF3d0JDd3NnQkVFQmFpRUVEQUVMQ3d1V0FnRUpmd05BSUFSQkNFNUZCRUJCQUNFQkEwQWdBVUVGU0FSQUlBRkJBM1FnQkdwQkFuUWlBRUdBL0FOcUVCMGFJQUJCZ2Z3RGFoQWRHaUFBUVlMOEEyb1FIU0VDUVFFaEJTUG9BUVJBSUFKQkFtOUJBVVlFUUNBQ1FRRnJJUUlMUVFJaEJRc2dBRUdEL0FOcUVCMGhCa0VBSVFkQkFVRUFJQVpCQ0hGQkFDT0JBaHNiSVFkQnlQNERJUWhCeWY0RFFjaitBeUFHUVJCeEd5RUlRUUFoQUFOQUlBQWdCVWdFUUVFQUlRTURRQ0FEUVFoSUJFQWdBQ0FDYWtHQWdBSWdCMEVBUVFjZ0F5QUVRUU4wSUFGQkJIUWdBMm9nQUVFRGRHcEJ3QUJCZ0tFZ0lBaEJmeUFHRUZBYUlBTkJBV29oQXd3QkN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFSQkFXb2hCQXdCQ3dzTEJRQWp4Z0VMQlFBanh3RUxCUUFqeWdFTEdBRUJmeVBNQVNFQUk4c0JCRUFnQUVFRWNpRUFDeUFBQ3pBQkFYOERRQUpBSUFCQi8vOERUZzBBSUFCQmdMWEpCR29nQUJCMk9nQUFJQUJCQVdvaEFBd0JDd3RCQUNUZ0FRc1dBQkFiUHdCQmxBRklCRUJCbEFFL0FHdEFBQm9MQzl3QkFDQUFRWndDU1FSQUR3c2dBRUVRYXlFQUFrQUNRQUpBQWtBQ1FBSkFJQUZCQVVjRVFDQUJRUUpHRFFFQ1FDQUJRUU5yRGdNREJBVUFDd3dGQ3lBQUVCa01CUXNnQUNnQ0JFSC8vLy8vQUhGQkFFMEVRRUVBUVlBQlFjc0FRUkVRQUFBTElBQWdBQ2dDQkVFQmF6WUNCQ0FBRUFjTUJBc2dBQkFLREFNTElBQW9BZ1FpQVVHQWdJQ0FmM0VnQVVFQmFrR0FnSUNBZjNGSEJFQkJBRUdBQVVIV0FFRUdFQUFBQ3lBQUlBRkJBV28yQWdRZ0FVR0FnSUNBQjNFRVFDQUFFQWtMREFJTElBQVFDd3dCQzBFQVFZQUJRZUVBUVJnUUFBQUxDeTBBQWtBQ1FBSkFJQUJCQ0dzb0FnQU9Bd0FBQVFJTER3c2dBQ2dDQUNJQUJFQWdBQ0FCRVBnQkN3OExBQXNEQUFFTEhRQUNRQUpBQWtBam1nSU9BZ0VDQUFzQUMwRUFJUUFMSUFBUTBnRUxCd0FnQUNTYUFnc2xBQUpBQWtBQ1FBSkFJNW9DRGdNQkFnTUFDd0FMUVFFaEFBdEJmeUVCQ3lBQkVOSUJDd3VmQWdZQVFRZ0xMUjRBQUFBQkFBQUFBUUFBQUI0QUFBQitBR3dBYVFCaUFDOEFjZ0IwQUM4QWRBQnNBSE1BWmdBdUFIUUFjd0JCT0FzM0tBQUFBQUVBQUFBQkFBQUFLQUFBQUdFQWJBQnNBRzhBWXdCaEFIUUFhUUJ2QUc0QUlBQjBBRzhBYndBZ0FHd0FZUUJ5QUdjQVpRQkI4QUFMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFjQUIxQUhJQVpRQXVBSFFBY3dCQm9BRUxNeVFBQUFBQkFBQUFBUUFBQUNRQUFBQkpBRzRBWkFCbEFIZ0FJQUJ2QUhVQWRBQWdBRzhBWmdBZ0FISUFZUUJ1QUdjQVpRQkIyQUVMSXhRQUFBQUJBQUFBQVFBQUFCUUFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDNEFkQUJ6QUVHQUFnc1ZBd0FBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFRQURNUWMyOTFjbU5sVFdGd2NHbHVaMVZTVENGamIzSmxMMlJwYzNRdlkyOXlaUzUxYm5SdmRXTm9aV1F1ZDJGemJTNXRZWEE9Iik6CiJ1bmRlZmluZWQiIT09dHlwZW9mIHdpbmRvd3x8InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZj9hd2FpdCBJKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVJZQUovZndGL1lBQUFZQU4vZjM4QmYyQUVmMzkvZndCZ0FuOS9BR0FCZndGL1lBRi9BR0FEZjM5L0FHQUtmMzkvZjM5L2YzOS9md0JnQUFGL1lBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCMzkvZjM5L2YzOEFZQVIvZjM5L0FYOWdDSDkvZjM5L2YzOS9BR0FGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBREEvOEIvUUVFQkFjQkJRQUdCQVlHQmdFRUJ3QUFCZ1VGQndjR0FRWUdCZ0VGQlFFRUFRRUdCZ0VCQVFFQkFRRUdBUUVHQmdFQkFRRUlDUUVCQVFFQkFRRUJCZ1lCQVFFQkFRRUJBUWtKQ1FrUEFBSUFFQXNNQ2dvSEJBWUJBUVlCQVFFQkJnRUJBUUVGQlFBRkJRa0JCUVVBRFFZR0JnRUZDUVVGQkFZR0JnWUdBUVlCQmdFR0FRWUFCZ2tKQmdRRkFBWUJBUVlBQkFjQkFBRUdBUVlHQ1FrRUJBWUVCZ1lHQkFRSEJRVUZCUVVGQlFVRkJBWUdCUVlHQlFZR0JRWUdCUVVGQlFVRkJRVUZCUVVBQlFVRkJRVUZCZ2tKQ1FVSkJRa0pDUVVFQmdZT0JnRUdBUVlCQ1FrSkNRa0pDUWtKQ1FrSkJnRUJDUWtKQ1FFQkJBUUJCUVlBQlFNQkFBRUc3UXViQW44QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FBUXQvQUVHQWtRUUxmd0JCZ0xnQkMzOEFRWURKQlF0L0FFR0EyQVVMZndCQmdLRUxDMzhBUVlDQURBdC9BRUdBb1JjTGZ3QkJnSUFKQzM4QVFZQ2hJQXQvQUVHQStBQUxmd0JCZ0pBRUMzOEFRWUNKSFF0L0FFR0FtU0VMZndCQmdJQUlDMzhBUVlDWktRdC9BRUdBZ0FnTGZ3QkJnSmt4QzM4QVFZQ0FDQXQvQUVHQW1Ua0xmd0JCZ0lBSUMzOEFRWUNad1FBTGZ3QkJnSUFJQzM4QVFZQ1p5UUFMZndCQmdJQUlDMzhBUVlDWjBRQUxmd0JCZ0JRTGZ3QkJnSzNSQUF0L0FFR0FpUGdEQzM4QVFZQzF5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnTFhOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR0FBZ3QvQVVFQUN3ZndFR1VHYldWdGIzSjVBZ0FIWDE5aGJHeHZZd0FRQ0Y5ZmNtVjBZV2x1QUJJSlgxOXlaV3hsWVhObEFCb0pYMTlqYjJ4c1pXTjBBQXdMWDE5eWRIUnBYMkpoYzJVRG1RSUdZMjl1Wm1sbkFEUU9hR0Z6UTI5eVpWTjBZWEowWldRQU5RbHpZWFpsVTNSaGRHVUFQQWxzYjJGa1UzUmhkR1VBUndWcGMwZENRd0JJRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFCSkMyZGxkRk4wWlhCVFpYUnpBRW9JWjJWMFUzUmxjSE1BU3hWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUExQUVNWlhobFkzVjBaVVp5WVcxbEFOTUJDVjlmYzJWMFlYSm5Zd0Q4QVJsbGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2QVBzQkZXVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZiZ0Q5QVF0bGVHVmpkWFJsVTNSbGNBRFFBUlJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFEVkFReG5aWFJEZVdOc1pWTmxkSE1BMWdFSloyVjBRM2xqYkdWekFOY0JEbk5sZEVwdmVYQmhaRk4wWVhSbEFOd0JIMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhJQTBRRVFZMnhsWVhKQmRXUnBiMEoxWm1abGNnQkRISE5sZEUxaGJuVmhiRU52Ykc5eWFYcGhkR2x2YmxCaGJHVjBkR1VBSWhkWFFWTk5RazlaWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ014RTFkQlUwMUNUMWxmVFVWTlQxSlpYMU5KV2tVRE1oSlhRVk5OUWs5WlgxZEJVMDFmVUVGSFJWTURNeDVCVTFORlRVSk1XVk5EVWtsUVZGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJScEJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVTBsYVJRTUdGbGRCVTAxQ1QxbGZVMVJCVkVWZlRFOURRVlJKVDA0REJ4SlhRVk5OUWs5WlgxTlVRVlJGWDFOSldrVURDQ0JIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTVBIRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VERUJKV1NVUkZUMTlTUVUxZlRFOURRVlJKVDA0RENRNVdTVVJGVDE5U1FVMWZVMGxhUlFNS0VWZFBVa3RmVWtGTlgweFBRMEZVU1U5T0F3c05WMDlTUzE5U1FVMWZVMGxhUlFNTUprOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9BdzBpVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1PR0VkU1FWQklTVU5UWDA5VlZGQlZWRjlNVDBOQlZFbFBUZ01kRkVkU1FWQklTVU5UWDA5VlZGQlZWRjlUU1ZwRkF4NFVSMEpEWDFCQlRFVlVWRVZmVEU5RFFWUkpUMDRERVJCSFFrTmZVRUZNUlZSVVJWOVRTVnBGQXhJWVFrZGZVRkpKVDFKSlZGbGZUVUZRWDB4UFEwRlVTVTlPQXhNVVFrZGZVRkpKVDFKSlZGbGZUVUZRWDFOSldrVURGQTVHVWtGTlJWOU1UME5CVkVsUFRnTVZDa1pTUVUxRlgxTkpXa1VERmhkQ1FVTkxSMUpQVlU1RVgwMUJVRjlNVDBOQlZFbFBUZ01YRTBKQlEwdEhVazlWVGtSZlRVRlFYMU5KV2tVREdCSlVTVXhGWDBSQlZFRmZURTlEUVZSSlQwNERHUTVVU1V4RlgwUkJWRUZmVTBsYVJRTWFFazlCVFY5VVNVeEZVMTlNVDBOQlZFbFBUZ01iRGs5QlRWOVVTVXhGVTE5VFNWcEZBeHdWUVZWRVNVOWZRbFZHUmtWU1gweFBRMEZVU1U5T0F5Y1JRVlZFU1U5ZlFsVkdSa1ZTWDFOSldrVURLQmxEU0VGT1RrVk1YekZmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeDhWUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlUU1ZwRkF5QVpRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWhGVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZVMGxhUlFNaUdVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlRFOURRVlJKVDA0REl4VkRTRUZPVGtWTVh6TmZRbFZHUmtWU1gxTkpXa1VESkJsRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlVVlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5VFNWcEZBeVlXUTBGU1ZGSkpSRWRGWDFKQlRWOU1UME5CVkVsUFRnTXBFa05CVWxSU1NVUkhSVjlTUVUxZlUwbGFSUU1xRVVKUFQxUmZVazlOWDB4UFEwRlVTVTlPQXlzTlFrOVBWRjlTVDAxZlUwbGFSUU1zRmtOQlVsUlNTVVJIUlY5U1QwMWZURTlEUVZSSlQwNERMUkpEUVZKVVVrbEVSMFZmVWs5TlgxTkpXa1VETGgxRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXZHVVJGUWxWSFgwZEJUVVZDVDFsZlRVVk5UMUpaWDFOSldrVURNQ0ZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFIQnR6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBM1FFZGNtVnpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUEzZ0VaYzJWMFVtVmhaRWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURmQVJ0eVpYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRBRWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUE0UUVjY21WelpYUlhjbWwwWlVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEaUFReG5aWFJTWldkcGMzUmxja0VBNHdFTVoyVjBVbVZuYVhOMFpYSkNBT1FCREdkbGRGSmxaMmx6ZEdWeVF3RGxBUXhuWlhSU1pXZHBjM1JsY2tRQTVnRU1aMlYwVW1WbmFYTjBaWEpGQU9jQkRHZGxkRkpsWjJsemRHVnlTQURvQVF4blpYUlNaV2RwYzNSbGNrd0E2UUVNWjJWMFVtVm5hWE4wWlhKR0FPb0JFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBT3NCRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0RzQVJsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QU8wQkJXZGxkRXhaQU80QkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTzhCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUUR3QVJOa2NtRjNUMkZ0Vkc5WFlYTnRUV1Z0YjNKNUFQRUJCbWRsZEVSSlZnRHlBUWRuWlhSVVNVMUJBUE1CQm1kbGRGUk5RUUQwQVFablpYUlVRVU1BOVFFVGRYQmtZWFJsUkdWaWRXZEhRazFsYlc5eWVRRDJBUWdDOXdFS2hac0MvUUdnQWdFRWZ5QUJLQUlBSWdOQkFYRkZCRUJCQUVFWVFaVUNRUTBRQUFBTElBTkJmSEVpQWtFUVR3Ui9JQUpCOFAvLy93TkpCVUVBQzBVRVFFRUFRUmhCbHdKQkRSQUFBQXNnQWtHQUFra0VmeUFDUVFSMklRSkJBQVVnQWtFZklBSm5heUlEUVFScmRrRVFjeUVDSUFOQkIyc0xJZ05CRjBrRWZ5QUNRUkJKQlVFQUMwVUVRRUVBUVJoQnBBSkJEUkFBQUFzZ0FTZ0NGQ0VFSUFFb0FoQWlCUVJBSUFVZ0JEWUNGQXNnQkFSQUlBUWdCVFlDRUFzZ0EwRUVkQ0FDYWtFQ2RDQUFhaWdDWUNBQlJnUkFJQU5CQkhRZ0FtcEJBblFnQUdvZ0JEWUNZQ0FFUlFSQUlBTkJBblFnQUdvZ0EwRUNkQ0FBYWlnQ0JFRUJJQUowUVg5emNTSUJOZ0lFSUFGRkJFQWdBQ0FBS0FJQVFRRWdBM1JCZjNOeE5nSUFDd3NMQy8wREFRWi9JQUZGQkVCQkFFRVlRYzBCUVEwUUFBQUxJQUVvQWdBaUEwRUJjVVVFUUVFQVFSaEJ6d0ZCRFJBQUFBc2dBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJZ1ZCQVhFRVFDQURRWHh4UVJCcUlBVkJmSEZxSWdKQjhQLy8vd05KQkVBZ0FDQUVFQUVnQVNBRFFRTnhJQUp5SWdNMkFnQWdBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJUVVMQ3lBRFFRSnhCRUFnQVVFRWF5Z0NBQ0lDS0FJQUlnWkJBWEZGQkVCQkFFRVlRZVFCUVE4UUFBQUxJQVpCZkhGQkVHb2dBMEY4Y1dvaUIwSHcvLy8vQTBrRWZ5QUFJQUlRQVNBQ0lBWkJBM0VnQjNJaUF6WUNBQ0FDQlNBQkN5RUJDeUFFSUFWQkFuSTJBZ0FnQTBGOGNTSUNRUkJQQkg4Z0FrSHcvLy8vQTBrRlFRQUxSUVJBUVFCQkdFSHpBVUVORUFBQUN5QUVJQUZCRUdvZ0FtcEhCRUJCQUVFWVFmUUJRUTBRQUFBTElBUkJCR3NnQVRZQ0FDQUNRWUFDU1FSL0lBSkJCSFloQkVFQUJTQUNRUjhnQW1kcklnSkJCR3QyUVJCeklRUWdBa0VIYXdzaUEwRVhTUVIvSUFSQkVFa0ZRUUFMUlFSQVFRQkJHRUdFQWtFTkVBQUFDeUFEUVFSMElBUnFRUUowSUFCcUtBSmdJUUlnQVVFQU5nSVFJQUVnQWpZQ0ZDQUNCRUFnQWlBQk5nSVFDeUFEUVFSMElBUnFRUUowSUFCcUlBRTJBbUFnQUNBQUtBSUFRUUVnQTNSeU5nSUFJQU5CQW5RZ0FHb2dBMEVDZENBQWFpZ0NCRUVCSUFSMGNqWUNCQXZMQVFFQ2Z5QUNRUTl4UlVFQUlBRkJEM0ZGUVFBZ0FTQUNUUnNiUlFSQVFRQkJHRUdDQTBFRUVBQUFDeUFBS0FLZ0RDSURCRUFnQVNBRFFSQnFTUVJBUVFCQkdFR01BMEVQRUFBQUN5QUJRUkJySUFOR0JFQWdBeWdDQUNFRUlBRkJFR3NoQVFzRklBRWdBRUdrREdwSkJFQkJBRUVZUVpnRFFRUVFBQUFMQ3lBQ0lBRnJJZ0pCTUVrRVFBOExJQUVnQkVFQ2NTQUNRU0JyUVFGeWNqWUNBQ0FCUVFBMkFoQWdBVUVBTmdJVUlBRWdBbXBCRUdzaUFrRUNOZ0lBSUFBZ0FqWUNvQXdnQUNBQkVBSUxsd0VCQW45QkFUOEFJZ0JLQkg5QkFTQUFhMEFBUVFCSUJVRUFDd1JBQUF0Qm9BSkJBRFlDQUVIQURrRUFOZ0lBUVFBaEFBTkFBa0FnQUVFWFR3MEFJQUJCQW5SQm9BSnFRUUEyQWdSQkFDRUJBMEFDUUNBQlFSQlBEUUFnQUVFRWRDQUJha0VDZEVHZ0FtcEJBRFlDWUNBQlFRRnFJUUVNQVFzTElBQkJBV29oQUF3QkN3dEJvQUpCMEE0L0FFRVFkQkFEUWFBQ0pBQUxMUUFnQUVIdy8vLy9BMDhFUUVISUFFRVlRY2tEUVIwUUFBQUxJQUJCRDJwQmNIRWlBRUVRSUFCQkVFc2JDOTBCQVFGL0lBRkJnQUpKQkg4Z0FVRUVkaUVCUVFBRklBRkIrUC8vL3dGSkJFQkJBVUViSUFGbmEzUWdBV3BCQVdzaEFRc2dBVUVmSUFGbmF5SUNRUVJyZGtFUWN5RUJJQUpCQjJzTElnSkJGMGtFZnlBQlFSQkpCVUVBQzBVRVFFRUFRUmhCMGdKQkRSQUFBQXNnQWtFQ2RDQUFhaWdDQkVGL0lBRjBjU0lCQkg4Z0FXZ2dBa0VFZEdwQkFuUWdBR29vQW1BRklBQW9BZ0JCZnlBQ1FRRnFkSEVpQVFSL0lBRm9JZ0ZCQW5RZ0FHb29BZ1FpQWtVRVFFRUFRUmhCM3dKQkVSQUFBQXNnQW1nZ0FVRUVkR3BCQW5RZ0FHb29BbUFGUVFBTEN3czdBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FGSEJFQWdBQ0FCUWYvLy8vOTRjVUdBZ0lDQUFYSTJBZ1FnQUVFUWFrRUNFUGtCQ3dzdEFRRi9JQUVvQWdBaUFrRUJjUVJBUVFCQkdFR3pCRUVDRUFBQUN5QUJJQUpCQVhJMkFnQWdBQ0FCRUFJTEhRQWdBQ0FBS0FJRVFmLy8vLzk0Y1RZQ0JDQUFRUkJxUVFRUStRRUxUd0VCZnlBQUtBSUVJZ0ZCZ0lDQWdBZHhRWUNBZ0lBQlJnUkFJQUZCLy8vLy93QnhRUUJMQkVBZ0FCQUpCU0FBSUFGQi8vLy8vM2h4UVlDQWdJQUNjallDQkNBQVFSQnFRUU1RK1FFTEN3dEtBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FKR0JIOGdBVUdBZ0lDQWVIRkZCVUVBQ3dSQUlBQWdBVUgvLy8vL2VIRTJBZ1FnQUVFUWFrRUZFUGtCSXdBZ0FCQUlDd3Z6QVFFR2Z5TUNJZ1VpQWlFREl3TWhBQU5BQWtBZ0F5QUFUdzBBSUFNb0FnQWlCQ2dDQkNJQlFZQ0FnSUFIY1VHQWdJQ0FBMFlFZnlBQlFmLy8vLzhBY1VFQVN3VkJBQXNFUUNBRUVBY2dBaUFFTmdJQUlBSkJCR29oQWdWQkFDQUJRZi8vLy84QWNVVWdBVUdBZ0lDQUIzRWJCRUFqQUNBRUVBZ0ZJQVFnQVVILy8vLy9CM0UyQWdRTEN5QURRUVJxSVFNTUFRc0xJQUlrQXlBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUVBb2dBRUVFYWlFQURBRUxDeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBSWdFZ0FTZ0NCRUgvLy8vL0IzRTJBZ1FnQVJBTElBQkJCR29oQUF3QkN3c2dCU1FEQzI4QkFYOC9BQ0lDSUFGQitQLy8vd0ZKQkg5QkFVRWJJQUZuYTNSQkFXc2dBV29GSUFFTFFSQWdBQ2dDb0F3Z0FrRVFkRUVRYTBkMGFrSC8vd05xUVlDQWZIRkJFSFlpQVNBQ0lBRktHMEFBUVFCSUJFQWdBVUFBUVFCSUJFQUFDd3NnQUNBQ1FSQjBQd0JCRUhRUUF3dUhBUUVDZnlBQktBSUFJUU1nQWtFUGNRUkFRUUJCR0VIdEFrRU5FQUFBQ3lBRFFYeHhJQUpySWdSQklFOEVRQ0FCSUFOQkFuRWdBbkkyQWdBZ0FVRVFhaUFDYWlJQklBUkJFR3RCQVhJMkFnQWdBQ0FCRUFJRklBRWdBMEYrY1RZQ0FDQUJRUkJxSUFFb0FnQkJmSEZxSUFGQkVHb2dBU2dDQUVGOGNXb29BZ0JCZlhFMkFnQUxDNUVCQVFKL0l3RUVRRUVBUVJoQjVnTkJEUkFBQUFzZ0FDQUJFQVVpQXhBR0lnSkZCRUJCQVNRQkVBeEJBQ1FCSUFBZ0F4QUdJZ0pGQkVBZ0FDQURFQTBnQUNBREVBWWlBa1VFUUVFQVFSaEI4Z05CRXhBQUFBc0xDeUFDS0FJQVFYeHhJQU5KQkVCQkFFRVlRZm9EUVEwUUFBQUxJQUpCQURZQ0JDQUNJQUUyQWd3Z0FDQUNFQUVnQUNBQ0lBTVFEaUFDQ3lJQkFYOGpBQ0lDQkg4Z0FnVVFCQ01BQ3lBQUVBOGlBQ0FCTmdJSUlBQkJFR29MVVFFQmZ5QUFLQUlFSWdGQmdJQ0FnSDl4SUFGQkFXcEJnSUNBZ0g5eFJ3UkFRUUJCZ0FGQjZBQkJBaEFBQUFzZ0FDQUJRUUZxTmdJRUlBQW9BZ0JCQVhFRVFFRUFRWUFCUWVzQVFRMFFBQUFMQ3hRQUlBQkJuQUpMQkVBZ0FFRVFheEFSQ3lBQUN5Y0FJQUJCZ0FJb0FnQkxCRUJCc0FGQjZBRkJGa0ViRUFBQUN5QUFRUU4wUVlRQ2FpZ0NBQXZFREFFRGZ3TkFJQUZCQTNGQkFDQUNHd1JBSUFBaUEwRUJhaUVBSUFFaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRRnJJUUlNQVFzTElBQkJBM0ZGQkVBRFFDQUNRUkJKUlFSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FFRUlhaUFCUVFocUtBSUFOZ0lBSUFCQkRHb2dBVUVNYWlnQ0FEWUNBQ0FCUVJCcUlRRWdBRUVRYWlFQUlBSkJFR3NoQWd3QkN3c2dBa0VJY1FSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FVRUlhaUVCSUFCQkNHb2hBQXNnQWtFRWNRUkFJQUFnQVNnQ0FEWUNBQ0FCUVFScUlRRWdBRUVFYWlFQUN5QUNRUUp4QkVBZ0FDQUJMd0VBT3dFQUlBRkJBbW9oQVNBQVFRSnFJUUFMSUFKQkFYRUVRQ0FBSUFFdEFBQTZBQUFMRHdzZ0FrRWdUd1JBQWtBQ1FBSkFJQUJCQTNFaUEwRUJSd1JBSUFOQkFrWU5BU0FEUVFOR0RRSU1Bd3NnQVNnQ0FDRUZJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFOcklRSURRQ0FDUVJGSlJRUkFJQUFnQVVFQmFpZ0NBQ0lEUVFoMElBVkJHSFp5TmdJQUlBQkJCR29nQTBFWWRpQUJRUVZxS0FJQUlnTkJDSFJ5TmdJQUlBQkJDR29nQTBFWWRpQUJRUWxxS0FJQUlnTkJDSFJ5TmdJQUlBQkJER29nQVVFTmFpZ0NBQ0lGUVFoMElBTkJHSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3Q0N5QUJLQUlBSVFVZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRSnJJUUlEUUNBQ1FSSkpSUVJBSUFBZ0FVRUNhaWdDQUNJRFFSQjBJQVZCRUhaeU5nSUFJQUJCQkdvZ0EwRVFkaUFCUVFacUtBSUFJZ05CRUhSeU5nSUFJQUJCQ0dvZ0EwRVFkaUFCUVFwcUtBSUFJZ05CRUhSeU5nSUFJQUJCREdvZ0FVRU9haWdDQUNJRlFSQjBJQU5CRUhaeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0JDeUFCS0FJQUlRVWdBQ0lEUVFGcUlRQWdBU0lFUVFGcUlRRWdBeUFFTFFBQU9nQUFJQUpCQVdzaEFnTkFJQUpCRTBsRkJFQWdBQ0FCUVFOcUtBSUFJZ05CR0hRZ0JVRUlkbkkyQWdBZ0FFRUVhaUFEUVFoMklBRkJCMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRUlhaUFEUVFoMklBRkJDMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRU1haUFCUVE5cUtBSUFJZ1ZCR0hRZ0EwRUlkbkkyQWdBZ0FVRVFhaUVCSUFCQkVHb2hBQ0FDUVJCcklRSU1BUXNMQ3dzZ0FrRVFjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRaHhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUVjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUUp4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUJjUVJBSUFBZ0FTMEFBRG9BQUFzTDBnSUJBbjhDUUNBQ0lRTWdBQ0FCUmcwQVFRRWdBQ0FEYWlBQlRTQUJJQU5xSUFCTkd3UkFJQUFnQVNBREVCUU1BUXNnQUNBQlNRUkFJQUZCQjNFZ0FFRUhjVVlFUUFOQUlBQkJCM0VFUUNBRFJRMEVJQU5CQVdzaEF5QUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBRXBBd0EzQXdBZ0EwRUlheUVESUFCQkNHb2hBQ0FCUVFocUlRRU1BUXNMQ3dOQUlBTUVRQ0FBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFnQTBFQmF5RUREQUVMQ3dVZ0FVRUhjU0FBUVFkeFJnUkFBMEFnQUNBRGFrRUhjUVJBSUFORkRRUWdBQ0FEUVFGcklnTnFJQUVnQTJvdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQU5CQ0dzaUEyb2dBU0FEYWlrREFEY0RBQXdCQ3dzTEEwQWdBd1JBSUFBZ0EwRUJheUlEYWlBQklBTnFMUUFBT2dBQURBRUxDd3NMQ3pnQUl3QkZCRUJCQUVFWVFkRUVRUTBRQUFBTElBQkJEM0ZGUVFBZ0FCdEZCRUJCQUVFWVFkSUVRUUlRQUFBTEl3QWdBRUVRYXhBSUMwVUJCSDhqQXlNQ0lnRnJJZ0pCQVhRaUFFR0FBaUFBUVlBQ1N4c2lBMEVBRUJBaUFDQUJJQUlRRlNBQkJFQWdBUkFXQ3lBQUpBSWdBQ0FDYWlRRElBQWdBMm9rQkFzaUFRRi9Jd01pQVNNRVR3UkFFQmNqQXlFQkN5QUJJQUEyQWdBZ0FVRUVhaVFEQzdZQkFRSi9JQUFvQWdRaUFrSC8vLy8vQUhFaEFTQUFLQUlBUVFGeEJFQkJBRUdBQVVIekFFRU5FQUFBQ3lBQlFRRkdCRUFnQUVFUWFrRUJFUGtCSUFKQmdJQ0FnSGh4QkVBZ0FFR0FnSUNBZURZQ0JBVWpBQ0FBRUFnTEJTQUJRUUJOQkVCQkFFR0FBVUg4QUVFUEVBQUFDeUFBS0FJSUVCTkJFSEVFUUNBQUlBRkJBV3NnQWtHQWdJQ0FmM0Z5TmdJRUJTQUFJQUZCQVd0QmdJQ0FnSHR5TmdJRUlBSkJnSUNBZ0hoeFJRUkFJQUFRR0FzTEN3c1NBQ0FBUVp3Q1N3UkFJQUJCRUdzUUdRc0xVd0JCOHVYTEJ5UStRYURCZ2dVa1AwSFlzT0VDSkVCQmlKQWdKRUZCOHVYTEJ5UkNRYURCZ2dVa1EwSFlzT0VDSkVSQmlKQWdKRVZCOHVYTEJ5UkdRYURCZ2dVa1IwSFlzT0VDSkVoQmlKQWdKRWtMbHdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPREFJQ0F3TURBd1FFQlFVR0J3QUxEQWNMSTRBQ0JFQWpnUUlFUUNBQVFZQUNTQTBKSUFCQmdCSklRUUFnQUVIL0Ewb2JEUWtGUVFBZ0FFR0FBa2dqZ1FJYkRRa0xDd3NnQUVHQXJkRUFhZzhMSUFCQkFTUHlBU0lBUVFBZ0FFVWorZ0ViRzBFT2RHcEJnSzNRQUdvUEN5QUFRWUNRZm1vamdRSUVmMEhQL2dNUUhVRUJjUVZCQUF0QkRYUnFEd3NnQUNQekFVRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5T0JBZ1JBUWZEK0F4QWRRUWR4SVFFTElBRkJBVWdMQkg5QkFRVWdBUXRCREhRZ0FHcEJnUEI5YWc4TElBQkJnRkJxRHdzZ0FFR0FtZEVBYWdzSkFDQUFFQnd0QUFBTHd3RUFRUUFrZ2dKQkFDU0RBa0VBSklRQ1FRQWtoUUpCQUNTR0FrRUFKSWNDUVFBa2lBSkJBQ1NKQWtFQUpJb0NRUUFraXdKQkFDU01Ba0VBSkkwQ1FRQWtqZ0pCQUNTUEFrRUFKSkFDUVFBa2tRSWpnQUlFUUE4TEk0RUNCRUJCRVNTREFrR0FBU1NLQWtFQUpJUUNRUUFraFFKQi93RWtoZ0pCMWdBa2h3SkJBQ1NJQWtFTkpJa0NCVUVCSklNQ1FiQUJKSW9DUVFBa2hBSkJFeVNGQWtFQUpJWUNRZGdCSkljQ1FRRWtpQUpCelFBa2lRSUxRWUFDSkl3Q1FmNy9BeVNMQWdzTEFDQUFFQndnQVRvQUFBdHpBUUYvUVFBazlBRkJBU1QxQVVISEFoQWRJZ0JGSlBZQklBQkJBMHhCQUNBQVFRRk9HeVQzQVNBQVFRWk1RUUFnQUVFRlRoc2srQUVnQUVFVFRFRUFJQUJCRDA0YkpQa0JJQUJCSGt4QkFDQUFRUmxPR3lUNkFVRUJKUElCUVFBazh3RkJ6LzREUVFBUUgwSHcvZ05CQVJBZkN5OEFRZEgrQTBIL0FSQWZRZEwrQTBIL0FSQWZRZFArQTBIL0FSQWZRZFQrQTBIL0FSQWZRZFgrQTBIL0FSQWZDN0FJQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdzREJBVUdCd2dKQ2dzTURRQUxEQTBMUWZMbHl3Y2tQa0dnd1lJRkpEOUIyTERoQWlSQVFZaVFJQ1JCUWZMbHl3Y2tRa0dnd1lJRkpFTkIyTERoQWlSRVFZaVFJQ1JGUWZMbHl3Y2tSa0dnd1lJRkpFZEIyTERoQWlSSVFZaVFJQ1JKREF3TFFmLy8vd2NrUGtIajJ2NEhKRDlCZ09LUUJDUkFRUUFrUVVILy8vOEhKRUpCNDlyK0J5UkRRWURpa0FRa1JFRUFKRVZCLy8vL0J5UkdRZVBhL2dja1IwR0E0cEFFSkVoQkFDUkpEQXNMUWYvLy93Y2tQa0dFaWY0SEpEOUJ1dlRRQkNSQVFRQWtRVUgvLy84SEpFSkJzZjd2QXlSRFFZQ0lBaVJFUVFBa1JVSC8vLzhISkVaQi84dU9BeVJIUWY4QkpFaEJBQ1JKREFvTFFjWE4vd2NrUGtHRXVib0dKRDlCcWRhUkJDUkFRWWppNkFJa1FVSC8vLzhISkVKQjQ5citCeVJEUVlEaWtBUWtSRUVBSkVWQi8vLy9CeVJHUWVQYS9nY2tSMEdBNHBBRUpFaEJBQ1JKREFrTFFmLy8vd2NrUGtHQS9zc0NKRDlCZ0lUOUJ5UkFRUUFrUVVILy8vOEhKRUpCZ1A3TEFpUkRRWUNFL1Fja1JFRUFKRVZCLy8vL0J5UkdRWUQreXdJa1IwR0FoUDBISkVoQkFDUkpEQWdMUWYvLy93Y2tQa0d4L3U4REpEOUJ4Y2NCSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQmhJbitCeVJIUWJyMDBBUWtTRUVBSkVrTUJ3dEJBQ1ErUVlTSkFpUS9RWUM4L3dja1FFSC8vLzhISkVGQkFDUkNRWVNKQWlSRFFZQzgvd2NrUkVILy8vOEhKRVZCQUNSR1FZU0pBaVJIUVlDOC93Y2tTRUgvLy84SEpFa01CZ3RCcGYvL0J5UStRWlNwL2dja1AwSC9xZElFSkVCQkFDUkJRYVgvL3dja1FrR1VxZjRISkVOQi82blNCQ1JFUVFBa1JVR2wvLzhISkVaQmxLbitCeVJIUWYrcDBnUWtTRUVBSkVrTUJRdEIvLy8vQnlRK1FZRCsvd2NrUDBHQWdQd0hKRUJCQUNSQlFmLy8vd2NrUWtHQS92OEhKRU5CZ0lEOEJ5UkVRUUFrUlVILy8vOEhKRVpCZ1A3L0J5UkhRWUNBL0Fja1NFRUFKRWtNQkF0Qi8vLy9CeVErUVlEKy93Y2tQMEdBbE8wREpFQkJBQ1JCUWYvLy93Y2tRa0gveTQ0REpFTkIvd0VrUkVFQUpFVkIvLy8vQnlSR1FiSCs3d01rUjBHQWlBSWtTRUVBSkVrTUF3dEIvLy8vQnlRK1FmL0xqZ01rUDBIL0FTUkFRUUFrUVVILy8vOEhKRUpCaEluK0J5UkRRYnIwMEFRa1JFRUFKRVZCLy8vL0J5UkdRYkgrN3dNa1IwR0FpQUlrU0VFQUpFa01BZ3RCLy8vL0J5UStRZDZac2dRa1AwR01wY2tDSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUFRdEIvLy8vQnlRK1FhWExsZ1VrUDBIU3BNa0NKRUJCQUNSQlFmLy8vd2NrUWtHbHk1WUZKRU5CMHFUSkFpUkVRUUFrUlVILy8vOEhKRVpCcGN1V0JTUkhRZEtreVFJa1NFRUFKRWtMQzlvSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZZ0JSd1JBSUFCQjRRQkdEUUVnQUVFVVJnMENJQUJCeGdCR0RRTWdBRUhaQUVZTkJDQUFRY1lCUmcwRUlBQkJoZ0ZHRFFVZ0FFR29BVVlOQlNBQVFiOEJSZzBHSUFCQnpnRkdEUVlnQUVIUkFVWU5CaUFBUWZBQlJnMEdJQUJCSjBZTkJ5QUFRY2tBUmcwSElBQkIzQUJHRFFjZ0FFR3pBVVlOQnlBQVFja0JSZzBJSUFCQjhBQkdEUWtnQUVIR0FFWU5DaUFBUWRNQlJnMExEQXdMUWYrNWxnVWtQa0dBL3Y4SEpEOUJnTVlCSkVCQkFDUkJRZis1bGdVa1FrR0EvdjhISkVOQmdNWUJKRVJCQUNSRlFmKzVsZ1VrUmtHQS92OEhKRWRCZ01ZQkpFaEJBQ1JKREFzTFFmLy8vd2NrUGtIL3k0NERKRDlCL3dFa1FFRUFKRUZCLy8vL0J5UkNRWVNKL2dja1EwRzY5TkFFSkVSQkFDUkZRZi8vL3dja1JrSC95NDRESkVkQi93RWtTRUVBSkVrTUNndEIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHeC91OERKRU5CZ0lnQ0pFUkJBQ1JGUWYvLy93Y2tSa0dFaWY0SEpFZEJ1dlRRQkNSSVFRQWtTUXdKQzBILzY5WUZKRDVCbFAvL0J5US9RY0swdFFVa1FFRUFKRUZCQUNSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmtILy8vOEhKRWRCaEluK0J5UklRYnIwMEFRa1NRd0lDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FZRG0vUWNrUTBHQWhORUVKRVJCQUNSRlFmLy8vd2NrUmtILysrb0NKRWRCZ0lEOEJ5UklRZjhCSkVrTUJ3dEJuUC8vQnlRK1FmL3IwZ1FrUDBIenFJNERKRUJCdXZRQUpFRkJ3b3IvQnlSQ1FZQ3Mvd2NrUTBHQTlOQUVKRVJCZ0lDb0FpUkZRZi8vL3dja1JrR0VpZjRISkVkQnV2VFFCQ1JJUVFBa1NRd0dDMEdBL3E4REpENUIvLy8vQnlRL1FjcWsvUWNrUUVFQUpFRkIvLy8vQnlSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUJRdEIvN21XQlNRK1FZRCsvd2NrUDBHQXhnRWtRRUVBSkVGQjBzYjlCeVJDUVlDQTJBWWtRMEdBZ0l3REpFUkJBQ1JGUWY4QkpFWkIvLy8vQnlSSFFmdisvd2NrU0VIL2lRSWtTUXdFQzBITy8vOEhKRDVCNzkrUEF5US9RYkdJOGdRa1FFSGF0T2tDSkVGQi8vLy9CeVJDUVlEbS9RY2tRMEdBaE5FRUpFUkJBQ1JGUWYvLy93Y2tSa0gveTQ0REpFZEIvd0VrU0VFQUpFa01Bd3RCLy8vL0J5UStRWVNKL2dja1AwRzY5TkFFSkVCQkFDUkJRZi8vL3dja1FrR0EvZ01rUTBHQWlNWUJKRVJCZ0pRQkpFVkIvLy8vQnlSR1FmL0xqZ01rUjBIL0FTUklRUUFrU1F3Q0MwSC8vLzhISkQ1Qi84dU9BeVEvUWY4QkpFQkJBQ1JCUVlEKy93Y2tRa0dBZ1B3SEpFTkJnSUNNQXlSRVFRQWtSVUgvLy84SEpFWkJzZjd2QXlSSFFZQ0lBaVJJUVFBa1NRd0JDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FlUGEvZ2NrUTBIajJ2NEhKRVJCQUNSRlFmLy8vd2NrUmtIL3k0NERKRWRCL3dFa1NFRUFKRWtMQzBvQkFuOUJBQkFpSTRFQ0JFQVBDeU9BQWdSQUk0RUNSUVJBRHdzTFFiUUNJUUFEUUFKQUlBQkJ3d0pLRFFBZ0FCQWRJQUZxSVFFZ0FFRUJhaUVBREFFTEN5QUJRZjhCY1JBakM5d0JBRUVBSk9zQlFRQWs3QUZCQUNUdEFVRUFKTzRCUVFBazd3RkJBQ1R3QVVFQUpQRUJRWkFCSk8wQkk0RUNCRUJCd2Y0RFFZRUJFQjlCeFA0RFFaQUJFQjlCeC80RFFmd0JFQjhGUWNIK0EwR0ZBUkFmUWNiK0EwSC9BUkFmUWNmK0EwSDhBUkFmUWNqK0EwSC9BUkFmUWNuK0EwSC9BUkFmQzBHUUFTVHRBVUhBL2dOQmtBRVFIMEhQL2dOQkFCQWZRZkQrQTBFQkVCOGpnQUlFUUNPQkFnUkFRUUFrN1FGQndQNERRUUFRSDBIQi9nTkJnQUVRSDBIRS9nTkJBQkFmQlVFQUpPMEJRY0QrQTBFQUVCOUJ3ZjREUVlRQkVCOExDeEFrQzIwQUk0RUNCRUJCNlA0RFFjQUJFQjlCNmY0RFFmOEJFQjlCNnY0RFFjRUJFQjlCNi80RFFRMFFId1ZCNlA0RFFmOEJFQjlCNmY0RFFmOEJFQjlCNnY0RFFmOEJFQjlCNi80RFFmOEJFQjhMSTRFQ1FRQWpnQUliQkVCQjZmNERRU0FRSDBIci9nTkJpZ0VRSHdzTFZnQkJrUDREUVlBQkVCOUJrZjREUWI4QkVCOUJrdjREUWZNQkVCOUJrLzREUWNFQkVCOUJsUDREUWI4QkVCOGpnQUlFUUVHUi9nTkJQeEFmUVpMK0EwRUFFQjlCay80RFFRQVFIMEdVL2dOQnVBRVFId3NMTEFCQmxmNERRZjhCRUI5Qmx2NERRVDhRSDBHWC9nTkJBQkFmUVpqK0EwRUFFQjlCbWY0RFFiZ0JFQjhMTXdCQm12NERRZjhBRUI5Qm0vNERRZjhCRUI5Qm5QNERRWjhCRUI5Qm5mNERRUUFRSDBHZS9nTkJ1QUVRSDBFQkpJWUJDeTBBUVovK0EwSC9BUkFmUWFEK0EwSC9BUkFmUWFIK0EwRUFFQjlCb3Y0RFFRQVFIMEdqL2dOQnZ3RVFId3RjQUNBQVFZQUJjVUVBUnlTdEFTQUFRY0FBY1VFQVJ5U3NBU0FBUVNCeFFRQkhKS3NCSUFCQkVIRkJBRWNrcWdFZ0FFRUljVUVBUnlTeEFTQUFRUVJ4UVFCSEpMQUJJQUJCQW5GQkFFY2tyd0VnQUVFQmNVRUFSeVN1QVF0RkFFRVBKSm9CUVE4a213RkJEeVNjQVVFUEpKMEJRUUFrbmdGQkFDU2ZBVUVBSktBQlFRQWtvUUZCL3dBa29nRkIvd0Frb3dGQkFTU2tBVUVCSktVQlFRQWtwZ0VMdlFFQVFRQWtwd0ZCQUNTb0FVRUFKS2tCUVFFa3FnRkJBU1NyQVVFQkpLd0JRUUVrclFGQkFTU3VBVUVCSks4QlFRRWtzQUZCQVNTeEFVRUJKTElCUVFBa3N3RkJBQ1MwQVVFQUpMVUJRUUFrdGdFUUp4QW9FQ2tRS2tHay9nTkI5d0FRSDBFSEpLZ0JRUWNrcVFGQnBmNERRZk1CRUI5Qjh3RVFLMEdtL2dOQjhRRVFIMEVCSkxJQkk0QUNCRUJCcFA0RFFRQVFIMEVBSktnQlFRQWtxUUZCcGY0RFFRQVFIMEVBRUN0QnB2NERRZkFBRUI5QkFDU3lBUXNRTEFzK0FDQUFRUUZ4UVFCSEpMb0JJQUJCQW5GQkFFY2t1d0VnQUVFRWNVRUFSeVM4QVNBQVFRaHhRUUJISkwwQklBQkJFSEZCQUVja3ZnRWdBQ1M1QVFzK0FDQUFRUUZ4UVFCSEpNQUJJQUJCQW5GQkFFY2t3UUVnQUVFRWNVRUFSeVRDQVNBQVFRaHhRUUJISk1NQklBQkJFSEZCQUVja3hBRWdBQ1MvQVF0NEFFRUFKTVVCUVFBa3hnRkJBQ1RIQVVFQUpNb0JRUUFreXdGQkFDVE1BVUVBSk1nQlFRQWt5UUVqZ1FJRVFFR0UvZ05CSGhBZlFhQTlKTVlCQlVHRS9nTkJxd0VRSDBITTF3SWt4Z0VMUVlmK0EwSDRBUkFmUWZnQkpNd0JJNEFDQkVBamdRSkZCRUJCaFA0RFFRQVFIMEVFSk1ZQkN3c0xRd0JCQUNUTkFVRUFKTTRCSTRFQ0JFQkJndjREUWZ3QUVCOUJBQ1RQQVVFQUpOQUJRUUFrMFFFRlFZTCtBMEgrQUJBZlFRQWt6d0ZCQVNUUUFVRUFKTkVCQ3d0MUFDT0JBZ1JBUWZEK0EwSDRBUkFmUWMvK0EwSCtBUkFmUWMzK0EwSCtBQkFmUVlEK0EwSFBBUkFmUVkvK0EwSGhBUkFmUWV6K0EwSCtBUkFmUWZYK0EwR1BBUkFmQlVIdy9nTkIvd0VRSDBIUC9nTkIvd0VRSDBITi9nTkIvd0VRSDBHQS9nTkJ6d0VRSDBHUC9nTkI0UUVRSHdzTGxnRUJBWDlCd3dJUUhTSUFRY0FCUmdSL1FRRUZJQUJCZ0FGR1FRQWpOUnNMQkVCQkFTU0JBZ1ZCQUNTQkFndEJBQ1NZQWtHQXFOYTVCeVNTQWtFQUpKTUNRUUFrbEFKQmdLald1UWNrbFFKQkFDU1dBa0VBSkpjQ0l6UUVRRUVCSklBQ0JVRUFKSUFDQ3hBZUVDQVFJUkFsRUNZUUxVRUFFQzVCLy84REk3a0JFQjlCNFFFUUwwR1AvZ01qdndFUUh4QXdFREVRTWd0S0FDQUFRUUJLSkRRZ0FVRUFTaVExSUFKQkFFb2tOaUFEUVFCS0pEY2dCRUVBU2lRNElBVkJBRW9rT1NBR1FRQktKRG9nQjBFQVNpUTdJQWhCQUVva1BDQUpRUUJLSkQwUU13c0ZBQ09ZQWd1NUFRQkJnQWdqZ3dJNkFBQkJnUWdqaEFJNkFBQkJnZ2dqaFFJNkFBQkJnd2dqaGdJNkFBQkJoQWdqaHdJNkFBQkJoUWdqaUFJNkFBQkJoZ2dqaVFJNkFBQkJod2dqaWdJNkFBQkJpQWdqaXdJN0FRQkJpZ2dqakFJN0FRQkJqQWdqalFJMkFnQkJrUWdqamdKQkFFYzZBQUJCa2dnamp3SkJBRWM2QUFCQmt3Z2prQUpCQUVjNkFBQkJsQWdqa1FKQkFFYzZBQUJCbFFnamdBSkJBRWM2QUFCQmxnZ2pnUUpCQUVjNkFBQkJsd2dqZ2dKQkFFYzZBQUFMYUFCQnlBa2o4Z0U3QVFCQnlna2o4d0U3QVFCQnpBa2o5QUZCQUVjNkFBQkJ6UWtqOVFGQkFFYzZBQUJCemdrajlnRkJBRWM2QUFCQnp3a2o5d0ZCQUVjNkFBQkIwQWtqK0FGQkFFYzZBQUJCMFFraitRRkJBRWM2QUFCQjBna2orZ0ZCQUVjNkFBQUxOUUJCK2dranhRRTJBZ0JCL2dranhnRTJBZ0JCZ2dvanlBRkJBRWM2QUFCQmhRb2p5UUZCQUVjNkFBQkJoZjRESThjQkVCOExZd0JCM2dvaldFRUFSem9BQUVIZkNpTmJOZ0lBUWVNS0kxdzJBZ0JCNXdvalhqWUNBRUhzQ2lOZk5nSUFRZkVLSTJBNkFBQkI4Z29qWVRvQUFFSDNDaU5pUVFCSE9nQUFRZmdLSTJNMkFnQkIvUW9qWkRzQkFFSC9DaU5kUVFCSE9nQUFDMGdBUVpBTEkyOUJBRWM2QUFCQmtRc2pjallDQUVHVkN5TnpOZ0lBUVprTEkzVTJBZ0JCbmdzamRqWUNBRUdqQ3lOM09nQUFRYVFMSTNnNkFBQkJwUXNqZEVFQVJ6b0FBQXRIQUVIMEN5T1JBVUVBUnpvQUFFSDFDeU9UQVRZQ0FFSDVDeU9VQVRZQ0FFSDlDeU9XQVRZQ0FFR0NEQ09YQVRZQ0FFR0hEQ09aQVRzQkFFR0pEQ09WQVVFQVJ6b0FBQXVIQVFBUU5rR3lDQ1BzQVRZQ0FFRzJDQ1BoQVRvQUFFSEUvZ01qN1FFUUgwSGtDQ08zQVVFQVJ6b0FBRUhsQ0NPNEFVRUFSem9BQUJBM0VEaEJyQW9qc3dFMkFnQkJzQW9qdEFFNkFBQkJzUW9qdFFFNkFBQVFPUkE2UWNJTEkzOUJBRWM2QUFCQnd3c2pnZ0UyQWdCQnh3c2pnd0UyQWdCQnl3c2poQUU3QVFBUU8wRUFKSmdDQzdrQkFFR0FDQzBBQUNTREFrR0JDQzBBQUNTRUFrR0NDQzBBQUNTRkFrR0RDQzBBQUNTR0FrR0VDQzBBQUNTSEFrR0ZDQzBBQUNTSUFrR0dDQzBBQUNTSkFrR0hDQzBBQUNTS0FrR0lDQzhCQUNTTEFrR0tDQzhCQUNTTUFrR01DQ2dDQUNTTkFrR1JDQzBBQUVFQVNpU09Ba0dTQ0MwQUFFRUFTaVNQQWtHVENDMEFBRUVBU2lTUUFrR1VDQzBBQUVFQVNpU1JBa0dWQ0MwQUFFRUFTaVNBQWtHV0NDMEFBRUVBU2lTQkFrR1hDQzBBQUVFQVNpU0NBZ3RlQVFGL1FRQWs3QUZCQUNUdEFVSEUvZ05CQUJBZlFjSCtBeEFkUVh4eElRRkJBQ1RoQVVIQi9nTWdBUkFmSUFBRVFBSkFRUUFoQUFOQUlBQkJnTmdGVGcwQklBQkJnTWtGYWtIL0FUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEM0SUJBUUYvSStNQklRRWdBRUdBQVhGQkFFY2s0d0VnQUVIQUFIRkJBRWNrNUFFZ0FFRWdjVUVBUnlUbEFTQUFRUkJ4UVFCSEpPWUJJQUJCQ0hGQkFFY2s1d0VnQUVFRWNVRUFSeVRvQVNBQVFRSnhRUUJISk9rQklBQkJBWEZCQUVjazZnRWo0d0ZGUVFBZ0FSc0VRRUVCRUQ0TFFRQWo0d0VnQVJzRVFFRUFFRDRMQ3lvQVFlUUlMUUFBUVFCS0pMY0JRZVVJTFFBQVFRQktKTGdCUWYvL0F4QWRFQzVCai80REVCMFFMd3RvQUVISUNTOEJBQ1R5QVVIS0NTOEJBQ1R6QVVITUNTMEFBRUVBU2lUMEFVSE5DUzBBQUVFQVNpVDFBVUhPQ1MwQUFFRUFTaVQyQVVIUENTMEFBRUVBU2lUM0FVSFFDUzBBQUVFQVNpVDRBVUhSQ1MwQUFFRUFTaVQ1QVVIU0NTMEFBRUVBU2lUNkFRdEhBRUg2Q1NnQ0FDVEZBVUgrQ1NnQ0FDVEdBVUdDQ2kwQUFFRUFTaVRJQVVHRkNpMEFBRUVBU2lUSkFVR0YvZ01RSFNUSEFVR0cvZ01RSFNUS0FVR0gvZ01RSFNUTUFRc0hBRUVBSkxZQkMyTUFRZDRLTFFBQVFRQktKRmhCM3dvb0FnQWtXMEhqQ2lnQ0FDUmNRZWNLS0FJQUpGNUI3QW9vQWdBa1gwSHhDaTBBQUNSZ1FmSUtMUUFBSkdGQjl3b3RBQUJCQUVva1lrSDRDaWdDQUNSalFmMEtMd0VBSkdSQi93b3RBQUJCQUVva1hRdElBRUdRQ3kwQUFFRUFTaVJ2UVpFTEtBSUFKSEpCbFFzb0FnQWtjMEdaQ3lnQ0FDUjFRWjRMS0FJQUpIWkJvd3N0QUFBa2QwR2tDeTBBQUNSNFFiRUxMUUFBUVFCS0pIUUxSd0JCOUFzdEFBQkJBRW9ra1FGQjlRc29BZ0Fra3dGQitRc29BZ0FrbEFGQi9Rc29BZ0FrbGdGQmdnd29BZ0FrbHdGQmh3d3ZBUUFrbVFGQmlRd3RBQUJCQUVva2xRRUx6QUVCQVg4UVBVR3lDQ2dDQUNUc0FVRzJDQzBBQUNUaEFVSEUvZ01RSFNUdEFVSEEvZ01RSFJBL0VFQkJnUDRERUIxQi93RnpKTm9CSTlvQklnQkJFSEZCQUVjazJ3RWdBRUVnY1VFQVJ5VGNBUkJCRUVKQnJBb29BZ0Frc3dGQnNBb3RBQUFrdEFGQnNRb3RBQUFrdFFGQkFDUzJBUkJFRUVWQndnc3RBQUJCQUVva2YwSERDeWdDQUNTQ0FVSEhDeWdDQUNTREFVSExDeThCQUNTRUFSQkdRUUFrbUFKQmdLald1UWNra2dKQkFDU1RBa0VBSkpRQ1FZQ28xcmtISkpVQ1FRQWtsZ0pCQUNTWEFnc0ZBQ09CQWdzRkFDT1ZBZ3NGQUNPV0Fnc0ZBQ09YQWd1eUFnRUdmeU5MSWdVZ0FFWkJBQ05LSUFSR1FRQWdBRUVJU2tFQUlBRkJBRW9iR3hzRVFDQURRUUZyRUIxQklIRkJBRWNoQ0NBREVCMUJJSEZCQUVjaENVRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQWdnQ1VjYklnY2dBR29pQTBHZ0FVd0VRQ0FCUWFBQmJDQURha0VEYkVHQXlRVnFJZ1F0QUFBaENpQUVJQW82QUFBZ0FVR2dBV3dnQTJwQkEyeEJnY2tGYWlBRUxRQUJPZ0FBSUFGQm9BRnNJQU5xUVFOc1FZTEpCV29nQkMwQUFqb0FBQ0FCUWFBQmJDQURha0dBa1FScUlBQkJBQ0FIYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQTBFRGNTSUVRUVJ5SUFRZ0EwRUVjUnM2QUFBZ0JrRUJhaUVHQ3lBSFFRRnFJUU1NQVFzTEJTQUVKRW9MSUFBZ0JVNEVRQ0FBUVFocUlnRWdBa0VIY1NJQ2FpQUJJQUFnQWtnYklRVUxJQVVrU3lBR0N5a0FJQUJCZ0pBQ1JnUkFJQUZCZ0FGcklBRkJnQUZxSUFGQmdBRnhHeUVCQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUM4Z0JBQ0FCRUIwZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTkNJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalF5RUJEQUlMSTBRaEFRd0JDeU5GSVFFTEJTQUJRY24rQTBZRVFDTkdJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalJ5RUJEQUlMSTBnaEFRd0JDeU5KSVFFTEJTTStJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalB5RUJEQUlMSTBBaEFRd0JDeU5CSVFFTEN3c2dBUXVNQXdFR2Z5QUJJQUFRVFNBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFQUlRVUNmMEVCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUJkQ0FTY1FSQVFRSWhCUXNnQlVFQmFnc2dCVUVCSUFGMElCRnhHeUVDSTRFQ0JIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdVRVFDQU1RUWR4SVFFTElBRWdBaUFGRUU0aUJVRWZjVUVEZENFQklBVkI0QWR4UVFWMVFRTjBJUThnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdvUVR5SUZRWUNBL0FkeFFSQjFJUUVnQlVHQS9nTnhRUWgxSVE4Z0JVSC9BWEVMSVFVZ0J5QUliQ0FPYWtFRGJDQUphaUlRSUFFNkFBQWdFRUVCYWlBUE9nQUFJQkJCQW1vZ0JUb0FBQ0FIUWFBQmJDQU9ha0dBa1FScUlBSkJBM0VpQVVFRWNpQUJJQXRCZ0FGeFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTRFQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRVUF1aEFnRUJmeUFEUVFkeElRTWdCU0FHRUUwZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ1ZCZ0pCK2FpQUVRUWh4UVFCSElnWkJEWFJxTFFBQUlRY2dBa0VIY1NFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2Z5QUZRWUdRZm1vZ0JrRUJjVUVOZEdvdEFBQkJBU0FEUVFjZ0Eyc2dCRUVnY1JzaUEzUnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQjNFYklnTkJBQkJPSWdKQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUpCZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVFMGdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QlBJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdlVBUUVHZnlBRFFRTjFJUW9EUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUtRUVYwSUFKcUlBWkJBM1ZxSWdoQmdKQithaTBBQUNFSFFRQWhDU004QkVBZ0JDQUFJQVlnQ0NBSEVFd2lDMEVBU2dSQVFRRWhDU0FMUVFGcklBUnFJUVFMQ3lBSlJVRUFJenNiQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJSSWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNEVDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJTQlNBRUlBQWdCaUFESUFFZ0J4QlRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVB3QVNFRElBQWo4UUVpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRlFMb0FVQkQzOENRRUVuSVFZRFFDQUdRUUJJRFFFZ0JrRUNkQ0lGUVlEOEEyb2lBeEFkSVFJZ0EwRUJhaEFkSVFjZ0EwRUNhaEFkSVFNZ0FrRVFheUVFSUFkQkNHc2hDMEVJSVFJZ0FRUkFRUkFoQWlBRElBTkJBWEZySVFNTElBQWdBaUFFYWtoQkFDQUFJQVJPR3dSQUlBVkJnL3dEYWhBZElnVkJnQUZ4UVFCSElRd2dCVUVnY1VFQVJ5RU5RWUNBQWlBREVFMGdBaUFBSUFScklnTnJRUUZySUFNZ0JVSEFBSEViUVFGMGFpSURRWUNRZm1vZ0JVRUljVUVBUnlPQkFpSUNJQUliUVFGeFFRMTBJZ0pxTFFBQUlRNGdBMEdCa0g1cUlBSnFMUUFBSVE5QkJ5RURBMEFnQTBFQVRnUkFRUUFoQWdKL1FRRkJBQ0FEUVFkcmF5QURJQTBiSWdSMElBOXhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdCSFFnRG5FYklnUUVRRUVISUFOcklBdHFJZ0pCQUU0RWZ5QUNRYUFCVEFWQkFBc0VRRUVBSVFkQkFDRUtJK29CUlNPQkFpSUlJQWdiSWdoRkJFQWdBRUdnQVd3Z0FtcEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMUVFBZ0RCc0VRRUVCSVFjRlFRRkJBQ0FKUVFCTFFRQWdFRUVFY1VFQUk0RUNHeHNiSVFvTEMwRUJRUUFnQ2tVZ0J4c2dDQnNFUUNPQkFnUkFJQUJCb0FGc0lBSnFRUU5zUVlESkJXb2dCVUVIY1NBRVFRRVFUaUlFUVI5eFFRTjBPZ0FBSUFCQm9BRnNJQUpxUVFOc1FZSEpCV29nQkVIZ0IzRkJCWFZCQTNRNkFBQWdBRUdnQVd3Z0FtcEJBMnhCZ3NrRmFpQUVRWUQ0QVhGQkNuVkJBM1E2QUFBRklBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JFSEovZ05CeVA0RElBVkJFSEViRUU4aUJFR0FnUHdIY1VFUWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQnlRVnFJQVJCZ1A0RGNVRUlkVG9BQUNBQVFhQUJiQ0FDYWtFRGJFR0N5UVZxSUFRNkFBQUxDd3NMSUFOQkFXc2hBd3dCQ3dzTElBWkJBV3NoQmd3QUFBc0FDd3RrQVFGL1FZQ0FBa0dBa0FJajVnRWJJUUZCQVNQcUFTT0JBaHNFUUNBQUlBRkJnTGdDUVlDd0FpUG5BUnNqN3dFZ0FHcEIvd0Z4UVFBajdnRVFWQXNqNVFFRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBrQVJzUVZRc2o2UUVFUUNBQUkrZ0JFRllMQ3lVQkFYOENRQU5BSUFCQmtBRktEUUVnQUVIL0FYRVFWeUFBUVFGcUlRQU1BQUFMQUFzTFJnRUNmd05BSUFGQmtBRk9SUVJBUVFBaEFBTkFJQUJCb0FGSUJFQWdBVUdnQVd3Z0FHcEJnSkVFYWtFQU9nQUFJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3dzYkFFR1AvZ01RSFVFQklBQjBjaUlBSkw4QlFZLytBeUFBRUI4TEN3QkJBU1RCQVVFQkVGb0xMZ0VCZndKL0kzVWlBRUVBU2dSL0kyMEZRUUFMQkVBZ0FFRUJheUVBQ3lBQVJRc0VRRUVBSkc4TElBQWtkUXN3QVFGL0FuOGpnd0VpQUVFQVNnUi9JMzBGUVFBTEJFQWdBRUVCYXlFQUN5QUFSUXNFUUVFQUpIOExJQUFrZ3dFTE1nRUJmd0ovSTVZQklnQkJBRW9FZnlPUUFRVkJBQXNFUUNBQVFRRnJJUUFMSUFCRkN3UkFRUUFra1FFTElBQWtsZ0VMUndFQ2Z5QUFKR1JCbFA0REVCMUIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFIMEdVL2dNZ0FTQUFRUWgxUVFkeElnQnlFQjhnQWlSVklBQWtWeU5WSTFkQkNIUnlKRm9Mb2dFQkFuOGpZa1ZCQVNOWUd3UkFEd3NqWTBFQmF5SUFRUUJNQkVBalRRUkFJMDBrWXdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDeUlBUWY4UFNnMEFHa0VBQ3dSQVFRQWtXQXNqVDBFQVNnUkFJQUFRWHdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNFUUVFQUpGZ0xDd1ZCQ0NSakN3VWdBQ1JqQ3d0VEFRSi9JMXhCQVdzaUFVRUFUQVJBSTFRRVFDTlVJZ0VFZnlOZEJVRUFDd1JBSTE4aEFDQUFRUUZxSUFCQkFXc2pVeHRCRDNFaUFFRVBTQVJBSUFBa1h3VkJBQ1JkQ3dzRlFRZ2hBUXNMSUFFa1hBdFRBUUovSTNOQkFXc2lBVUVBVEFSQUkyc0VRQ05ySWdFRWZ5TjBCVUVBQ3dSQUkzWWhBQ0FBUVFGcUlBQkJBV3NqYWh0QkQzRWlBRUVQU0FSQUlBQWtkZ1ZCQUNSMEN3c0ZRUWdoQVFzTElBRWtjd3RjQVFKL0k1UUJRUUZySWdGQkFFd0VRQ09NQVFSQUk0d0JJZ0VFZnlPVkFRVkJBQXNFUUNPWEFTRUFJQUJCQVdvZ0FFRUJheU9MQVJ0QkQzRWlBRUVQU0FSQUlBQWtsd0VGUVFBa2xRRUxDd1ZCQ0NFQkN3c2dBU1NVQVF1cEFnRUNmMEdBd0FBamdnSjBJZ0VoQWlPekFTQUFhaUlBSUFGT0JFQWdBQ0FDYXlTekFRSkFBa0FDUUFKQUFrQWp0UUZCQVdwQkIzRWlBQVJBSUFCQkFrWU5BUUpBSUFCQkJHc09CQU1BQkFVQUN3d0ZDeU5lSWdGQkFFb0VmeU5XQlVFQUN3UkFJQUZCQVdzaUFVVUVRRUVBSkZnTEN5QUJKRjRRWEJCZEVGNE1CQXNqWGlJQlFRQktCSDhqVmdWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSWUN3c2dBU1JlRUZ3UVhSQmVFR0FNQXdzalhpSUJRUUJLQkg4alZnVkJBQXNFUUNBQlFRRnJJZ0ZGQkVCQkFDUllDd3NnQVNSZUVGd1FYUkJlREFJTEkxNGlBVUVBU2dSL0kxWUZRUUFMQkVBZ0FVRUJheUlCUlFSQVFRQWtXQXNMSUFFa1hoQmNFRjBRWGhCZ0RBRUxFR0VRWWhCakN5QUFKTFVCUVFFUEJTQUFKTE1CQzBFQUMzUUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQUNRQ0FBUVFKckRnTUNBd1FBQ3d3RUN5TlpJZ0FqbmdGSElRRWdBQ1NlQVNBQkR3c2pjQ0lBSTU4QlJ5RUJJQUFrbndFZ0FROExJNEFCSWdBam9BRkhJUUVnQUNTZ0FTQUJEd3Nqa2dFaUFDT2hBVWNoQVNBQUpLRUJJQUVQQzBFQUMxVUFBa0FDUUFKQUlBQkJBVWNFUUNBQVFRSkdEUUVnQUVFRFJnMENEQU1MUVFFZ0FYUkJnUUZ4UVFCSER3dEJBU0FCZEVHSEFYRkJBRWNQQzBFQklBRjBRZjRBY1VFQVJ3OExRUUVnQVhSQkFYRkJBRWNMY3dFQmZ5TmJJQUJySVFBRFFDQUFRUUJNQkVCQmdCQWpXbXRCQW5RaUFVRUNkQ0FCSTRJQ0d5UmJJMXNnQUVFZmRTSUJJQUFnQVdwemF5RUFJMkZCQVdwQkIzRWtZUXdCQ3dzZ0FDUmJJMWxCQUNOWUd3Ui9JMTlCRDNFRlFROFBDeU5RSTJFUVpnUi9RUUVGUVg4TGJFRVBhZ3RzQVFGL0kzSWdBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTnhhMEVDZENPQ0FuUWtjaU55SUFCQkgzVWlBU0FBSUFGcWMyc2hBQ040UVFGcVFRZHhKSGdNQVFzTElBQWtjaU53UVFBamJ4c0VmeU4yUVE5eEJVRVBEd3NqWnlONEVHWUVmMEVCQlVGL0MyeEJEMm9MRHdBamhBRkJBWFZCc1A0RGFoQWRDeXNCQVg4amhBRkJBV29oQUFOQUlBQkJJRWhGQkVBZ0FFRWdheUVBREFFTEN5QUFKSVFCRUdra2h3RUw1Z0VCQTM4amdBRkZRUUVqZnhzRVFFRVBEd3NqaFFFaEFpT0dBUVJBUVp6K0F4QWRRUVYxUVE5eElnSWtoUUZCQUNTR0FRc2pod0VqaEFGQkFYRkZRUUowZFVFUGNTRUJBa0FDUUFKQUFrQWdBZ1JBSUFKQkFVWU5BU0FDUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEF3d0NDeUFCUVFGMUlRRkJBaUVEREFFTElBRkJBblVoQVVFRUlRTUxJQU5CQUVvRWZ5QUJJQU50QlVFQUMwRVBhaUVCSTRJQklBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamdRRnJRUUYwSTRJQ2RDU0NBU09DQVNBQVFSOTFJZ0lnQUNBQ2FuTnJJUUFRYWd3QkN3c2dBQ1NDQVNBQkM0OEJBUUovSTVNQklBQnJJZ0JCQUV3RVFDT1lBU09OQVhRamdnSjBJQUJCSDNVaUFTQUFJQUZxYzJzaEFDT1pBU0lCUVFGMUlnSWdBVUVCY1NBQ1FRRnhjeUlCUVE1MGNpSUNRYjkvY1NBQlFRWjBjaUFDSTQ0Qkd5U1pBUXRCQUNBQUlBQkJBRWdiSkpNQkk1SUJRUUFqa1FFYkJIOGpsd0ZCRDNFRlFROFBDMEYvUVFFam1RRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMbHdFQkFYOUJBQ1NrQVNBQVFROGpxZ0ViSUFGQkR5T3JBUnRxSUFKQkR5T3NBUnRxSUFOQkR5T3RBUnRxSVFRZ0FFRVBJNjRCR3lBQlFROGpyd0ViYWlFQUlBQWdBa0VQSTdBQkcyb2hBU0FEUVE4anNRRWJJUU5CQUNTbEFVRUFKS1lCSUFRanFBRkJBV29RYlNFQUlBRWdBMm9qcVFGQkFXb1FiU0VCSUFBa29nRWdBU1NqQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElML3dJQkJYOGpUQ0FBYWlJQ0pFd2pXeUFDYTBFQVRDSUNSUVJBUVFFUVpTRUNDeU5tSUFCcUlnRWtaaU55SUFGclFRQk1JZ0ZGQkVCQkFoQmxJUUVMSTNrZ0FHb2tlVUVBSTRJQkkzbHJRUUJLSTRZQkcwVWlCRVVFUUVFREVHVWhCQXNqaUFFZ0FHb2tpQUVqa3dFamlBRnJRUUJNSWdWRkJFQkJCQkJsSVFVTElBSUVRQ05NSVFOQkFDUk1JQU1RWnlTYUFRc2dBUVJBSTJZaEEwRUFKR1lnQXhCb0pKc0JDeUFFQkVBamVTRURRUUFrZVNBREVHc2tuQUVMSUFVRVFDT0lBU0VEUVFBa2lBRWdBeEJzSkowQkMwRUJJQVZCQVNBRVFRRWdBU0FDR3hzYkJFQkJBU1NtQVF0QmdJQ0FBaU9DQW5SQnhOZ0NiU0lDSVFFanRBRWdBR29pQUNBQ1RnUkFJQUFnQVdzaEFFRUJJNlVCUVFFanBBRWpwZ0ViR3dSQUk1b0JJNXNCSTV3Qkk1MEJFRzRhQlNBQUpMUUJDeU8yQVNJQ1FRRjBRWUNad1FCcUlnRWpvZ0ZCQW1vNkFBQWdBVUVCYWlPakFVRUNham9BQUNBQ1FRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDNlVEQVFaL0lBQVFaeUVCSUFBUWFDRUNJQUFRYXlFRUlBQVFiQ0VGSUFFa21nRWdBaVNiQVNBRUpKd0JJQVVrblFFanRBRWdBR29pQUVHQWdJQUNJNElDZEVIRTJBSnRUZ1JBSUFCQmdJQ0FBaU9DQW5SQnhOZ0NiV3NoQUNBQklBSWdCQ0FGRUc0aEF5TzJBVUVCZEVHQW1jRUFhaUlHSUFOQmdQNERjVUVJZFVFQ2Fqb0FBQ0FHUVFGcUlBTkIvd0Z4UVFKcU9nQUFJejBFUUNBQlFROUJEMEVQRUc0aEFTTzJBVUVCZEVHQW1TRnFJZ01nQVVHQS9nTnhRUWgxUVFKcU9nQUFJQU5CQVdvZ0FVSC9BWEZCQW1vNkFBQkJEeUFDUVE5QkR4QnVJUUVqdGdGQkFYUkJnSmtwYWlJQ0lBRkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUZCL3dGeFFRSnFPZ0FBUVE5QkR5QUVRUThRYmlFQkk3WUJRUUYwUVlDWk1Xb2lBaUFCUVlEK0EzRkJDSFZCQW1vNkFBQWdBa0VCYWlBQlFmOEJjVUVDYWpvQUFFRVBRUTlCRHlBRkVHNGhBU08yQVVFQmRFR0FtVGxxSWdJZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBVUgvQVhGQkFtbzZBQUFMSTdZQlFRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDeDRCQVg4Z0FCQmtJUUVnQVVWQkFDTTZHd1JBSUFBUWJ3VWdBQkJ3Q3dzdkFRSi9RZGNBSTRJQ2RDRUJJNmNCSVFBRFFDQUFJQUZPQkVBZ0FSQnhJQUFnQVdzaEFBd0JDd3NnQUNTbkFRdWtBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQmxmNERSZzBCQWtBZ0FFR1IvZ05yRGhZR0N4QVVBQWNNRVJVRENBMFNGZ1FKRGhNWEJRb1BBQXNNRnd0QmtQNERFQjFCZ0FGeUR3dEJsZjRERUIxQi93RnlEd3RCbXY0REVCMUIvd0J5RHd0Qm4vNERFQjFCL3dGeUR3dEJwUDRERUIwUEMwR1IvZ01RSFVFL2NnOExRWmIrQXhBZFFUOXlEd3RCbS80REVCMUIvd0Z5RHd0Qm9QNERFQjFCL3dGeUR3dEJwZjRERUIwUEMwR1MvZ01RSFE4TFFaZitBeEFkRHd0Qm5QNERFQjFCbndGeUR3dEJvZjRERUIwUEMwR0FBVUVBSTdJQkd5RUFJQUJCQVhJZ0FFRitjU05ZR3lFQUlBQkJBbklnQUVGOWNTTnZHeUVBSUFCQkJISWdBRUY3Y1NOL0d5RUFJQUJCQ0hJZ0FFRjNjU09SQVJ0QjhBQnlEd3RCay80REVCMUIvd0Z5RHd0Qm1QNERFQjFCL3dGeUR3dEJuZjRERUIxQi93RnlEd3RCb3Y0REVCMFBDMEdVL2dNUUhVRy9BWElQQzBHWi9nTVFIVUcvQVhJUEMwR2UvZ01RSFVHL0FYSVBDMEdqL2dNUUhVRy9BWElQQzBGL0M1d0JBUUYvSTlvQklRQWoyd0VFUUNBQVFYdHhJQUJCQkhJajBnRWJJUUFnQUVGK2NTQUFRUUZ5STlVQkd5RUFJQUJCZDNFZ0FFRUljaVBUQVJzaEFDQUFRWDF4SUFCQkFuSWoxQUViSVFBRkk5d0JCRUFnQUVGK2NTQUFRUUZ5STlZQkd5RUFJQUJCZlhFZ0FFRUNjaVBYQVJzaEFDQUFRWHR4SUFCQkJISWoyQUViSVFBZ0FFRjNjU0FBUVFoeUk5a0JHeUVBQ3dzZ0FFSHdBWElMMUFJQUlBQkJnSUFDU0FSQVFYOFBDeUFBUVlEQUFraEJBQ0FBUVlDQUFrNGJCRUJCZnc4TElBQkJnUHdEU0VFQUlBQkJnTUFEVGhzRVFDQUFRWUJBYWhBZER3c2dBRUdmL1FOTVFRQWdBRUdBL0FOT0d3UkFRZjhCUVg4ajRRRkJBa2diRHdzZ0FFSE4vZ05HQkVCQi93RWhBRUhOL2dNUUhVRUJjVVVFUUVIK0FTRUFDeU9DQWtVRVFDQUFRZjkrY1NFQUN5QUFEd3NnQUVIRS9nTkdCRUFnQUNQdEFSQWZJKzBCRHdzZ0FFR20vZ05NUVFBZ0FFR1EvZ05PR3dSQUVISWdBQkJ6RHdzZ0FFR3YvZ05NUVFBZ0FFR24vZ05PR3dSQVFmOEJEd3NnQUVHLy9nTk1RUUFnQUVHdy9nTk9Hd1JBRUhJamZ3UkFFR2tQQzBGL0R3c2dBRUdFL2dOR0JFQWdBQ1BHQVVHQS9nTnhRUWgxSWdBUUh5QUFEd3NnQUVHRi9nTkdCRUFnQUNQSEFSQWZJOGNCRHdzZ0FFR1AvZ05HQkVBanZ3RkI0QUZ5RHdzZ0FFR0EvZ05HQkVBUWRBOExRWDhMS1FFQmZ5UGVBU0FBUmdSQVFRRWs0QUVMSUFBUWRTSUJRWDlHQkg4Z0FCQWRCU0FCUWY4QmNRc0xwQUlCQTM4ajlnRUVRQThMSS9jQklRTWorQUVoQWlBQVFmOC9UQVJBSUFJRWZ5QUJRUkJ4UlFWQkFBdEZCRUFnQVVFUGNTSUFCRUFnQUVFS1JnUkFRUUVrOUFFTEJVRUFKUFFCQ3dzRklBQkIvLzhBVEFSQUkvb0JJZ1FFZnlBQVFmL2ZBRXdGUVFFTEJFQWdBVUVQY1NQeUFTQUNHeUVBSUFNRWZ5QUJRUjl4SVFFZ0FFSGdBWEVGSS9rQkJIOGdBVUgvQUhFaEFTQUFRWUFCY1FWQkFDQUFJQVFiQ3dzaEFDQUFJQUZ5SlBJQkJTUHlBVUgvQVhFZ0FVRUFTa0VJZEhJazhnRUxCVUVBSUFCQi83OEJUQ0FDR3dSQUkvVUJRUUFnQXhzRVFDUHlBVUVmY1NBQlFlQUJjWElrOGdFUEN5QUJRUTl4SUFGQkEzRWorZ0ViSlBNQkJVRUFJQUJCLy84QlRDQUNHd1JBSUFNRVFDQUJRUUZ4UVFCSEpQVUJDd3NMQ3dzTE9BRUJmeU5PSVFFZ0FFSHdBSEZCQkhVa1RTQUFRUWh4UVFCSEpFNGdBRUVIY1NSUEkyVkJBQ05PUlVFQUlBRWJHd1JBUVFBa1dBc0xaUUFqV0FSQVFRQWpYU05VR3dSQUkxOUJBV3BCRDNFa1h3c2pVeUFBUVFoeFFRQkhSd1JBUVJBalgydEJEM0VrWHdzTElBQkJCSFZCRDNFa1VpQUFRUWh4UVFCSEpGTWdBRUVIY1NSVUlBQkIrQUZ4UVFCS0lnQWtXU0FBUlFSQVFRQWtXQXNMWlFBamJ3UkFRUUFqZENOckd3UkFJM1pCQVdwQkQzRWtkZ3NqYWlBQVFRaHhRUUJIUndSQVFSQWpkbXRCRDNFa2Rnc0xJQUJCQkhWQkQzRWthU0FBUVFoeFFRQkhKR29nQUVFSGNTUnJJQUJCK0FGeFFRQktJZ0FrY0NBQVJRUkFJQUFrYndzTGNnQWprUUVFUUVFQUk1VUJJNHdCR3dSQUk1Y0JRUUZxUVE5eEpKY0JDeU9MQVNBQVFRaHhRUUJIUndSQVFSQWpsd0ZyUVE5eEpKY0JDd3NnQUVFRWRVRVBjU1NLQVNBQVFRaHhRUUJISklzQklBQkJCM0VrakFFZ0FFSDRBWEZCQUVvaUFDU1NBU0FBUlFSQUlBQWtrUUVMQ3pnQUlBQkJCSFVralFFZ0FFRUljVUVBUnlTT0FTQUFRUWR4SWdBa2p3RWdBRUVCZENJQVFRRklCRUJCQVNFQUN5QUFRUU4wSkpnQkM2b0JBUUovUVFFa1dDTmVSUVJBUWNBQUpGNExRWUFRSTFwclFRSjBJZ0JCQW5RZ0FDT0NBaHNrV3lOVUJFQWpWQ1JjQlVFSUpGd0xRUUVrWFNOU0pGOGpXaVJrSTAwRVFDTk5KR01GUVFna1l3dEJBU05QUVFCS0lnQWpUVUVBU2hza1lrRUFKR1VnQUFSL0FuOGpaQ0lBSTA5MUlRRkJBU05PQkg5QkFTUmxJQUFnQVdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dWQkFBc0VRRUVBSkZnTEkxbEZCRUJCQUNSWUN3dVNBUUVDZnlBQVFRZHhJZ0VrVnlOVklBRkJDSFJ5SkZvanRRRkJBWEZCQVVZaEFpTldSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBa1VFUUVFQUlBRWpYa0VBVEJzRVFDTmVRUUZySkY1QkFDTmVSU0FBUVlBQmNSc0VRRUVBSkZnTEN3c2dBRUhBQUhGQkFFY2tWaUFBUVlBQmNRUkFFSDBqVmtFQVFRQWpYa0hBQUVZZ0Foc2JCRUFqWGtFQmF5UmVDd3NMUUFCQkFTUnZJM1ZGQkVCQndBQWtkUXRCZ0JBamNXdEJBblFqZ2dKMEpISWphd1JBSTJza2N3VkJDQ1J6QzBFQkpIUWphU1IySTNCRkJFQkJBQ1J2Q3d1U0FRRUNmeUFBUVFkeElnRWtiaU5zSUFGQkNIUnlKSEVqdFFGQkFYRkJBVVloQWlOdFJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFamRVRUFUQnNFUUNOMVFRRnJKSFZCQUNOMVJTQUFRWUFCY1JzRVFFRUFKRzhMQ3dzZ0FFSEFBSEZCQUVja2JTQUFRWUFCY1FSQUVIOGpiVUVBUVFBamRVSEFBRVlnQWhzYkJFQWpkVUVCYXlSMUN3c0xQUUJCQVNSL0k0TUJSUVJBUVlBQ0pJTUJDMEdBRUNPQkFXdEJBWFFqZ2dKMEpJSUJJNElCUVFacUpJSUJRUUFraEFFamdBRkZCRUJCQUNSL0N3dVBBUUVCZnlBQVFRZHhJZ0VrZmlOOElBRkJDSFJ5SklFQkk3VUJRUUZ4UVFGR0lnRkZCRUJCQUVFQUlBQkJ3QUJ4STMwYkk0TUJRUUJNR3dSQUk0TUJRUUZySklNQlFRQWpnd0ZGSUFCQmdBRnhHd1JBUVFBa2Z3c0xDeUFBUWNBQWNVRUFSeVI5SUFCQmdBRnhCRUFRZ1FFamZVRUFRUUFqZ3dGQmdBSkdJQUViR3dSQUk0TUJRUUZySklNQkN3c0xVZ0JCQVNTUkFTT1dBVVVFUUVIQUFDU1dBUXNqbUFFampRRjBJNElDZENTVEFTT01BUVJBSTR3QkpKUUJCVUVJSkpRQkMwRUJKSlVCSTRvQkpKY0JRZi8vQVNTWkFTT1NBVVVFUUVFQUpKRUJDd3VMQVFFQ2Z5TzFBVUVCY1VFQlJpRUNJNUFCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqbGdGQkFFd2JCRUFqbGdGQkFXc2tsZ0ZCQUNPV0FVVWdBRUdBQVhFYkJFQkJBQ1NSQVFzTEN5QUFRY0FBY1VFQVJ5U1FBU0FBUVlBQmNRUkFFSU1CSTVBQlFRQkJBQ09XQVVIQUFFWWdBaHNiQkVBamxnRkJBV3NrbGdFTEN3dWRCQUFqc2dGRlFRQWdBRUdtL2dOSEd3UkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQm12NERSZzBCQWtBZ0FFR1IvZ05yRGhZREJ3c1BBQVFJREJBQUJRa05FUUFHQ2c0U0V4UVZBQXNNRlFzZ0FSQjREQlVMUVFBZ0FVR0FBWEZCQUVjaUFDT0FBUnNFUUVFQUpJY0JDeUFBSklBQklBQkZCRUFnQUNSL0N3d1VDeUFCUVFaMVFRTnhKRkFnQVVFL2NTUlJRY0FBSTFGckpGNE1Fd3NnQVVFR2RVRURjU1JuSUFGQlAzRWthRUhBQUNOb2F5UjFEQklMSUFFa2VrR0FBaU42YXlTREFRd1JDeUFCUVQ5eEpJa0JRY0FBSTRrQmF5U1dBUXdRQ3lBQkVIa01Ed3NnQVJCNkRBNExRUUVraGdFZ0FVRUZkVUVQY1NSN0RBMExJQUVRZXd3TUN5QUJKRlVqVjBFSWRDQUJjaVJhREFzTElBRWtiQ051UVFoMElBRnlKSEVNQ2dzZ0FTUjhJMzVCQ0hRZ0FYSWtnUUVNQ1FzZ0FSQjhEQWdMSUFFUWZnd0hDeUFCRUlBQkRBWUxJQUVRZ2dFTUJRc2dBUkNFQVF3RUN5QUJRUVIxUVFkeEpLZ0JJQUZCQjNFa3FRRkJBU1NrQVF3REN5QUJFQ3RCQVNTbEFRd0NDeU95QVNJQUJIOUJBQVVnQVVHQUFYRUxCRUJCQnlTMUFVRUFKR0ZCQUNSNEN5QUJRWUFCY1VWQkFDQUFHd1JBQWtCQmtQNERJUUFEUUNBQVFhYitBMDROQVNBQVFRQVFrZ0VnQUVFQmFpRUFEQUFBQ3dBTEN5QUJRWUFCY1VFQVJ5U3lBUXdCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUhSQWZJQUJCQVdvaEFBd0JDd3RCaEFVayt3RUxKUUVCZjBIUi9nTVFIU0VBUWRMK0F4QWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNwQVFGL1FkUCtBeEFkSVFCQjFQNERFQjFCL3dGeElBQkIvd0Z4UVFoMGNrSHdQM0ZCZ0lBQ2FndUdBUUVEZnlPQkFrVUVRQThMSUFCQmdBRnhSVUVBSS93Qkd3UkFRUUFrL0FGQjFmNERRZFgrQXhBZFFZQUJjaEFmRHdzUWh3RWhBUkNJQVNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSlB3QklBTWsvUUVnQVNUK0FTQUNKUDhCUWRYK0F5QUFRZjkrY1JBZkJTQUJJQUlnQXhDVEFVSFYvZ05CL3dFUUh3c0xXUUVFZjBFQlFlditBeUlESUFCR0lBQkI2ZjREUmhzRVFDQUFRUUZySWdRUUhVRy9mM0VpQWtFL2NTSUZRVUJySUFVZ0FDQURSaHRCZ0pBRWFpQUJPZ0FBSUFKQmdBRnhCRUFnQkNBQ1FRRnFRWUFCY2hBZkN3c0xNUUFDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdNQ0F3UUFDd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzZkFDQUFRUUVqekFFUWl3RWlBSFJ4Qkg5QkFTQUFkQ0FCY1VVRlFRQUxDNFlCQVFSL0EwQWdBaUFBU0FSQUlBSkJCR29oQWlQR0FTSUJRUVJxUWYvL0EzRWlBeVRHQVNQTEFRUkFJOGtCSVFRanlBRUVRQ1BLQVNUSEFVRUJKTUlCUVFJUVdrRUFKTWdCUVFFa3lRRUZJQVFFUUVFQUpNa0JDd3NnQVNBREVJd0JCRUFqeHdGQkFXb2lBVUgvQVVvRVFFRUJKTWdCUVFBaEFRc2dBU1RIQVFzTERBRUxDd3NOQUNQRkFSQ05BVUVBSk1VQkMwWUJBWDhqeGdFaEFFRUFKTVlCUVlUK0EwRUFFQjhqeXdFRWZ5QUFRUUFRakFFRlFRQUxCRUFqeHdGQkFXb2lBRUgvQVVvRVFFRUJKTWdCUVFBaEFBc2dBQ1RIQVFzTGZBRURmeVBMQVNFQklBQkJCSEZCQUVja3l3RWdBRUVEY1NFQ0lBRkZCRUFqekFFUWl3RWhBU0FDRUlzQklRTWp4Z0VoQUNQTEFRUi9RUUVnQVhRZ0FIRUZRUUVnQTNRZ0FIRkJBRUVCSUFGMElBQnhHd3NFUUNQSEFVRUJhaUlBUWY4QlNnUkFRUUVreUFGQkFDRUFDeUFBSk1jQkN3c2dBaVRNQVF2SUJnRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUh3d0JDeUFBUWREK0EwWkJBQ09BQWhzRVFFRUFKSUFDUWY4QkpJd0NEQUlMSUFCQmdJQUNTQVJBSUFBZ0FSQjNEQUVMSUFCQmdNQUNTRUVBSUFCQmdJQUNUaHNOQVNBQVFZRDhBMGhCQUNBQVFZREFBMDRiQkVBZ0FFR0FRR29nQVJBZkRBSUxJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRQ1BoQVVFQ1RnOExJQUJCLy8wRFRFRUFJQUJCb1AwRFRoc05BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKTThCSUFGQkFuRkJBRWNrMEFFZ0FVR0FBWEZCQUVjazBRRkJBUThMSUFCQnB2NERURUVBSUFCQmtQNERUaHNFUUJCeUlBQWdBUkNGQVE4TElBQkJ2LzREVEVFQUlBQkJzUDREVGhzRVFCQnlJMzhFUUNPRUFVRUJkVUd3L2dOcUlBRVFId3dDQ3d3Q0N5QUFRY3YrQTB4QkFDQUFRY0QrQTA0YkJFQWdBRUhBL2dOR0JFQWdBUkEvREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RSFVFSGNYSkJnQUZ5RUI4TUFnc2dBRUhFL2dOR0JFQkJBQ1R0QVNBQVFRQVFId3dDQ3lBQVFjWCtBMFlFUUNBQkpPSUJEQU1MSUFCQnh2NERSZ1JBSUFFUWhnRU1Bd3NDUUFKQUFrQUNRQ0FBUWNQK0EwY0VRQ0FBUWNMK0Eyc09DZ0VFQkFRRUJBUUVBd0lFQ3lBQkpPNEJEQVlMSUFFazd3RU1CUXNnQVNUd0FRd0VDeUFCSlBFQkRBTUxEQUlMSUFCQjFmNERSZ1JBSUFFUWlRRU1BUXRCQVNBQVFjLytBMFlnQUVIdy9nTkdHd1JBSS93QkJFQWovZ0VpQWtHQWdBRk9CSDhnQWtILy93Rk1CVUVBQ3dSL1FRRUZJQUpCLzc4RFRFRUFJQUpCZ0tBRFRoc0xEUUlMQ3lBQVFlditBMHhCQUNBQVFlaitBMDRiQkVBZ0FDQUJFSW9CREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFCQ09BUUpBQWtBQ1FBSkFJQUJCaFA0RFJ3UkFJQUJCaGY0RGF3NERBUUlEQkFzUWp3RU1CUXNDUUNQTEFRUkFJOGtCRFFFanlBRUVRRUVBSk1nQkN3c2dBU1RIQVFzTUJRc2dBU1RLQVNQSkFVRUFJOHNCR3dSQUlBRWt4d0ZCQUNUSkFRc01CQXNnQVJDUUFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRhQVNQYUFTSUNRUkJ4UVFCSEpOc0JJQUpCSUhGQkFFY2szQUVMSUFCQmovNERSZ1JBSUFFUUx3d0NDeUFBUWYvL0EwWUVRQ0FCRUM0TUFndEJBUThMUVFBUEMwRUJDeUFBSTk4QklBQkdCRUJCQVNUZ0FRc2dBQ0FCRUpFQkJFQWdBQ0FCRUI4TEMxd0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFSFloQlNBQklBTnFJUVFEUUNBRVFmKy9Ba3hGQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUpJQklBTkJBV29oQXd3QkN3c2ord0ZCSUNPQ0FuUWdBa0VFZFd4cUpQc0JDM1FCQW44ai9BRkZCRUFQQzBFUUlRQWovZ0VqL3dFQ2Z5UDlBU0lCUVJCSUJFQWdBU0VBQ3lBQUN4Q1RBU1ArQVNBQWFpVCtBU1AvQVNBQWFpVC9BU0FCSUFCcklnQWsvUUZCMWY0RElRRWdBRUVBVEFSQVFRQWsvQUVnQVVIL0FSQWZCU0FCSUFCQkJIVkJBV3RCLzM1eEVCOExDek1BSSswQkkrSUJSa0VBSUFCQkFVWkJBU0FBR3hzRVFDQUJRUVJ5SWdGQndBQnhCRUFRV3dzRklBRkJlM0VoQVFzZ0FRdUJBZ0VGZnlQakFVVUVRQThMSStFQklRQWdBQ1B0QVNJQ1FaQUJUZ1IvUVFFRlFmZ0NJNElDZENJQklRTWo3QUVpQkNBQlRnUi9RUUlGUVFOQkFDQUVJQU5PR3dzTElnRkhCRUJCd2Y0REVCMGhBQ0FCSk9FQlFRQWhBZ0pBQWtBQ1FBSkFJQUVFUUNBQlFRRnJEZ01CQWdNRUN5QUFRWHh4SWdCQkNIRkJBRWNoQWd3REN5QUFRWDF4UVFGeUlnQkJFSEZCQUVjaEFnd0NDeUFBUVg1eFFRSnlJZ0JCSUhGQkFFY2hBZ3dCQ3lBQVFRTnlJUUFMSUFJRVFCQmJDeUFCUlFSQUVKUUJDeUFCUVFGR0JFQkJBU1RBQVVFQUVGb0xRY0grQXlBQklBQVFsUUVRSHdVZ0FrR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUhSQ1ZBUkFmQ3dzTG9BRUJBWDhqNHdFRVFDUHNBU0FBYWlUc0FTTTVJUUVEUUNQc0FVRUVJNElDSWdCMFFjZ0RJQUIwSSswQlFaa0JSaHRPQkVBajdBRkJCQ09DQWlJQWRFSElBeUFBZENQdEFVR1pBVVliYXlUc0FTUHRBU0lBUVpBQlJnUkFJQUVFUUJCWUJTQUFFRmNMRUZsQmZ5UktRWDhrU3dVZ0FFR1FBVWdFUUNBQlJRUkFJQUFRVndzTEMwRUFJQUJCQVdvZ0FFR1pBVW9iSk8wQkRBRUxDd3NRbGdFTE9BRUJmMEVFSTRJQ0lnQjBRY2dESUFCMEkrMEJRWmtCUmhzaEFBTkFJK3NCSUFCT0JFQWdBQkNYQVNQckFTQUFheVRyQVF3QkN3c0xzZ0VCQTM4ajBRRkZCRUFQQ3dOQUlBTWdBRWdFUUNBRFFRUnFJUU1DZnlQTkFTSUNRUVJxSWdGQi8vOERTZ1JBSUFGQmdJQUVheUVCQ3lBQkN5VE5BU0FDUVFGQkFrRUhJOUFCR3lJQ2RIRUVmMEVCSUFKMElBRnhSUVZCQUFzRVFFR0IvZ05CZ2Y0REVCMUJBWFJCQVdwQi93RnhFQjhqemdGQkFXb2lBVUVJUmdSQVFRQWt6Z0ZCQVNUREFVRURFRnBCZ3Y0RFFZTCtBeEFkUWY5K2NSQWZRUUFrMFFFRklBRWt6Z0VMQ3d3QkN3c0xsUUVBSS9zQlFRQktCRUFqK3dFZ0FHb2hBRUVBSlBzQkN5T05BaUFBYWlTTkFpT1JBa1VFUUNNM0JFQWo2d0VnQUdvazZ3RVFtQUVGSUFBUWx3RUxJellFUUNPbkFTQUFhaVNuQVJCeUJTQUFFSEVMSUFBUW1RRUxJemdFUUNQRkFTQUFhaVRGQVJDT0FRVWdBQkNOQVFzamxBSWdBR29pQUNPU0FrNEVRQ09UQWtFQmFpU1RBaUFBSTVJQ2F5RUFDeUFBSkpRQ0N3d0FRUVFRbWdFampBSVFIUXNwQVFGL1FRUVFtZ0VqakFKQkFXcEIvLzhEY1JBZElRQVFtd0ZCL3dGeElBQkIvd0Z4UVFoMGNnc09BRUVFRUpvQklBQWdBUkNTQVFzd0FFRUJJQUIwUWY4QmNTRUFJQUZCQUVvRVFDT0tBaUFBY2tIL0FYRWtpZ0lGSTRvQ0lBQkIvd0Z6Y1NTS0Fnc0xDUUJCQlNBQUVKNEJDem9CQVg4Z0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dwQkVIRkJBRWNRbndFRklBRkJIM1VpQWlBQklBSnFjMEVQY1NBQVFROXhTeENmQVFzTENRQkJCeUFBRUo0QkN3a0FRUVlnQUJDZUFRc0pBRUVFSUFBUW5nRUxQd0VDZnlBQlFZRCtBM0ZCQ0hVaEFpQUJRZjhCY1NJQklRTWdBQ0FCRUpFQkJFQWdBQ0FERUI4TElBQkJBV29pQUNBQ0VKRUJCRUFnQUNBQ0VCOExDdzRBUVFnUW1nRWdBQ0FCRUtRQkMxb0FJQUlFUUNBQVFmLy9BM0VpQUNBQmFpQUFJQUZ6Y3lJQVFSQnhRUUJIRUo4QklBQkJnQUp4UVFCSEVLTUJCU0FBSUFGcVFmLy9BM0VpQWlBQVFmLy9BM0ZKRUtNQklBQWdBWE1nQW5OQmdDQnhRUUJIRUo4QkN3c0xBRUVFRUpvQklBQVFkZ3VwQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNNRlFzUW5BRkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2hBSWdBRUgvQVhFa2hRSU1Ed3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSElqZ3dJUW5RRU1Fd3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraEFJTUV3c2poQUlpQUVFQkVLQUJJQUJCQVdwQi93RnhJZ0FraEFJTURRc2poQUlpQUVGL0VLQUJJQUJCQVd0Qi93RnhJZ0FraEFJTURRc1Ftd0ZCL3dGeEpJUUNEQTBMSTRNQ0lnQkJnQUZ4UVlBQlJoQ2pBU0FBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrZ3dJTURRc1FuQUZCLy84RGNTT0xBaENsQVF3SUN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpSUFJNFVDUWY4QmNTT0VBa0gvQVhGQkNIUnlJZ0ZCQUJDbUFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWdDSUFCQi93RnhKSWtDUVFBUW9nRkJDQThMSTRVQ1FmOEJjU09FQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NEQWd3TEN5T0ZBa0gvQVhFamhBSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0VBZ3dMQ3lPRkFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0ZBZ3dGQ3lPRkFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0ZBZ3dGQ3hDYkFVSC9BWEVraFFJTUJRc2pnd0lpQUVFQmNVRUFTeENqQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFa2d3SU1CUXRCZnc4TEk0d0NRUUpxUWYvL0EzRWtqQUlNQkFzZ0FFVVFvUUZCQUJDaUFRd0RDeUFBUlJDaEFVRUJFS0lCREFJTEk0d0NRUUZxUWYvL0EzRWtqQUlNQVF0QkFCQ2hBVUVBRUtJQlFRQVFud0VMUVFRUEN5QUFRZjhCY1NTRkFrRUlDNWtHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVJCSEJFQWdBRUVSUmcwQkFrQWdBRUVTYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0JBZ1JBUWMzK0F4Q25BVUgvQVhFaUFFRUJjUVJBUWMzK0F5QUFRWDV4SWdCQmdBRnhCSDlCQUNTQ0FpQUFRZjkrY1FWQkFTU0NBaUFBUVlBQmNnc1FuUUZCeEFBUEN3dEJBU1NSQWd3UUN4Q2NBVUgvL3dOeElnQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBaU9NQWtFQ2FrSC8vd054Skl3Q0RCRUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlJNE1DRUowQkRCQUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSVlDREJBTEk0WUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTU0dBaU9HQWtVUW9RRkJBQkNpQVF3T0N5T0dBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWtoZ0lqaGdKRkVLRUJRUUVRb2dFTURRc1Ftd0ZCL3dGeEpJWUNEQW9MSTRNQ0lnRkJnQUZ4UVlBQlJpRUFJNG9DUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1NEQWd3S0N4Q2JBU0VBSTR3Q0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NNQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09IQWtIL0FYRWpoZ0pCL3dGeFFRaDBjaUlCUVFBUXBnRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSEFrSC9BWEVqaGdKQi93RnhRUWgwY2hDbkFVSC9BWEVrZ3dJTUNBc2pod0pCL3dGeEk0WUNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtoZ0lNQ0Fzamh3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtod0lnQUVVUW9RRkJBQkNpQVF3R0N5T0hBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NIQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0hBZ3dDQ3lPREFpSUJRUUZ4UVFGR0lRQWppZ0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SklNQ0RBSUxRWDhQQ3lPTUFrRUJha0gvL3dOeEpJd0NEQUVMSUFBUW93RkJBQkNoQVVFQUVLSUJRUUFRbndFTFFRUVBDeUFBUWY4QmNTU0hBa0VJQy9VR0FRSi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVnUndSQUlBQkJJVVlOQVFKQUlBQkJJbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamlnSkJCM1pCQVhFRVFDT01Ba0VCYWtILy93TnhKSXdDQlJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ3RCQ0E4TEVKd0JRZi8vQTNFaUFFR0EvZ054UVFoMUpJZ0NJQUJCL3dGeEpJa0NJNHdDUVFKcVFmLy9BM0VrakFJTUZBc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09EQWhDZEFRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3TkN5T0lBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NJQWd3T0N5T0lBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NJQWd3T0N4Q2JBVUgvQVhFa2lBSU1EZ3RCQmtFQUk0b0NJZ0pCQlhaQkFYRkJBRXNiSWdCQjRBQnlJQUFnQWtFRWRrRUJjVUVBU3hzaEFDT0RBaUVCSUFKQkJuWkJBWEZCQUVzRWZ5QUJJQUJyUWY4QmNRVWdBU0FBUVFaeUlBQWdBVUVQY1VFSlN4c2lBRUhnQUhJZ0FDQUJRWmtCU3hzaUFHcEIvd0Z4Q3lJQlJSQ2hBU0FBUWVBQWNVRUFSeENqQVVFQUVKOEJJQUVrZ3dJTURnc2ppZ0pCQjNaQkFYRkJBRXNFUUJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ1VqakFKQkFXcEIvLzhEY1NTTUFndEJDQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5SWdBZ0FFSC8vd054UVFBUXBnRWdBRUVCZEVILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQUVLY0JRZjhCY1NTREFnd0hDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3RkN5T0pBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NKQWd3R0N5T0pBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NKQWd3R0N4Q2JBVUgvQVhFa2lRSU1CZ3NqZ3dKQmYzTkIvd0Z4SklNQ1FRRVFvZ0ZCQVJDZkFRd0dDMEYvRHdzZ0FFSC9BWEVraVFKQkNBOExJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUF3c2dBRVVRb1FGQkFCQ2lBUXdDQ3lBQVJSQ2hBVUVCRUtJQkRBRUxJNHdDUVFGcVFmLy9BM0VrakFJTFFRUUw4UVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhSZzBCQWtBZ0FFRXlhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPS0FrRUVka0VCY1FSQUk0d0NRUUZxUWYvL0EzRWtqQUlGRUpzQklRQWpqQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJd0NDMEVJRHdzUW5BRkIvLzhEY1NTTEFpT01Ba0VDYWtILy93TnhKSXdDREJFTEk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUlnQWpnd0lRblFFTURnc2ppd0pCQVdwQi8vOERjU1NMQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVNJQlFRRVFvQUVnQVVFQmFrSC9BWEVpQVVVUW9RRkJBQkNpQVNBQUlBRVFuUUVNRGdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BU0lCUVg4UW9BRWdBVUVCYTBIL0FYRWlBVVVRb1FGQkFSQ2lBU0FBSUFFUW5RRU1EUXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRbXdGQi93RnhFSjBCREFzTFFRQVFvZ0ZCQUJDZkFVRUJFS01CREFzTEk0b0NRUVIyUVFGeFFRRkdCRUFRbXdFaEFDT01BaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2pBSUZJNHdDUVFGcVFmLy9BM0VrakFJTFFRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlBSTRzQ1FRQVFwZ0VqaXdJZ0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2lBSWdBRUgvQVhFa2lRSkJBQkNpQVVFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVVIL0FYRWtnd0lNQmdzaml3SkJBV3RCLy84RGNTU0xBa0VJRHdzamd3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVF3R0N5T0RBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NEQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0RBZ3dEQzBFQUVLSUJRUUFRbndFamlnSkJCSFpCQVhGQkFFMFFvd0VNQXd0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUFRc2pqQUpCQVdwQi8vOERjU1NNQWd0QkJBdUNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQkJ3UUJHRFFFQ1FDQUFRY0lBYXc0T0F3UUZCZ2NJQ1JFS0N3d05EZzhBQ3d3UEN3d1BDeU9GQWlTRUFnd09DeU9HQWlTRUFnd05DeU9IQWlTRUFnd01DeU9JQWlTRUFnd0xDeU9KQWlTRUFnd0tDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtoQUlNQ1Fzamd3SWtoQUlNQ0FzamhBSWtoUUlNQndzamhnSWtoUUlNQmdzamh3SWtoUUlNQlFzamlBSWtoUUlNQkFzamlRSWtoUUlNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RkIvd0Z4SklVQ0RBSUxJNE1DSklVQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFCQjBRQkdEUUVDUUNBQVFkSUFhdzRPRUFNRUJRWUhDQWtLRUFzTURRNEFDd3dPQ3lPRUFpU0dBZ3dPQ3lPRkFpU0dBZ3dOQ3lPSEFpU0dBZ3dNQ3lPSUFpU0dBZ3dMQ3lPSkFpU0dBZ3dLQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFVSC9BWEVraGdJTUNRc2pnd0lraGdJTUNBc2poQUlraHdJTUJ3c2poUUlraHdJTUJnc2poZ0lraHdJTUJRc2ppQUlraHdJTUJBc2ppUUlraHdJTUF3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFwd0ZCL3dGeEpJY0NEQUlMSTRNQ0pJY0NEQUVMUVg4UEMwRUVDLzBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQkI0UUJHRFFFQ1FDQUFRZUlBYXc0T0F3UVFCUVlIQ0FrS0N3d1FEUTRBQ3d3T0N5T0VBaVNJQWd3T0N5T0ZBaVNJQWd3TkN5T0dBaVNJQWd3TUN5T0hBaVNJQWd3TEN5T0pBaVNJQWd3S0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2lBSU1DUXNqZ3dJa2lBSU1DQXNqaEFJa2lRSU1Cd3NqaFFJa2lRSU1CZ3NqaGdJa2lRSU1CUXNqaHdJa2lRSU1CQXNqaUFJa2lRSU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdGQi93RnhKSWtDREFJTEk0TUNKSWtDREFFTFFYOFBDMEVFQzVzREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUVIeEFFWU5BUUpBSUFCQjhnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVRQUxEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRRQ0VKMEJEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRVQ0VKMEJEQTRMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRZQ0VKMEJEQTBMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRjQ0VKMEJEQXdMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRnQ0VKMEJEQXNMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRrQ0VKMEJEQW9MSS93QlJRUkFBa0FqdHdFRVFFRUJKSTRDREFFTEk3a0JJNzhCY1VFZmNVVUVRRUVCSkk4Q0RBRUxRUUVra0FJTEN3d0pDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaU9EQWhDZEFRd0lDeU9FQWlTREFnd0hDeU9GQWlTREFnd0dDeU9HQWlTREFnd0ZDeU9IQWlTREFnd0VDeU9JQWlTREFnd0RDeU9KQWlTREFnd0NDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtnd0lNQVF0QmZ3OExRUVFMTndFQmZ5QUJRUUJPQkVBZ0FFSC9BWEVnQUNBQmFrSC9BWEZMRUtNQkJTQUJRUjkxSWdJZ0FTQUNhbk1nQUVIL0FYRktFS01CQ3dzMEFRSi9JNE1DSWdFZ0FFSC9BWEVpQWhDZ0FTQUJJQUlRc0FFZ0FDQUJha0gvQVhFaUFDU0RBaUFBUlJDaEFVRUFFS0lCQzFnQkFuOGpnd0lpQVNBQWFpT0tBa0VFZGtFQmNXcEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQUVIL0FYRWdBV29qaWdKQkJIWkJBWEZxUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRQVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZQUJSd1JBSUFCQmdRRkdEUUVDUUNBQVFZSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQ3hBUXdRQ3lPRkFoQ3hBUXdQQ3lPR0FoQ3hBUXdPQ3lPSEFoQ3hBUXdOQ3lPSUFoQ3hBUXdNQ3lPSkFoQ3hBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3hBUXdLQ3lPREFoQ3hBUXdKQ3lPRUFoQ3lBUXdJQ3lPRkFoQ3lBUXdIQ3lPR0FoQ3lBUXdHQ3lPSEFoQ3lBUXdGQ3lPSUFoQ3lBUXdFQ3lPSkFoQ3lBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3lBUXdDQ3lPREFoQ3lBUXdCQzBGL0R3dEJCQXMzQVFKL0k0TUNJZ0VnQUVIL0FYRkJmMndpQWhDZ0FTQUJJQUlRc0FFZ0FTQUFhMEgvQVhFaUFDU0RBaUFBUlJDaEFVRUJFS0lCQzFnQkFuOGpnd0lpQVNBQWF5T0tBa0VFZGtFQmNXdEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQVNBQVFmOEJjV3NqaWdKQkJIWkJBWEZyUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRRVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFaQUJSd1JBSUFCQmtRRkdEUUVDUUNBQVFaSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQzBBUXdRQ3lPRkFoQzBBUXdQQ3lPR0FoQzBBUXdPQ3lPSEFoQzBBUXdOQ3lPSUFoQzBBUXdNQ3lPSkFoQzBBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzBBUXdLQ3lPREFoQzBBUXdKQ3lPRUFoQzFBUXdJQ3lPRkFoQzFBUXdIQ3lPR0FoQzFBUXdHQ3lPSEFoQzFBUXdGQ3lPSUFoQzFBUXdFQ3lPSkFoQzFBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzFBUXdDQ3lPREFoQzFBUXdCQzBGL0R3dEJCQXNpQUNPREFpQUFjU0lBSklNQ0lBQkZFS0VCUVFBUW9nRkJBUkNmQVVFQUVLTUJDeVlBSTRNQ0lBQnpRZjhCY1NJQUpJTUNJQUJGRUtFQlFRQVFvZ0ZCQUJDZkFVRUFFS01CQzRzQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR2dBVWNFUUNBQVFhRUJSZzBCQWtBZ0FFR2lBV3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamhBSVF0d0VNRUFzamhRSVF0d0VNRHdzamhnSVF0d0VNRGdzamh3SVF0d0VNRFFzamlBSVF0d0VNREFzamlRSVF0d0VNQ3dzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF0d0VNQ2dzamd3SVF0d0VNQ1FzamhBSVF1QUVNQ0FzamhRSVF1QUVNQndzamhnSVF1QUVNQmdzamh3SVF1QUVNQlFzamlBSVF1QUVNQkFzamlRSVF1QUVNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF1QUVNQWdzamd3SVF1QUVNQVF0QmZ3OExRUVFMSmdBamd3SWdBSEpCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVVFQUVKOEJRUUFRb3dFTExBRUJmeU9EQWlJQklBQkIvd0Z4UVg5c0lnQVFvQUVnQVNBQUVMQUJJQUFnQVdwRkVLRUJRUUVRb2dFTGl3SUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRYkFCUndSQUlBQkJzUUZHRFFFQ1FDQUFRYklCYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0VBaEM2QVF3UUN5T0ZBaEM2QVF3UEN5T0dBaEM2QVF3T0N5T0hBaEM2QVF3TkN5T0lBaEM2QVF3TUN5T0pBaEM2QVF3TEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM2QVF3S0N5T0RBaEM2QVF3SkN5T0VBaEM3QVF3SUN5T0ZBaEM3QVF3SEN5T0dBaEM3QVF3R0N5T0hBaEM3QVF3RkN5T0lBaEM3QVF3RUN5T0pBaEM3QVF3REN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM3QVF3Q0N5T0RBaEM3QVF3QkMwRi9Ed3RCQkFzN0FRRi9JQUFRZFNJQlFYOUdCSDhnQUJBZEJTQUJDMEgvQVhFZ0FFRUJhaUlCRUhVaUFFRi9SZ1IvSUFFUUhRVWdBQXRCL3dGeFFRaDBjZ3NNQUVFSUVKb0JJQUFRdlFFTE5BQWdBRUdBQVhGQmdBRkdFS01CSUFCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NJQVJSQ2hBVUVBRUtJQlFRQVFud0VnQUFzeUFDQUFRUUZ4UVFCTEVLTUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBUlJDaEFVRUFFS0lCUVFBUW53RWdBQXM0QVFGL0k0b0NRUVIyUVFGeElBQkJBWFJ5UWY4QmNTRUJJQUJCZ0FGeFFZQUJSaENqQVNBQlJSQ2hBVUVBRUtJQlFRQVFud0VnQVFzNUFRRi9JNG9DUVFSMlFRRnhRUWQwSUFCQi93RnhRUUYyY2lFQklBQkJBWEZCQVVZUW93RWdBVVVRb1FGQkFCQ2lBVUVBRUo4QklBRUxLZ0FnQUVHQUFYRkJnQUZHRUtNQklBQkJBWFJCL3dGeElnQkZFS0VCUVFBUW9nRkJBQkNmQVNBQUN6MEJBWDhnQUVIL0FYRkJBWFlpQVVHQUFYSWdBU0FBUVlBQmNVR0FBVVliSWdGRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBUVFGeFFRRkdFS01CSUFFTEt3QWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VnQUFzcUFRRi9JQUJCL3dGeFFRRjJJZ0ZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFRUUZ4UVFGR0VLTUJJQUVMSGdCQkFTQUFkQ0FCY1VIL0FYRkZFS0VCUVFBUW9nRkJBUkNmQVNBQkM4Z0lBUVYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFkeElnUUVRQ0FFUVFGR0RRRUNRQ0FFUVFKckRnWURCQVVHQndnQUN3d0lDeU9FQWlFQkRBY0xJNFVDSVFFTUJnc2poZ0loQVF3RkN5T0hBaUVCREFRTEk0Z0NJUUVNQXdzamlRSWhBUXdDQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFTRUJEQUVMSTRNQ0lRRUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUJRUkFJQVZCQVVZTkFRSkFJQVZCQW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2dBRUVIVEFSL0lBRVF2d0VoQWtFQkJTQUFRUTlNQkg4Z0FSREFBU0VDUVFFRlFRQUxDeUVEREE4TElBQkJGMHdFZnlBQkVNRUJJUUpCQVFVZ0FFRWZUQVIvSUFFUXdnRWhBa0VCQlVFQUN3c2hBd3dPQ3lBQVFTZE1CSDhnQVJEREFTRUNRUUVGSUFCQkwwd0VmeUFCRU1RQklRSkJBUVZCQUFzTElRTU1EUXNnQUVFM1RBUi9JQUVReFFFaEFrRUJCU0FBUVQ5TUJIOGdBUkRHQVNFQ1FRRUZRUUFMQ3lFRERBd0xJQUJCeHdCTUJIOUJBQ0FCRU1jQklRSkJBUVVnQUVIUEFFd0VmMEVCSUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dMQ3lBQVFkY0FUQVIvUVFJZ0FSREhBU0VDUVFFRklBQkIzd0JNQkg5QkF5QUJFTWNCSVFKQkFRVkJBQXNMSVFNTUNnc2dBRUhuQUV3RWYwRUVJQUVReHdFaEFrRUJCU0FBUWU4QVRBUi9RUVVnQVJESEFTRUNRUUVGUVFBTEN5RUREQWtMSUFCQjl3Qk1CSDlCQmlBQkVNY0JJUUpCQVFVZ0FFSC9BRXdFZjBFSElBRVF4d0VoQWtFQkJVRUFDd3NoQXd3SUN5QUFRWWNCVEFSL0lBRkJmbkVoQWtFQkJTQUFRWThCVEFSL0lBRkJmWEVoQWtFQkJVRUFDd3NoQXd3SEN5QUFRWmNCVEFSL0lBRkJlM0VoQWtFQkJTQUFRWjhCVEFSL0lBRkJkM0VoQWtFQkJVRUFDd3NoQXd3R0N5QUFRYWNCVEFSL0lBRkJiM0VoQWtFQkJTQUFRYThCVEFSL0lBRkJYM0VoQWtFQkJVRUFDd3NoQXd3RkN5QUFRYmNCVEFSL0lBRkJ2Mzl4SVFKQkFRVWdBRUcvQVV3RWZ5QUJRZjkrY1NFQ1FRRUZRUUFMQ3lFRERBUUxJQUJCeHdGTUJIOGdBVUVCY2lFQ1FRRUZJQUJCendGTUJIOGdBVUVDY2lFQ1FRRUZRUUFMQ3lFRERBTUxJQUJCMXdGTUJIOGdBVUVFY2lFQ1FRRUZJQUJCM3dGTUJIOGdBVUVJY2lFQ1FRRUZRUUFMQ3lFRERBSUxJQUJCNXdGTUJIOGdBVUVRY2lFQ1FRRUZJQUJCN3dGTUJIOGdBVUVnY2lFQ1FRRUZRUUFMQ3lFRERBRUxJQUJCOXdGTUJIOGdBVUhBQUhJaEFrRUJCU0FBUWY4QlRBUi9JQUZCZ0FGeUlRSkJBUVZCQUFzTElRTUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUVCRUFnQkVFQlJnMEJBa0FnQkVFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQWlTRUFnd0hDeUFDSklVQ0RBWUxJQUlraGdJTUJRc2dBaVNIQWd3RUN5QUNKSWdDREFNTElBSWtpUUlNQWd0QkFTQUZRUWRLSUFWQkJFZ2JCRUFqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElnQWhDZEFRc01BUXNnQWlTREFndEJCRUYvSUFNYkM3c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJSZzBCQWtBZ0FFSENBV3NPRGdNU0JBVUdCd2dKQ2dzTUVRME9BQXNNRGdzamlnSkJCM1pCQVhFTkVRd09DeU9MQWhDK0FVSC8vd054SVFBaml3SkJBbXBCLy84RGNTU0xBaUFBUVlEK0EzRkJDSFVraEFJZ0FFSC9BWEVraFFKQkJBOExJNG9DUVFkMlFRRnhEUkVNRGdzamlnSkJCM1pCQVhFTkVBd01DeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09GQWtIL0FYRWpoQUpCL3dGeFFRaDBjaENsQVF3TkN4Q2JBUkN4QVF3TkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFQUpJd0NEQXNMSTRvQ1FRZDJRUUZ4UVFGSERRb01Cd3NqaXdJaUFCQytBVUgvL3dOeEpJd0NJQUJCQW1wQi8vOERjU1NMQWd3SkN5T0tBa0VIZGtFQmNVRUJSZzBIREFvTEVKc0JRZjhCY1JESUFTRUFJNHdDUVFGcVFmLy9BM0VrakFJZ0FBOExJNG9DUVFkMlFRRnhRUUZIRFFnaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSkJBbXBCLy84RGNSQ2xBUXdGQ3hDYkFSQ3lBUXdHQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVJSkl3Q0RBUUxRWDhQQ3lPTEFpSUFFTDRCUWYvL0EzRWtqQUlnQUVFQ2FrSC8vd054SklzQ1FRd1BDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWtFQ2FrSC8vd054RUtVQkN4Q2NBVUgvL3dOeEpJd0NDMEVJRHdzampBSkJBV3BCLy84RGNTU01Ba0VFRHdzampBSkJBbXBCLy84RGNTU01Ba0VNQzZBRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVVZTkFRSkFJQUJCMGdGckRnNERBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExJNG9DUVFSMlFRRnhEUThNRFFzaml3SWlBUkMrQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SklzQ0lBQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBa0VFRHdzamlnSkJCSFpCQVhFTkR3d01DeU9LQWtFRWRrRUJjUTBPSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTR3Q1FRSnFRZi8vQTNFUXBRRU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaHdKQi93RnhJNFlDUWY4QmNVRUlkSElRcFFFTUN3c1Ftd0VRdEFFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUlRcFFGQkVDU01BZ3dKQ3lPS0FrRUVka0VCY1VFQlJ3MElEQVlMSTRzQ0lnQVF2Z0ZCLy84RGNTU01Ba0VCSkxnQklBQkJBbXBCLy84RGNTU0xBZ3dIQ3lPS0FrRUVka0VCY1VFQlJnMEZEQWdMSTRvQ1FRUjJRUUZ4UVFGSERRY2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUpCQW1wQi8vOERjUkNsQVF3RUN4Q2JBUkMxQVF3RkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFWUpJd0NEQU1MUVg4UEN5T0xBaUlBRUw0QlFmLy9BM0VrakFJZ0FFRUNha0gvL3dOeEpJc0NRUXdQQ3hDY0FVSC8vd054Skl3Q0MwRUlEd3NqakFKQkFXcEIvLzhEY1NTTUFrRUVEd3NqakFKQkFtcEIvLzhEY1NTTUFrRU1DN0VEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFVWU5BUUpBSUFCQjRnRnJEZzREQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUpzQlFmOEJjVUdBL2dOcUk0TUNFSjBCREFzTEk0c0NJZ0VRdmdGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTTEFpQUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUpCQkE4TEk0VUNRWUQrQTJvamd3SVFuUUZCQkE4TEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUVLVUJRUWdQQ3hDYkFSQzNBUXdIQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVnSkl3Q1FRZ1BDeENiQVVFWWRFRVlkU0VBSTRzQ0lBQkJBUkNtQVNPTEFpQUFha0gvL3dOeEpJc0NRUUFRb1FGQkFCQ2lBU09NQWtFQmFrSC8vd054Skl3Q1FRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNNQWtFRUR3c1FuQUZCLy84RGNTT0RBaENkQVNPTUFrRUNha0gvL3dOeEpJd0NRUVFQQ3hDYkFSQzRBUXdDQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVvSkl3Q1FRZ1BDMEYvRHdzampBSkJBV3BCLy84RGNTU01Ba0VFQytjREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFVWU5BUUpBSUFCQjhnRnJEZzREQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRUpzQlFmOEJjVUdBL2dOcUVLY0JRZjhCY1NTREFnd05DeU9MQWlJQkVMNEJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtpd0lnQUVHQS9nTnhRUWgxSklNQ0lBQkIvd0Z4SklvQ0RBMExJNFVDUVlEK0Eyb1Fwd0ZCL3dGeEpJTUNEQXdMUVFBa3R3RU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaWdKQi93RnhJNE1DUWY4QmNVRUlkSElRcFFGQkNBOExFSnNCRUxvQkRBZ0xJNHNDUVFKclFmLy9BM0VpQUNTTEFpQUFJNHdDRUtVQlFUQWtqQUpCQ0E4TEVKc0JRUmgwUVJoMUlRQWppd0loQVVFQUVLRUJRUUFRb2dFZ0FTQUFRUUVRcGdFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBaU9NQWtFQmFrSC8vd054Skl3Q1FRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNMQWtFSUR3c1FuQUZCLy84RGNSQ25BVUgvQVhFa2d3SWpqQUpCQW1wQi8vOERjU1NNQWd3RkMwRUJKTGdCREFRTEVKc0JFTHNCREFJTEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0d0NFS1VCUVRna2pBSkJDQThMUVg4UEN5T01Ba0VCYWtILy93TnhKSXdDQzBFRUM5Z0JBUUYvSTR3Q1FRRnFRZi8vQTNFaEFTT1FBZ1JBSUFGQkFXdEIvLzhEY1NFQkN5QUJKSXdDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGckRnNEJBZ01FQlFZSENBa0tDd3dORGc4TElBQVFxQUVQQ3lBQUVLa0JEd3NnQUJDcUFROExJQUFRcXdFUEN5QUFFS3dCRHdzZ0FCQ3RBUThMSUFBUXJnRVBDeUFBRUs4QkR3c2dBQkN6QVE4TElBQVF0Z0VQQ3lBQUVMa0JEd3NnQUJDOEFROExJQUFReVFFUEN5QUFFTW9CRHdzZ0FCRExBUThMSUFBUXpBRUx2Z0VCQW45QkFDUzNBVUdQL2dNUUhVRUJJQUIwUVg5emNTSUJKTDhCUVkvK0F5QUJFQjhqaXdKQkFtdEIvLzhEY1NTTEFpT0xBaUlCSTR3Q0lnSkIvd0Z4RUI4Z0FVRUJhaUFDUVlEK0EzRkJDSFVRSHdKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWt3QUZCd0FBa2pBSU1CQXRCQUNUQkFVSElBQ1NNQWd3REMwRUFKTUlCUWRBQUpJd0NEQUlMUVFBa3d3RkIyQUFrakFJTUFRdEJBQ1RFQVVIZ0FDU01BZ3NMNlFFQkFuOGp1QUVFUUVFQkpMY0JRUUFrdUFFTEk3a0JJNzhCY1VFZmNVRUFTZ1JBSTQ4Q1JVRUFJN2NCR3dSL0k4QUJRUUFqdWdFYkJIOUJBQkRPQVVFQkJTUEJBVUVBSTdzQkd3Ui9RUUVRemdGQkFRVWp3Z0ZCQUNPOEFSc0VmMEVDRU00QlFRRUZJOE1CUVFBanZRRWJCSDlCQXhET0FVRUJCU1BFQVVFQUk3NEJHd1IvUVFRUXpnRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQVFRRWpqd0lqamdJYkJIOUJBQ1NQQWtFQUpJNENRUUFra0FKQkFDU1JBa0VZQlVFVUN5RUFDMEVCSTQ4Q0k0NENHd1JBUVFBa2p3SkJBQ1NPQWtFQUpKQUNRUUFra1FJTElBQVBDMEVBQzdZQkFRSi9RUUVrbUFJamtBSUVRQ09NQWhBZFFmOEJjUkROQVJDYUFVRUFKSThDUVFBa2pnSkJBQ1NRQWtFQUpKRUNDeERQQVNJQVFRQktCRUFnQUJDYUFRdEJCQ0VBUVFBamtRSkZRUUVqandJampnSWJHd1JBSTR3Q0VCMUIvd0Z4RU0wQklRQUxJNG9DUWZBQmNTU0tBaUFBUVFCTUJFQWdBQThMSUFBUW1nRWpsd0pCQVdvaUFTT1ZBazRFZnlPV0FrRUJhaVNXQWlBQkk1VUNhd1VnQVFza2x3SWpqQUlqM1FGR0JFQkJBU1RnQVFzZ0FBc0ZBQ08yQVF1dUFRRURmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQWtFQUlRQURRQ1BnQVVWQkFDQUJSVUVBUVFBZ0FFVWdBeHNiR3dSQUVOQUJRUUJJQkVCQkFTRURCU09OQWtIUXBBUWpnZ0owVGdSQVFRRWhBQVZCQVNBQkk3WUJJQUpPUVFBZ0FrRi9TaHNiSVFFTEN3d0JDd3NnQUFSQUk0MENRZENrQkNPQ0FuUnJKSTBDUVFBUEN5QUJCRUJCQVE4TEkrQUJCRUJCQUNUZ0FVRUNEd3NqakFKQkFXdEIvLzhEY1NTTUFrRi9Dd2NBUVg4UTBnRUxOQUVDZndOQUlBRkJBRTVCQUNBQ0lBQklHd1JBUVg4UTBnRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09TQWdzRkFDT1RBZ3NGQUNPVUFndGJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09CZ01FQlFZSENBQUxEQWdMSTlJQkR3c2oxUUVQQ3lQVEFROExJOVFCRHdzajFnRVBDeVBYQVE4TEk5Z0JEd3NqMlFFUEMwRUFDNGNCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBRWNrMGdFTUJ3c2dBVUVBUnlUVkFRd0dDeUFCUVFCSEpOTUJEQVVMSUFGQkFFY2sxQUVNQkFzZ0FVRUFSeVRXQVF3REN5QUJRUUJISk5jQkRBSUxJQUZCQUVjazJBRU1BUXNnQVVFQVJ5VFpBUXNMVVFFQmYwRUFKSkVDSUFBUTJBRkZCRUJCQVNFQkN5QUFRUUVRMlFFZ0FRUkFRUUZCQVVFQVFRRkJBQ0FBUVFOTUd5SUFRUUFqMndFYkd5QUFSVUVBSTl3Qkd4c0VRRUVCSk1RQlFRUVFXZ3NMQ3drQUlBQkJBQkRaQVF1YUFRQWdBRUVBU2dSQVFRQVEyZ0VGUVFBUTJ3RUxJQUZCQUVvRVFFRUJFTm9CQlVFQkVOc0JDeUFDUVFCS0JFQkJBaERhQVFWQkFoRGJBUXNnQTBFQVNnUkFRUU1RMmdFRlFRTVEyd0VMSUFSQkFFb0VRRUVFRU5vQkJVRUVFTnNCQ3lBRlFRQktCRUJCQlJEYUFRVkJCUkRiQVFzZ0JrRUFTZ1JBUVFZUTJnRUZRUVlRMndFTElBZEJBRW9FUUVFSEVOb0JCVUVIRU5zQkN3c0hBQ0FBSk4wQkN3Y0FRWDhrM1FFTEJ3QWdBQ1RlQVFzSEFFRi9KTjRCQ3djQUlBQWszd0VMQndCQmZ5VGZBUXNGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0lBZ3NGQUNPSkFnc0ZBQ09LQWdzRkFDT01BZ3NGQUNPTEFnc0xBQ09NQWhBZFFmOEJjUXNGQUNQdEFRdXJBd0VLZjBHQWdBSkJnSkFDSStZQkd5RUlRWUM0QWtHQXNBSWo1d0ViSVFrRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ0NBRlFRTjFRUVYwSUFscUlBUkJBM1ZxSWdKQmdKQithaTBBQUJCTklRWWdCVUVJYnlFQlFRY2dCRUVJYjJzaEIwRUFJUU1DZnlBQVFRQktRUUFqZ1FJYkJFQWdBa0dBMEg1cUxRQUFJUU1MSUFOQndBQnhDd1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRkJBWFFnQm1vaUJrR0FrSDVxUVFGQkFDQURRUWh4R3lJQ1FRMTBhaTBBQUNFS1FRQWhBU0FHUVlHUWZtb2dBa0VOZEdvdEFBQkJBU0FIZEhFRVFFRUNJUUVMSUFGQkFXb2dBVUVCSUFkMElBcHhHeUVCSUFWQkNIUWdCR3BCQTJ3aEFpQUFRUUJLUVFBamdRSWJCRUFnQWtHQW9RdHFJZ0lnQTBFSGNTQUJRUUFRVGlJQlFSOXhRUU4wT2dBQUlBSkJBV29nQVVIZ0IzRkJCWFZCQTNRNkFBQWdBa0VDYWlBQlFZRDRBWEZCQ25WQkEzUTZBQUFGSUFKQmdLRUxhaUlESUFGQngvNERFRThpQVVHQWdQd0hjVUVRZFRvQUFDQURRUUZxSUFGQmdQNERjVUVJZFRvQUFDQURRUUpxSUFFNkFBQUxJQVJCQVdvaEJBd0JDd3NnQlVFQmFpRUZEQUVMQ3d2VkF3RU1md05BSUFSQkYwNUZCRUJCQUNFREEwQWdBMEVmU0FSQVFRRkJBQ0FEUVE5S0lnY2JJUWtnQkVFUGF5QUVJQVJCRDBvaUFCdEJCSFFpQlNBRFFROXJhaUFESUFWcUlBY2JJUWhCZ0pBQ1FZQ0FBaUFBR3lFS1FjZitBeUVIUVg4aEJrRi9JUVZCQUNFQkEwQWdBVUVJU0FSQVFRQWhBQU5BSUFCQkJVZ0VRQ0FBUVFOMElBRnFRUUowSWdKQmd2d0RhaEFkSUFoR0JFQWdBa0dEL0FOcUVCMGhBa0VCUVFBZ0FrRUljVUVBSTRFQ0d4c2dDVVlFUUVFSUlRRkJCU0VBSUFJaUJVRVFjUVIvUWNuK0F3VkJ5UDREQ3lFSEN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFWQkFFaEJBQ09CQWhzRVFFR0F1QUpCZ0xBQ0krY0JHeUVMUVg4aEFFRUFJUUlEUUNBQ1FTQklCRUJCQUNFQkEwQWdBVUVnU0FSQUlBRkJCWFFnQzJvZ0Ftb2lCa0dBa0g1cUxRQUFJQWhHQkVCQklDRUNRU0FoQVNBR0lRQUxJQUZCQVdvaEFRd0JDd3NnQWtFQmFpRUNEQUVMQ3lBQVFRQk9CSDhnQUVHQTBINXFMUUFBQlVGL0N5RUdDMEVBSVFBRFFDQUFRUWhJQkVBZ0NDQUtJQWxCQUVFSElBQWdBMEVEZENBRVFRTjBJQUJxUWZnQlFZQ2hGeUFISUFZZ0JSQlFHaUFBUVFGcUlRQU1BUXNMSUFOQkFXb2hBd3dCQ3dzZ0JFRUJhaUVFREFFTEN3dVdBZ0VKZndOQUlBUkJDRTVGQkVCQkFDRUJBMEFnQVVFRlNBUkFJQUZCQTNRZ0JHcEJBblFpQUVHQS9BTnFFQjBhSUFCQmdmd0RhaEFkR2lBQVFZTDhBMm9RSFNFQ1FRRWhCU1BvQVFSQUlBSkJBbTlCQVVZRVFDQUNRUUZySVFJTFFRSWhCUXNnQUVHRC9BTnFFQjBoQmtFQUlRZEJBVUVBSUFaQkNIRkJBQ09CQWhzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VGQWFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqeGdFTEJRQWp4d0VMQlFBanlnRUxHQUVCZnlQTUFTRUFJOHNCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnTFhKQkdvZ0FCQjJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGdBUXNXQUJBYlB3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEM5d0JBQ0FBUVp3Q1NRUkFEd3NnQUVFUWF5RUFBa0FDUUFKQUFrQUNRQUpBSUFGQkFVY0VRQ0FCUVFKR0RRRUNRQ0FCUVFOckRnTURCQVVBQ3d3RkN5QUFFQmtNQlFzZ0FDZ0NCRUgvLy8vL0FIRkJBRTBFUUVFQVFZQUJRY3NBUVJFUUFBQUxJQUFnQUNnQ0JFRUJhellDQkNBQUVBY01CQXNnQUJBS0RBTUxJQUFvQWdRaUFVR0FnSUNBZjNFZ0FVRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUFVSFdBRUVHRUFBQUN5QUFJQUZCQVdvMkFnUWdBVUdBZ0lDQUIzRUVRQ0FBRUFrTERBSUxJQUFRQ3d3QkMwRUFRWUFCUWVFQVFSZ1FBQUFMQ3kwQUFrQUNRQUpBSUFCQkNHc29BZ0FPQXdBQUFRSUxEd3NnQUNnQ0FDSUFCRUFnQUNBQkVQZ0JDdzhMQUFzREFBRUxIUUFDUUFKQUFrQWptZ0lPQWdFQ0FBc0FDMEVBSVFBTElBQVEwZ0VMQndBZ0FDU2FBZ3NsQUFKQUFrQUNRQUpBSTVvQ0RnTUJBZ01BQ3dBTFFRRWhBQXRCZnlFQkN5QUJFTklCQ3d1ZkFnWUFRUWdMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFkQUJzQUhNQVpnQXVBSFFBY3dCQk9BczNLQUFBQUFFQUFBQUJBQUFBS0FBQUFHRUFiQUJzQUc4QVl3QmhBSFFBYVFCdkFHNEFJQUIwQUc4QWJ3QWdBR3dBWVFCeUFHY0FaUUJCOEFBTExSNEFBQUFCQUFBQUFRQUFBQjRBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzhBY0FCMUFISUFaUUF1QUhRQWN3QkJvQUVMTXlRQUFBQUJBQUFBQVFBQUFDUUFBQUJKQUc0QVpBQmxBSGdBSUFCdkFIVUFkQUFnQUc4QVpnQWdBSElBWVFCdUFHY0FaUUJCMkFFTEl4UUFBQUFCQUFBQUFRQUFBQlFBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzRBZEFCekFFR0FBZ3NWQXdBQUFCQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpOgphd2FpdCBPKCJkYXRhOmFwcGxpY2F0aW9uL3dhc207YmFzZTY0LEFHRnpiUUVBQUFBQmlBRVJZQUovZndGL1lBQUFZQU4vZjM4QmYyQUVmMzkvZndCZ0FuOS9BR0FCZndGL1lBRi9BR0FEZjM5L0FHQUtmMzkvZjM5L2YzOS9md0JnQUFGL1lBWi9mMzkvZjM4QVlBZC9mMzkvZjM5L0FYOWdCMzkvZjM5L2YzOEFZQVIvZjM5L0FYOWdDSDkvZjM5L2YzOS9BR0FGZjM5L2YzOEJmMkFOZjM5L2YzOS9mMzkvZjM5L2Z3Ri9BZzBCQTJWdWRnVmhZbTl5ZEFBREEvOEIvUUVFQkFjQkJRQUdCQVlHQmdFRUJ3QUFCZ1VGQndjR0FRWUdCZ0VGQlFFRUFRRUdCZ0VCQVFFQkFRRUdBUUVHQmdFQkFRRUlDUUVCQVFFQkFRRUJCZ1lCQVFFQkFRRUJBUWtKQ1FrUEFBSUFFQXNNQ2dvSEJBWUJBUVlCQVFFQkJnRUJBUUVGQlFBRkJRa0JCUVVBRFFZR0JnRUZDUVVGQkFZR0JnWUdBUVlCQmdFR0FRWUFCZ2tKQmdRRkFBWUJBUVlBQkFjQkFBRUdBUVlHQ1FrRUJBWUVCZ1lHQkFRSEJRVUZCUVVGQlFVRkJBWUdCUVlHQlFZR0JRWUdCUVVGQlFVRkJRVUZCUVVBQlFVRkJRVUZCZ2tKQ1FVSkJRa0pDUVVFQmdZT0JnRUdBUVlCQ1FrSkNRa0pDUWtKQ1FrSkJnRUJDUWtKQ1FFQkJBUUJCUVlBQlFNQkFBRUc3UXViQW44QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQUVFQUMzOEFRWUFJQzM4QVFZQUlDMzhBUVlBSUMzOEFRWUFRQzM4QVFZQ0FBUXQvQUVHQWtBRUxmd0JCZ0lBQ0MzOEFRWUNRQXd0L0FFR0FnQUVMZndCQmdCQUxmd0JCZ0lBRUMzOEFRWUNRQkF0L0FFR0FBUXQvQUVHQWtRUUxmd0JCZ0xnQkMzOEFRWURKQlF0L0FFR0EyQVVMZndCQmdLRUxDMzhBUVlDQURBdC9BRUdBb1JjTGZ3QkJnSUFKQzM4QVFZQ2hJQXQvQUVHQStBQUxmd0JCZ0pBRUMzOEFRWUNKSFF0L0FFR0FtU0VMZndCQmdJQUlDMzhBUVlDWktRdC9BRUdBZ0FnTGZ3QkJnSmt4QzM4QVFZQ0FDQXQvQUVHQW1Ua0xmd0JCZ0lBSUMzOEFRWUNad1FBTGZ3QkJnSUFJQzM4QVFZQ1p5UUFMZndCQmdJQUlDMzhBUVlDWjBRQUxmd0JCZ0JRTGZ3QkJnSzNSQUF0L0FFR0FpUGdEQzM4QVFZQzF5UVFMZndCQi8vOERDMzhBUVFBTGZ3QkJnTFhOQkF0L0FFR1VBUXQvQVVFQUMzOEJRUUVMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFYOExmd0ZCZnd0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVQQzM4QlFROExmd0ZCRHd0L0FVRVBDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQi93QUxmd0ZCL3dBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQVF0L0FVRUJDMzhCUVFFTGZ3RkJBUXQvQVVFQkMzOEJRUUVMZndGQkFRdC9BVUVCQzM4QlFRRUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQmZ3dC9BVUYvQzM4QlFYOExmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBUXQvQVVFQkMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRUUFMZndGQkFBdC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FVRUFDMzhCUVFBTGZ3RkJBQXQvQVVFQUMzOEJRWUNvMXJrSEMzOEJRUUFMZndGQkFBdC9BVUdBcU5hNUJ3dC9BVUVBQzM4QlFRQUxmd0ZCQUF0L0FFR0FBZ3QvQVVFQUN3ZndFR1VHYldWdGIzSjVBZ0FIWDE5aGJHeHZZd0FRQ0Y5ZmNtVjBZV2x1QUJJSlgxOXlaV3hsWVhObEFCb0pYMTlqYjJ4c1pXTjBBQXdMWDE5eWRIUnBYMkpoYzJVRG1RSUdZMjl1Wm1sbkFEUU9hR0Z6UTI5eVpWTjBZWEowWldRQU5RbHpZWFpsVTNSaGRHVUFQQWxzYjJGa1UzUmhkR1VBUndWcGMwZENRd0JJRW1kbGRGTjBaWEJ6VUdWeVUzUmxjRk5sZEFCSkMyZGxkRk4wWlhCVFpYUnpBRW9JWjJWMFUzUmxjSE1BU3hWbGVHVmpkWFJsVFhWc2RHbHdiR1ZHY21GdFpYTUExQUVNWlhobFkzVjBaVVp5WVcxbEFOTUJDVjlmYzJWMFlYSm5Zd0Q4QVJsbGVHVmpkWFJsUm5KaGJXVkJibVJEYUdWamEwRjFaR2x2QVBzQkZXVjRaV04xZEdWVmJuUnBiRU52Ym1ScGRHbHZiZ0Q5QVF0bGVHVmpkWFJsVTNSbGNBRFFBUlJuWlhSRGVXTnNaWE5RWlhKRGVXTnNaVk5sZEFEVkFReG5aWFJEZVdOc1pWTmxkSE1BMWdFSloyVjBRM2xqYkdWekFOY0JEbk5sZEVwdmVYQmhaRk4wWVhSbEFOd0JIMmRsZEU1MWJXSmxjazltVTJGdGNHeGxjMGx1UVhWa2FXOUNkV1ptWlhJQTBRRVFZMnhsWVhKQmRXUnBiMEoxWm1abGNnQkRISE5sZEUxaGJuVmhiRU52Ykc5eWFYcGhkR2x2YmxCaGJHVjBkR1VBSWhkWFFWTk5RazlaWDAxRlRVOVNXVjlNVDBOQlZFbFBUZ014RTFkQlUwMUNUMWxmVFVWTlQxSlpYMU5KV2tVRE1oSlhRVk5OUWs5WlgxZEJVMDFmVUVGSFJWTURNeDVCVTFORlRVSk1XVk5EVWtsUVZGOU5SVTFQVWxsZlRFOURRVlJKVDA0REJScEJVMU5GVFVKTVdWTkRVa2xRVkY5TlJVMVBVbGxmVTBsYVJRTUdGbGRCVTAxQ1QxbGZVMVJCVkVWZlRFOURRVlJKVDA0REJ4SlhRVk5OUWs5WlgxTlVRVlJGWDFOSldrVURDQ0JIUVUxRlFrOVpYMGxPVkVWU1RrRk1YMDFGVFU5U1dWOU1UME5CVkVsUFRnTVBIRWRCVFVWQ1QxbGZTVTVVUlZKT1FVeGZUVVZOVDFKWlgxTkpXa1VERUJKV1NVUkZUMTlTUVUxZlRFOURRVlJKVDA0RENRNVdTVVJGVDE5U1FVMWZVMGxhUlFNS0VWZFBVa3RmVWtGTlgweFBRMEZVU1U5T0F3c05WMDlTUzE5U1FVMWZVMGxhUlFNTUprOVVTRVZTWDBkQlRVVkNUMWxmU1U1VVJWSk9RVXhmVFVWTlQxSlpYMHhQUTBGVVNVOU9BdzBpVDFSSVJWSmZSMEZOUlVKUFdWOUpUbFJGVWs1QlRGOU5SVTFQVWxsZlUwbGFSUU1PR0VkU1FWQklTVU5UWDA5VlZGQlZWRjlNVDBOQlZFbFBUZ01kRkVkU1FWQklTVU5UWDA5VlZGQlZWRjlUU1ZwRkF4NFVSMEpEWDFCQlRFVlVWRVZmVEU5RFFWUkpUMDRERVJCSFFrTmZVRUZNUlZSVVJWOVRTVnBGQXhJWVFrZGZVRkpKVDFKSlZGbGZUVUZRWDB4UFEwRlVTVTlPQXhNVVFrZGZVRkpKVDFKSlZGbGZUVUZRWDFOSldrVURGQTVHVWtGTlJWOU1UME5CVkVsUFRnTVZDa1pTUVUxRlgxTkpXa1VERmhkQ1FVTkxSMUpQVlU1RVgwMUJVRjlNVDBOQlZFbFBUZ01YRTBKQlEwdEhVazlWVGtSZlRVRlFYMU5KV2tVREdCSlVTVXhGWDBSQlZFRmZURTlEUVZSSlQwNERHUTVVU1V4RlgwUkJWRUZmVTBsYVJRTWFFazlCVFY5VVNVeEZVMTlNVDBOQlZFbFBUZ01iRGs5QlRWOVVTVXhGVTE5VFNWcEZBeHdWUVZWRVNVOWZRbFZHUmtWU1gweFBRMEZVU1U5T0F5Y1JRVlZFU1U5ZlFsVkdSa1ZTWDFOSldrVURLQmxEU0VGT1RrVk1YekZmUWxWR1JrVlNYMHhQUTBGVVNVOU9BeDhWUTBoQlRrNUZURjh4WDBKVlJrWkZVbDlUU1ZwRkF5QVpRMGhCVGs1RlRGOHlYMEpWUmtaRlVsOU1UME5CVkVsUFRnTWhGVU5JUVU1T1JVeGZNbDlDVlVaR1JWSmZVMGxhUlFNaUdVTklRVTVPUlV4Zk0xOUNWVVpHUlZKZlRFOURRVlJKVDA0REl4VkRTRUZPVGtWTVh6TmZRbFZHUmtWU1gxTkpXa1VESkJsRFNFRk9Ua1ZNWHpSZlFsVkdSa1ZTWDB4UFEwRlVTVTlPQXlVVlEwaEJUazVGVEY4MFgwSlZSa1pGVWw5VFNWcEZBeVlXUTBGU1ZGSkpSRWRGWDFKQlRWOU1UME5CVkVsUFRnTXBFa05CVWxSU1NVUkhSVjlTUVUxZlUwbGFSUU1xRVVKUFQxUmZVazlOWDB4UFEwRlVTVTlPQXlzTlFrOVBWRjlTVDAxZlUwbGFSUU1zRmtOQlVsUlNTVVJIUlY5U1QwMWZURTlEUVZSSlQwNERMUkpEUVZKVVVrbEVSMFZmVWs5TlgxTkpXa1VETGgxRVJVSlZSMTlIUVUxRlFrOVpYMDFGVFU5U1dWOU1UME5CVkVsUFRnTXZHVVJGUWxWSFgwZEJUVVZDVDFsZlRVVk5UMUpaWDFOSldrVURNQ0ZuWlhSWFlYTnRRbTk1VDJabWMyVjBSbkp2YlVkaGJXVkNiM2xQWm1aelpYUUFIQnR6WlhSUWNtOW5jbUZ0UTI5MWJuUmxja0p5WldGcmNHOXBiblFBM1FFZGNtVnpaWFJRY205bmNtRnRRMjkxYm5SbGNrSnlaV0ZyY0c5cGJuUUEzZ0VaYzJWMFVtVmhaRWRpVFdWdGIzSjVRbkpsWVd0d2IybHVkQURmQVJ0eVpYTmxkRkpsWVdSSFlrMWxiVzl5ZVVKeVpXRnJjRzlwYm5RQTRBRWFjMlYwVjNKcGRHVkhZazFsYlc5eWVVSnlaV0ZyY0c5cGJuUUE0UUVjY21WelpYUlhjbWwwWlVkaVRXVnRiM0o1UW5KbFlXdHdiMmx1ZEFEaUFReG5aWFJTWldkcGMzUmxja0VBNHdFTVoyVjBVbVZuYVhOMFpYSkNBT1FCREdkbGRGSmxaMmx6ZEdWeVF3RGxBUXhuWlhSU1pXZHBjM1JsY2tRQTVnRU1aMlYwVW1WbmFYTjBaWEpGQU9jQkRHZGxkRkpsWjJsemRHVnlTQURvQVF4blpYUlNaV2RwYzNSbGNrd0E2UUVNWjJWMFVtVm5hWE4wWlhKR0FPb0JFV2RsZEZCeWIyZHlZVzFEYjNWdWRHVnlBT3NCRDJkbGRGTjBZV05yVUc5cGJuUmxjZ0RzQVJsblpYUlBjR052WkdWQmRGQnliMmR5WVcxRGIzVnVkR1Z5QU8wQkJXZGxkRXhaQU80QkhXUnlZWGRDWVdOclozSnZkVzVrVFdGd1ZHOVhZWE50VFdWdGIzSjVBTzhCR0dSeVlYZFVhV3hsUkdGMFlWUnZWMkZ6YlUxbGJXOXllUUR3QVJOa2NtRjNUMkZ0Vkc5WFlYTnRUV1Z0YjNKNUFQRUJCbWRsZEVSSlZnRHlBUWRuWlhSVVNVMUJBUE1CQm1kbGRGUk5RUUQwQVFablpYUlVRVU1BOVFFVGRYQmtZWFJsUkdWaWRXZEhRazFsYlc5eWVRRDJBUWdDOXdFS2hac0MvUUdnQWdFRWZ5QUJLQUlBSWdOQkFYRkZCRUJCQUVFWVFaVUNRUTBRQUFBTElBTkJmSEVpQWtFUVR3Ui9JQUpCOFAvLy93TkpCVUVBQzBVRVFFRUFRUmhCbHdKQkRSQUFBQXNnQWtHQUFra0VmeUFDUVFSMklRSkJBQVVnQWtFZklBSm5heUlEUVFScmRrRVFjeUVDSUFOQkIyc0xJZ05CRjBrRWZ5QUNRUkJKQlVFQUMwVUVRRUVBUVJoQnBBSkJEUkFBQUFzZ0FTZ0NGQ0VFSUFFb0FoQWlCUVJBSUFVZ0JEWUNGQXNnQkFSQUlBUWdCVFlDRUFzZ0EwRUVkQ0FDYWtFQ2RDQUFhaWdDWUNBQlJnUkFJQU5CQkhRZ0FtcEJBblFnQUdvZ0JEWUNZQ0FFUlFSQUlBTkJBblFnQUdvZ0EwRUNkQ0FBYWlnQ0JFRUJJQUowUVg5emNTSUJOZ0lFSUFGRkJFQWdBQ0FBS0FJQVFRRWdBM1JCZjNOeE5nSUFDd3NMQy8wREFRWi9JQUZGQkVCQkFFRVlRYzBCUVEwUUFBQUxJQUVvQWdBaUEwRUJjVVVFUUVFQVFSaEJ6d0ZCRFJBQUFBc2dBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJZ1ZCQVhFRVFDQURRWHh4UVJCcUlBVkJmSEZxSWdKQjhQLy8vd05KQkVBZ0FDQUVFQUVnQVNBRFFRTnhJQUp5SWdNMkFnQWdBVUVRYWlBQktBSUFRWHh4YWlJRUtBSUFJUVVMQ3lBRFFRSnhCRUFnQVVFRWF5Z0NBQ0lDS0FJQUlnWkJBWEZGQkVCQkFFRVlRZVFCUVE4UUFBQUxJQVpCZkhGQkVHb2dBMEY4Y1dvaUIwSHcvLy8vQTBrRWZ5QUFJQUlRQVNBQ0lBWkJBM0VnQjNJaUF6WUNBQ0FDQlNBQkN5RUJDeUFFSUFWQkFuSTJBZ0FnQTBGOGNTSUNRUkJQQkg4Z0FrSHcvLy8vQTBrRlFRQUxSUVJBUVFCQkdFSHpBVUVORUFBQUN5QUVJQUZCRUdvZ0FtcEhCRUJCQUVFWVFmUUJRUTBRQUFBTElBUkJCR3NnQVRZQ0FDQUNRWUFDU1FSL0lBSkJCSFloQkVFQUJTQUNRUjhnQW1kcklnSkJCR3QyUVJCeklRUWdBa0VIYXdzaUEwRVhTUVIvSUFSQkVFa0ZRUUFMUlFSQVFRQkJHRUdFQWtFTkVBQUFDeUFEUVFSMElBUnFRUUowSUFCcUtBSmdJUUlnQVVFQU5nSVFJQUVnQWpZQ0ZDQUNCRUFnQWlBQk5nSVFDeUFEUVFSMElBUnFRUUowSUFCcUlBRTJBbUFnQUNBQUtBSUFRUUVnQTNSeU5nSUFJQU5CQW5RZ0FHb2dBMEVDZENBQWFpZ0NCRUVCSUFSMGNqWUNCQXZMQVFFQ2Z5QUNRUTl4UlVFQUlBRkJEM0ZGUVFBZ0FTQUNUUnNiUlFSQVFRQkJHRUdDQTBFRUVBQUFDeUFBS0FLZ0RDSURCRUFnQVNBRFFSQnFTUVJBUVFCQkdFR01BMEVQRUFBQUN5QUJRUkJySUFOR0JFQWdBeWdDQUNFRUlBRkJFR3NoQVFzRklBRWdBRUdrREdwSkJFQkJBRUVZUVpnRFFRUVFBQUFMQ3lBQ0lBRnJJZ0pCTUVrRVFBOExJQUVnQkVFQ2NTQUNRU0JyUVFGeWNqWUNBQ0FCUVFBMkFoQWdBVUVBTmdJVUlBRWdBbXBCRUdzaUFrRUNOZ0lBSUFBZ0FqWUNvQXdnQUNBQkVBSUxsd0VCQW45QkFUOEFJZ0JLQkg5QkFTQUFhMEFBUVFCSUJVRUFDd1JBQUF0Qm9BSkJBRFlDQUVIQURrRUFOZ0lBUVFBaEFBTkFBa0FnQUVFWFR3MEFJQUJCQW5SQm9BSnFRUUEyQWdSQkFDRUJBMEFDUUNBQlFSQlBEUUFnQUVFRWRDQUJha0VDZEVHZ0FtcEJBRFlDWUNBQlFRRnFJUUVNQVFzTElBQkJBV29oQUF3QkN3dEJvQUpCMEE0L0FFRVFkQkFEUWFBQ0pBQUxMUUFnQUVIdy8vLy9BMDhFUUVISUFFRVlRY2tEUVIwUUFBQUxJQUJCRDJwQmNIRWlBRUVRSUFCQkVFc2JDOTBCQVFGL0lBRkJnQUpKQkg4Z0FVRUVkaUVCUVFBRklBRkIrUC8vL3dGSkJFQkJBVUViSUFGbmEzUWdBV3BCQVdzaEFRc2dBVUVmSUFGbmF5SUNRUVJyZGtFUWN5RUJJQUpCQjJzTElnSkJGMGtFZnlBQlFSQkpCVUVBQzBVRVFFRUFRUmhCMGdKQkRSQUFBQXNnQWtFQ2RDQUFhaWdDQkVGL0lBRjBjU0lCQkg4Z0FXZ2dBa0VFZEdwQkFuUWdBR29vQW1BRklBQW9BZ0JCZnlBQ1FRRnFkSEVpQVFSL0lBRm9JZ0ZCQW5RZ0FHb29BZ1FpQWtVRVFFRUFRUmhCM3dKQkVSQUFBQXNnQW1nZ0FVRUVkR3BCQW5RZ0FHb29BbUFGUVFBTEN3czdBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FGSEJFQWdBQ0FCUWYvLy8vOTRjVUdBZ0lDQUFYSTJBZ1FnQUVFUWFrRUNFUGtCQ3dzdEFRRi9JQUVvQWdBaUFrRUJjUVJBUVFCQkdFR3pCRUVDRUFBQUN5QUJJQUpCQVhJMkFnQWdBQ0FCRUFJTEhRQWdBQ0FBS0FJRVFmLy8vLzk0Y1RZQ0JDQUFRUkJxUVFRUStRRUxUd0VCZnlBQUtBSUVJZ0ZCZ0lDQWdBZHhRWUNBZ0lBQlJnUkFJQUZCLy8vLy93QnhRUUJMQkVBZ0FCQUpCU0FBSUFGQi8vLy8vM2h4UVlDQWdJQUNjallDQkNBQVFSQnFRUU1RK1FFTEN3dEtBUUYvSUFBb0FnUWlBVUdBZ0lDQUIzRkJnSUNBZ0FKR0JIOGdBVUdBZ0lDQWVIRkZCVUVBQ3dSQUlBQWdBVUgvLy8vL2VIRTJBZ1FnQUVFUWFrRUZFUGtCSXdBZ0FCQUlDd3Z6QVFFR2Z5TUNJZ1VpQWlFREl3TWhBQU5BQWtBZ0F5QUFUdzBBSUFNb0FnQWlCQ2dDQkNJQlFZQ0FnSUFIY1VHQWdJQ0FBMFlFZnlBQlFmLy8vLzhBY1VFQVN3VkJBQXNFUUNBRUVBY2dBaUFFTmdJQUlBSkJCR29oQWdWQkFDQUJRZi8vLy84QWNVVWdBVUdBZ0lDQUIzRWJCRUFqQUNBRUVBZ0ZJQVFnQVVILy8vLy9CM0UyQWdRTEN5QURRUVJxSVFNTUFRc0xJQUlrQXlBRklRQURRQUpBSUFBZ0FrOE5BQ0FBS0FJQUVBb2dBRUVFYWlFQURBRUxDeUFGSVFBRFFBSkFJQUFnQWs4TkFDQUFLQUlBSWdFZ0FTZ0NCRUgvLy8vL0IzRTJBZ1FnQVJBTElBQkJCR29oQUF3QkN3c2dCU1FEQzI4QkFYOC9BQ0lDSUFGQitQLy8vd0ZKQkg5QkFVRWJJQUZuYTNSQkFXc2dBV29GSUFFTFFSQWdBQ2dDb0F3Z0FrRVFkRUVRYTBkMGFrSC8vd05xUVlDQWZIRkJFSFlpQVNBQ0lBRktHMEFBUVFCSUJFQWdBVUFBUVFCSUJFQUFDd3NnQUNBQ1FSQjBQd0JCRUhRUUF3dUhBUUVDZnlBQktBSUFJUU1nQWtFUGNRUkFRUUJCR0VIdEFrRU5FQUFBQ3lBRFFYeHhJQUpySWdSQklFOEVRQ0FCSUFOQkFuRWdBbkkyQWdBZ0FVRVFhaUFDYWlJQklBUkJFR3RCQVhJMkFnQWdBQ0FCRUFJRklBRWdBMEYrY1RZQ0FDQUJRUkJxSUFFb0FnQkJmSEZxSUFGQkVHb2dBU2dDQUVGOGNXb29BZ0JCZlhFMkFnQUxDNUVCQVFKL0l3RUVRRUVBUVJoQjVnTkJEUkFBQUFzZ0FDQUJFQVVpQXhBR0lnSkZCRUJCQVNRQkVBeEJBQ1FCSUFBZ0F4QUdJZ0pGQkVBZ0FDQURFQTBnQUNBREVBWWlBa1VFUUVFQVFSaEI4Z05CRXhBQUFBc0xDeUFDS0FJQVFYeHhJQU5KQkVCQkFFRVlRZm9EUVEwUUFBQUxJQUpCQURZQ0JDQUNJQUUyQWd3Z0FDQUNFQUVnQUNBQ0lBTVFEaUFDQ3lJQkFYOGpBQ0lDQkg4Z0FnVVFCQ01BQ3lBQUVBOGlBQ0FCTmdJSUlBQkJFR29MVVFFQmZ5QUFLQUlFSWdGQmdJQ0FnSDl4SUFGQkFXcEJnSUNBZ0g5eFJ3UkFRUUJCZ0FGQjZBQkJBaEFBQUFzZ0FDQUJRUUZxTmdJRUlBQW9BZ0JCQVhFRVFFRUFRWUFCUWVzQVFRMFFBQUFMQ3hRQUlBQkJuQUpMQkVBZ0FFRVFheEFSQ3lBQUN5Y0FJQUJCZ0FJb0FnQkxCRUJCc0FGQjZBRkJGa0ViRUFBQUN5QUFRUU4wUVlRQ2FpZ0NBQXZFREFFRGZ3TkFJQUZCQTNGQkFDQUNHd1JBSUFBaUEwRUJhaUVBSUFFaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRRnJJUUlNQVFzTElBQkJBM0ZGQkVBRFFDQUNRUkJKUlFSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FFRUlhaUFCUVFocUtBSUFOZ0lBSUFCQkRHb2dBVUVNYWlnQ0FEWUNBQ0FCUVJCcUlRRWdBRUVRYWlFQUlBSkJFR3NoQWd3QkN3c2dBa0VJY1FSQUlBQWdBU2dDQURZQ0FDQUFRUVJxSUFGQkJHb29BZ0EyQWdBZ0FVRUlhaUVCSUFCQkNHb2hBQXNnQWtFRWNRUkFJQUFnQVNnQ0FEWUNBQ0FCUVFScUlRRWdBRUVFYWlFQUN5QUNRUUp4QkVBZ0FDQUJMd0VBT3dFQUlBRkJBbW9oQVNBQVFRSnFJUUFMSUFKQkFYRUVRQ0FBSUFFdEFBQTZBQUFMRHdzZ0FrRWdUd1JBQWtBQ1FBSkFJQUJCQTNFaUEwRUJSd1JBSUFOQkFrWU5BU0FEUVFOR0RRSU1Bd3NnQVNnQ0FDRUZJQUFnQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBMEVCYWlFQUlBRkJBV29pQkVFQmFpRUJJQU1nQkMwQUFEb0FBQ0FDUVFOcklRSURRQ0FDUVJGSlJRUkFJQUFnQVVFQmFpZ0NBQ0lEUVFoMElBVkJHSFp5TmdJQUlBQkJCR29nQTBFWWRpQUJRUVZxS0FJQUlnTkJDSFJ5TmdJQUlBQkJDR29nQTBFWWRpQUJRUWxxS0FJQUlnTkJDSFJ5TmdJQUlBQkJER29nQVVFTmFpZ0NBQ0lGUVFoMElBTkJHSFp5TmdJQUlBRkJFR29oQVNBQVFSQnFJUUFnQWtFUWF5RUNEQUVMQ3d3Q0N5QUJLQUlBSVFVZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUNBQ1FRSnJJUUlEUUNBQ1FSSkpSUVJBSUFBZ0FVRUNhaWdDQUNJRFFSQjBJQVZCRUhaeU5nSUFJQUJCQkdvZ0EwRVFkaUFCUVFacUtBSUFJZ05CRUhSeU5nSUFJQUJCQ0dvZ0EwRVFkaUFCUVFwcUtBSUFJZ05CRUhSeU5nSUFJQUJCREdvZ0FVRU9haWdDQUNJRlFSQjBJQU5CRUhaeU5nSUFJQUZCRUdvaEFTQUFRUkJxSVFBZ0FrRVFheUVDREFFTEN3d0JDeUFCS0FJQUlRVWdBQ0lEUVFGcUlRQWdBU0lFUVFGcUlRRWdBeUFFTFFBQU9nQUFJQUpCQVdzaEFnTkFJQUpCRTBsRkJFQWdBQ0FCUVFOcUtBSUFJZ05CR0hRZ0JVRUlkbkkyQWdBZ0FFRUVhaUFEUVFoMklBRkJCMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRUlhaUFEUVFoMklBRkJDMm9vQWdBaUEwRVlkSEkyQWdBZ0FFRU1haUFCUVE5cUtBSUFJZ1ZCR0hRZ0EwRUlkbkkyQWdBZ0FVRVFhaUVCSUFCQkVHb2hBQ0FDUVJCcklRSU1BUXNMQ3dzZ0FrRVFjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJQUlBRkJBV29pQVMwQUFEb0FBQ0FBUVFGcUlnQWdBVUVCYWlJQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlEUVFGcUlRQWdBVUVCYWlJRVFRRnFJUUVnQXlBRUxRQUFPZ0FBQ3lBQ1FRaHhCRUFnQUNBQkxRQUFPZ0FBSUFCQkFXb2lBQ0FCUVFGcUlnRXRBQUE2QUFBZ0FFRUJhaUlBSUFGQkFXb2lBUzBBQURvQUFDQUFRUUZxSWdBZ0FVRUJhaUlCTFFBQU9nQUFJQUJCQVdvaUFDQUJRUUZxSWdFdEFBQTZBQUFnQUVFQmFpSUFJQUZCQVdvaUFTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUVjUVJBSUFBZ0FTMEFBRG9BQUNBQVFRRnFJZ0FnQVVFQmFpSUJMUUFBT2dBQUlBQkJBV29pQUNBQlFRRnFJZ0V0QUFBNkFBQWdBRUVCYWlJRFFRRnFJUUFnQVVFQmFpSUVRUUZxSVFFZ0F5QUVMUUFBT2dBQUN5QUNRUUp4QkVBZ0FDQUJMUUFBT2dBQUlBQkJBV29pQTBFQmFpRUFJQUZCQVdvaUJFRUJhaUVCSUFNZ0JDMEFBRG9BQUFzZ0FrRUJjUVJBSUFBZ0FTMEFBRG9BQUFzTDBnSUJBbjhDUUNBQ0lRTWdBQ0FCUmcwQVFRRWdBQ0FEYWlBQlRTQUJJQU5xSUFCTkd3UkFJQUFnQVNBREVCUU1BUXNnQUNBQlNRUkFJQUZCQjNFZ0FFRUhjVVlFUUFOQUlBQkJCM0VFUUNBRFJRMEVJQU5CQVdzaEF5QUFJZ0pCQVdvaEFDQUJJZ1JCQVdvaEFTQUNJQVF0QUFBNkFBQU1BUXNMQTBBZ0EwRUlTVVVFUUNBQUlBRXBBd0EzQXdBZ0EwRUlheUVESUFCQkNHb2hBQ0FCUVFocUlRRU1BUXNMQ3dOQUlBTUVRQ0FBSWdKQkFXb2hBQ0FCSWdSQkFXb2hBU0FDSUFRdEFBQTZBQUFnQTBFQmF5RUREQUVMQ3dVZ0FVRUhjU0FBUVFkeFJnUkFBMEFnQUNBRGFrRUhjUVJBSUFORkRRUWdBQ0FEUVFGcklnTnFJQUVnQTJvdEFBQTZBQUFNQVFzTEEwQWdBMEVJU1VVRVFDQUFJQU5CQ0dzaUEyb2dBU0FEYWlrREFEY0RBQXdCQ3dzTEEwQWdBd1JBSUFBZ0EwRUJheUlEYWlBQklBTnFMUUFBT2dBQURBRUxDd3NMQ3pnQUl3QkZCRUJCQUVFWVFkRUVRUTBRQUFBTElBQkJEM0ZGUVFBZ0FCdEZCRUJCQUVFWVFkSUVRUUlRQUFBTEl3QWdBRUVRYXhBSUMwVUJCSDhqQXlNQ0lnRnJJZ0pCQVhRaUFFR0FBaUFBUVlBQ1N4c2lBMEVBRUJBaUFDQUJJQUlRRlNBQkJFQWdBUkFXQ3lBQUpBSWdBQ0FDYWlRRElBQWdBMm9rQkFzaUFRRi9Jd01pQVNNRVR3UkFFQmNqQXlFQkN5QUJJQUEyQWdBZ0FVRUVhaVFEQzdZQkFRSi9JQUFvQWdRaUFrSC8vLy8vQUhFaEFTQUFLQUlBUVFGeEJFQkJBRUdBQVVIekFFRU5FQUFBQ3lBQlFRRkdCRUFnQUVFUWFrRUJFUGtCSUFKQmdJQ0FnSGh4QkVBZ0FFR0FnSUNBZURZQ0JBVWpBQ0FBRUFnTEJTQUJRUUJOQkVCQkFFR0FBVUg4QUVFUEVBQUFDeUFBS0FJSUVCTkJFSEVFUUNBQUlBRkJBV3NnQWtHQWdJQ0FmM0Z5TmdJRUJTQUFJQUZCQVd0QmdJQ0FnSHR5TmdJRUlBSkJnSUNBZ0hoeFJRUkFJQUFRR0FzTEN3c1NBQ0FBUVp3Q1N3UkFJQUJCRUdzUUdRc0xVd0JCOHVYTEJ5UStRYURCZ2dVa1AwSFlzT0VDSkVCQmlKQWdKRUZCOHVYTEJ5UkNRYURCZ2dVa1EwSFlzT0VDSkVSQmlKQWdKRVZCOHVYTEJ5UkdRYURCZ2dVa1IwSFlzT0VDSkVoQmlKQWdKRWtMbHdJQkFYOENRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkJESFVpQVFSQUlBRkJBVVlOQVFKQUlBRkJBbXNPREFJQ0F3TURBd1FFQlFVR0J3QUxEQWNMSTRBQ0JFQWpnUUlFUUNBQVFZQUNTQTBKSUFCQmdCSklRUUFnQUVIL0Ewb2JEUWtGUVFBZ0FFR0FBa2dqZ1FJYkRRa0xDd3NnQUVHQXJkRUFhZzhMSUFCQkFTUHlBU0lBUVFBZ0FFVWorZ0ViRzBFT2RHcEJnSzNRQUdvUEN5QUFRWUNRZm1vamdRSUVmMEhQL2dNUUhVRUJjUVZCQUF0QkRYUnFEd3NnQUNQekFVRU5kR3BCZ05uR0FHb1BDeUFBUVlDUWZtb1BDMEVBSVFFQ2Z5T0JBZ1JBUWZEK0F4QWRRUWR4SVFFTElBRkJBVWdMQkg5QkFRVWdBUXRCREhRZ0FHcEJnUEI5YWc4TElBQkJnRkJxRHdzZ0FFR0FtZEVBYWdzSkFDQUFFQnd0QUFBTHd3RUFRUUFrZ2dKQkFDU0RBa0VBSklRQ1FRQWtoUUpCQUNTR0FrRUFKSWNDUVFBa2lBSkJBQ1NKQWtFQUpJb0NRUUFraXdKQkFDU01Ba0VBSkkwQ1FRQWtqZ0pCQUNTUEFrRUFKSkFDUVFBa2tRSWpnQUlFUUE4TEk0RUNCRUJCRVNTREFrR0FBU1NLQWtFQUpJUUNRUUFraFFKQi93RWtoZ0pCMWdBa2h3SkJBQ1NJQWtFTkpJa0NCVUVCSklNQ1FiQUJKSW9DUVFBa2hBSkJFeVNGQWtFQUpJWUNRZGdCSkljQ1FRRWtpQUpCelFBa2lRSUxRWUFDSkl3Q1FmNy9BeVNMQWdzTEFDQUFFQndnQVRvQUFBdHpBUUYvUVFBazlBRkJBU1QxQVVISEFoQWRJZ0JGSlBZQklBQkJBMHhCQUNBQVFRRk9HeVQzQVNBQVFRWk1RUUFnQUVFRlRoc2srQUVnQUVFVFRFRUFJQUJCRDA0YkpQa0JJQUJCSGt4QkFDQUFRUmxPR3lUNkFVRUJKUElCUVFBazh3RkJ6LzREUVFBUUgwSHcvZ05CQVJBZkN5OEFRZEgrQTBIL0FSQWZRZEwrQTBIL0FSQWZRZFArQTBIL0FSQWZRZFQrQTBIL0FSQWZRZFgrQTBIL0FSQWZDN0FJQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFBRVFDQUFRUUZHRFFFQ1FDQUFRUUpyRGdzREJBVUdCd2dKQ2dzTURRQUxEQTBMUWZMbHl3Y2tQa0dnd1lJRkpEOUIyTERoQWlSQVFZaVFJQ1JCUWZMbHl3Y2tRa0dnd1lJRkpFTkIyTERoQWlSRVFZaVFJQ1JGUWZMbHl3Y2tSa0dnd1lJRkpFZEIyTERoQWlSSVFZaVFJQ1JKREF3TFFmLy8vd2NrUGtIajJ2NEhKRDlCZ09LUUJDUkFRUUFrUVVILy8vOEhKRUpCNDlyK0J5UkRRWURpa0FRa1JFRUFKRVZCLy8vL0J5UkdRZVBhL2dja1IwR0E0cEFFSkVoQkFDUkpEQXNMUWYvLy93Y2tQa0dFaWY0SEpEOUJ1dlRRQkNSQVFRQWtRVUgvLy84SEpFSkJzZjd2QXlSRFFZQ0lBaVJFUVFBa1JVSC8vLzhISkVaQi84dU9BeVJIUWY4QkpFaEJBQ1JKREFvTFFjWE4vd2NrUGtHRXVib0dKRDlCcWRhUkJDUkFRWWppNkFJa1FVSC8vLzhISkVKQjQ5citCeVJEUVlEaWtBUWtSRUVBSkVWQi8vLy9CeVJHUWVQYS9nY2tSMEdBNHBBRUpFaEJBQ1JKREFrTFFmLy8vd2NrUGtHQS9zc0NKRDlCZ0lUOUJ5UkFRUUFrUVVILy8vOEhKRUpCZ1A3TEFpUkRRWUNFL1Fja1JFRUFKRVZCLy8vL0J5UkdRWUQreXdJa1IwR0FoUDBISkVoQkFDUkpEQWdMUWYvLy93Y2tQa0d4L3U4REpEOUJ4Y2NCSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQmhJbitCeVJIUWJyMDBBUWtTRUVBSkVrTUJ3dEJBQ1ErUVlTSkFpUS9RWUM4L3dja1FFSC8vLzhISkVGQkFDUkNRWVNKQWlSRFFZQzgvd2NrUkVILy8vOEhKRVZCQUNSR1FZU0pBaVJIUVlDOC93Y2tTRUgvLy84SEpFa01CZ3RCcGYvL0J5UStRWlNwL2dja1AwSC9xZElFSkVCQkFDUkJRYVgvL3dja1FrR1VxZjRISkVOQi82blNCQ1JFUVFBa1JVR2wvLzhISkVaQmxLbitCeVJIUWYrcDBnUWtTRUVBSkVrTUJRdEIvLy8vQnlRK1FZRCsvd2NrUDBHQWdQd0hKRUJCQUNSQlFmLy8vd2NrUWtHQS92OEhKRU5CZ0lEOEJ5UkVRUUFrUlVILy8vOEhKRVpCZ1A3L0J5UkhRWUNBL0Fja1NFRUFKRWtNQkF0Qi8vLy9CeVErUVlEKy93Y2tQMEdBbE8wREpFQkJBQ1JCUWYvLy93Y2tRa0gveTQ0REpFTkIvd0VrUkVFQUpFVkIvLy8vQnlSR1FiSCs3d01rUjBHQWlBSWtTRUVBSkVrTUF3dEIvLy8vQnlRK1FmL0xqZ01rUDBIL0FTUkFRUUFrUVVILy8vOEhKRUpCaEluK0J5UkRRYnIwMEFRa1JFRUFKRVZCLy8vL0J5UkdRYkgrN3dNa1IwR0FpQUlrU0VFQUpFa01BZ3RCLy8vL0J5UStRZDZac2dRa1AwR01wY2tDSkVCQkFDUkJRZi8vL3dja1FrR0VpZjRISkVOQnV2VFFCQ1JFUVFBa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUFRdEIvLy8vQnlRK1FhWExsZ1VrUDBIU3BNa0NKRUJCQUNSQlFmLy8vd2NrUWtHbHk1WUZKRU5CMHFUSkFpUkVRUUFrUlVILy8vOEhKRVpCcGN1V0JTUkhRZEtreVFJa1NFRUFKRWtMQzlvSUFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZZ0JSd1JBSUFCQjRRQkdEUUVnQUVFVVJnMENJQUJCeGdCR0RRTWdBRUhaQUVZTkJDQUFRY1lCUmcwRUlBQkJoZ0ZHRFFVZ0FFR29BVVlOQlNBQVFiOEJSZzBHSUFCQnpnRkdEUVlnQUVIUkFVWU5CaUFBUWZBQlJnMEdJQUJCSjBZTkJ5QUFRY2tBUmcwSElBQkIzQUJHRFFjZ0FFR3pBVVlOQnlBQVFja0JSZzBJSUFCQjhBQkdEUWtnQUVIR0FFWU5DaUFBUWRNQlJnMExEQXdMUWYrNWxnVWtQa0dBL3Y4SEpEOUJnTVlCSkVCQkFDUkJRZis1bGdVa1FrR0EvdjhISkVOQmdNWUJKRVJCQUNSRlFmKzVsZ1VrUmtHQS92OEhKRWRCZ01ZQkpFaEJBQ1JKREFzTFFmLy8vd2NrUGtIL3k0NERKRDlCL3dFa1FFRUFKRUZCLy8vL0J5UkNRWVNKL2dja1EwRzY5TkFFSkVSQkFDUkZRZi8vL3dja1JrSC95NDRESkVkQi93RWtTRUVBSkVrTUNndEIvLy8vQnlRK1FZU0ovZ2NrUDBHNjlOQUVKRUJCQUNSQlFmLy8vd2NrUWtHeC91OERKRU5CZ0lnQ0pFUkJBQ1JGUWYvLy93Y2tSa0dFaWY0SEpFZEJ1dlRRQkNSSVFRQWtTUXdKQzBILzY5WUZKRDVCbFAvL0J5US9RY0swdFFVa1FFRUFKRUZCQUNSQ1FmLy8vd2NrUTBHRWlmNEhKRVJCdXZUUUJDUkZRUUFrUmtILy8vOEhKRWRCaEluK0J5UklRYnIwMEFRa1NRd0lDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FZRG0vUWNrUTBHQWhORUVKRVJCQUNSRlFmLy8vd2NrUmtILysrb0NKRWRCZ0lEOEJ5UklRZjhCSkVrTUJ3dEJuUC8vQnlRK1FmL3IwZ1FrUDBIenFJNERKRUJCdXZRQUpFRkJ3b3IvQnlSQ1FZQ3Mvd2NrUTBHQTlOQUVKRVJCZ0lDb0FpUkZRZi8vL3dja1JrR0VpZjRISkVkQnV2VFFCQ1JJUVFBa1NRd0dDMEdBL3E4REpENUIvLy8vQnlRL1FjcWsvUWNrUUVFQUpFRkIvLy8vQnlSQ1FmLy8vd2NrUTBIL3k0NERKRVJCL3dFa1JVSC8vLzhISkVaQjQ5citCeVJIUVlEaWtBUWtTRUVBSkVrTUJRdEIvN21XQlNRK1FZRCsvd2NrUDBHQXhnRWtRRUVBSkVGQjBzYjlCeVJDUVlDQTJBWWtRMEdBZ0l3REpFUkJBQ1JGUWY4QkpFWkIvLy8vQnlSSFFmdisvd2NrU0VIL2lRSWtTUXdFQzBITy8vOEhKRDVCNzkrUEF5US9RYkdJOGdRa1FFSGF0T2tDSkVGQi8vLy9CeVJDUVlEbS9RY2tRMEdBaE5FRUpFUkJBQ1JGUWYvLy93Y2tSa0gveTQ0REpFZEIvd0VrU0VFQUpFa01Bd3RCLy8vL0J5UStRWVNKL2dja1AwRzY5TkFFSkVCQkFDUkJRZi8vL3dja1FrR0EvZ01rUTBHQWlNWUJKRVJCZ0pRQkpFVkIvLy8vQnlSR1FmL0xqZ01rUjBIL0FTUklRUUFrU1F3Q0MwSC8vLzhISkQ1Qi84dU9BeVEvUWY4QkpFQkJBQ1JCUVlEKy93Y2tRa0dBZ1B3SEpFTkJnSUNNQXlSRVFRQWtSVUgvLy84SEpFWkJzZjd2QXlSSFFZQ0lBaVJJUVFBa1NRd0JDMEgvLy84SEpENUJoTnUyQlNRL1Fmdm1pUUlrUUVFQUpFRkIvLy8vQnlSQ1FlUGEvZ2NrUTBIajJ2NEhKRVJCQUNSRlFmLy8vd2NrUmtIL3k0NERKRWRCL3dFa1NFRUFKRWtMQzBvQkFuOUJBQkFpSTRFQ0JFQVBDeU9BQWdSQUk0RUNSUVJBRHdzTFFiUUNJUUFEUUFKQUlBQkJ3d0pLRFFBZ0FCQWRJQUZxSVFFZ0FFRUJhaUVBREFFTEN5QUJRZjhCY1JBakM5d0JBRUVBSk9zQlFRQWs3QUZCQUNUdEFVRUFKTzRCUVFBazd3RkJBQ1R3QVVFQUpQRUJRWkFCSk8wQkk0RUNCRUJCd2Y0RFFZRUJFQjlCeFA0RFFaQUJFQjlCeC80RFFmd0JFQjhGUWNIK0EwR0ZBUkFmUWNiK0EwSC9BUkFmUWNmK0EwSDhBUkFmUWNqK0EwSC9BUkFmUWNuK0EwSC9BUkFmQzBHUUFTVHRBVUhBL2dOQmtBRVFIMEhQL2dOQkFCQWZRZkQrQTBFQkVCOGpnQUlFUUNPQkFnUkFRUUFrN1FGQndQNERRUUFRSDBIQi9nTkJnQUVRSDBIRS9nTkJBQkFmQlVFQUpPMEJRY0QrQTBFQUVCOUJ3ZjREUVlRQkVCOExDeEFrQzIwQUk0RUNCRUJCNlA0RFFjQUJFQjlCNmY0RFFmOEJFQjlCNnY0RFFjRUJFQjlCNi80RFFRMFFId1ZCNlA0RFFmOEJFQjlCNmY0RFFmOEJFQjlCNnY0RFFmOEJFQjlCNi80RFFmOEJFQjhMSTRFQ1FRQWpnQUliQkVCQjZmNERRU0FRSDBIci9nTkJpZ0VRSHdzTFZnQkJrUDREUVlBQkVCOUJrZjREUWI4QkVCOUJrdjREUWZNQkVCOUJrLzREUWNFQkVCOUJsUDREUWI4QkVCOGpnQUlFUUVHUi9nTkJQeEFmUVpMK0EwRUFFQjlCay80RFFRQVFIMEdVL2dOQnVBRVFId3NMTEFCQmxmNERRZjhCRUI5Qmx2NERRVDhRSDBHWC9nTkJBQkFmUVpqK0EwRUFFQjlCbWY0RFFiZ0JFQjhMTXdCQm12NERRZjhBRUI5Qm0vNERRZjhCRUI5Qm5QNERRWjhCRUI5Qm5mNERRUUFRSDBHZS9nTkJ1QUVRSDBFQkpJWUJDeTBBUVovK0EwSC9BUkFmUWFEK0EwSC9BUkFmUWFIK0EwRUFFQjlCb3Y0RFFRQVFIMEdqL2dOQnZ3RVFId3RjQUNBQVFZQUJjVUVBUnlTdEFTQUFRY0FBY1VFQVJ5U3NBU0FBUVNCeFFRQkhKS3NCSUFCQkVIRkJBRWNrcWdFZ0FFRUljVUVBUnlTeEFTQUFRUVJ4UVFCSEpMQUJJQUJCQW5GQkFFY2tyd0VnQUVFQmNVRUFSeVN1QVF0RkFFRVBKSm9CUVE4a213RkJEeVNjQVVFUEpKMEJRUUFrbmdGQkFDU2ZBVUVBSktBQlFRQWtvUUZCL3dBa29nRkIvd0Frb3dGQkFTU2tBVUVCSktVQlFRQWtwZ0VMdlFFQVFRQWtwd0ZCQUNTb0FVRUFKS2tCUVFFa3FnRkJBU1NyQVVFQkpLd0JRUUVrclFGQkFTU3VBVUVCSks4QlFRRWtzQUZCQVNTeEFVRUJKTElCUVFBa3N3RkJBQ1MwQVVFQUpMVUJRUUFrdGdFUUp4QW9FQ2tRS2tHay9nTkI5d0FRSDBFSEpLZ0JRUWNrcVFGQnBmNERRZk1CRUI5Qjh3RVFLMEdtL2dOQjhRRVFIMEVCSkxJQkk0QUNCRUJCcFA0RFFRQVFIMEVBSktnQlFRQWtxUUZCcGY0RFFRQVFIMEVBRUN0QnB2NERRZkFBRUI5QkFDU3lBUXNRTEFzK0FDQUFRUUZ4UVFCSEpMb0JJQUJCQW5GQkFFY2t1d0VnQUVFRWNVRUFSeVM4QVNBQVFRaHhRUUJISkwwQklBQkJFSEZCQUVja3ZnRWdBQ1M1QVFzK0FDQUFRUUZ4UVFCSEpNQUJJQUJCQW5GQkFFY2t3UUVnQUVFRWNVRUFSeVRDQVNBQVFRaHhRUUJISk1NQklBQkJFSEZCQUVja3hBRWdBQ1MvQVF0NEFFRUFKTVVCUVFBa3hnRkJBQ1RIQVVFQUpNb0JRUUFreXdGQkFDVE1BVUVBSk1nQlFRQWt5UUVqZ1FJRVFFR0UvZ05CSGhBZlFhQTlKTVlCQlVHRS9nTkJxd0VRSDBITTF3SWt4Z0VMUVlmK0EwSDRBUkFmUWZnQkpNd0JJNEFDQkVBamdRSkZCRUJCaFA0RFFRQVFIMEVFSk1ZQkN3c0xRd0JCQUNUTkFVRUFKTTRCSTRFQ0JFQkJndjREUWZ3QUVCOUJBQ1RQQVVFQUpOQUJRUUFrMFFFRlFZTCtBMEgrQUJBZlFRQWt6d0ZCQVNUUUFVRUFKTkVCQ3d0MUFDT0JBZ1JBUWZEK0EwSDRBUkFmUWMvK0EwSCtBUkFmUWMzK0EwSCtBQkFmUVlEK0EwSFBBUkFmUVkvK0EwSGhBUkFmUWV6K0EwSCtBUkFmUWZYK0EwR1BBUkFmQlVIdy9nTkIvd0VRSDBIUC9nTkIvd0VRSDBITi9nTkIvd0VRSDBHQS9nTkJ6d0VRSDBHUC9nTkI0UUVRSHdzTGxnRUJBWDlCd3dJUUhTSUFRY0FCUmdSL1FRRUZJQUJCZ0FGR1FRQWpOUnNMQkVCQkFTU0JBZ1ZCQUNTQkFndEJBQ1NZQWtHQXFOYTVCeVNTQWtFQUpKTUNRUUFrbEFKQmdLald1UWNrbFFKQkFDU1dBa0VBSkpjQ0l6UUVRRUVCSklBQ0JVRUFKSUFDQ3hBZUVDQVFJUkFsRUNZUUxVRUFFQzVCLy84REk3a0JFQjlCNFFFUUwwR1AvZ01qdndFUUh4QXdFREVRTWd0S0FDQUFRUUJLSkRRZ0FVRUFTaVExSUFKQkFFb2tOaUFEUVFCS0pEY2dCRUVBU2lRNElBVkJBRW9rT1NBR1FRQktKRG9nQjBFQVNpUTdJQWhCQUVva1BDQUpRUUJLSkQwUU13c0ZBQ09ZQWd1NUFRQkJnQWdqZ3dJNkFBQkJnUWdqaEFJNkFBQkJnZ2dqaFFJNkFBQkJnd2dqaGdJNkFBQkJoQWdqaHdJNkFBQkJoUWdqaUFJNkFBQkJoZ2dqaVFJNkFBQkJod2dqaWdJNkFBQkJpQWdqaXdJN0FRQkJpZ2dqakFJN0FRQkJqQWdqalFJMkFnQkJrUWdqamdKQkFFYzZBQUJCa2dnamp3SkJBRWM2QUFCQmt3Z2prQUpCQUVjNkFBQkJsQWdqa1FKQkFFYzZBQUJCbFFnamdBSkJBRWM2QUFCQmxnZ2pnUUpCQUVjNkFBQkJsd2dqZ2dKQkFFYzZBQUFMYUFCQnlBa2o4Z0U3QVFCQnlna2o4d0U3QVFCQnpBa2o5QUZCQUVjNkFBQkJ6UWtqOVFGQkFFYzZBQUJCemdrajlnRkJBRWM2QUFCQnp3a2o5d0ZCQUVjNkFBQkIwQWtqK0FGQkFFYzZBQUJCMFFraitRRkJBRWM2QUFCQjBna2orZ0ZCQUVjNkFBQUxOUUJCK2dranhRRTJBZ0JCL2dranhnRTJBZ0JCZ2dvanlBRkJBRWM2QUFCQmhRb2p5UUZCQUVjNkFBQkJoZjRESThjQkVCOExZd0JCM2dvaldFRUFSem9BQUVIZkNpTmJOZ0lBUWVNS0kxdzJBZ0JCNXdvalhqWUNBRUhzQ2lOZk5nSUFRZkVLSTJBNkFBQkI4Z29qWVRvQUFFSDNDaU5pUVFCSE9nQUFRZmdLSTJNMkFnQkIvUW9qWkRzQkFFSC9DaU5kUVFCSE9nQUFDMGdBUVpBTEkyOUJBRWM2QUFCQmtRc2pjallDQUVHVkN5TnpOZ0lBUVprTEkzVTJBZ0JCbmdzamRqWUNBRUdqQ3lOM09nQUFRYVFMSTNnNkFBQkJwUXNqZEVFQVJ6b0FBQXRIQUVIMEN5T1JBVUVBUnpvQUFFSDFDeU9UQVRZQ0FFSDVDeU9VQVRZQ0FFSDlDeU9XQVRZQ0FFR0NEQ09YQVRZQ0FFR0hEQ09aQVRzQkFFR0pEQ09WQVVFQVJ6b0FBQXVIQVFBUU5rR3lDQ1BzQVRZQ0FFRzJDQ1BoQVRvQUFFSEUvZ01qN1FFUUgwSGtDQ08zQVVFQVJ6b0FBRUhsQ0NPNEFVRUFSem9BQUJBM0VEaEJyQW9qc3dFMkFnQkJzQW9qdEFFNkFBQkJzUW9qdFFFNkFBQVFPUkE2UWNJTEkzOUJBRWM2QUFCQnd3c2pnZ0UyQWdCQnh3c2pnd0UyQWdCQnl3c2poQUU3QVFBUU8wRUFKSmdDQzdrQkFFR0FDQzBBQUNTREFrR0JDQzBBQUNTRUFrR0NDQzBBQUNTRkFrR0RDQzBBQUNTR0FrR0VDQzBBQUNTSEFrR0ZDQzBBQUNTSUFrR0dDQzBBQUNTSkFrR0hDQzBBQUNTS0FrR0lDQzhCQUNTTEFrR0tDQzhCQUNTTUFrR01DQ2dDQUNTTkFrR1JDQzBBQUVFQVNpU09Ba0dTQ0MwQUFFRUFTaVNQQWtHVENDMEFBRUVBU2lTUUFrR1VDQzBBQUVFQVNpU1JBa0dWQ0MwQUFFRUFTaVNBQWtHV0NDMEFBRUVBU2lTQkFrR1hDQzBBQUVFQVNpU0NBZ3RlQVFGL1FRQWs3QUZCQUNUdEFVSEUvZ05CQUJBZlFjSCtBeEFkUVh4eElRRkJBQ1RoQVVIQi9nTWdBUkFmSUFBRVFBSkFRUUFoQUFOQUlBQkJnTmdGVGcwQklBQkJnTWtGYWtIL0FUb0FBQ0FBUVFGcUlRQU1BQUFMQUFzTEM0SUJBUUYvSStNQklRRWdBRUdBQVhGQkFFY2s0d0VnQUVIQUFIRkJBRWNrNUFFZ0FFRWdjVUVBUnlUbEFTQUFRUkJ4UVFCSEpPWUJJQUJCQ0hGQkFFY2s1d0VnQUVFRWNVRUFSeVRvQVNBQVFRSnhRUUJISk9rQklBQkJBWEZCQUVjazZnRWo0d0ZGUVFBZ0FSc0VRRUVCRUQ0TFFRQWo0d0VnQVJzRVFFRUFFRDRMQ3lvQVFlUUlMUUFBUVFCS0pMY0JRZVVJTFFBQVFRQktKTGdCUWYvL0F4QWRFQzVCai80REVCMFFMd3RvQUVISUNTOEJBQ1R5QVVIS0NTOEJBQ1R6QVVITUNTMEFBRUVBU2lUMEFVSE5DUzBBQUVFQVNpVDFBVUhPQ1MwQUFFRUFTaVQyQVVIUENTMEFBRUVBU2lUM0FVSFFDUzBBQUVFQVNpVDRBVUhSQ1MwQUFFRUFTaVQ1QVVIU0NTMEFBRUVBU2lUNkFRdEhBRUg2Q1NnQ0FDVEZBVUgrQ1NnQ0FDVEdBVUdDQ2kwQUFFRUFTaVRJQVVHRkNpMEFBRUVBU2lUSkFVR0YvZ01RSFNUSEFVR0cvZ01RSFNUS0FVR0gvZ01RSFNUTUFRc0hBRUVBSkxZQkMyTUFRZDRLTFFBQVFRQktKRmhCM3dvb0FnQWtXMEhqQ2lnQ0FDUmNRZWNLS0FJQUpGNUI3QW9vQWdBa1gwSHhDaTBBQUNSZ1FmSUtMUUFBSkdGQjl3b3RBQUJCQUVva1lrSDRDaWdDQUNSalFmMEtMd0VBSkdSQi93b3RBQUJCQUVva1hRdElBRUdRQ3kwQUFFRUFTaVJ2UVpFTEtBSUFKSEpCbFFzb0FnQWtjMEdaQ3lnQ0FDUjFRWjRMS0FJQUpIWkJvd3N0QUFBa2QwR2tDeTBBQUNSNFFiRUxMUUFBUVFCS0pIUUxSd0JCOUFzdEFBQkJBRW9ra1FGQjlRc29BZ0Fra3dGQitRc29BZ0FrbEFGQi9Rc29BZ0FrbGdGQmdnd29BZ0FrbHdGQmh3d3ZBUUFrbVFGQmlRd3RBQUJCQUVva2xRRUx6QUVCQVg4UVBVR3lDQ2dDQUNUc0FVRzJDQzBBQUNUaEFVSEUvZ01RSFNUdEFVSEEvZ01RSFJBL0VFQkJnUDRERUIxQi93RnpKTm9CSTlvQklnQkJFSEZCQUVjazJ3RWdBRUVnY1VFQVJ5VGNBUkJCRUVKQnJBb29BZ0Frc3dGQnNBb3RBQUFrdEFGQnNRb3RBQUFrdFFGQkFDUzJBUkJFRUVWQndnc3RBQUJCQUVva2YwSERDeWdDQUNTQ0FVSEhDeWdDQUNTREFVSExDeThCQUNTRUFSQkdRUUFrbUFKQmdLald1UWNra2dKQkFDU1RBa0VBSkpRQ1FZQ28xcmtISkpVQ1FRQWtsZ0pCQUNTWEFnc0ZBQ09CQWdzRkFDT1ZBZ3NGQUNPV0Fnc0ZBQ09YQWd1eUFnRUdmeU5MSWdVZ0FFWkJBQ05LSUFSR1FRQWdBRUVJU2tFQUlBRkJBRW9iR3hzRVFDQURRUUZyRUIxQklIRkJBRWNoQ0NBREVCMUJJSEZCQUVjaENVRUFJUU1EUUNBRFFRaElCRUJCQnlBRGF5QURJQWdnQ1VjYklnY2dBR29pQTBHZ0FVd0VRQ0FCUWFBQmJDQURha0VEYkVHQXlRVnFJZ1F0QUFBaENpQUVJQW82QUFBZ0FVR2dBV3dnQTJwQkEyeEJnY2tGYWlBRUxRQUJPZ0FBSUFGQm9BRnNJQU5xUVFOc1FZTEpCV29nQkMwQUFqb0FBQ0FCUWFBQmJDQURha0dBa1FScUlBQkJBQ0FIYTJzZ0FVR2dBV3hxUWZpUUJHb3RBQUFpQTBFRGNTSUVRUVJ5SUFRZ0EwRUVjUnM2QUFBZ0JrRUJhaUVHQ3lBSFFRRnFJUU1NQVFzTEJTQUVKRW9MSUFBZ0JVNEVRQ0FBUVFocUlnRWdBa0VIY1NJQ2FpQUJJQUFnQWtnYklRVUxJQVVrU3lBR0N5a0FJQUJCZ0pBQ1JnUkFJQUZCZ0FGcklBRkJnQUZxSUFGQmdBRnhHeUVCQ3lBQlFRUjBJQUJxQzBvQUlBQkJBM1FnQVVFQmRHb2lBRUVCYWtFL2NTSUJRVUJySUFFZ0FodEJnSkFFYWkwQUFDRUJJQUJCUDNFaUFFRkFheUFBSUFJYlFZQ1FCR290QUFBZ0FVSC9BWEZCQ0hSeUM4Z0JBQ0FCRUIwZ0FFRUJkSFZCQTNFaEFDQUJRY2orQTBZRVFDTkNJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalF5RUJEQUlMSTBRaEFRd0JDeU5GSVFFTEJTQUJRY24rQTBZRVFDTkdJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalJ5RUJEQUlMSTBnaEFRd0JDeU5KSVFFTEJTTStJUUVDUUNBQVJRMEFBa0FDUUFKQUFrQWdBRUVCYXc0REFRSURBQXNNQXdzalB5RUJEQUlMSTBBaEFRd0JDeU5CSVFFTEN3c2dBUXVNQXdFR2Z5QUJJQUFRVFNBRlFRRjBhaUlBUVlDUWZtb2dBa0VCY1VFTmRDSUJhaTBBQUNFUklBQkJnWkIrYWlBQmFpMEFBQ0VTSUFNaEFBTkFJQUFnQkV3RVFDQUFJQU5ySUFacUlnNGdDRWdFUUVFQUlRVUNmMEVCUVFjZ0FHc2dBRUVCSUF0QklIRkZJQXRCQUVnYkd5SUJkQ0FTY1FSQVFRSWhCUXNnQlVFQmFnc2dCVUVCSUFGMElCRnhHeUVDSTRFQ0JIOUJBU0FNUVFCT0lBdEJBRTRiQlVFQUN3Ui9JQXRCQjNFaEFTQU1RUUJPSWdVRVFDQU1RUWR4SVFFTElBRWdBaUFGRUU0aUJVRWZjVUVEZENFQklBVkI0QWR4UVFWMVFRTjBJUThnQlVHQStBRnhRUXAxUVFOMEJTQUNRY2YrQXlBS0lBcEJBRXdiSWdvUVR5SUZRWUNBL0FkeFFSQjFJUUVnQlVHQS9nTnhRUWgxSVE4Z0JVSC9BWEVMSVFVZ0J5QUliQ0FPYWtFRGJDQUphaUlRSUFFNkFBQWdFRUVCYWlBUE9nQUFJQkJCQW1vZ0JUb0FBQ0FIUWFBQmJDQU9ha0dBa1FScUlBSkJBM0VpQVVFRWNpQUJJQXRCZ0FGeFFRQWdDMEVBVGhzYk9nQUFJQTFCQVdvaERRc2dBRUVCYWlFQURBRUxDeUFOQzM0QkEzOGdBMEVIY1NFRFFRQWdBaUFDUVFOMVFRTjBheUFBR3lFSFFhQUJJQUJyUVFjZ0FFRUlha0dnQVVvYklRaEJmeUVDSTRFQ0JFQWdCRUdBMEg1cUxRQUFJZ0pCQ0hGQkFFY2hDU0FDUWNBQWNRUkFRUWNnQTJzaEF3c0xJQVlnQlNBSklBY2dDQ0FESUFBZ0FVR2dBVUdBeVFWQkFDQUNRWDhRVUF1aEFnRUJmeUFEUVFkeElRTWdCU0FHRUUwZ0JFR0EwSDVxTFFBQUlnUkJ3QUJ4Qkg5QkJ5QURhd1VnQXd0QkFYUnFJZ1ZCZ0pCK2FpQUVRUWh4UVFCSElnWkJEWFJxTFFBQUlRY2dBa0VIY1NFRFFRQWhBaUFCUWFBQmJDQUFha0VEYkVHQXlRVnFJQVJCQjNFQ2Z5QUZRWUdRZm1vZ0JrRUJjVUVOZEdvdEFBQkJBU0FEUVFjZ0Eyc2dCRUVnY1JzaUEzUnhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdBM1FnQjNFYklnTkJBQkJPSWdKQkgzRkJBM1E2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FlQUhjVUVGZFVFRGREb0FBQ0FCUWFBQmJDQUFha0VEYkVHQ3lRVnFJQUpCZ1BnQmNVRUtkVUVEZERvQUFDQUJRYUFCYkNBQWFrR0FrUVJxSUFOQkEzRWlBRUVFY2lBQUlBUkJnQUZ4R3pvQUFBdkVBUUFnQkNBRkVFMGdBMEVIY1VFQmRHb2lCRUdBa0g1cUxRQUFJUVZCQUNFRElBRkJvQUZzSUFCcVFRTnNRWURKQldvQ2Z5QUVRWUdRZm1vdEFBQkJBVUVISUFKQkIzRnJJZ0owY1FSQVFRSWhBd3NnQTBFQmFnc2dBMEVCSUFKMElBVnhHeUlEUWNmK0F4QlBJZ0pCZ0lEOEIzRkJFSFU2QUFBZ0FVR2dBV3dnQUdwQkEyeEJnY2tGYWlBQ1FZRCtBM0ZCQ0hVNkFBQWdBVUdnQVd3Z0FHcEJBMnhCZ3NrRmFpQUNPZ0FBSUFGQm9BRnNJQUJxUVlDUkJHb2dBMEVEY1RvQUFBdlVBUUVHZnlBRFFRTjFJUW9EUUNBRVFhQUJTQVJBSUFRZ0JXb2lCa0dBQWs0RVFDQUdRWUFDYXlFR0N5QUtRUVYwSUFKcUlBWkJBM1ZxSWdoQmdKQithaTBBQUNFSFFRQWhDU004QkVBZ0JDQUFJQVlnQ0NBSEVFd2lDMEVBU2dSQVFRRWhDU0FMUVFGcklBUnFJUVFMQ3lBSlJVRUFJenNiQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJSSWdaQkFFb0VRQ0FHUVFGcklBUnFJUVFMQlNBSlJRUkFJNEVDQkVBZ0JDQUFJQVlnQXlBSUlBRWdCeEJTQlNBRUlBQWdCaUFESUFFZ0J4QlRDd3NMSUFSQkFXb2hCQXdCQ3dzTE1nRURmeVB3QVNFRElBQWo4UUVpQkVnRVFBOExRUUFnQTBFSGF5SURheUVGSUFBZ0FTQUNJQUFnQkdzZ0F5QUZFRlFMb0FVQkQzOENRRUVuSVFZRFFDQUdRUUJJRFFFZ0JrRUNkQ0lGUVlEOEEyb2lBeEFkSVFJZ0EwRUJhaEFkSVFjZ0EwRUNhaEFkSVFNZ0FrRVFheUVFSUFkQkNHc2hDMEVJSVFJZ0FRUkFRUkFoQWlBRElBTkJBWEZySVFNTElBQWdBaUFFYWtoQkFDQUFJQVJPR3dSQUlBVkJnL3dEYWhBZElnVkJnQUZ4UVFCSElRd2dCVUVnY1VFQVJ5RU5RWUNBQWlBREVFMGdBaUFBSUFScklnTnJRUUZySUFNZ0JVSEFBSEViUVFGMGFpSURRWUNRZm1vZ0JVRUljVUVBUnlPQkFpSUNJQUliUVFGeFFRMTBJZ0pxTFFBQUlRNGdBMEdCa0g1cUlBSnFMUUFBSVE5QkJ5RURBMEFnQTBFQVRnUkFRUUFoQWdKL1FRRkJBQ0FEUVFkcmF5QURJQTBiSWdSMElBOXhCRUJCQWlFQ0N5QUNRUUZxQ3lBQ1FRRWdCSFFnRG5FYklnUUVRRUVISUFOcklBdHFJZ0pCQUU0RWZ5QUNRYUFCVEFWQkFBc0VRRUVBSVFkQkFDRUtJK29CUlNPQkFpSUlJQWdiSWdoRkJFQWdBRUdnQVd3Z0FtcEJnSkVFYWkwQUFDSUpJUkFnQ1VFRGNTSUpRUUJMUVFBZ0RCc0VRRUVCSVFjRlFRRkJBQ0FKUVFCTFFRQWdFRUVFY1VFQUk0RUNHeHNiSVFvTEMwRUJRUUFnQ2tVZ0J4c2dDQnNFUUNPQkFnUkFJQUJCb0FGc0lBSnFRUU5zUVlESkJXb2dCVUVIY1NBRVFRRVFUaUlFUVI5eFFRTjBPZ0FBSUFCQm9BRnNJQUpxUVFOc1FZSEpCV29nQkVIZ0IzRkJCWFZCQTNRNkFBQWdBRUdnQVd3Z0FtcEJBMnhCZ3NrRmFpQUVRWUQ0QVhGQkNuVkJBM1E2QUFBRklBQkJvQUZzSUFKcVFRTnNRWURKQldvZ0JFSEovZ05CeVA0RElBVkJFSEViRUU4aUJFR0FnUHdIY1VFUWRUb0FBQ0FBUWFBQmJDQUNha0VEYkVHQnlRVnFJQVJCZ1A0RGNVRUlkVG9BQUNBQVFhQUJiQ0FDYWtFRGJFR0N5UVZxSUFRNkFBQUxDd3NMSUFOQkFXc2hBd3dCQ3dzTElBWkJBV3NoQmd3QUFBc0FDd3RrQVFGL1FZQ0FBa0dBa0FJajVnRWJJUUZCQVNQcUFTT0JBaHNFUUNBQUlBRkJnTGdDUVlDd0FpUG5BUnNqN3dFZ0FHcEIvd0Z4UVFBajdnRVFWQXNqNVFFRVFDQUFJQUZCZ0xnQ1FZQ3dBaVBrQVJzUVZRc2o2UUVFUUNBQUkrZ0JFRllMQ3lVQkFYOENRQU5BSUFCQmtBRktEUUVnQUVIL0FYRVFWeUFBUVFGcUlRQU1BQUFMQUFzTFJnRUNmd05BSUFGQmtBRk9SUVJBUVFBaEFBTkFJQUJCb0FGSUJFQWdBVUdnQVd3Z0FHcEJnSkVFYWtFQU9nQUFJQUJCQVdvaEFBd0JDd3NnQVVFQmFpRUJEQUVMQ3dzYkFFR1AvZ01RSFVFQklBQjBjaUlBSkw4QlFZLytBeUFBRUI4TEN3QkJBU1RCQVVFQkVGb0xMZ0VCZndKL0kzVWlBRUVBU2dSL0kyMEZRUUFMQkVBZ0FFRUJheUVBQ3lBQVJRc0VRRUVBSkc4TElBQWtkUXN3QVFGL0FuOGpnd0VpQUVFQVNnUi9JMzBGUVFBTEJFQWdBRUVCYXlFQUN5QUFSUXNFUUVFQUpIOExJQUFrZ3dFTE1nRUJmd0ovSTVZQklnQkJBRW9FZnlPUUFRVkJBQXNFUUNBQVFRRnJJUUFMSUFCRkN3UkFRUUFra1FFTElBQWtsZ0VMUndFQ2Z5QUFKR1JCbFA0REVCMUIrQUZ4SVFGQmsvNERJQUJCL3dGeElnSVFIMEdVL2dNZ0FTQUFRUWgxUVFkeElnQnlFQjhnQWlSVklBQWtWeU5WSTFkQkNIUnlKRm9Mb2dFQkFuOGpZa1ZCQVNOWUd3UkFEd3NqWTBFQmF5SUFRUUJNQkVBalRRUkFJMDBrWXdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDeUlBUWY4UFNnMEFHa0VBQ3dSQVFRQWtXQXNqVDBFQVNnUkFJQUFRWHdKL0kyUWlBU05QZFNFQVFRRWpUZ1IvUVFFa1pTQUJJQUJyQlNBQUlBRnFDMEgvRDBvTkFCcEJBQXNFUUVFQUpGZ0xDd1ZCQ0NSakN3VWdBQ1JqQ3d0VEFRSi9JMXhCQVdzaUFVRUFUQVJBSTFRRVFDTlVJZ0VFZnlOZEJVRUFDd1JBSTE4aEFDQUFRUUZxSUFCQkFXc2pVeHRCRDNFaUFFRVBTQVJBSUFBa1h3VkJBQ1JkQ3dzRlFRZ2hBUXNMSUFFa1hBdFRBUUovSTNOQkFXc2lBVUVBVEFSQUkyc0VRQ05ySWdFRWZ5TjBCVUVBQ3dSQUkzWWhBQ0FBUVFGcUlBQkJBV3NqYWh0QkQzRWlBRUVQU0FSQUlBQWtkZ1ZCQUNSMEN3c0ZRUWdoQVFzTElBRWtjd3RjQVFKL0k1UUJRUUZySWdGQkFFd0VRQ09NQVFSQUk0d0JJZ0VFZnlPVkFRVkJBQXNFUUNPWEFTRUFJQUJCQVdvZ0FFRUJheU9MQVJ0QkQzRWlBRUVQU0FSQUlBQWtsd0VGUVFBa2xRRUxDd1ZCQ0NFQkN3c2dBU1NVQVF1cEFnRUNmMEdBd0FBamdnSjBJZ0VoQWlPekFTQUFhaUlBSUFGT0JFQWdBQ0FDYXlTekFRSkFBa0FDUUFKQUFrQWp0UUZCQVdwQkIzRWlBQVJBSUFCQkFrWU5BUUpBSUFCQkJHc09CQU1BQkFVQUN3d0ZDeU5lSWdGQkFFb0VmeU5XQlVFQUN3UkFJQUZCQVdzaUFVVUVRRUVBSkZnTEN5QUJKRjRRWEJCZEVGNE1CQXNqWGlJQlFRQktCSDhqVmdWQkFBc0VRQ0FCUVFGcklnRkZCRUJCQUNSWUN3c2dBU1JlRUZ3UVhSQmVFR0FNQXdzalhpSUJRUUJLQkg4alZnVkJBQXNFUUNBQlFRRnJJZ0ZGQkVCQkFDUllDd3NnQVNSZUVGd1FYUkJlREFJTEkxNGlBVUVBU2dSL0kxWUZRUUFMQkVBZ0FVRUJheUlCUlFSQVFRQWtXQXNMSUFFa1hoQmNFRjBRWGhCZ0RBRUxFR0VRWWhCakN5QUFKTFVCUVFFUEJTQUFKTE1CQzBFQUMzUUJBWDhDUUFKQUFrQUNRQ0FBUVFGSEJFQUNRQ0FBUVFKckRnTUNBd1FBQ3d3RUN5TlpJZ0FqbmdGSElRRWdBQ1NlQVNBQkR3c2pjQ0lBSTU4QlJ5RUJJQUFrbndFZ0FROExJNEFCSWdBam9BRkhJUUVnQUNTZ0FTQUJEd3Nqa2dFaUFDT2hBVWNoQVNBQUpLRUJJQUVQQzBFQUMxVUFBa0FDUUFKQUlBQkJBVWNFUUNBQVFRSkdEUUVnQUVFRFJnMENEQU1MUVFFZ0FYUkJnUUZ4UVFCSER3dEJBU0FCZEVHSEFYRkJBRWNQQzBFQklBRjBRZjRBY1VFQVJ3OExRUUVnQVhSQkFYRkJBRWNMY3dFQmZ5TmJJQUJySVFBRFFDQUFRUUJNQkVCQmdCQWpXbXRCQW5RaUFVRUNkQ0FCSTRJQ0d5UmJJMXNnQUVFZmRTSUJJQUFnQVdwemF5RUFJMkZCQVdwQkIzRWtZUXdCQ3dzZ0FDUmJJMWxCQUNOWUd3Ui9JMTlCRDNFRlFROFBDeU5RSTJFUVpnUi9RUUVGUVg4TGJFRVBhZ3RzQVFGL0kzSWdBR3NoQUFOQUlBQkJBRXdFUUVHQUVDTnhhMEVDZENPQ0FuUWtjaU55SUFCQkgzVWlBU0FBSUFGcWMyc2hBQ040UVFGcVFRZHhKSGdNQVFzTElBQWtjaU53UVFBamJ4c0VmeU4yUVE5eEJVRVBEd3NqWnlONEVHWUVmMEVCQlVGL0MyeEJEMm9MRHdBamhBRkJBWFZCc1A0RGFoQWRDeXNCQVg4amhBRkJBV29oQUFOQUlBQkJJRWhGQkVBZ0FFRWdheUVBREFFTEN5QUFKSVFCRUdra2h3RUw1Z0VCQTM4amdBRkZRUUVqZnhzRVFFRVBEd3NqaFFFaEFpT0dBUVJBUVp6K0F4QWRRUVYxUVE5eElnSWtoUUZCQUNTR0FRc2pod0VqaEFGQkFYRkZRUUowZFVFUGNTRUJBa0FDUUFKQUFrQWdBZ1JBSUFKQkFVWU5BU0FDUVFKR0RRSU1Bd3NnQVVFRWRTRUJEQU1MUVFFaEF3d0NDeUFCUVFGMUlRRkJBaUVEREFFTElBRkJBblVoQVVFRUlRTUxJQU5CQUVvRWZ5QUJJQU50QlVFQUMwRVBhaUVCSTRJQklBQnJJUUFEUUNBQVFRQk1CRUJCZ0JBamdRRnJRUUYwSTRJQ2RDU0NBU09DQVNBQVFSOTFJZ0lnQUNBQ2FuTnJJUUFRYWd3QkN3c2dBQ1NDQVNBQkM0OEJBUUovSTVNQklBQnJJZ0JCQUV3RVFDT1lBU09OQVhRamdnSjBJQUJCSDNVaUFTQUFJQUZxYzJzaEFDT1pBU0lCUVFGMUlnSWdBVUVCY1NBQ1FRRnhjeUlCUVE1MGNpSUNRYjkvY1NBQlFRWjBjaUFDSTQ0Qkd5U1pBUXRCQUNBQUlBQkJBRWdiSkpNQkk1SUJRUUFqa1FFYkJIOGpsd0ZCRDNFRlFROFBDMEYvUVFFam1RRkJBWEViYkVFUGFnc3dBQ0FBUVR4R0JFQkIvd0FQQ3lBQVFUeHJRYUNOQm13Z0FXeEJBM1ZCb0kwR2JVRThha0dnalFac1FZenhBbTBMbHdFQkFYOUJBQ1NrQVNBQVFROGpxZ0ViSUFGQkR5T3JBUnRxSUFKQkR5T3NBUnRxSUFOQkR5T3RBUnRxSVFRZ0FFRVBJNjRCR3lBQlFROGpyd0ViYWlFQUlBQWdBa0VQSTdBQkcyb2hBU0FEUVE4anNRRWJJUU5CQUNTbEFVRUFKS1lCSUFRanFBRkJBV29RYlNFQUlBRWdBMm9qcVFGQkFXb1FiU0VCSUFBa29nRWdBU1NqQVNBQlFmOEJjU0FBUWY4QmNVRUlkSElML3dJQkJYOGpUQ0FBYWlJQ0pFd2pXeUFDYTBFQVRDSUNSUVJBUVFFUVpTRUNDeU5tSUFCcUlnRWtaaU55SUFGclFRQk1JZ0ZGQkVCQkFoQmxJUUVMSTNrZ0FHb2tlVUVBSTRJQkkzbHJRUUJLSTRZQkcwVWlCRVVFUUVFREVHVWhCQXNqaUFFZ0FHb2tpQUVqa3dFamlBRnJRUUJNSWdWRkJFQkJCQkJsSVFVTElBSUVRQ05NSVFOQkFDUk1JQU1RWnlTYUFRc2dBUVJBSTJZaEEwRUFKR1lnQXhCb0pKc0JDeUFFQkVBamVTRURRUUFrZVNBREVHc2tuQUVMSUFVRVFDT0lBU0VEUVFBa2lBRWdBeEJzSkowQkMwRUJJQVZCQVNBRVFRRWdBU0FDR3hzYkJFQkJBU1NtQVF0QmdJQ0FBaU9DQW5SQnhOZ0NiU0lDSVFFanRBRWdBR29pQUNBQ1RnUkFJQUFnQVdzaEFFRUJJNlVCUVFFanBBRWpwZ0ViR3dSQUk1b0JJNXNCSTV3Qkk1MEJFRzRhQlNBQUpMUUJDeU8yQVNJQ1FRRjBRWUNad1FCcUlnRWpvZ0ZCQW1vNkFBQWdBVUVCYWlPakFVRUNham9BQUNBQ1FRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDNlVEQVFaL0lBQVFaeUVCSUFBUWFDRUNJQUFRYXlFRUlBQVFiQ0VGSUFFa21nRWdBaVNiQVNBRUpKd0JJQVVrblFFanRBRWdBR29pQUVHQWdJQUNJNElDZEVIRTJBSnRUZ1JBSUFCQmdJQ0FBaU9DQW5SQnhOZ0NiV3NoQUNBQklBSWdCQ0FGRUc0aEF5TzJBVUVCZEVHQW1jRUFhaUlHSUFOQmdQNERjVUVJZFVFQ2Fqb0FBQ0FHUVFGcUlBTkIvd0Z4UVFKcU9nQUFJejBFUUNBQlFROUJEMEVQRUc0aEFTTzJBVUVCZEVHQW1TRnFJZ01nQVVHQS9nTnhRUWgxUVFKcU9nQUFJQU5CQVdvZ0FVSC9BWEZCQW1vNkFBQkJEeUFDUVE5QkR4QnVJUUVqdGdGQkFYUkJnSmtwYWlJQ0lBRkJnUDREY1VFSWRVRUNham9BQUNBQ1FRRnFJQUZCL3dGeFFRSnFPZ0FBUVE5QkR5QUVRUThRYmlFQkk3WUJRUUYwUVlDWk1Xb2lBaUFCUVlEK0EzRkJDSFZCQW1vNkFBQWdBa0VCYWlBQlFmOEJjVUVDYWpvQUFFRVBRUTlCRHlBRkVHNGhBU08yQVVFQmRFR0FtVGxxSWdJZ0FVR0EvZ054UVFoMVFRSnFPZ0FBSUFKQkFXb2dBVUgvQVhGQkFtbzZBQUFMSTdZQlFRRnFJZ0ZCLy84RFRnUi9JQUZCQVdzRklBRUxKTFlCQ3lBQUpMUUJDeDRCQVg4Z0FCQmtJUUVnQVVWQkFDTTZHd1JBSUFBUWJ3VWdBQkJ3Q3dzdkFRSi9RZGNBSTRJQ2RDRUJJNmNCSVFBRFFDQUFJQUZPQkVBZ0FSQnhJQUFnQVdzaEFBd0JDd3NnQUNTbkFRdWtBd0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQmxmNERSZzBCQWtBZ0FFR1IvZ05yRGhZR0N4QVVBQWNNRVJVRENBMFNGZ1FKRGhNWEJRb1BBQXNNRnd0QmtQNERFQjFCZ0FGeUR3dEJsZjRERUIxQi93RnlEd3RCbXY0REVCMUIvd0J5RHd0Qm4vNERFQjFCL3dGeUR3dEJwUDRERUIwUEMwR1IvZ01RSFVFL2NnOExRWmIrQXhBZFFUOXlEd3RCbS80REVCMUIvd0Z5RHd0Qm9QNERFQjFCL3dGeUR3dEJwZjRERUIwUEMwR1MvZ01RSFE4TFFaZitBeEFkRHd0Qm5QNERFQjFCbndGeUR3dEJvZjRERUIwUEMwR0FBVUVBSTdJQkd5RUFJQUJCQVhJZ0FFRitjU05ZR3lFQUlBQkJBbklnQUVGOWNTTnZHeUVBSUFCQkJISWdBRUY3Y1NOL0d5RUFJQUJCQ0hJZ0FFRjNjU09SQVJ0QjhBQnlEd3RCay80REVCMUIvd0Z5RHd0Qm1QNERFQjFCL3dGeUR3dEJuZjRERUIxQi93RnlEd3RCb3Y0REVCMFBDMEdVL2dNUUhVRy9BWElQQzBHWi9nTVFIVUcvQVhJUEMwR2UvZ01RSFVHL0FYSVBDMEdqL2dNUUhVRy9BWElQQzBGL0M1d0JBUUYvSTlvQklRQWoyd0VFUUNBQVFYdHhJQUJCQkhJajBnRWJJUUFnQUVGK2NTQUFRUUZ5STlVQkd5RUFJQUJCZDNFZ0FFRUljaVBUQVJzaEFDQUFRWDF4SUFCQkFuSWoxQUViSVFBRkk5d0JCRUFnQUVGK2NTQUFRUUZ5STlZQkd5RUFJQUJCZlhFZ0FFRUNjaVBYQVJzaEFDQUFRWHR4SUFCQkJISWoyQUViSVFBZ0FFRjNjU0FBUVFoeUk5a0JHeUVBQ3dzZ0FFSHdBWElMMUFJQUlBQkJnSUFDU0FSQVFYOFBDeUFBUVlEQUFraEJBQ0FBUVlDQUFrNGJCRUJCZnc4TElBQkJnUHdEU0VFQUlBQkJnTUFEVGhzRVFDQUFRWUJBYWhBZER3c2dBRUdmL1FOTVFRQWdBRUdBL0FOT0d3UkFRZjhCUVg4ajRRRkJBa2diRHdzZ0FFSE4vZ05HQkVCQi93RWhBRUhOL2dNUUhVRUJjVVVFUUVIK0FTRUFDeU9DQWtVRVFDQUFRZjkrY1NFQUN5QUFEd3NnQUVIRS9nTkdCRUFnQUNQdEFSQWZJKzBCRHdzZ0FFR20vZ05NUVFBZ0FFR1EvZ05PR3dSQUVISWdBQkJ6RHdzZ0FFR3YvZ05NUVFBZ0FFR24vZ05PR3dSQVFmOEJEd3NnQUVHLy9nTk1RUUFnQUVHdy9nTk9Hd1JBRUhJamZ3UkFFR2tQQzBGL0R3c2dBRUdFL2dOR0JFQWdBQ1BHQVVHQS9nTnhRUWgxSWdBUUh5QUFEd3NnQUVHRi9nTkdCRUFnQUNQSEFSQWZJOGNCRHdzZ0FFR1AvZ05HQkVBanZ3RkI0QUZ5RHdzZ0FFR0EvZ05HQkVBUWRBOExRWDhMS1FFQmZ5UGVBU0FBUmdSQVFRRWs0QUVMSUFBUWRTSUJRWDlHQkg4Z0FCQWRCU0FCUWY4QmNRc0xwQUlCQTM4ajlnRUVRQThMSS9jQklRTWorQUVoQWlBQVFmOC9UQVJBSUFJRWZ5QUJRUkJ4UlFWQkFBdEZCRUFnQVVFUGNTSUFCRUFnQUVFS1JnUkFRUUVrOUFFTEJVRUFKUFFCQ3dzRklBQkIvLzhBVEFSQUkvb0JJZ1FFZnlBQVFmL2ZBRXdGUVFFTEJFQWdBVUVQY1NQeUFTQUNHeUVBSUFNRWZ5QUJRUjl4SVFFZ0FFSGdBWEVGSS9rQkJIOGdBVUgvQUhFaEFTQUFRWUFCY1FWQkFDQUFJQVFiQ3dzaEFDQUFJQUZ5SlBJQkJTUHlBVUgvQVhFZ0FVRUFTa0VJZEhJazhnRUxCVUVBSUFCQi83OEJUQ0FDR3dSQUkvVUJRUUFnQXhzRVFDUHlBVUVmY1NBQlFlQUJjWElrOGdFUEN5QUJRUTl4SUFGQkEzRWorZ0ViSlBNQkJVRUFJQUJCLy84QlRDQUNHd1JBSUFNRVFDQUJRUUZ4UVFCSEpQVUJDd3NMQ3dzTE9BRUJmeU5PSVFFZ0FFSHdBSEZCQkhVa1RTQUFRUWh4UVFCSEpFNGdBRUVIY1NSUEkyVkJBQ05PUlVFQUlBRWJHd1JBUVFBa1dBc0xaUUFqV0FSQVFRQWpYU05VR3dSQUkxOUJBV3BCRDNFa1h3c2pVeUFBUVFoeFFRQkhSd1JBUVJBalgydEJEM0VrWHdzTElBQkJCSFZCRDNFa1VpQUFRUWh4UVFCSEpGTWdBRUVIY1NSVUlBQkIrQUZ4UVFCS0lnQWtXU0FBUlFSQVFRQWtXQXNMWlFBamJ3UkFRUUFqZENOckd3UkFJM1pCQVdwQkQzRWtkZ3NqYWlBQVFRaHhRUUJIUndSQVFSQWpkbXRCRDNFa2Rnc0xJQUJCQkhWQkQzRWthU0FBUVFoeFFRQkhKR29nQUVFSGNTUnJJQUJCK0FGeFFRQktJZ0FrY0NBQVJRUkFJQUFrYndzTGNnQWprUUVFUUVFQUk1VUJJNHdCR3dSQUk1Y0JRUUZxUVE5eEpKY0JDeU9MQVNBQVFRaHhRUUJIUndSQVFSQWpsd0ZyUVE5eEpKY0JDd3NnQUVFRWRVRVBjU1NLQVNBQVFRaHhRUUJISklzQklBQkJCM0VrakFFZ0FFSDRBWEZCQUVvaUFDU1NBU0FBUlFSQUlBQWtrUUVMQ3pnQUlBQkJCSFVralFFZ0FFRUljVUVBUnlTT0FTQUFRUWR4SWdBa2p3RWdBRUVCZENJQVFRRklCRUJCQVNFQUN5QUFRUU4wSkpnQkM2b0JBUUovUVFFa1dDTmVSUVJBUWNBQUpGNExRWUFRSTFwclFRSjBJZ0JCQW5RZ0FDT0NBaHNrV3lOVUJFQWpWQ1JjQlVFSUpGd0xRUUVrWFNOU0pGOGpXaVJrSTAwRVFDTk5KR01GUVFna1l3dEJBU05QUVFCS0lnQWpUVUVBU2hza1lrRUFKR1VnQUFSL0FuOGpaQ0lBSTA5MUlRRkJBU05PQkg5QkFTUmxJQUFnQVdzRklBQWdBV29MUWY4UFNnMEFHa0VBQ3dWQkFBc0VRRUVBSkZnTEkxbEZCRUJCQUNSWUN3dVNBUUVDZnlBQVFRZHhJZ0VrVnlOVklBRkJDSFJ5SkZvanRRRkJBWEZCQVVZaEFpTldSU0lCQkVBZ0FFSEFBSEZCQUVjaEFRc2dBa1VFUUVFQUlBRWpYa0VBVEJzRVFDTmVRUUZySkY1QkFDTmVSU0FBUVlBQmNSc0VRRUVBSkZnTEN3c2dBRUhBQUhGQkFFY2tWaUFBUVlBQmNRUkFFSDBqVmtFQVFRQWpYa0hBQUVZZ0Foc2JCRUFqWGtFQmF5UmVDd3NMUUFCQkFTUnZJM1ZGQkVCQndBQWtkUXRCZ0JBamNXdEJBblFqZ2dKMEpISWphd1JBSTJza2N3VkJDQ1J6QzBFQkpIUWphU1IySTNCRkJFQkJBQ1J2Q3d1U0FRRUNmeUFBUVFkeElnRWtiaU5zSUFGQkNIUnlKSEVqdFFGQkFYRkJBVVloQWlOdFJTSUJCRUFnQUVIQUFIRkJBRWNoQVFzZ0FrVUVRRUVBSUFFamRVRUFUQnNFUUNOMVFRRnJKSFZCQUNOMVJTQUFRWUFCY1JzRVFFRUFKRzhMQ3dzZ0FFSEFBSEZCQUVja2JTQUFRWUFCY1FSQUVIOGpiVUVBUVFBamRVSEFBRVlnQWhzYkJFQWpkVUVCYXlSMUN3c0xQUUJCQVNSL0k0TUJSUVJBUVlBQ0pJTUJDMEdBRUNPQkFXdEJBWFFqZ2dKMEpJSUJJNElCUVFacUpJSUJRUUFraEFFamdBRkZCRUJCQUNSL0N3dVBBUUVCZnlBQVFRZHhJZ0VrZmlOOElBRkJDSFJ5SklFQkk3VUJRUUZ4UVFGR0lnRkZCRUJCQUVFQUlBQkJ3QUJ4STMwYkk0TUJRUUJNR3dSQUk0TUJRUUZySklNQlFRQWpnd0ZGSUFCQmdBRnhHd1JBUVFBa2Z3c0xDeUFBUWNBQWNVRUFSeVI5SUFCQmdBRnhCRUFRZ1FFamZVRUFRUUFqZ3dGQmdBSkdJQUViR3dSQUk0TUJRUUZySklNQkN3c0xVZ0JCQVNTUkFTT1dBVVVFUUVIQUFDU1dBUXNqbUFFampRRjBJNElDZENTVEFTT01BUVJBSTR3QkpKUUJCVUVJSkpRQkMwRUJKSlVCSTRvQkpKY0JRZi8vQVNTWkFTT1NBVVVFUUVFQUpKRUJDd3VMQVFFQ2Z5TzFBVUVCY1VFQlJpRUNJNUFCUlNJQkJFQWdBRUhBQUhGQkFFY2hBUXNnQWtVRVFFRUFJQUVqbGdGQkFFd2JCRUFqbGdGQkFXc2tsZ0ZCQUNPV0FVVWdBRUdBQVhFYkJFQkJBQ1NSQVFzTEN5QUFRY0FBY1VFQVJ5U1FBU0FBUVlBQmNRUkFFSU1CSTVBQlFRQkJBQ09XQVVIQUFFWWdBaHNiQkVBamxnRkJBV3NrbGdFTEN3dWRCQUFqc2dGRlFRQWdBRUdtL2dOSEd3UkFRUUFQQ3dKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQmtQNERSd1JBSUFCQm12NERSZzBCQWtBZ0FFR1IvZ05yRGhZREJ3c1BBQVFJREJBQUJRa05FUUFHQ2c0U0V4UVZBQXNNRlFzZ0FSQjREQlVMUVFBZ0FVR0FBWEZCQUVjaUFDT0FBUnNFUUVFQUpJY0JDeUFBSklBQklBQkZCRUFnQUNSL0N3d1VDeUFCUVFaMVFRTnhKRkFnQVVFL2NTUlJRY0FBSTFGckpGNE1Fd3NnQVVFR2RVRURjU1JuSUFGQlAzRWthRUhBQUNOb2F5UjFEQklMSUFFa2VrR0FBaU42YXlTREFRd1JDeUFCUVQ5eEpJa0JRY0FBSTRrQmF5U1dBUXdRQ3lBQkVIa01Ed3NnQVJCNkRBNExRUUVraGdFZ0FVRUZkVUVQY1NSN0RBMExJQUVRZXd3TUN5QUJKRlVqVjBFSWRDQUJjaVJhREFzTElBRWtiQ051UVFoMElBRnlKSEVNQ2dzZ0FTUjhJMzVCQ0hRZ0FYSWtnUUVNQ1FzZ0FSQjhEQWdMSUFFUWZnd0hDeUFCRUlBQkRBWUxJQUVRZ2dFTUJRc2dBUkNFQVF3RUN5QUJRUVIxUVFkeEpLZ0JJQUZCQjNFa3FRRkJBU1NrQVF3REN5QUJFQ3RCQVNTbEFRd0NDeU95QVNJQUJIOUJBQVVnQVVHQUFYRUxCRUJCQnlTMUFVRUFKR0ZCQUNSNEN5QUJRWUFCY1VWQkFDQUFHd1JBQWtCQmtQNERJUUFEUUNBQVFhYitBMDROQVNBQVFRQVFrZ0VnQUVFQmFpRUFEQUFBQ3dBTEN5QUJRWUFCY1VFQVJ5U3lBUXdCQzBFQkR3dEJBUXM4QVFGL0lBQkJDSFFoQVVFQUlRQURRQUpBSUFCQm53RktEUUFnQUVHQS9BTnFJQUFnQVdvUUhSQWZJQUJCQVdvaEFBd0JDd3RCaEFVayt3RUxKUUVCZjBIUi9nTVFIU0VBUWRMK0F4QWRRZjhCY1NBQVFmOEJjVUVJZEhKQjhQOERjUXNwQVFGL1FkUCtBeEFkSVFCQjFQNERFQjFCL3dGeElBQkIvd0Z4UVFoMGNrSHdQM0ZCZ0lBQ2FndUdBUUVEZnlPQkFrVUVRQThMSUFCQmdBRnhSVUVBSS93Qkd3UkFRUUFrL0FGQjFmNERRZFgrQXhBZFFZQUJjaEFmRHdzUWh3RWhBUkNJQVNFQ0lBQkIvMzV4UVFGcVFRUjBJUU1nQUVHQUFYRUVRRUVCSlB3QklBTWsvUUVnQVNUK0FTQUNKUDhCUWRYK0F5QUFRZjkrY1JBZkJTQUJJQUlnQXhDVEFVSFYvZ05CL3dFUUh3c0xXUUVFZjBFQlFlditBeUlESUFCR0lBQkI2ZjREUmhzRVFDQUFRUUZySWdRUUhVRy9mM0VpQWtFL2NTSUZRVUJySUFVZ0FDQURSaHRCZ0pBRWFpQUJPZ0FBSUFKQmdBRnhCRUFnQkNBQ1FRRnFRWUFCY2hBZkN3c0xNUUFDUUFKQUFrQUNRQ0FBQkVBQ1FDQUFRUUZyRGdNQ0F3UUFDd3dFQzBFSkR3dEJBdzhMUVFVUEMwRUhEd3RCQUFzZkFDQUFRUUVqekFFUWl3RWlBSFJ4Qkg5QkFTQUFkQ0FCY1VVRlFRQUxDNFlCQVFSL0EwQWdBaUFBU0FSQUlBSkJCR29oQWlQR0FTSUJRUVJxUWYvL0EzRWlBeVRHQVNQTEFRUkFJOGtCSVFRanlBRUVRQ1BLQVNUSEFVRUJKTUlCUVFJUVdrRUFKTWdCUVFFa3lRRUZJQVFFUUVFQUpNa0JDd3NnQVNBREVJd0JCRUFqeHdGQkFXb2lBVUgvQVVvRVFFRUJKTWdCUVFBaEFRc2dBU1RIQVFzTERBRUxDd3NOQUNQRkFSQ05BVUVBSk1VQkMwWUJBWDhqeGdFaEFFRUFKTVlCUVlUK0EwRUFFQjhqeXdFRWZ5QUFRUUFRakFFRlFRQUxCRUFqeHdGQkFXb2lBRUgvQVVvRVFFRUJKTWdCUVFBaEFBc2dBQ1RIQVFzTGZBRURmeVBMQVNFQklBQkJCSEZCQUVja3l3RWdBRUVEY1NFQ0lBRkZCRUFqekFFUWl3RWhBU0FDRUlzQklRTWp4Z0VoQUNQTEFRUi9RUUVnQVhRZ0FIRUZRUUVnQTNRZ0FIRkJBRUVCSUFGMElBQnhHd3NFUUNQSEFVRUJhaUlBUWY4QlNnUkFRUUVreUFGQkFDRUFDeUFBSk1jQkN3c2dBaVRNQVF2SUJnRUJmd0pBQWtBZ0FFSE4vZ05HQkVCQnpmNERJQUZCQVhFUUh3d0JDeUFBUWREK0EwWkJBQ09BQWhzRVFFRUFKSUFDUWY4QkpJd0NEQUlMSUFCQmdJQUNTQVJBSUFBZ0FSQjNEQUVMSUFCQmdNQUNTRUVBSUFCQmdJQUNUaHNOQVNBQVFZRDhBMGhCQUNBQVFZREFBMDRiQkVBZ0FFR0FRR29nQVJBZkRBSUxJQUJCbi8wRFRFRUFJQUJCZ1B3RFRoc0VRQ1BoQVVFQ1RnOExJQUJCLy8wRFRFRUFJQUJCb1AwRFRoc05BQ0FBUVlMK0EwWUVRQ0FCUVFGeFFRQkhKTThCSUFGQkFuRkJBRWNrMEFFZ0FVR0FBWEZCQUVjazBRRkJBUThMSUFCQnB2NERURUVBSUFCQmtQNERUaHNFUUJCeUlBQWdBUkNGQVE4TElBQkJ2LzREVEVFQUlBQkJzUDREVGhzRVFCQnlJMzhFUUNPRUFVRUJkVUd3L2dOcUlBRVFId3dDQ3d3Q0N5QUFRY3YrQTB4QkFDQUFRY0QrQTA0YkJFQWdBRUhBL2dOR0JFQWdBUkEvREFNTElBQkJ3ZjREUmdSQVFjSCtBeUFCUWZnQmNVSEIvZ01RSFVFSGNYSkJnQUZ5RUI4TUFnc2dBRUhFL2dOR0JFQkJBQ1R0QVNBQVFRQVFId3dDQ3lBQVFjWCtBMFlFUUNBQkpPSUJEQU1MSUFCQnh2NERSZ1JBSUFFUWhnRU1Bd3NDUUFKQUFrQUNRQ0FBUWNQK0EwY0VRQ0FBUWNMK0Eyc09DZ0VFQkFRRUJBUUVBd0lFQ3lBQkpPNEJEQVlMSUFFazd3RU1CUXNnQVNUd0FRd0VDeUFCSlBFQkRBTUxEQUlMSUFCQjFmNERSZ1JBSUFFUWlRRU1BUXRCQVNBQVFjLytBMFlnQUVIdy9nTkdHd1JBSS93QkJFQWovZ0VpQWtHQWdBRk9CSDhnQWtILy93Rk1CVUVBQ3dSL1FRRUZJQUpCLzc4RFRFRUFJQUpCZ0tBRFRoc0xEUUlMQ3lBQVFlditBMHhCQUNBQVFlaitBMDRiQkVBZ0FDQUJFSW9CREFJTElBQkJoLzREVEVFQUlBQkJoUDREVGhzRVFCQ09BUUpBQWtBQ1FBSkFJQUJCaFA0RFJ3UkFJQUJCaGY0RGF3NERBUUlEQkFzUWp3RU1CUXNDUUNQTEFRUkFJOGtCRFFFanlBRUVRRUVBSk1nQkN3c2dBU1RIQVFzTUJRc2dBU1RLQVNQSkFVRUFJOHNCR3dSQUlBRWt4d0ZCQUNUSkFRc01CQXNnQVJDUUFRd0RDd3dDQ3lBQVFZRCtBMFlFUUNBQlFmOEJjeVRhQVNQYUFTSUNRUkJ4UVFCSEpOc0JJQUpCSUhGQkFFY2szQUVMSUFCQmovNERSZ1JBSUFFUUx3d0NDeUFBUWYvL0EwWUVRQ0FCRUM0TUFndEJBUThMUVFBUEMwRUJDeUFBSTk4QklBQkdCRUJCQVNUZ0FRc2dBQ0FCRUpFQkJFQWdBQ0FCRUI4TEMxd0JBMzhEUUFKQUlBTWdBazROQUNBQUlBTnFFSFloQlNBQklBTnFJUVFEUUNBRVFmKy9Ba3hGQkVBZ0JFR0FRR29oQkF3QkN3c2dCQ0FGRUpJQklBTkJBV29oQXd3QkN3c2ord0ZCSUNPQ0FuUWdBa0VFZFd4cUpQc0JDM1FCQW44ai9BRkZCRUFQQzBFUUlRQWovZ0VqL3dFQ2Z5UDlBU0lCUVJCSUJFQWdBU0VBQ3lBQUN4Q1RBU1ArQVNBQWFpVCtBU1AvQVNBQWFpVC9BU0FCSUFCcklnQWsvUUZCMWY0RElRRWdBRUVBVEFSQVFRQWsvQUVnQVVIL0FSQWZCU0FCSUFCQkJIVkJBV3RCLzM1eEVCOExDek1BSSswQkkrSUJSa0VBSUFCQkFVWkJBU0FBR3hzRVFDQUJRUVJ5SWdGQndBQnhCRUFRV3dzRklBRkJlM0VoQVFzZ0FRdUJBZ0VGZnlQakFVVUVRQThMSStFQklRQWdBQ1B0QVNJQ1FaQUJUZ1IvUVFFRlFmZ0NJNElDZENJQklRTWo3QUVpQkNBQlRnUi9RUUlGUVFOQkFDQUVJQU5PR3dzTElnRkhCRUJCd2Y0REVCMGhBQ0FCSk9FQlFRQWhBZ0pBQWtBQ1FBSkFJQUVFUUNBQlFRRnJEZ01CQWdNRUN5QUFRWHh4SWdCQkNIRkJBRWNoQWd3REN5QUFRWDF4UVFGeUlnQkJFSEZCQUVjaEFnd0NDeUFBUVg1eFFRSnlJZ0JCSUhGQkFFY2hBZ3dCQ3lBQVFRTnlJUUFMSUFJRVFCQmJDeUFCUlFSQUVKUUJDeUFCUVFGR0JFQkJBU1RBQVVFQUVGb0xRY0grQXlBQklBQVFsUUVRSHdVZ0FrR1pBVVlFUUVIQi9nTWdBVUhCL2dNUUhSQ1ZBUkFmQ3dzTG9BRUJBWDhqNHdFRVFDUHNBU0FBYWlUc0FTTTVJUUVEUUNQc0FVRUVJNElDSWdCMFFjZ0RJQUIwSSswQlFaa0JSaHRPQkVBajdBRkJCQ09DQWlJQWRFSElBeUFBZENQdEFVR1pBVVliYXlUc0FTUHRBU0lBUVpBQlJnUkFJQUVFUUJCWUJTQUFFRmNMRUZsQmZ5UktRWDhrU3dVZ0FFR1FBVWdFUUNBQlJRUkFJQUFRVndzTEMwRUFJQUJCQVdvZ0FFR1pBVW9iSk8wQkRBRUxDd3NRbGdFTE9BRUJmMEVFSTRJQ0lnQjBRY2dESUFCMEkrMEJRWmtCUmhzaEFBTkFJK3NCSUFCT0JFQWdBQkNYQVNQckFTQUFheVRyQVF3QkN3c0xzZ0VCQTM4ajBRRkZCRUFQQ3dOQUlBTWdBRWdFUUNBRFFRUnFJUU1DZnlQTkFTSUNRUVJxSWdGQi8vOERTZ1JBSUFGQmdJQUVheUVCQ3lBQkN5VE5BU0FDUVFGQkFrRUhJOUFCR3lJQ2RIRUVmMEVCSUFKMElBRnhSUVZCQUFzRVFFR0IvZ05CZ2Y0REVCMUJBWFJCQVdwQi93RnhFQjhqemdGQkFXb2lBVUVJUmdSQVFRQWt6Z0ZCQVNUREFVRURFRnBCZ3Y0RFFZTCtBeEFkUWY5K2NSQWZRUUFrMFFFRklBRWt6Z0VMQ3d3QkN3c0xsUUVBSS9zQlFRQktCRUFqK3dFZ0FHb2hBRUVBSlBzQkN5T05BaUFBYWlTTkFpT1JBa1VFUUNNM0JFQWo2d0VnQUdvazZ3RVFtQUVGSUFBUWx3RUxJellFUUNPbkFTQUFhaVNuQVJCeUJTQUFFSEVMSUFBUW1RRUxJemdFUUNQRkFTQUFhaVRGQVJDT0FRVWdBQkNOQVFzamxBSWdBR29pQUNPU0FrNEVRQ09UQWtFQmFpU1RBaUFBSTVJQ2F5RUFDeUFBSkpRQ0N3d0FRUVFRbWdFampBSVFIUXNwQVFGL1FRUVFtZ0VqakFKQkFXcEIvLzhEY1JBZElRQVFtd0ZCL3dGeElBQkIvd0Z4UVFoMGNnc09BRUVFRUpvQklBQWdBUkNTQVFzd0FFRUJJQUIwUWY4QmNTRUFJQUZCQUVvRVFDT0tBaUFBY2tIL0FYRWtpZ0lGSTRvQ0lBQkIvd0Z6Y1NTS0Fnc0xDUUJCQlNBQUVKNEJDem9CQVg4Z0FVRUFUZ1JBSUFCQkQzRWdBVUVQY1dwQkVIRkJBRWNRbndFRklBRkJIM1VpQWlBQklBSnFjMEVQY1NBQVFROXhTeENmQVFzTENRQkJCeUFBRUo0QkN3a0FRUVlnQUJDZUFRc0pBRUVFSUFBUW5nRUxQd0VDZnlBQlFZRCtBM0ZCQ0hVaEFpQUJRZjhCY1NJQklRTWdBQ0FCRUpFQkJFQWdBQ0FERUI4TElBQkJBV29pQUNBQ0VKRUJCRUFnQUNBQ0VCOExDdzRBUVFnUW1nRWdBQ0FCRUtRQkMxb0FJQUlFUUNBQVFmLy9BM0VpQUNBQmFpQUFJQUZ6Y3lJQVFSQnhRUUJIRUo4QklBQkJnQUp4UVFCSEVLTUJCU0FBSUFGcVFmLy9BM0VpQWlBQVFmLy9BM0ZKRUtNQklBQWdBWE1nQW5OQmdDQnhRUUJIRUo4QkN3c0xBRUVFRUpvQklBQVFkZ3VwQlFFQmZ3SkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09EZ01FQlFZSENBa0tDd3dORGc4UUFBc01FQXNNRlFzUW5BRkIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2hBSWdBRUgvQVhFa2hRSU1Ed3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSElqZ3dJUW5RRU1Fd3NqaFFKQi93RnhJNFFDUWY4QmNVRUlkSEpCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraEFJTUV3c2poQUlpQUVFQkVLQUJJQUJCQVdwQi93RnhJZ0FraEFJTURRc2poQUlpQUVGL0VLQUJJQUJCQVd0Qi93RnhJZ0FraEFJTURRc1Ftd0ZCL3dGeEpJUUNEQTBMSTRNQ0lnQkJnQUZ4UVlBQlJoQ2pBU0FBUVFGMElBQkIvd0Z4UVFkMmNrSC9BWEVrZ3dJTURRc1FuQUZCLy84RGNTT0xBaENsQVF3SUN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNpSUFJNFVDUWY4QmNTT0VBa0gvQVhGQkNIUnlJZ0ZCQUJDbUFTQUFJQUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSWdDSUFCQi93RnhKSWtDUVFBUW9nRkJDQThMSTRVQ1FmOEJjU09FQWtIL0FYRkJDSFJ5RUtjQlFmOEJjU1NEQWd3TEN5T0ZBa0gvQVhFamhBSkIvd0Z4UVFoMGNrRUJhMEgvL3dOeElnQkJnUDREY1VFSWRTU0VBZ3dMQ3lPRkFpSUFRUUVRb0FFZ0FFRUJha0gvQVhFaUFDU0ZBZ3dGQ3lPRkFpSUFRWDhRb0FFZ0FFRUJhMEgvQVhFaUFDU0ZBZ3dGQ3hDYkFVSC9BWEVraFFJTUJRc2pnd0lpQUVFQmNVRUFTeENqQVNBQVFRZDBJQUJCL3dGeFFRRjJja0gvQVhFa2d3SU1CUXRCZnc4TEk0d0NRUUpxUWYvL0EzRWtqQUlNQkFzZ0FFVVFvUUZCQUJDaUFRd0RDeUFBUlJDaEFVRUJFS0lCREFJTEk0d0NRUUZxUWYvL0EzRWtqQUlNQVF0QkFCQ2hBVUVBRUtJQlFRQVFud0VMUVFRUEN5QUFRZjhCY1NTRkFrRUlDNWtHQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVJCSEJFQWdBRUVSUmcwQkFrQWdBRUVTYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0JBZ1JBUWMzK0F4Q25BVUgvQVhFaUFFRUJjUVJBUWMzK0F5QUFRWDV4SWdCQmdBRnhCSDlCQUNTQ0FpQUFRZjkrY1FWQkFTU0NBaUFBUVlBQmNnc1FuUUZCeEFBUEN3dEJBU1NSQWd3UUN4Q2NBVUgvL3dOeElnQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBaU9NQWtFQ2FrSC8vd054Skl3Q0RCRUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlJNE1DRUowQkRCQUxJNGNDUWY4QmNTT0dBa0gvQVhGQkNIUnlRUUZxUWYvL0EzRWlBRUdBL2dOeFFRaDFKSVlDREJBTEk0WUNJZ0JCQVJDZ0FTQUFRUUZxUWY4QmNTU0dBaU9HQWtVUW9RRkJBQkNpQVF3T0N5T0dBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWtoZ0lqaGdKRkVLRUJRUUVRb2dFTURRc1Ftd0ZCL3dGeEpJWUNEQW9MSTRNQ0lnRkJnQUZ4UVlBQlJpRUFJNG9DUVFSMlFRRnhJQUZCQVhSeVFmOEJjU1NEQWd3S0N4Q2JBU0VBSTR3Q0lBQkJHSFJCR0hWcVFmLy9BM0ZCQVdwQi8vOERjU1NNQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09IQWtIL0FYRWpoZ0pCL3dGeFFRaDBjaUlCUVFBUXBnRWdBQ0FCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSEFrSC9BWEVqaGdKQi93RnhRUWgwY2hDbkFVSC9BWEVrZ3dJTUNBc2pod0pCL3dGeEk0WUNRZjhCY1VFSWRISkJBV3RCLy84RGNTSUFRWUQrQTNGQkNIVWtoZ0lNQ0Fzamh3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtod0lnQUVVUW9RRkJBQkNpQVF3R0N5T0hBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NIQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0hBZ3dDQ3lPREFpSUJRUUZ4UVFGR0lRQWppZ0pCQkhaQkFYRkJCM1FnQVVIL0FYRkJBWFp5SklNQ0RBSUxRWDhQQ3lPTUFrRUJha0gvL3dOeEpJd0NEQUVMSUFBUW93RkJBQkNoQVVFQUVLSUJRUUFRbndFTFFRUVBDeUFBUWY4QmNTU0hBa0VJQy9VR0FRSi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBRUVnUndSQUlBQkJJVVlOQVFKQUlBQkJJbXNPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamlnSkJCM1pCQVhFRVFDT01Ba0VCYWtILy93TnhKSXdDQlJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ3RCQ0E4TEVKd0JRZi8vQTNFaUFFR0EvZ054UVFoMUpJZ0NJQUJCL3dGeEpJa0NJNHdDUVFKcVFmLy9BM0VrakFJTUZBc2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQ09EQWhDZEFRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYWtILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3TkN5T0lBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NJQWd3T0N5T0lBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NJQWd3T0N4Q2JBVUgvQVhFa2lBSU1EZ3RCQmtFQUk0b0NJZ0pCQlhaQkFYRkJBRXNiSWdCQjRBQnlJQUFnQWtFRWRrRUJjVUVBU3hzaEFDT0RBaUVCSUFKQkJuWkJBWEZCQUVzRWZ5QUJJQUJyUWY4QmNRVWdBU0FBUVFaeUlBQWdBVUVQY1VFSlN4c2lBRUhnQUhJZ0FDQUJRWmtCU3hzaUFHcEIvd0Z4Q3lJQlJSQ2hBU0FBUWVBQWNVRUFSeENqQVVFQUVKOEJJQUVrZ3dJTURnc2ppZ0pCQjNaQkFYRkJBRXNFUUJDYkFTRUFJNHdDSUFCQkdIUkJHSFZxUWYvL0EzRkJBV3BCLy84RGNTU01BZ1VqakFKQkFXcEIvLzhEY1NTTUFndEJDQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5SWdBZ0FFSC8vd054UVFBUXBnRWdBRUVCZEVILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWlBQVFmOEJjU1NKQWtFQUVLSUJRUWdQQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2lJQUVLY0JRZjhCY1NTREFnd0hDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBja0VCYTBILy93TnhJZ0JCZ1A0RGNVRUlkU1NJQWd3RkN5T0pBaUlBUVFFUW9BRWdBRUVCYWtIL0FYRWlBQ1NKQWd3R0N5T0pBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NKQWd3R0N4Q2JBVUgvQVhFa2lRSU1CZ3NqZ3dKQmYzTkIvd0Z4SklNQ1FRRVFvZ0ZCQVJDZkFRd0dDMEYvRHdzZ0FFSC9BWEVraVFKQkNBOExJQUJCQVdwQi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUF3c2dBRVVRb1FGQkFCQ2lBUXdDQ3lBQVJSQ2hBVUVCRUtJQkRBRUxJNHdDUVFGcVFmLy9BM0VrakFJTFFRUUw4UVVCQVg4Q1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRVEJIQkVBZ0FFRXhSZzBCQWtBZ0FFRXlhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPS0FrRUVka0VCY1FSQUk0d0NRUUZxUWYvL0EzRWtqQUlGRUpzQklRQWpqQUlnQUVFWWRFRVlkV3BCLy84RGNVRUJha0gvL3dOeEpJd0NDMEVJRHdzUW5BRkIvLzhEY1NTTEFpT01Ba0VDYWtILy93TnhKSXdDREJFTEk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUlnQWpnd0lRblFFTURnc2ppd0pCQVdwQi8vOERjU1NMQWtFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVNJQlFRRVFvQUVnQVVFQmFrSC9BWEVpQVVVUW9RRkJBQkNpQVNBQUlBRVFuUUVNRGdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJaUFCQ25BU0lCUVg4UW9BRWdBVUVCYTBIL0FYRWlBVVVRb1FGQkFSQ2lBU0FBSUFFUW5RRU1EUXNqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRbXdGQi93RnhFSjBCREFzTFFRQVFvZ0ZCQUJDZkFVRUJFS01CREFzTEk0b0NRUVIyUVFGeFFRRkdCRUFRbXdFaEFDT01BaUFBUVJoMFFSaDFha0gvL3dOeFFRRnFRZi8vQTNFa2pBSUZJNHdDUVFGcVFmLy9BM0VrakFJTFFRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaUlBSTRzQ1FRQVFwZ0VqaXdJZ0FHcEIvLzhEY1NJQVFZRCtBM0ZCQ0hVa2lBSWdBRUgvQVhFa2lRSkJBQkNpQVVFSUR3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISWlBQkNuQVVIL0FYRWtnd0lNQmdzaml3SkJBV3RCLy84RGNTU0xBa0VJRHdzamd3SWlBRUVCRUtBQklBQkJBV3BCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVF3R0N5T0RBaUlBUVg4UW9BRWdBRUVCYTBIL0FYRWlBQ1NEQWlBQVJSQ2hBVUVCRUtJQkRBVUxFSnNCUWY4QmNTU0RBZ3dEQzBFQUVLSUJRUUFRbndFamlnSkJCSFpCQVhGQkFFMFFvd0VNQXd0QmZ3OExJQUJCQVd0Qi8vOERjU0lBUVlEK0EzRkJDSFVraUFJZ0FFSC9BWEVraVFJTUFRc2pqQUpCQVdwQi8vOERjU1NNQWd0QkJBdUNBZ0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRY0FBUndSQUlBQkJ3UUJHRFFFQ1FDQUFRY0lBYXc0T0F3UUZCZ2NJQ1JFS0N3d05EZzhBQ3d3UEN3d1BDeU9GQWlTRUFnd09DeU9HQWlTRUFnd05DeU9IQWlTRUFnd01DeU9JQWlTRUFnd0xDeU9KQWlTRUFnd0tDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtoQUlNQ1Fzamd3SWtoQUlNQ0FzamhBSWtoUUlNQndzamhnSWtoUUlNQmdzamh3SWtoUUlNQlFzamlBSWtoUUlNQkFzamlRSWtoUUlNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RkIvd0Z4SklVQ0RBSUxJNE1DSklVQ0RBRUxRWDhQQzBFRUMvMEJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFkQUFSd1JBSUFCQjBRQkdEUUVDUUNBQVFkSUFhdzRPRUFNRUJRWUhDQWtLRUFzTURRNEFDd3dPQ3lPRUFpU0dBZ3dPQ3lPRkFpU0dBZ3dOQ3lPSEFpU0dBZ3dNQ3lPSUFpU0dBZ3dMQ3lPSkFpU0dBZ3dLQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFVSC9BWEVraGdJTUNRc2pnd0lraGdJTUNBc2poQUlraHdJTUJ3c2poUUlraHdJTUJnc2poZ0lraHdJTUJRc2ppQUlraHdJTUJBc2ppUUlraHdJTUF3c2ppUUpCL3dGeEk0Z0NRZjhCY1VFSWRISVFwd0ZCL3dGeEpJY0NEQUlMSTRNQ0pJY0NEQUVMUVg4UEMwRUVDLzBCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRZUFBUndSQUlBQkI0UUJHRFFFQ1FDQUFRZUlBYXc0T0F3UVFCUVlIQ0FrS0N3d1FEUTRBQ3d3T0N5T0VBaVNJQWd3T0N5T0ZBaVNJQWd3TkN5T0dBaVNJQWd3TUN5T0hBaVNJQWd3TEN5T0pBaVNJQWd3S0N5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BVUgvQVhFa2lBSU1DUXNqZ3dJa2lBSU1DQXNqaEFJa2lRSU1Cd3NqaFFJa2lRSU1CZ3NqaGdJa2lRSU1CUXNqaHdJa2lRSU1CQXNqaUFJa2lRSU1Bd3NqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElRcHdGQi93RnhKSWtDREFJTEk0TUNKSWtDREFFTFFYOFBDMEVFQzVzREFBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBQkhCRUFnQUVIeEFFWU5BUUpBSUFCQjhnQnJEZzREQkFVR0J3Z0pDZ3NNRFE0UEVRQUxEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRRQ0VKMEJEQThMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRVQ0VKMEJEQTRMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRZQ0VKMEJEQTBMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRjQ0VKMEJEQXdMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRnQ0VKMEJEQXNMSTRrQ1FmOEJjU09JQWtIL0FYRkJDSFJ5STRrQ0VKMEJEQW9MSS93QlJRUkFBa0FqdHdFRVFFRUJKSTRDREFFTEk3a0JJNzhCY1VFZmNVVUVRRUVCSkk4Q0RBRUxRUUVra0FJTEN3d0pDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaU9EQWhDZEFRd0lDeU9FQWlTREFnd0hDeU9GQWlTREFnd0dDeU9HQWlTREFnd0ZDeU9IQWlTREFnd0VDeU9JQWlTREFnd0RDeU9KQWlTREFnd0NDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaENuQVVIL0FYRWtnd0lNQVF0QmZ3OExRUVFMTndFQmZ5QUJRUUJPQkVBZ0FFSC9BWEVnQUNBQmFrSC9BWEZMRUtNQkJTQUJRUjkxSWdJZ0FTQUNhbk1nQUVIL0FYRktFS01CQ3dzMEFRSi9JNE1DSWdFZ0FFSC9BWEVpQWhDZ0FTQUJJQUlRc0FFZ0FDQUJha0gvQVhFaUFDU0RBaUFBUlJDaEFVRUFFS0lCQzFnQkFuOGpnd0lpQVNBQWFpT0tBa0VFZGtFQmNXcEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQUVIL0FYRWdBV29qaWdKQkJIWkJBWEZxUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRQVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFZQUJSd1JBSUFCQmdRRkdEUUVDUUNBQVFZSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQ3hBUXdRQ3lPRkFoQ3hBUXdQQ3lPR0FoQ3hBUXdPQ3lPSEFoQ3hBUXdOQ3lPSUFoQ3hBUXdNQ3lPSkFoQ3hBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3hBUXdLQ3lPREFoQ3hBUXdKQ3lPRUFoQ3lBUXdJQ3lPRkFoQ3lBUXdIQ3lPR0FoQ3lBUXdHQ3lPSEFoQ3lBUXdGQ3lPSUFoQ3lBUXdFQ3lPSkFoQ3lBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQ3lBUXdDQ3lPREFoQ3lBUXdCQzBGL0R3dEJCQXMzQVFKL0k0TUNJZ0VnQUVIL0FYRkJmMndpQWhDZ0FTQUJJQUlRc0FFZ0FTQUFhMEgvQVhFaUFDU0RBaUFBUlJDaEFVRUJFS0lCQzFnQkFuOGpnd0lpQVNBQWF5T0tBa0VFZGtFQmNXdEIvd0Z4SWdJZ0FDQUJjM05CRUhGQkFFY1Fud0VnQVNBQVFmOEJjV3NqaWdKQkJIWkJBWEZyUVlBQ2NVRUFTeENqQVNBQ0pJTUNJQUpGRUtFQlFRRVFvZ0VMaXdJQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUNBQVFaQUJSd1JBSUFCQmtRRkdEUUVDUUNBQVFaSUJhdzRPQXdRRkJnY0lDUW9MREEwT0R4QUFDd3dRQ3lPRUFoQzBBUXdRQ3lPRkFoQzBBUXdQQ3lPR0FoQzBBUXdPQ3lPSEFoQzBBUXdOQ3lPSUFoQzBBUXdNQ3lPSkFoQzBBUXdMQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzBBUXdLQ3lPREFoQzBBUXdKQ3lPRUFoQzFBUXdJQ3lPRkFoQzFBUXdIQ3lPR0FoQzFBUXdHQ3lPSEFoQzFBUXdGQ3lPSUFoQzFBUXdFQ3lPSkFoQzFBUXdEQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFSQzFBUXdDQ3lPREFoQzFBUXdCQzBGL0R3dEJCQXNpQUNPREFpQUFjU0lBSklNQ0lBQkZFS0VCUVFBUW9nRkJBUkNmQVVFQUVLTUJDeVlBSTRNQ0lBQnpRZjhCY1NJQUpJTUNJQUJGRUtFQlFRQVFvZ0ZCQUJDZkFVRUFFS01CQzRzQ0FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFR2dBVWNFUUNBQVFhRUJSZzBCQWtBZ0FFR2lBV3NPRGdNRUJRWUhDQWtLQ3d3TkRnOFFBQXNNRUFzamhBSVF0d0VNRUFzamhRSVF0d0VNRHdzamhnSVF0d0VNRGdzamh3SVF0d0VNRFFzamlBSVF0d0VNREFzamlRSVF0d0VNQ3dzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF0d0VNQ2dzamd3SVF0d0VNQ1FzamhBSVF1QUVNQ0FzamhRSVF1QUVNQndzamhnSVF1QUVNQmdzamh3SVF1QUVNQlFzamlBSVF1QUVNQkFzamlRSVF1QUVNQXdzamlRSkIvd0Z4STRnQ1FmOEJjVUVJZEhJUXB3RVF1QUVNQWdzamd3SVF1QUVNQVF0QmZ3OExRUVFMSmdBamd3SWdBSEpCL3dGeElnQWtnd0lnQUVVUW9RRkJBQkNpQVVFQUVKOEJRUUFRb3dFTExBRUJmeU9EQWlJQklBQkIvd0Z4UVg5c0lnQVFvQUVnQVNBQUVMQUJJQUFnQVdwRkVLRUJRUUVRb2dFTGl3SUFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUFRYkFCUndSQUlBQkJzUUZHRFFFQ1FDQUFRYklCYXc0T0F3UUZCZ2NJQ1FvTERBME9EeEFBQ3d3UUN5T0VBaEM2QVF3UUN5T0ZBaEM2QVF3UEN5T0dBaEM2QVF3T0N5T0hBaEM2QVF3TkN5T0lBaEM2QVF3TUN5T0pBaEM2QVF3TEN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM2QVF3S0N5T0RBaEM2QVF3SkN5T0VBaEM3QVF3SUN5T0ZBaEM3QVF3SEN5T0dBaEM3QVF3R0N5T0hBaEM3QVF3RkN5T0lBaEM3QVF3RUN5T0pBaEM3QVF3REN5T0pBa0gvQVhFamlBSkIvd0Z4UVFoMGNoQ25BUkM3QVF3Q0N5T0RBaEM3QVF3QkMwRi9Ed3RCQkFzN0FRRi9JQUFRZFNJQlFYOUdCSDhnQUJBZEJTQUJDMEgvQVhFZ0FFRUJhaUlCRUhVaUFFRi9SZ1IvSUFFUUhRVWdBQXRCL3dGeFFRaDBjZ3NNQUVFSUVKb0JJQUFRdlFFTE5BQWdBRUdBQVhGQmdBRkdFS01CSUFCQkFYUWdBRUgvQVhGQkIzWnlRZjhCY1NJQVJSQ2hBVUVBRUtJQlFRQVFud0VnQUFzeUFDQUFRUUZ4UVFCTEVLTUJJQUJCQjNRZ0FFSC9BWEZCQVhaeVFmOEJjU0lBUlJDaEFVRUFFS0lCUVFBUW53RWdBQXM0QVFGL0k0b0NRUVIyUVFGeElBQkJBWFJ5UWY4QmNTRUJJQUJCZ0FGeFFZQUJSaENqQVNBQlJSQ2hBVUVBRUtJQlFRQVFud0VnQVFzNUFRRi9JNG9DUVFSMlFRRnhRUWQwSUFCQi93RnhRUUYyY2lFQklBQkJBWEZCQVVZUW93RWdBVVVRb1FGQkFCQ2lBVUVBRUo4QklBRUxLZ0FnQUVHQUFYRkJnQUZHRUtNQklBQkJBWFJCL3dGeElnQkZFS0VCUVFBUW9nRkJBQkNmQVNBQUN6MEJBWDhnQUVIL0FYRkJBWFlpQVVHQUFYSWdBU0FBUVlBQmNVR0FBVVliSWdGRkVLRUJRUUFRb2dGQkFCQ2ZBU0FBUVFGeFFRRkdFS01CSUFFTEt3QWdBRUVQY1VFRWRDQUFRZkFCY1VFRWRuSWlBRVVRb1FGQkFCQ2lBVUVBRUo4QlFRQVFvd0VnQUFzcUFRRi9JQUJCL3dGeFFRRjJJZ0ZGRUtFQlFRQVFvZ0ZCQUJDZkFTQUFRUUZ4UVFGR0VLTUJJQUVMSGdCQkFTQUFkQ0FCY1VIL0FYRkZFS0VCUVFBUW9nRkJBUkNmQVNBQkM4Z0lBUVYvQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQ0FBUVFkeElnUUVRQ0FFUVFGR0RRRUNRQ0FFUVFKckRnWURCQVVHQndnQUN3d0lDeU9FQWlFQkRBY0xJNFVDSVFFTUJnc2poZ0loQVF3RkN5T0hBaUVCREFRTEk0Z0NJUUVNQXdzamlRSWhBUXdDQ3lPSkFrSC9BWEVqaUFKQi93RnhRUWgwY2hDbkFTRUJEQUVMSTRNQ0lRRUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSHdBWEZCQkhVaUJRUkFJQVZCQVVZTkFRSkFJQVZCQW1zT0RnTUVCUVlIQ0FrS0N3d05EZzhRQUFzTUVBc2dBRUVIVEFSL0lBRVF2d0VoQWtFQkJTQUFRUTlNQkg4Z0FSREFBU0VDUVFFRlFRQUxDeUVEREE4TElBQkJGMHdFZnlBQkVNRUJJUUpCQVFVZ0FFRWZUQVIvSUFFUXdnRWhBa0VCQlVFQUN3c2hBd3dPQ3lBQVFTZE1CSDhnQVJEREFTRUNRUUVGSUFCQkwwd0VmeUFCRU1RQklRSkJBUVZCQUFzTElRTU1EUXNnQUVFM1RBUi9JQUVReFFFaEFrRUJCU0FBUVQ5TUJIOGdBUkRHQVNFQ1FRRUZRUUFMQ3lFRERBd0xJQUJCeHdCTUJIOUJBQ0FCRU1jQklRSkJBUVVnQUVIUEFFd0VmMEVCSUFFUXh3RWhBa0VCQlVFQUN3c2hBd3dMQ3lBQVFkY0FUQVIvUVFJZ0FSREhBU0VDUVFFRklBQkIzd0JNQkg5QkF5QUJFTWNCSVFKQkFRVkJBQXNMSVFNTUNnc2dBRUhuQUV3RWYwRUVJQUVReHdFaEFrRUJCU0FBUWU4QVRBUi9RUVVnQVJESEFTRUNRUUVGUVFBTEN5RUREQWtMSUFCQjl3Qk1CSDlCQmlBQkVNY0JJUUpCQVFVZ0FFSC9BRXdFZjBFSElBRVF4d0VoQWtFQkJVRUFDd3NoQXd3SUN5QUFRWWNCVEFSL0lBRkJmbkVoQWtFQkJTQUFRWThCVEFSL0lBRkJmWEVoQWtFQkJVRUFDd3NoQXd3SEN5QUFRWmNCVEFSL0lBRkJlM0VoQWtFQkJTQUFRWjhCVEFSL0lBRkJkM0VoQWtFQkJVRUFDd3NoQXd3R0N5QUFRYWNCVEFSL0lBRkJiM0VoQWtFQkJTQUFRYThCVEFSL0lBRkJYM0VoQWtFQkJVRUFDd3NoQXd3RkN5QUFRYmNCVEFSL0lBRkJ2Mzl4SVFKQkFRVWdBRUcvQVV3RWZ5QUJRZjkrY1NFQ1FRRUZRUUFMQ3lFRERBUUxJQUJCeHdGTUJIOGdBVUVCY2lFQ1FRRUZJQUJCendGTUJIOGdBVUVDY2lFQ1FRRUZRUUFMQ3lFRERBTUxJQUJCMXdGTUJIOGdBVUVFY2lFQ1FRRUZJQUJCM3dGTUJIOGdBVUVJY2lFQ1FRRUZRUUFMQ3lFRERBSUxJQUJCNXdGTUJIOGdBVUVRY2lFQ1FRRUZJQUJCN3dGTUJIOGdBVUVnY2lFQ1FRRUZRUUFMQ3lFRERBRUxJQUJCOXdGTUJIOGdBVUhBQUhJaEFrRUJCU0FBUWY4QlRBUi9JQUZCZ0FGeUlRSkJBUVZCQUFzTElRTUxBa0FDUUFKQUFrQUNRQUpBQWtBQ1FDQUVCRUFnQkVFQlJnMEJBa0FnQkVFQ2F3NEdBd1FGQmdjSUFBc01DQXNnQWlTRUFnd0hDeUFDSklVQ0RBWUxJQUlraGdJTUJRc2dBaVNIQWd3RUN5QUNKSWdDREFNTElBSWtpUUlNQWd0QkFTQUZRUWRLSUFWQkJFZ2JCRUFqaVFKQi93RnhJNGdDUWY4QmNVRUlkSElnQWhDZEFRc01BUXNnQWlTREFndEJCRUYvSUFNYkM3c0VBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBZ0FFSEFBVWNFUUNBQVFjRUJSZzBCQWtBZ0FFSENBV3NPRGdNU0JBVUdCd2dKQ2dzTUVRME9BQXNNRGdzamlnSkJCM1pCQVhFTkVRd09DeU9MQWhDK0FVSC8vd054SVFBaml3SkJBbXBCLy84RGNTU0xBaUFBUVlEK0EzRkJDSFVraEFJZ0FFSC9BWEVraFFKQkJBOExJNG9DUVFkMlFRRnhEUkVNRGdzamlnSkJCM1pCQVhFTkVBd01DeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09GQWtIL0FYRWpoQUpCL3dGeFFRaDBjaENsQVF3TkN4Q2JBUkN4QVF3TkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFQUpJd0NEQXNMSTRvQ1FRZDJRUUZ4UVFGSERRb01Cd3NqaXdJaUFCQytBVUgvL3dOeEpJd0NJQUJCQW1wQi8vOERjU1NMQWd3SkN5T0tBa0VIZGtFQmNVRUJSZzBIREFvTEVKc0JRZjhCY1JESUFTRUFJNHdDUVFGcVFmLy9BM0VrakFJZ0FBOExJNG9DUVFkMlFRRnhRUUZIRFFnaml3SkJBbXRCLy84RGNTSUFKSXNDSUFBampBSkJBbXBCLy84RGNSQ2xBUXdGQ3hDYkFSQ3lBUXdHQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVJSkl3Q0RBUUxRWDhQQ3lPTEFpSUFFTDRCUWYvL0EzRWtqQUlnQUVFQ2FrSC8vd054SklzQ1FRd1BDeU9MQWtFQ2EwSC8vd054SWdBa2l3SWdBQ09NQWtFQ2FrSC8vd054RUtVQkN4Q2NBVUgvL3dOeEpJd0NDMEVJRHdzampBSkJBV3BCLy84RGNTU01Ba0VFRHdzampBSkJBbXBCLy84RGNTU01Ba0VNQzZBRUFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFJQUJCMEFGSEJFQWdBRUhSQVVZTkFRSkFJQUJCMGdGckRnNERBQVFGQmdjSUNRb0FDd0FNRFFBTERBMExJNG9DUVFSMlFRRnhEUThNRFFzaml3SWlBUkMrQVVILy93TnhJUUFnQVVFQ2FrSC8vd054SklzQ0lBQkJnUDREY1VFSWRTU0dBaUFBUWY4QmNTU0hBa0VFRHdzamlnSkJCSFpCQVhFTkR3d01DeU9LQWtFRWRrRUJjUTBPSTRzQ1FRSnJRZi8vQTNFaUFDU0xBaUFBSTR3Q1FRSnFRZi8vQTNFUXBRRU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaHdKQi93RnhJNFlDUWY4QmNVRUlkSElRcFFFTUN3c1Ftd0VRdEFFTUN3c2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUlRcFFGQkVDU01BZ3dKQ3lPS0FrRUVka0VCY1VFQlJ3MElEQVlMSTRzQ0lnQVF2Z0ZCLy84RGNTU01Ba0VCSkxnQklBQkJBbXBCLy84RGNTU0xBZ3dIQ3lPS0FrRUVka0VCY1VFQlJnMEZEQWdMSTRvQ1FRUjJRUUZ4UVFGSERRY2ppd0pCQW10Qi8vOERjU0lBSklzQ0lBQWpqQUpCQW1wQi8vOERjUkNsQVF3RUN4Q2JBUkMxQVF3RkN5T0xBa0VDYTBILy93TnhJZ0FraXdJZ0FDT01BaENsQVVFWUpJd0NEQU1MUVg4UEN5T0xBaUlBRUw0QlFmLy9BM0VrakFJZ0FFRUNha0gvL3dOeEpJc0NRUXdQQ3hDY0FVSC8vd054Skl3Q0MwRUlEd3NqakFKQkFXcEIvLzhEY1NTTUFrRUVEd3NqakFKQkFtcEIvLzhEY1NTTUFrRU1DN0VEQVFGL0FrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjRBRkhCRUFnQUVIaEFVWU5BUUpBSUFCQjRnRnJEZzREQUFBRUJRWUhDQWtBQUFBS0N3QUxEQXNMRUpzQlFmOEJjVUdBL2dOcUk0TUNFSjBCREFzTEk0c0NJZ0VRdmdGQi8vOERjU0VBSUFGQkFtcEIvLzhEY1NTTEFpQUFRWUQrQTNGQkNIVWtpQUlnQUVIL0FYRWtpUUpCQkE4TEk0VUNRWUQrQTJvamd3SVFuUUZCQkE4TEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0a0NRZjhCY1NPSUFrSC9BWEZCQ0hSeUVLVUJRUWdQQ3hDYkFSQzNBUXdIQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVnSkl3Q1FRZ1BDeENiQVVFWWRFRVlkU0VBSTRzQ0lBQkJBUkNtQVNPTEFpQUFha0gvL3dOeEpJc0NRUUFRb1FGQkFCQ2lBU09NQWtFQmFrSC8vd054Skl3Q1FRd1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNNQWtFRUR3c1FuQUZCLy84RGNTT0RBaENkQVNPTUFrRUNha0gvL3dOeEpJd0NRUVFQQ3hDYkFSQzRBUXdDQ3lPTEFrRUNhMEgvL3dOeElnQWtpd0lnQUNPTUFoQ2xBVUVvSkl3Q1FRZ1BDMEYvRHdzampBSkJBV3BCLy84RGNTU01Ba0VFQytjREFRRi9Ba0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBSUFCQjhBRkhCRUFnQUVIeEFVWU5BUUpBSUFCQjhnRnJEZzREQkFBRkJnY0lDUW9MQUFBTURRQUxEQTBMRUpzQlFmOEJjVUdBL2dOcUVLY0JRZjhCY1NTREFnd05DeU9MQWlJQkVMNEJRZi8vQTNFaEFDQUJRUUpxUWYvL0EzRWtpd0lnQUVHQS9nTnhRUWgxSklNQ0lBQkIvd0Z4SklvQ0RBMExJNFVDUVlEK0Eyb1Fwd0ZCL3dGeEpJTUNEQXdMUVFBa3R3RU1Dd3NqaXdKQkFtdEIvLzhEY1NJQUpJc0NJQUFqaWdKQi93RnhJNE1DUWY4QmNVRUlkSElRcFFGQkNBOExFSnNCRUxvQkRBZ0xJNHNDUVFKclFmLy9BM0VpQUNTTEFpQUFJNHdDRUtVQlFUQWtqQUpCQ0E4TEVKc0JRUmgwUVJoMUlRQWppd0loQVVFQUVLRUJRUUFRb2dFZ0FTQUFRUUVRcGdFZ0FDQUJha0gvL3dOeElnQkJnUDREY1VFSWRTU0lBaUFBUWY4QmNTU0pBaU9NQWtFQmFrSC8vd054Skl3Q1FRZ1BDeU9KQWtIL0FYRWppQUpCL3dGeFFRaDBjaVNMQWtFSUR3c1FuQUZCLy84RGNSQ25BVUgvQVhFa2d3SWpqQUpCQW1wQi8vOERjU1NNQWd3RkMwRUJKTGdCREFRTEVKc0JFTHNCREFJTEk0c0NRUUpyUWYvL0EzRWlBQ1NMQWlBQUk0d0NFS1VCUVRna2pBSkJDQThMUVg4UEN5T01Ba0VCYWtILy93TnhKSXdDQzBFRUM5Z0JBUUYvSTR3Q1FRRnFRZi8vQTNFaEFTT1FBZ1JBSUFGQkFXdEIvLzhEY1NFQkN5QUJKSXdDQWtBQ1FBSkFBa0FDUUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FDUUFKQUlBQkI4QUZ4UVFSMUlnRUVRQ0FCUVFGckRnNEJBZ01FQlFZSENBa0tDd3dORGc4TElBQVFxQUVQQ3lBQUVLa0JEd3NnQUJDcUFROExJQUFRcXdFUEN5QUFFS3dCRHdzZ0FCQ3RBUThMSUFBUXJnRVBDeUFBRUs4QkR3c2dBQkN6QVE4TElBQVF0Z0VQQ3lBQUVMa0JEd3NnQUJDOEFROExJQUFReVFFUEN5QUFFTW9CRHdzZ0FCRExBUThMSUFBUXpBRUx2Z0VCQW45QkFDUzNBVUdQL2dNUUhVRUJJQUIwUVg5emNTSUJKTDhCUVkvK0F5QUJFQjhqaXdKQkFtdEIvLzhEY1NTTEFpT0xBaUlCSTR3Q0lnSkIvd0Z4RUI4Z0FVRUJhaUFDUVlEK0EzRkJDSFVRSHdKQUFrQUNRQUpBQWtBZ0FBUkFJQUJCQVVZTkFRSkFJQUJCQW1zT0F3TUVCUUFMREFVTFFRQWt3QUZCd0FBa2pBSU1CQXRCQUNUQkFVSElBQ1NNQWd3REMwRUFKTUlCUWRBQUpJd0NEQUlMUVFBa3d3RkIyQUFrakFJTUFRdEJBQ1RFQVVIZ0FDU01BZ3NMNlFFQkFuOGp1QUVFUUVFQkpMY0JRUUFrdUFFTEk3a0JJNzhCY1VFZmNVRUFTZ1JBSTQ4Q1JVRUFJN2NCR3dSL0k4QUJRUUFqdWdFYkJIOUJBQkRPQVVFQkJTUEJBVUVBSTdzQkd3Ui9RUUVRemdGQkFRVWp3Z0ZCQUNPOEFSc0VmMEVDRU00QlFRRUZJOE1CUVFBanZRRWJCSDlCQXhET0FVRUJCU1BFQVVFQUk3NEJHd1IvUVFRUXpnRkJBUVZCQUFzTEN3c0xCVUVBQ3dSQVFRRWpqd0lqamdJYkJIOUJBQ1NQQWtFQUpJNENRUUFra0FKQkFDU1JBa0VZQlVFVUN5RUFDMEVCSTQ4Q0k0NENHd1JBUVFBa2p3SkJBQ1NPQWtFQUpKQUNRUUFra1FJTElBQVBDMEVBQzdZQkFRSi9RUUVrbUFJamtBSUVRQ09NQWhBZFFmOEJjUkROQVJDYUFVRUFKSThDUVFBa2pnSkJBQ1NRQWtFQUpKRUNDeERQQVNJQVFRQktCRUFnQUJDYUFRdEJCQ0VBUVFBamtRSkZRUUVqandJampnSWJHd1JBSTR3Q0VCMUIvd0Z4RU0wQklRQUxJNG9DUWZBQmNTU0tBaUFBUVFCTUJFQWdBQThMSUFBUW1nRWpsd0pCQVdvaUFTT1ZBazRFZnlPV0FrRUJhaVNXQWlBQkk1VUNhd1VnQVFza2x3SWpqQUlqM1FGR0JFQkJBU1RnQVFzZ0FBc0ZBQ08yQVF1dUFRRURmeUFBUVg5QmdBZ2dBRUVBU0JzZ0FFRUFTaHNoQWtFQUlRQURRQ1BnQVVWQkFDQUJSVUVBUVFBZ0FFVWdBeHNiR3dSQUVOQUJRUUJJQkVCQkFTRURCU09OQWtIUXBBUWpnZ0owVGdSQVFRRWhBQVZCQVNBQkk3WUJJQUpPUVFBZ0FrRi9TaHNiSVFFTEN3d0JDd3NnQUFSQUk0MENRZENrQkNPQ0FuUnJKSTBDUVFBUEN5QUJCRUJCQVE4TEkrQUJCRUJCQUNUZ0FVRUNEd3NqakFKQkFXdEIvLzhEY1NTTUFrRi9Dd2NBUVg4UTBnRUxOQUVDZndOQUlBRkJBRTVCQUNBQ0lBQklHd1JBUVg4UTBnRWhBU0FDUVFGcUlRSU1BUXNMSUFGQkFFZ0VRQ0FCRHd0QkFBc0ZBQ09TQWdzRkFDT1RBZ3NGQUNPVUFndGJBQUpBQWtBQ1FBSkFBa0FDUUFKQUFrQWdBQVJBSUFCQkFVWU5BUUpBSUFCQkFtc09CZ01FQlFZSENBQUxEQWdMSTlJQkR3c2oxUUVQQ3lQVEFROExJOVFCRHdzajFnRVBDeVBYQVE4TEk5Z0JEd3NqMlFFUEMwRUFDNGNCQUFKQUFrQUNRQUpBQWtBQ1FBSkFBa0FnQUFSQUlBQkJBVVlOQVFKQUlBQkJBbXNPQmdNRUJRWUhDQUFMREFnTElBRkJBRWNrMGdFTUJ3c2dBVUVBUnlUVkFRd0dDeUFCUVFCSEpOTUJEQVVMSUFGQkFFY2sxQUVNQkFzZ0FVRUFSeVRXQVF3REN5QUJRUUJISk5jQkRBSUxJQUZCQUVjazJBRU1BUXNnQVVFQVJ5VFpBUXNMVVFFQmYwRUFKSkVDSUFBUTJBRkZCRUJCQVNFQkN5QUFRUUVRMlFFZ0FRUkFRUUZCQVVFQVFRRkJBQ0FBUVFOTUd5SUFRUUFqMndFYkd5QUFSVUVBSTl3Qkd4c0VRRUVCSk1RQlFRUVFXZ3NMQ3drQUlBQkJBQkRaQVF1YUFRQWdBRUVBU2dSQVFRQVEyZ0VGUVFBUTJ3RUxJQUZCQUVvRVFFRUJFTm9CQlVFQkVOc0JDeUFDUVFCS0JFQkJBaERhQVFWQkFoRGJBUXNnQTBFQVNnUkFRUU1RMmdFRlFRTVEyd0VMSUFSQkFFb0VRRUVFRU5vQkJVRUVFTnNCQ3lBRlFRQktCRUJCQlJEYUFRVkJCUkRiQVFzZ0JrRUFTZ1JBUVFZUTJnRUZRUVlRMndFTElBZEJBRW9FUUVFSEVOb0JCVUVIRU5zQkN3c0hBQ0FBSk4wQkN3Y0FRWDhrM1FFTEJ3QWdBQ1RlQVFzSEFFRi9KTjRCQ3djQUlBQWszd0VMQndCQmZ5VGZBUXNGQUNPREFnc0ZBQ09FQWdzRkFDT0ZBZ3NGQUNPR0Fnc0ZBQ09IQWdzRkFDT0lBZ3NGQUNPSkFnc0ZBQ09LQWdzRkFDT01BZ3NGQUNPTEFnc0xBQ09NQWhBZFFmOEJjUXNGQUNQdEFRdXJBd0VLZjBHQWdBSkJnSkFDSStZQkd5RUlRWUM0QWtHQXNBSWo1d0ViSVFrRFFDQUZRWUFDU0FSQVFRQWhCQU5BSUFSQmdBSklCRUFnQ0NBRlFRTjFRUVYwSUFscUlBUkJBM1ZxSWdKQmdKQithaTBBQUJCTklRWWdCVUVJYnlFQlFRY2dCRUVJYjJzaEIwRUFJUU1DZnlBQVFRQktRUUFqZ1FJYkJFQWdBa0dBMEg1cUxRQUFJUU1MSUFOQndBQnhDd1JBUVFjZ0FXc2hBUXRCQUNFQ0lBRkJBWFFnQm1vaUJrR0FrSDVxUVFGQkFDQURRUWh4R3lJQ1FRMTBhaTBBQUNFS1FRQWhBU0FHUVlHUWZtb2dBa0VOZEdvdEFBQkJBU0FIZEhFRVFFRUNJUUVMSUFGQkFXb2dBVUVCSUFkMElBcHhHeUVCSUFWQkNIUWdCR3BCQTJ3aEFpQUFRUUJLUVFBamdRSWJCRUFnQWtHQW9RdHFJZ0lnQTBFSGNTQUJRUUFRVGlJQlFSOXhRUU4wT2dBQUlBSkJBV29nQVVIZ0IzRkJCWFZCQTNRNkFBQWdBa0VDYWlBQlFZRDRBWEZCQ25WQkEzUTZBQUFGSUFKQmdLRUxhaUlESUFGQngvNERFRThpQVVHQWdQd0hjVUVRZFRvQUFDQURRUUZxSUFGQmdQNERjVUVJZFRvQUFDQURRUUpxSUFFNkFBQUxJQVJCQVdvaEJBd0JDd3NnQlVFQmFpRUZEQUVMQ3d2VkF3RU1md05BSUFSQkYwNUZCRUJCQUNFREEwQWdBMEVmU0FSQVFRRkJBQ0FEUVE5S0lnY2JJUWtnQkVFUGF5QUVJQVJCRDBvaUFCdEJCSFFpQlNBRFFROXJhaUFESUFWcUlBY2JJUWhCZ0pBQ1FZQ0FBaUFBR3lFS1FjZitBeUVIUVg4aEJrRi9JUVZCQUNFQkEwQWdBVUVJU0FSQVFRQWhBQU5BSUFCQkJVZ0VRQ0FBUVFOMElBRnFRUUowSWdKQmd2d0RhaEFkSUFoR0JFQWdBa0dEL0FOcUVCMGhBa0VCUVFBZ0FrRUljVUVBSTRFQ0d4c2dDVVlFUUVFSUlRRkJCU0VBSUFJaUJVRVFjUVIvUWNuK0F3VkJ5UDREQ3lFSEN3c2dBRUVCYWlFQURBRUxDeUFCUVFGcUlRRU1BUXNMSUFWQkFFaEJBQ09CQWhzRVFFR0F1QUpCZ0xBQ0krY0JHeUVMUVg4aEFFRUFJUUlEUUNBQ1FTQklCRUJCQUNFQkEwQWdBVUVnU0FSQUlBRkJCWFFnQzJvZ0Ftb2lCa0dBa0g1cUxRQUFJQWhHQkVCQklDRUNRU0FoQVNBR0lRQUxJQUZCQVdvaEFRd0JDd3NnQWtFQmFpRUNEQUVMQ3lBQVFRQk9CSDhnQUVHQTBINXFMUUFBQlVGL0N5RUdDMEVBSVFBRFFDQUFRUWhJQkVBZ0NDQUtJQWxCQUVFSElBQWdBMEVEZENBRVFRTjBJQUJxUWZnQlFZQ2hGeUFISUFZZ0JSQlFHaUFBUVFGcUlRQU1BUXNMSUFOQkFXb2hBd3dCQ3dzZ0JFRUJhaUVFREFFTEN3dVdBZ0VKZndOQUlBUkJDRTVGQkVCQkFDRUJBMEFnQVVFRlNBUkFJQUZCQTNRZ0JHcEJBblFpQUVHQS9BTnFFQjBhSUFCQmdmd0RhaEFkR2lBQVFZTDhBMm9RSFNFQ1FRRWhCU1BvQVFSQUlBSkJBbTlCQVVZRVFDQUNRUUZySVFJTFFRSWhCUXNnQUVHRC9BTnFFQjBoQmtFQUlRZEJBVUVBSUFaQkNIRkJBQ09CQWhzYklRZEJ5UDRESVFoQnlmNERRY2orQXlBR1FSQnhHeUVJUVFBaEFBTkFJQUFnQlVnRVFFRUFJUU1EUUNBRFFRaElCRUFnQUNBQ2FrR0FnQUlnQjBFQVFRY2dBeUFFUVFOMElBRkJCSFFnQTJvZ0FFRURkR3BCd0FCQmdLRWdJQWhCZnlBR0VGQWFJQU5CQVdvaEF3d0JDd3NnQUVFQmFpRUFEQUVMQ3lBQlFRRnFJUUVNQVFzTElBUkJBV29oQkF3QkN3c0xCUUFqeGdFTEJRQWp4d0VMQlFBanlnRUxHQUVCZnlQTUFTRUFJOHNCQkVBZ0FFRUVjaUVBQ3lBQUN6QUJBWDhEUUFKQUlBQkIvLzhEVGcwQUlBQkJnTFhKQkdvZ0FCQjJPZ0FBSUFCQkFXb2hBQXdCQ3d0QkFDVGdBUXNXQUJBYlB3QkJsQUZJQkVCQmxBRS9BR3RBQUJvTEM5d0JBQ0FBUVp3Q1NRUkFEd3NnQUVFUWF5RUFBa0FDUUFKQUFrQUNRQUpBSUFGQkFVY0VRQ0FCUVFKR0RRRUNRQ0FCUVFOckRnTURCQVVBQ3d3RkN5QUFFQmtNQlFzZ0FDZ0NCRUgvLy8vL0FIRkJBRTBFUUVFQVFZQUJRY3NBUVJFUUFBQUxJQUFnQUNnQ0JFRUJhellDQkNBQUVBY01CQXNnQUJBS0RBTUxJQUFvQWdRaUFVR0FnSUNBZjNFZ0FVRUJha0dBZ0lDQWYzRkhCRUJCQUVHQUFVSFdBRUVHRUFBQUN5QUFJQUZCQVdvMkFnUWdBVUdBZ0lDQUIzRUVRQ0FBRUFrTERBSUxJQUFRQ3d3QkMwRUFRWUFCUWVFQVFSZ1FBQUFMQ3kwQUFrQUNRQUpBSUFCQkNHc29BZ0FPQXdBQUFRSUxEd3NnQUNnQ0FDSUFCRUFnQUNBQkVQZ0JDdzhMQUFzREFBRUxIUUFDUUFKQUFrQWptZ0lPQWdFQ0FBc0FDMEVBSVFBTElBQVEwZ0VMQndBZ0FDU2FBZ3NsQUFKQUFrQUNRQUpBSTVvQ0RnTUJBZ01BQ3dBTFFRRWhBQXRCZnlFQkN5QUJFTklCQ3d1ZkFnWUFRUWdMTFI0QUFBQUJBQUFBQVFBQUFCNEFBQUIrQUd3QWFRQmlBQzhBY2dCMEFDOEFkQUJzQUhNQVpnQXVBSFFBY3dCQk9BczNLQUFBQUFFQUFBQUJBQUFBS0FBQUFHRUFiQUJzQUc4QVl3QmhBSFFBYVFCdkFHNEFJQUIwQUc4QWJ3QWdBR3dBWVFCeUFHY0FaUUJCOEFBTExSNEFBQUFCQUFBQUFRQUFBQjRBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzhBY0FCMUFISUFaUUF1QUhRQWN3QkJvQUVMTXlRQUFBQUJBQUFBQVFBQUFDUUFBQUJKQUc0QVpBQmxBSGdBSUFCdkFIVUFkQUFnQUc4QVpnQWdBSElBWVFCdUFHY0FaUUJCMkFFTEl4UUFBQUFCQUFBQUFRQUFBQlFBQUFCK0FHd0FhUUJpQUM4QWNnQjBBQzRBZEFCekFFR0FBZ3NWQXdBQUFCQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFETVFjMjkxY21ObFRXRndjR2x1WjFWU1RDRmpiM0psTDJScGMzUXZZMjl5WlM1MWJuUnZkV05vWldRdWQyRnpiUzV0WVhBPSIpKS5pbnN0YW5jZTsKY29uc3QgYj1uZXcgVWludDhBcnJheShhLmV4cG9ydHMubWVtb3J5LmJ1ZmZlcik7cmV0dXJue2luc3RhbmNlOmEsYnl0ZU1lbW9yeTpiLHR5cGU6IldlYiBBc3NlbWJseSJ9fTtsZXQgcix1LEUsYztjPXtncmFwaGljc1dvcmtlclBvcnQ6dm9pZCAwLG1lbW9yeVdvcmtlclBvcnQ6dm9pZCAwLGNvbnRyb2xsZXJXb3JrZXJQb3J0OnZvaWQgMCxhdWRpb1dvcmtlclBvcnQ6dm9pZCAwLHdhc21JbnN0YW5jZTp2b2lkIDAsd2FzbUJ5dGVNZW1vcnk6dm9pZCAwLG9wdGlvbnM6dm9pZCAwLFdBU01CT1lfQk9PVF9ST01fTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfQllURVNfTE9DQVRJT046MCxXQVNNQk9ZX0dBTUVfUkFNX0JBTktTX0xPQ0FUSU9OOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9TSVpFOjAsV0FTTUJPWV9JTlRFUk5BTF9TVEFURV9MT0NBVElPTjowLFdBU01CT1lfSU5URVJOQUxfTUVNT1JZX1NJWkU6MCxXQVNNQk9ZX0lOVEVSTkFMX01FTU9SWV9MT0NBVElPTjowLFdBU01CT1lfUEFMRVRURV9NRU1PUllfU0laRTowLApXQVNNQk9ZX1BBTEVUVEVfTUVNT1JZX0xPQ0FUSU9OOjAsV0FTTUJPWV9DVVJSRU5UX0ZSQU1FX09VVFBVVF9MT0NBVElPTjowLFdBU01CT1lfQ1VSUkVOVF9GUkFNRV9TSVpFOjAsV0FTTUJPWV9TT1VORF9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMV9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfMl9PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfM19PVVRQVVRfTE9DQVRJT046MCxXQVNNQk9ZX0NIQU5ORUxfNF9PVVRQVVRfTE9DQVRJT046MCxwYXVzZWQ6ITAsdXBkYXRlSWQ6dm9pZCAwLHRpbWVTdGFtcHNVbnRpbFJlYWR5OjAsZnBzVGltZVN0YW1wczpbXSxzcGVlZDowLGZyYW1lU2tpcENvdW50ZXI6MCxjdXJyZW50QXVkaW9MYXRlbmN5SW5TZWNvbmRzOjAsbWVzc2FnZUhhbmRsZXI6KGEpPT57Y29uc3QgYj1uKGEpO3N3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSBmLkNPTk5FQ1Q6IkdSQVBISUNTIj09PWIubWVzc2FnZS53b3JrZXJJZD8KKGMuZ3JhcGhpY3NXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEouYmluZCh2b2lkIDAsYyksYy5ncmFwaGljc1dvcmtlclBvcnQpKToiTUVNT1JZIj09PWIubWVzc2FnZS53b3JrZXJJZD8oYy5tZW1vcnlXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKE0uYmluZCh2b2lkIDAsYyksYy5tZW1vcnlXb3JrZXJQb3J0KSk6IkNPTlRST0xMRVIiPT09Yi5tZXNzYWdlLndvcmtlcklkPyhjLmNvbnRyb2xsZXJXb3JrZXJQb3J0PWIubWVzc2FnZS5wb3J0c1swXSxxKEwuYmluZCh2b2lkIDAsYyksYy5jb250cm9sbGVyV29ya2VyUG9ydCkpOiJBVURJTyI9PT1iLm1lc3NhZ2Uud29ya2VySWQmJihjLmF1ZGlvV29ya2VyUG9ydD1iLm1lc3NhZ2UucG9ydHNbMF0scShLLmJpbmQodm9pZCAwLGMpLGMuYXVkaW9Xb3JrZXJQb3J0KSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5JTlNUQU5USUFURV9XQVNNOihhc3luYygpPT57bGV0IGE7YT1hd2FpdCBQKHApOwpjLndhc21JbnN0YW5jZT1hLmluc3RhbmNlO2Mud2FzbUJ5dGVNZW1vcnk9YS5ieXRlTWVtb3J5O2soaCh7dHlwZTphLnR5cGV9LGIubWVzc2FnZUlkKSl9KSgpO2JyZWFrO2Nhc2UgZi5DT05GSUc6Yy53YXNtSW5zdGFuY2UuZXhwb3J0cy5jb25maWcuYXBwbHkoYyxiLm1lc3NhZ2UuY29uZmlnKTtjLm9wdGlvbnM9Yi5tZXNzYWdlLm9wdGlvbnM7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SRVNFVF9BVURJT19RVUVVRTpjLndhc21JbnN0YW5jZS5leHBvcnRzLmNsZWFyQXVkaW9CdWZmZXIoKTtrKGgodm9pZCAwLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSBmLlBMQVk6aWYoIWMucGF1c2VkfHwhYy53YXNtSW5zdGFuY2V8fCFjLndhc21CeXRlTWVtb3J5KXtrKGgoe2Vycm9yOiEwfSxiLm1lc3NhZ2VJZCkpO2JyZWFrfWMucGF1c2VkPSExO2MuZnBzVGltZVN0YW1wcz1bXTt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0KMDtjLm9wdGlvbnMuaXNHYmNDb2xvcml6YXRpb25FbmFibGVkP2Mub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlJiZjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoIndhc21ib3lnYiBicm93biByZWQgZGFya2Jyb3duIGdyZWVuIGRhcmtncmVlbiBpbnZlcnRlZCBwYXN0ZWxtaXggb3JhbmdlIHllbGxvdyBibHVlIGRhcmtibHVlIGdyYXlzY2FsZSIuc3BsaXQoIiAiKS5pbmRleE9mKGMub3B0aW9ucy5nYmNDb2xvcml6YXRpb25QYWxldHRlLnRvTG93ZXJDYXNlKCkpKTpjLndhc21JbnN0YW5jZS5leHBvcnRzLnNldE1hbnVhbENvbG9yaXphdGlvblBhbGV0dGUoMCk7RihjLDFFMy9jLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZSk7ayhoKHZvaWQgMCxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5QQVVTRTpjLnBhdXNlZD0hMDtjLnVwZGF0ZUlkJiYoY2xlYXJUaW1lb3V0KGMudXBkYXRlSWQpLGMudXBkYXRlSWQ9dm9pZCAwKTtrKGgodm9pZCAwLApiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5SVU5fV0FTTV9FWFBPUlQ6YT1iLm1lc3NhZ2UucGFyYW1ldGVycz9jLndhc21JbnN0YW5jZS5leHBvcnRzW2IubWVzc2FnZS5leHBvcnRdLmFwcGx5KHZvaWQgMCxiLm1lc3NhZ2UucGFyYW1ldGVycyk6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuZXhwb3J0XSgpO2soaCh7dHlwZTpmLlJVTl9XQVNNX0VYUE9SVCxyZXNwb25zZTphfSxiLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgZi5HRVRfV0FTTV9NRU1PUllfU0VDVElPTjp7YT0wO2xldCBkPWMud2FzbUJ5dGVNZW1vcnkubGVuZ3RoO2IubWVzc2FnZS5zdGFydCYmKGE9Yi5tZXNzYWdlLnN0YXJ0KTtiLm1lc3NhZ2UuZW5kJiYoZD1iLm1lc3NhZ2UuZW5kKTthPWMud2FzbUJ5dGVNZW1vcnkuc2xpY2UoYSxkKS5idWZmZXI7ayhoKHt0eXBlOmYuUlVOX1dBU01fRVhQT1JULHJlc3BvbnNlOmF9LGIubWVzc2FnZUlkKSxbYV0pO2JyZWFrfWNhc2UgZi5HRVRfV0FTTV9DT05TVEFOVDprKGgoe3R5cGU6Zi5HRVRfV0FTTV9DT05TVEFOVCwKcmVzcG9uc2U6Yy53YXNtSW5zdGFuY2UuZXhwb3J0c1tiLm1lc3NhZ2UuY29uc3RhbnRdLnZhbHVlT2YoKX0sYi5tZXNzYWdlSWQpKTticmVhaztjYXNlIGYuRk9SQ0VfT1VUUFVUX0ZSQU1FOkMoYyk7YnJlYWs7Y2FzZSBmLlNFVF9TUEVFRDpjLnNwZWVkPWIubWVzc2FnZS5zcGVlZDtjLmZwc1RpbWVTdGFtcHM9W107Yy50aW1lU3RhbXBzVW50aWxSZWFkeT02MDt3KGMpO2MuZnJhbWVTa2lwQ291bnRlcj0wO2MuY3VycmVudEF1ZGlvTGF0ZW5jeUluU2Vjb25kcz0wO2Mud2FzbUluc3RhbmNlLmV4cG9ydHMuY2xlYXJBdWRpb0J1ZmZlcigpO2JyZWFrO2Nhc2UgZi5JU19HQkM6YT0wPGMud2FzbUluc3RhbmNlLmV4cG9ydHMuaXNHQkMoKTtrKGgoe3R5cGU6Zi5JU19HQkMscmVzcG9uc2U6YX0sYi5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKCJVbmtub3duIFdhc21Cb3kgV29ya2VyIG1lc3NhZ2U6IixiKX19LGdldEZQUzooKT0+MDxjLnRpbWVTdGFtcHNVbnRpbFJlYWR5PwpjLnNwZWVkJiYwPGMuc3BlZWQ/Yy5vcHRpb25zLmdhbWVib3lGcmFtZVJhdGUqYy5zcGVlZDpjLm9wdGlvbnMuZ2FtZWJveUZyYW1lUmF0ZTpjLmZwc1RpbWVTdGFtcHM/Yy5mcHNUaW1lU3RhbXBzLmxlbmd0aDowfTtxKGMubWVzc2FnZUhhbmRsZXIpfSkoKTsK",ca.LIB),
    b=new lb("data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGgoYSxiKXtlP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTprLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbShhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGUpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZSlzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugay5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZihhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZCsrLGI9YCR7Yn0tJHtkfWAsMUU1PGQmJihkPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGU9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaztlfHwoaz1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZD0wLGw7Y29uc3Qgbj0oYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkdFVF9DT05TVEFOVFNfRE9ORSI6aChmKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlVQREFURUQiOnthPW5ldyBVaW50OENsYW1wZWRBcnJheShhLm1lc3NhZ2UuZ3JhcGhpY3NGcmFtZUJ1ZmZlcik7Y29uc3QgYj1uZXcgVWludDhDbGFtcGVkQXJyYXkoOTIxNjApO2ZvcihsZXQgYz0wOzE0ND5jOysrYyl7bGV0IGU9NDgwKmMsZj02NDAqYztmb3IobGV0IGM9MDsxNjA+YzsrK2Mpe2NvbnN0IGQ9ZSszKmMsZz1mKyhjPDwyKTtiW2crMF09YVtkKzBdO2JbZysxXT1hW2QrMV07YltnKzJdPWFbZCsyXTtiW2crM109MjU1fX1hPWJ9aChmKHt0eXBlOiJVUERBVEVEIixpbWFnZURhdGFBcnJheUJ1ZmZlcjphLmJ1ZmZlcn0pLFthLmJ1ZmZlcl0pfX07bSgoYSk9PnthPWEuZGF0YT9hLmRhdGE6YTtzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNPTk5FQ1QiOmw9CmEubWVzc2FnZS5wb3J0c1swXTttKG4sbCk7aChmKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmwucG9zdE1lc3NhZ2UoZih7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==",
    ca.GRAPHICS),c=new lb("data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIG0oYSxiKXtjP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpuLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gcChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGMpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoYylzZWxmLm9ubWVzc2FnZT1hO2Vsc2Ugbi5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gZChhLGIscil7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksaysrLGI9YCR7Yn0tJHtrfWAsMUU1PGsmJihrPTApKTtyZXR1cm57d29ya2VySWQ6cixtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGM9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgbjtjfHwobj1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgaz0wO2NvbnN0IHE9KGEpPT57YT0oYS0xKS8xMjctMTsuMDA4Pk1hdGguYWJzKGEpJiYoYT0wKTtyZXR1cm4gYS8yLjV9O2xldCBsO2NvbnN0IHQ9KGEpPT57Y29uc3QgYj1hLmRhdGE/YS5kYXRhOmE7aWYoYi5tZXNzYWdlKXN3aXRjaChiLm1lc3NhZ2UudHlwZSl7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjptKGQoYi5tZXNzYWdlLGIubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiVVBEQVRFRCI6e2NvbnN0IGE9e3R5cGU6IlVQREFURUQiLG51bWJlck9mU2FtcGxlczpiLm1lc3NhZ2UubnVtYmVyT2ZTYW1wbGVzLGZwczpiLm1lc3NhZ2UuZnBzLGFsbG93RmFzdFNwZWVkU3RyZXRjaGluZzpiLm1lc3NhZ2UuYWxsb3dGYXN0U3BlZWRTdHJldGNoaW5nfSxjPVtdO1siYXVkaW9CdWZmZXIiLCJjaGFubmVsMUJ1ZmZlciIsImNoYW5uZWwyQnVmZmVyIiwiY2hhbm5lbDNCdWZmZXIiLCJjaGFubmVsNEJ1ZmZlciJdLmZvckVhY2goKGQpPT57aWYoYi5tZXNzYWdlW2RdKXt7dmFyIGY9Cm5ldyBVaW50OEFycmF5KGIubWVzc2FnZVtkXSk7dmFyIGc9Yi5tZXNzYWdlLm51bWJlck9mU2FtcGxlcztjb25zdCBhPW5ldyBGbG9hdDMyQXJyYXkoZyk7dmFyIGg9bmV3IEZsb2F0MzJBcnJheShnKTtsZXQgYz0wO2cqPTI7Zm9yKHZhciBlPTA7ZTxnO2UrPTIpYVtjXT1xKGZbZV0pLGMrKztjPTA7Zm9yKGU9MTtlPGc7ZSs9MiloW2NdPXEoZltlXSksYysrO2Y9YS5idWZmZXI7aD1oLmJ1ZmZlcn1hW2RdPXt9O2FbZF0ubGVmdD1mO2FbZF0ucmlnaHQ9aDtjLnB1c2goZik7Yy5wdXNoKGgpfX0pO20oZChhKSxjKX19fTtwKChhKT0+e2E9YS5kYXRhP2EuZGF0YTphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6bD1hLm1lc3NhZ2UucG9ydHNbMF07cCh0LGwpO20oZCh2b2lkIDAsYS5tZXNzYWdlSWQpKTticmVhaztjYXNlICJHRVRfQ09OU1RBTlRTIjpsLnBvc3RNZXNzYWdlKGQoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiQVVESU9fTEFURU5DWSI6bC5wb3N0TWVzc2FnZShkKGEubWVzc2FnZSwKYS5tZXNzYWdlSWQpKTticmVhaztkZWZhdWx0OmNvbnNvbGUubG9nKGEpfX0pfSkoKTsK",
    ca.AUDIO),d=new lb("data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXthfHxjb25zb2xlLmVycm9yKCJ3b3JrZXJhcGk6IE5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZCB0byBvbk1lc3NhZ2UhIik7aWYoYilpZihjKWIub25tZXNzYWdlPWE7ZWxzZSBiLm9uKCJtZXNzYWdlIixhKTtlbHNlIGlmKGMpc2VsZi5vbm1lc3NhZ2U9YTtlbHNlIGUub24oIm1lc3NhZ2UiLGEpfWZ1bmN0aW9uIGgoYSxiLGMpe2J8fChiPU1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnJlcGxhY2UoL1teYS16XSsvZywiIikuc3Vic3RyKDIsMTApLGQrKyxiPWAke2J9LSR7ZH1gLDFFNTxkJiYoZD0wKSk7cmV0dXJue3dvcmtlcklkOmMsbWVzc2FnZUlkOmIsbWVzc2FnZTphfX1jb25zdCBjPSJ1bmRlZmluZWQiIT09dHlwZW9mIHNlbGY7bGV0IGU7Y3x8KGU9cmVxdWlyZSgid29ya2VyX3RocmVhZHMiKS5wYXJlbnRQb3J0KTtsZXQgZD0wLGY7Y29uc3Qgaz0oYSk9Pnt9O2coKGEpPT57YT1hLmRhdGE/YS5kYXRhOgphO3N3aXRjaChhLm1lc3NhZ2UudHlwZSl7Y2FzZSAiQ09OTkVDVCI6Zj1hLm1lc3NhZ2UucG9ydHNbMF07ZyhrLGYpO2E9aCh2b2lkIDAsYS5tZXNzYWdlSWQpO2M/c2VsZi5wb3N0TWVzc2FnZShhLHZvaWQgMCk6ZS5wb3N0TWVzc2FnZShhLHZvaWQgMCk7YnJlYWs7Y2FzZSAiU0VUX0pPWVBBRF9TVEFURSI6Zi5wb3N0TWVzc2FnZShoKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2RlZmF1bHQ6Y29uc29sZS5sb2coYSl9fSl9KSgpOwo=",
    ca.CONTROLLER),e=new lb("data:application/javascript;base64,J3VzZSBzdHJpY3QnOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGcoYSxiKXtkP3NlbGYucG9zdE1lc3NhZ2UoYSxiKTpoLnBvc3RNZXNzYWdlKGEsYil9ZnVuY3Rpb24gbChhLGIpe2F8fGNvbnNvbGUuZXJyb3IoIndvcmtlcmFwaTogTm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkIHRvIG9uTWVzc2FnZSEiKTtpZihiKWlmKGQpYi5vbm1lc3NhZ2U9YTtlbHNlIGIub24oIm1lc3NhZ2UiLGEpO2Vsc2UgaWYoZClzZWxmLm9ubWVzc2FnZT1hO2Vsc2UgaC5vbigibWVzc2FnZSIsYSl9ZnVuY3Rpb24gYyhhLGIsYyl7Ynx8KGI9TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikucmVwbGFjZSgvW15hLXpdKy9nLCIiKS5zdWJzdHIoMiwxMCksZSsrLGI9YCR7Yn0tJHtlfWAsMUU1PGUmJihlPTApKTtyZXR1cm57d29ya2VySWQ6YyxtZXNzYWdlSWQ6YixtZXNzYWdlOmF9fWNvbnN0IGQ9InVuZGVmaW5lZCIhPT10eXBlb2Ygc2VsZjtsZXQgaDtkfHwoaD1yZXF1aXJlKCJ3b3JrZXJfdGhyZWFkcyIpLnBhcmVudFBvcnQpOwpsZXQgZT0wLGY7Y29uc3Qgaz0oYSxiKT0+e2NvbnN0IGQ9W107T2JqZWN0LmtleXMoYi5tZXNzYWdlKS5mb3JFYWNoKChhKT0+eyJ0eXBlIiE9PWEmJmQucHVzaChiLm1lc3NhZ2VbYV0pfSk7Y29uc3QgZT1jKGIubWVzc2FnZSxiLm1lc3NhZ2VJZCk7YT9mLnBvc3RNZXNzYWdlKGUsZCk6ZyhlLGQpfSxtPShhKT0+e2E9YS5kYXRhP2EuZGF0YTphO2lmKGEubWVzc2FnZSlzd2l0Y2goYS5tZXNzYWdlLnR5cGUpe2Nhc2UgIkNMRUFSX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSxbYS5tZXNzYWdlLndhc21CeXRlTWVtb3J5XSk7YnJlYWs7Y2FzZSAiR0VUX0NPTlNUQU5UU19ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiU0VUX01FTU9SWV9ET05FIjpnKGMoYS5tZXNzYWdlLGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6ayghMSxhKTticmVhaztjYXNlICJVUERBVEVEIjprKCExLGEpfX07bCgoYSk9PnthPQphLmRhdGE/YS5kYXRhOmE7c3dpdGNoKGEubWVzc2FnZS50eXBlKXtjYXNlICJDT05ORUNUIjpmPWEubWVzc2FnZS5wb3J0c1swXTtsKG0sZik7ZyhjKHZvaWQgMCxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkNMRUFSX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKHt0eXBlOiJDTEVBUl9NRU1PUlkifSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIkdFVF9DT05TVEFOVFMiOmYucG9zdE1lc3NhZ2UoYyh7dHlwZToiR0VUX0NPTlNUQU5UUyJ9LGEubWVzc2FnZUlkKSk7YnJlYWs7Y2FzZSAiR0VUX01FTU9SWSI6Zi5wb3N0TWVzc2FnZShjKGEubWVzc2FnZSxhLm1lc3NhZ2VJZCkpO2JyZWFrO2Nhc2UgIlNFVF9NRU1PUlkiOmsoITAsYSk7YnJlYWs7ZGVmYXVsdDpjb25zb2xlLmxvZyhhKX19KX0pKCk7Cg==",
    ca.MEMORY),f=[];[b,c,d,e].forEach((b)=>{const c=new MessageChannel,d=new Promise((d)=>{let e=0;a.postMessage({type:r.CONNECT,workerId:b.id,ports:[c.port1]},[c.port1]).then(()=>{e++;2<=e&&d();});b.postMessage({type:r.CONNECT,workerId:a.id,ports:[c.port2]},[c.port2]).then(()=>{e++;2<=e&&d();});});f.push(d);});await Promise.all(f);E.setWorker(b);G.setWorker(c);Q.setWorker(d);N.setWorker(e);return a};
    async function nb(){this.initialized||(this.loadedAndStarted=this.ready=!1,await this._instantiateWorkers(),this.coreType=(await this.worker.postMessage({type:r.INSTANTIATE_WASM})).message.type,await N.initialize(this.options.headless,this.options.maxNumberOfAutoSaveStates,this.options.saveStateCallback),await N.clearMemory(),this.initialized=!0);}
    function ob(a,b){const c=async()=>{!this.options.headless&&N.getLoadedCartridgeMemoryState().RAM&&await N.saveCartridgeRam();const c=await xa(a,b);await N.loadCartridgeRom(c.ROM,c.name);this.options.enableBootROMIfAvailable&&((await N.getCartridgeInfo()).CGBFlag?await N.loadBootROMIfAvailable(N.SUPPORTED_BOOT_ROM_TYPES.GBC):await N.loadBootROMIfAvailable(N.SUPPORTED_BOOT_ROM_TYPES.GB));this.loadedROM=a;await this.worker.postMessage({type:r.CONFIG,config:[N.loadedCartridgeMemoryState.BOOT?1:0,this.options.isGbcEnabled?
    1:0,this.options.audioBatchProcessing?1:0,this.options.graphicsBatchProcessing?1:0,this.options.timersBatchProcessing?1:0,this.options.graphicsDisableScanlineRendering?1:0,this.options.audioAccumulateSamples?1:0,this.options.tileRendering?1:0,this.options.tileCaching?1:0,this.options.enableAudioDebugging?1:0],options:{gameboyFrameRate:this.options.gameboyFrameRate,headless:this.options.headless,isAudioEnabled:this.options.isAudioEnabled,isGbcColorizationEnabled:this.options.isGbcColorizationEnabled,
    gbcColorizationPalette:this.options.gbcColorizationPalette,enableAudioDebugging:this.options.enableAudioDebugging,frameSkip:this.options.frameSkip}});};return (async()=>{await this.pause();await nb.bind(this)();this.options.headless?await c():(await Promise.all([E.initialize(this.canvasElement,this.options.updateGraphicsCallback),G.initialize(this.options.updateAudioCallback),Q.initialize()]),await c(),await N.loadCartridgeRam());this.ready=!0;if(this.options.onReady)this.options.onReady();m.runHook({key:"ready"});})()}
    for(var pb=oa(function(a){(function(){if("undefined"!==typeof performance&&null!==performance&&performance.now)a.exports=function(){return performance.now()};else if("undefined"!==typeof process&&null!==process&&process.hrtime){a.exports=function(){return (c()-f)/1E6};var b=process.hrtime;var c=function(){var a=b();return 1E9*a[0]+a[1]};var d=c();var e=1E9*process.uptime();var f=d-e;}else if(Date.now){a.exports=function(){return Date.now()-g};var g=Date.now();}else a.exports=function(){return (new Date).getTime()-
    g},g=(new Date).getTime();}).call(na);}),R="undefined"===typeof window?na:window,qb=["moz","webkit"],rb=R.requestAnimationFrame,sb=R.cancelAnimationFrame||R.cancelRequestAnimationFrame,tb=0;!rb&&tb<qb.length;tb++)rb=R[qb[tb]+"RequestAnimationFrame"],sb=R[qb[tb]+"CancelAnimationFrame"]||R[qb[tb]+"CancelRequestAnimationFrame"];
    if(!rb||!sb){var ub=0,vb=0,S=[],wb=1E3/60;rb=function(a){if(0===S.length){var b=pb(),c=Math.max(0,wb-(b-ub));ub=c+b;setTimeout(function(){for(var a=S.slice(0),b=S.length=0;b<a.length;b++)if(!a[b].cancelled)try{a[b].callback(ub);}catch(f){setTimeout(function(){throw f;},0);}},Math.round(c));}S.push({handle:++vb,callback:a,cancelled:!1});return vb};sb=function(a){for(var b=0;b<S.length;b++)S[b].handle===a&&(S[b].cancelled=!0);};}function T(a){return rb.call(R,a)}function xb(){sb.apply(R,arguments);}
    T.cancel=null;T.polyfill=null;function yb(){if(this.paused)return !0;let a=!1;this.frameSkip&&0<this.frameSkip&&(this.frameSkipCounter++,this.frameSkipCounter<this.frameSkip?a=!0:this.frameSkipCounter=0);a||E.renderFrame();Q.updateController();this.renderId=T(()=>{yb.call(this);});}
    var zb=oa(function(a){var b=function(a){function c(a,b,d,e){if("undefined"===typeof a)return c[0];if("undefined"!==typeof b){if(10!==+b||d){var h=d||"0123456789abcdefghijklmnopqrstuvwxyz";a=String(a);e||(a=a.toLowerCase(),h=h.toLowerCase());var q=a.length,f=Math.abs(b);d={};for(e=0;e<h.length;e++)d[h[e]]=e;for(e=0;e<q;e++)if(h=a[e],"-"!==h&&h in d&&d[h]>=f&&("1"!==h||1!==f))throw Error(h+" is not a valid digit in base "+b+".");b=y(b);q=[];for(e=(f="-"===a[0])?1:0;e<a.length;e++)if(h=a[e],h in d)q.push(y(d[h]));
    else if("<"===h){h=e;do e++;while(">"!==a[e]&&e<a.length);q.push(y(a.slice(h+1,e)));}else throw Error(h+" is not a valid character");b=Ta(q,b,f);}else b=y(a);return b}return y(a)}function e(a,b){this.value=a;this.sign=b;this.isSmall=!1;}function f(a){this.value=a;this.sign=0>a;this.isSmall=!0;}function g(a){this.value=a;}function k(a){return -9007199254740992<a&&9007199254740992>a}function l(a){return 1E7>a?[a]:1E14>a?[a%1E7,Math.floor(a/1E7)]:[a%1E7,Math.floor(a/1E7)%1E7,Math.floor(a/1E14)]}function n(a){z(a);
    var b=a.length;if(4>b&&0>U(a,za))switch(b){case 0:return 0;case 1:return a[0];case 2:return a[0]+1E7*a[1];default:return a[0]+1E7*(a[1]+1E7*a[2])}return a}function z(a){for(var b=a.length;0===a[--b];);a.length=b+1;}function D(a){for(var b=Array(a),c=-1;++c<a;)b[c]=0;return b}function x(a){return 0<a?Math.floor(a):Math.ceil(a)}function A(a,b){var c=a.length,h=b.length,d=Array(c),e=0,q;for(q=0;q<h;q++){var f=a[q]+b[q]+e;e=1E7<=f?1:0;d[q]=f-1E7*e;}for(;q<c;)f=a[q]+e,e=1E7===f?1:0,d[q++]=f-1E7*e;0<e&&d.push(e);
    return d}function t(a,b){return a.length>=b.length?A(a,b):A(b,a)}function w(a,b){var c=a.length,h=Array(c),d;for(d=0;d<c;d++){var e=a[d]-1E7+b;b=Math.floor(e/1E7);h[d]=e-1E7*b;b+=1;}for(;0<b;)h[d++]=b%1E7,b=Math.floor(b/1E7);return h}function v(a,b){var c=a.length,h=b.length,d=Array(c),e=0,q;for(q=0;q<h;q++){var f=a[q]-e-b[q];0>f?(f+=1E7,e=1):e=0;d[q]=f;}for(q=h;q<c;q++){f=a[q]-e;if(0>f)f+=1E7;else{d[q++]=f;break}d[q]=f;}for(;q<c;q++)d[q]=a[q];z(d);return d}function B(a,b,c){var h=a.length,d=Array(h);
    b=-b;var q;for(q=0;q<h;q++){var ia=a[q]+b;b=Math.floor(ia/1E7);ia%=1E7;d[q]=0>ia?ia+1E7:ia;}d=n(d);return "number"===typeof d?(c&&(d=-d),new f(d)):new e(d,c)}function p(a,b){var c=a.length,h=b.length,d=D(c+h),e;for(e=0;e<c;++e){var q=a[e];for(var f=0;f<h;++f){var g=b[f];g=q*g+d[e+f];var l=Math.floor(g/1E7);d[e+f]=g-1E7*l;d[e+f+1]+=l;}}z(d);return d}function M(a,b){var c=a.length,h=Array(c),d=0,e;for(e=0;e<c;e++){var q=a[e]*b+d;d=Math.floor(q/1E7);h[e]=q-1E7*d;}for(;0<d;)h[e++]=d%1E7,d=Math.floor(d/1E7);
    return h}function H(a,b){for(var c=[];0<b--;)c.push(0);return c.concat(a)}function O(a,b){var c=Math.max(a.length,b.length);if(30>=c)return p(a,b);c=Math.ceil(c/2);var h=a.slice(c);a=a.slice(0,c);var d=b.slice(c),e=b.slice(0,c);b=O(a,e);var q=O(h,d);h=O(t(a,h),t(e,d));c=t(t(b,H(v(v(h,b),q),c)),H(q,2*c));z(c);return c}function F(a,b,c){return 1E7>a?new e(M(b,a),c):new e(p(b,l(a)),c)}function Ja(a){var b=a.length,c=D(b+b),h;for(h=0;h<b;h++){var d=a[h];var e=-(d*d);for(var f=h;f<b;f++){var g=a[f];g=
    2*d*g+c[h+f]+e;e=Math.floor(g/1E7);c[h+f]=g-1E7*e;}c[h+b]=e;}z(c);return c}function Ka(a,b){var c=a.length,h=D(c);var d=0;for(--c;0<=c;--c){d=1E7*d+a[c];var e=x(d/b);d-=e*b;h[c]=e|0;}return [h,d|0]}function V(a,b){b=y(b);if(ra)return [new g(a.value/b.value),new g(a.value%b.value)];var d=a.value;var h=b.value;if(0===h)throw Error("Cannot divide by zero");if(a.isSmall)return b.isSmall?[new f(x(d/h)),new f(d%h)]:[c[0],a];if(b.isSmall){if(1===h)return [a,c[0]];if(-1==h)return [a.negate(),c[0]];h=Math.abs(h);
    if(1E7>h)return h=Ka(d,h),d=n(h[0]),h=h[1],a.sign&&(h=-h),"number"===typeof d?(a.sign!==b.sign&&(d=-d),[new f(d),new f(h)]):[new e(d,a.sign!==b.sign),new f(h)];h=l(h);}var q=U(d,h);if(-1===q)return [c[0],a];if(0===q)return [c[a.sign===b.sign?1:-1],c[0]];if(200>=d.length+h.length){var k=h,p=d.length;h=k.length;q=D(k.length);var t=k[h-1],A=Math.ceil(1E7/(2*t));d=M(d,A);k=M(k,A);var w,B,F;d.length<=p&&d.push(0);k.push(0);t=k[h-1];for(w=p-h;0<=w;w--){p=9999999;d[w+h]!==t&&(p=Math.floor((1E7*d[w+h]+d[w+h-
    1])/t));var H=B=0;var K=k.length;for(F=0;F<K;F++){B+=p*k[F];var O=Math.floor(B/1E7);H+=d[w+F]-(B-1E7*O);B=O;0>H?(d[w+F]=H+1E7,H=-1):(d[w+F]=H,H=0);}for(;0!==H;){--p;for(F=B=0;F<K;F++)B+=d[w+F]-1E7+k[F],0>B?(d[w+F]=B+1E7,B=0):(d[w+F]=B,B=1);H+=B;}q[w]=p;}d=Ka(d,A)[0];h=[n(q),n(d)];}else{q=d.length;t=h.length;A=[];for(k=[];q;)if(k.unshift(d[--q]),z(k),0>U(k,h))A.push(0);else{p=k.length;w=1E7*k[p-1]+k[p-2];B=1E7*h[t-1]+h[t-2];p>t&&(w=1E7*(w+1));p=Math.ceil(w/B);do{w=M(h,p);if(0>=U(w,k))break;p--;}while(p);
    A.push(p);k=v(k,w);}A.reverse();h=[n(A),n(k)];}d=h[0];b=a.sign!==b.sign;h=h[1];a=a.sign;"number"===typeof d?(b&&(d=-d),d=new f(d)):d=new e(d,b);"number"===typeof h?(a&&(h=-h),h=new f(h)):h=new e(h,a);return [d,h]}function U(a,b){if(a.length!==b.length)return a.length>b.length?1:-1;for(var c=a.length-1;0<=c;c--)if(a[c]!==b[c])return a[c]>b[c]?1:-1;return 0}function Ua(a){a=a.abs();if(a.isUnit())return !1;if(a.equals(2)||a.equals(3)||a.equals(5))return !0;if(a.isEven()||a.isDivisibleBy(3)||a.isDivisibleBy(5))return !1;
    if(a.lesser(49))return !0}function Aa(a,c){for(var d=a.prev(),h=d,e=0,f,q,g;h.isEven();)h=h.divide(2),e++;q=0;a:for(;q<c.length;q++)if(!a.lesser(c[q])&&(g=b(c[q]).modPow(h,a),!g.isUnit()&&!g.equals(d))){for(f=e-1;0!=f;f--){g=g.square().mod(a);if(g.isUnit())break;if(g.equals(d))continue a}return !1}return !0}function Ba(a,c,d){c=y(c);var h=a.isNegative(),e=c.isNegative();a=h?a.not():a;var f=e?c.not():c;for(c=[];!a.isZero()||!f.isZero();){a=V(a,W);var q=a[1].toJSNumber();h&&(q=W-1-q);f=V(f,W);var g=f[1].toJSNumber();
    e&&(g=W-1-g);a=a[0];f=f[0];c.push(d(q,g));}d=0!==d(h?1:0,e?1:0)?b(-1):b(0);for(h=c.length-1;0<=h;--h)d=d.multiply(W).add(b(c[h]));return d}function sa(a){a=a.value;a="number"===typeof a?a|1073741824:"bigint"===typeof a?a|BigInt(1073741824):a[0]+1E7*a[1]|1073758208;return a&-a}function Va(a,c){if(0>=c.compareTo(a)){var d=Va(a,c.square(c)),h=d.p;d=d.e;c=h.multiply(c);return 0>=c.compareTo(a)?{p:c,e:2*d+1}:{p:h,e:2*d}}return {p:b(1),e:0}}function Wa(a,b){a=y(a);b=y(b);return a.greater(b)?a:b}function Ca(a,
    b){a=y(a);b=y(b);return a.lesser(b)?a:b}function Xa(a,b){a=y(a).abs();b=y(b).abs();if(a.equals(b))return a;if(a.isZero())return b;if(b.isZero())return a;for(var d=c[1],h;a.isEven()&&b.isEven();)h=Ca(sa(a),sa(b)),a=a.divide(h),b=b.divide(h),d=d.multiply(h);for(;a.isEven();)a=a.divide(sa(a));do{for(;b.isEven();)b=b.divide(sa(b));a.greater(b)&&(h=b,b=a,a=h);b=b.subtract(a);}while(!b.isZero());return d.isUnit()?a:a.multiply(d)}function Ta(a,b,d){var h=c[0],e=c[1],f;for(f=a.length-1;0<=f;f--)h=h.add(a[f].times(e)),
    e=e.times(b);return d?h.negate():h}function ja(a,c){c=b(c);if(c.isZero()){if(a.isZero())return {value:[0],isNegative:!1};throw Error("Cannot convert nonzero numbers to base 0.");}if(c.equals(-1)){if(a.isZero())return {value:[0],isNegative:!1};if(a.isNegative())return {value:[].concat.apply([],Array.apply(null,Array(-a.toJSNumber())).map(Array.prototype.valueOf,[1,0])),isNegative:!1};c=Array.apply(null,Array(a.toJSNumber()-1)).map(Array.prototype.valueOf,[0,1]);c.unshift([1]);return {value:[].concat.apply([],
    c),isNegative:!1}}var d=!1;a.isNegative()&&c.isPositive()&&(d=!0,a=a.abs());if(c.isUnit())return a.isZero()?{value:[0],isNegative:!1}:{value:Array.apply(null,Array(a.toJSNumber())).map(Number.prototype.valueOf,1),isNegative:d};for(var h=[],e;a.isNegative()||0<=a.compareAbs(c);)e=a.divmod(c),a=e.quotient,e=e.remainder,e.isNegative()&&(e=c.minus(e).abs(),a=a.next()),h.push(e.toJSNumber());h.push(a.toJSNumber());return {value:h.reverse(),isNegative:d}}function Ya(a,b,c){a=ja(a,b);return (a.isNegative?
    "-":"")+a.value.map(function(a){var b=c;b=b||"0123456789abcdefghijklmnopqrstuvwxyz";a=a<b.length?b[a]:"<"+a+">";return a}).join("")}function Za(a){if(k(+a)){var b=+a;if(b===x(b))return ra?new g(BigInt(b)):new f(b);throw Error("Invalid integer: "+a);}(b="-"===a[0])&&(a=a.slice(1));var c=a.split(/e/i);if(2<c.length)throw Error("Invalid integer: "+c.join("e"));if(2===c.length){a=c[1];"+"===a[0]&&(a=a.slice(1));a=+a;if(a!==x(a)||!k(a))throw Error("Invalid integer: "+a+" is not a valid exponent.");c=c[0];
    var d=c.indexOf(".");0<=d&&(a-=c.length-d-1,c=c.slice(0,d)+c.slice(d+1));if(0>a)throw Error("Cannot include negative exponent part for integers");a=c+=Array(a+1).join("0");}if(!/^([0-9][0-9]*)$/.test(a))throw Error("Invalid integer: "+a);if(ra)return new g(BigInt(b?"-"+a:a));c=[];d=a.length;for(var h=d-7;0<d;)c.push(+a.slice(h,d)),h-=7,0>h&&(h=0),d-=7;z(c);return new e(c,b)}function y(a){if("number"===typeof a){if(ra)a=new g(BigInt(a));else if(k(a)){if(a!==x(a))throw Error(a+" is not an integer.");
    a=new f(a);}else a=Za(a.toString());return a}return "string"===typeof a?Za(a):"bigint"===typeof a?new g(a):a}var za=l(9007199254740992),ra="function"===typeof BigInt;e.prototype=Object.create(c.prototype);f.prototype=Object.create(c.prototype);g.prototype=Object.create(c.prototype);e.prototype.add=function(a){a=y(a);if(this.sign!==a.sign)return this.subtract(a.negate());var b=this.value,c=a.value;return a.isSmall?new e(w(b,Math.abs(c)),this.sign):new e(t(b,c),this.sign)};e.prototype.plus=e.prototype.add;
    f.prototype.add=function(a){a=y(a);var b=this.value;if(0>b!==a.sign)return this.subtract(a.negate());var c=a.value;if(a.isSmall){if(k(b+c))return new f(b+c);c=l(Math.abs(c));}return new e(w(c,Math.abs(b)),0>b)};f.prototype.plus=f.prototype.add;g.prototype.add=function(a){return new g(this.value+y(a).value)};g.prototype.plus=g.prototype.add;e.prototype.subtract=function(a){var b=y(a);if(this.sign!==b.sign)return this.add(b.negate());a=this.value;var c=b.value;if(b.isSmall)return B(a,Math.abs(c),this.sign);
    b=this.sign;0<=U(a,c)?a=v(a,c):(a=v(c,a),b=!b);a=n(a);"number"===typeof a?(b&&(a=-a),a=new f(a)):a=new e(a,b);return a};e.prototype.minus=e.prototype.subtract;f.prototype.subtract=function(a){a=y(a);var b=this.value;if(0>b!==a.sign)return this.add(a.negate());var c=a.value;return a.isSmall?new f(b-c):B(c,Math.abs(b),0<=b)};f.prototype.minus=f.prototype.subtract;g.prototype.subtract=function(a){return new g(this.value-y(a).value)};g.prototype.minus=g.prototype.subtract;e.prototype.negate=function(){return new e(this.value,
    !this.sign)};f.prototype.negate=function(){var a=this.sign,b=new f(-this.value);b.sign=!a;return b};g.prototype.negate=function(){return new g(-this.value)};e.prototype.abs=function(){return new e(this.value,!1)};f.prototype.abs=function(){return new f(Math.abs(this.value))};g.prototype.abs=function(){return new g(0<=this.value?this.value:-this.value)};e.prototype.multiply=function(a){var b=y(a);a=this.value;var d=b.value,h=this.sign!==b.sign;if(b.isSmall){if(0===d)return c[0];if(1===d)return this;
    if(-1===d)return this.negate();d=Math.abs(d);if(1E7>d)return new e(M(a,d),h);d=l(d);}b=a.length;var f=d.length;return 0<-.012*b-.012*f+1.5E-5*b*f?new e(O(a,d),h):new e(p(a,d),h)};e.prototype.times=e.prototype.multiply;f.prototype._multiplyBySmall=function(a){return k(a.value*this.value)?new f(a.value*this.value):F(Math.abs(a.value),l(Math.abs(this.value)),this.sign!==a.sign)};e.prototype._multiplyBySmall=function(a){return 0===a.value?c[0]:1===a.value?this:-1===a.value?this.negate():F(Math.abs(a.value),
    this.value,this.sign!==a.sign)};f.prototype.multiply=function(a){return y(a)._multiplyBySmall(this)};f.prototype.times=f.prototype.multiply;g.prototype.multiply=function(a){return new g(this.value*y(a).value)};g.prototype.times=g.prototype.multiply;e.prototype.square=function(){return new e(Ja(this.value),!1)};f.prototype.square=function(){var a=this.value*this.value;return k(a)?new f(a):new e(Ja(l(Math.abs(this.value))),!1)};g.prototype.square=function(){return new g(this.value*this.value)};e.prototype.divmod=
    function(a){a=V(this,a);return {quotient:a[0],remainder:a[1]}};g.prototype.divmod=f.prototype.divmod=e.prototype.divmod;e.prototype.divide=function(a){return V(this,a)[0]};g.prototype.over=g.prototype.divide=function(a){return new g(this.value/y(a).value)};f.prototype.over=f.prototype.divide=e.prototype.over=e.prototype.divide;e.prototype.mod=function(a){return V(this,a)[1]};g.prototype.mod=g.prototype.remainder=function(a){return new g(this.value%y(a).value)};f.prototype.remainder=f.prototype.mod=
    e.prototype.remainder=e.prototype.mod;e.prototype.pow=function(a){var b=y(a),d=this.value;a=b.value;var e;if(0===a)return c[1];if(0===d)return c[0];if(1===d)return c[1];if(-1===d)return b.isEven()?c[1]:c[-1];if(b.sign)return c[0];if(!b.isSmall)throw Error("The exponent "+b.toString()+" is too large.");if(this.isSmall&&k(e=Math.pow(d,a)))return new f(x(e));e=this;for(b=c[1];;){a&1&&(b=b.times(e),--a);if(0===a)break;a/=2;e=e.square();}return b};f.prototype.pow=e.prototype.pow;g.prototype.pow=function(a){var b=
    y(a),d=this.value;a=b.value;var e=BigInt(0),f=BigInt(1),h=BigInt(2);if(a===e)return c[1];if(d===e)return c[0];if(d===f)return c[1];if(d===BigInt(-1))return b.isEven()?c[1]:c[-1];if(b.isNegative())return new g(e);b=this;for(d=c[1];;){(a&f)===f&&(d=d.times(b),--a);if(a===e)break;a/=h;b=b.square();}return d};e.prototype.modPow=function(a,b){a=y(a);b=y(b);if(b.isZero())throw Error("Cannot take modPow with modulus 0");var d=c[1],e=this.mod(b);a.isNegative()&&(a=a.multiply(c[-1]),e=e.modInv(b));for(;a.isPositive();){if(e.isZero())return c[0];
    a.isOdd()&&(d=d.multiply(e).mod(b));a=a.divide(2);e=e.square().mod(b);}return d};g.prototype.modPow=f.prototype.modPow=e.prototype.modPow;e.prototype.compareAbs=function(a){a=y(a);return a.isSmall?1:U(this.value,a.value)};f.prototype.compareAbs=function(a){a=y(a);var b=Math.abs(this.value),c=a.value;return a.isSmall?(c=Math.abs(c),b===c?0:b>c?1:-1):-1};g.prototype.compareAbs=function(a){var b=this.value;a=y(a).value;b=0<=b?b:-b;a=0<=a?a:-a;return b===a?0:b>a?1:-1};e.prototype.compare=function(a){if(Infinity===
    a)return -1;if(-Infinity===a)return 1;a=y(a);return this.sign!==a.sign?a.sign?1:-1:a.isSmall?this.sign?-1:1:U(this.value,a.value)*(this.sign?-1:1)};e.prototype.compareTo=e.prototype.compare;f.prototype.compare=function(a){if(Infinity===a)return -1;if(-Infinity===a)return 1;a=y(a);var b=this.value,c=a.value;return a.isSmall?b==c?0:b>c?1:-1:0>b!==a.sign?0>b?-1:1:0>b?1:-1};f.prototype.compareTo=f.prototype.compare;g.prototype.compare=function(a){if(Infinity===a)return -1;if(-Infinity===a)return 1;var b=
    this.value;a=y(a).value;return b===a?0:b>a?1:-1};g.prototype.compareTo=g.prototype.compare;e.prototype.equals=function(a){return 0===this.compare(a)};g.prototype.eq=g.prototype.equals=f.prototype.eq=f.prototype.equals=e.prototype.eq=e.prototype.equals;e.prototype.notEquals=function(a){return 0!==this.compare(a)};g.prototype.neq=g.prototype.notEquals=f.prototype.neq=f.prototype.notEquals=e.prototype.neq=e.prototype.notEquals;e.prototype.greater=function(a){return 0<this.compare(a)};g.prototype.gt=
    g.prototype.greater=f.prototype.gt=f.prototype.greater=e.prototype.gt=e.prototype.greater;e.prototype.lesser=function(a){return 0>this.compare(a)};g.prototype.lt=g.prototype.lesser=f.prototype.lt=f.prototype.lesser=e.prototype.lt=e.prototype.lesser;e.prototype.greaterOrEquals=function(a){return 0<=this.compare(a)};g.prototype.geq=g.prototype.greaterOrEquals=f.prototype.geq=f.prototype.greaterOrEquals=e.prototype.geq=e.prototype.greaterOrEquals;e.prototype.lesserOrEquals=function(a){return 0>=this.compare(a)};
    g.prototype.leq=g.prototype.lesserOrEquals=f.prototype.leq=f.prototype.lesserOrEquals=e.prototype.leq=e.prototype.lesserOrEquals;e.prototype.isEven=function(){return 0===(this.value[0]&1)};f.prototype.isEven=function(){return 0===(this.value&1)};g.prototype.isEven=function(){return (this.value&BigInt(1))===BigInt(0)};e.prototype.isOdd=function(){return 1===(this.value[0]&1)};f.prototype.isOdd=function(){return 1===(this.value&1)};g.prototype.isOdd=function(){return (this.value&BigInt(1))===BigInt(1)};
    e.prototype.isPositive=function(){return !this.sign};f.prototype.isPositive=function(){return 0<this.value};g.prototype.isPositive=f.prototype.isPositive;e.prototype.isNegative=function(){return this.sign};f.prototype.isNegative=function(){return 0>this.value};g.prototype.isNegative=f.prototype.isNegative;e.prototype.isUnit=function(){return !1};f.prototype.isUnit=function(){return 1===Math.abs(this.value)};g.prototype.isUnit=function(){return this.abs().value===BigInt(1)};e.prototype.isZero=function(){return !1};
    f.prototype.isZero=function(){return 0===this.value};g.prototype.isZero=function(){return this.value===BigInt(0)};e.prototype.isDivisibleBy=function(a){a=y(a);return a.isZero()?!1:a.isUnit()?!0:0===a.compareAbs(2)?this.isEven():this.mod(a).isZero()};g.prototype.isDivisibleBy=f.prototype.isDivisibleBy=e.prototype.isDivisibleBy;e.prototype.isPrime=function(c){var d=Ua(this);if(d!==a)return d;d=this.abs();var e=d.bitLength();if(64>=e)return Aa(d,[2,3,5,7,11,13,17,19,23,29,31,37]);e=Math.log(2)*e.toJSNumber();
    c=Math.ceil(!0===c?2*Math.pow(e,2):e);e=[];for(var f=0;f<c;f++)e.push(b(f+2));return Aa(d,e)};g.prototype.isPrime=f.prototype.isPrime=e.prototype.isPrime;e.prototype.isProbablePrime=function(c,d){var e=Ua(this);if(e!==a)return e;e=this.abs();c=c===a?5:c;for(var f=[],h=0;h<c;h++)f.push(b.randBetween(2,e.minus(2),d));return Aa(e,f)};g.prototype.isProbablePrime=f.prototype.isProbablePrime=e.prototype.isProbablePrime;e.prototype.modInv=function(a){for(var c=b.zero,d=b.one,e=y(a),f=this.abs(),h,g,k;!f.isZero();)h=
    e.divide(f),g=c,k=e,c=d,e=f,d=g.subtract(h.multiply(d)),f=k.subtract(h.multiply(f));if(!e.isUnit())throw Error(this.toString()+" and "+a.toString()+" are not co-prime");-1===c.compare(0)&&(c=c.add(a));return this.isNegative()?c.negate():c};g.prototype.modInv=f.prototype.modInv=e.prototype.modInv;e.prototype.next=function(){var a=this.value;return this.sign?B(a,1,this.sign):new e(w(a,1),this.sign)};f.prototype.next=function(){var a=this.value;return 9007199254740992>a+1?new f(a+1):new e(za,!1)};g.prototype.next=
    function(){return new g(this.value+BigInt(1))};e.prototype.prev=function(){var a=this.value;return this.sign?new e(w(a,1),!0):B(a,1,this.sign)};f.prototype.prev=function(){var a=this.value;return -9007199254740992<a-1?new f(a-1):new e(za,!0)};g.prototype.prev=function(){return new g(this.value-BigInt(1))};for(var K=[1];1E7>=2*K[K.length-1];)K.push(2*K[K.length-1]);var ka=K.length,W=K[ka-1];e.prototype.shiftLeft=function(a){a=y(a).toJSNumber();if(!(1E7>=Math.abs(a)))throw Error(String(a)+" is too large for shifting.");
    if(0>a)return this.shiftRight(-a);var b=this;if(b.isZero())return b;for(;a>=ka;)b=b.multiply(W),a-=ka-1;return b.multiply(K[a])};g.prototype.shiftLeft=f.prototype.shiftLeft=e.prototype.shiftLeft;e.prototype.shiftRight=function(a){var b;a=y(a).toJSNumber();if(!(1E7>=Math.abs(a)))throw Error(String(a)+" is too large for shifting.");if(0>a)return this.shiftLeft(-a);for(b=this;a>=ka;){if(b.isZero()||b.isNegative()&&b.isUnit())return b;b=V(b,W);b=b[1].isNegative()?b[0].prev():b[0];a-=ka-1;}b=V(b,K[a]);
    return b[1].isNegative()?b[0].prev():b[0]};g.prototype.shiftRight=f.prototype.shiftRight=e.prototype.shiftRight;e.prototype.not=function(){return this.negate().prev()};g.prototype.not=f.prototype.not=e.prototype.not;e.prototype.and=function(a){return Ba(this,a,function(a,b){return a&b})};g.prototype.and=f.prototype.and=e.prototype.and;e.prototype.or=function(a){return Ba(this,a,function(a,b){return a|b})};g.prototype.or=f.prototype.or=e.prototype.or;e.prototype.xor=function(a){return Ba(this,a,function(a,
    b){return a^b})};g.prototype.xor=f.prototype.xor=e.prototype.xor;e.prototype.bitLength=function(){var a=this;0>a.compareTo(b(0))&&(a=a.negate().subtract(b(1)));return 0===a.compareTo(b(0))?b(0):b(Va(a,b(2)).e).add(b(1))};g.prototype.bitLength=f.prototype.bitLength=e.prototype.bitLength;e.prototype.toArray=function(a){return ja(this,a)};f.prototype.toArray=function(a){return ja(this,a)};g.prototype.toArray=function(a){return ja(this,a)};e.prototype.toString=function(b,c){b===a&&(b=10);if(10!==b)return Ya(this,
    b,c);b=this.value;c=b.length;for(var d=String(b[--c]),e;0<=--c;)e=String(b[c]),d+="0000000".slice(e.length)+e;return (this.sign?"-":"")+d};f.prototype.toString=function(b,c){b===a&&(b=10);return 10!=b?Ya(this,b,c):String(this.value)};g.prototype.toString=f.prototype.toString;g.prototype.toJSON=e.prototype.toJSON=f.prototype.toJSON=function(){return this.toString()};e.prototype.valueOf=function(){return parseInt(this.toString(),10)};e.prototype.toJSNumber=e.prototype.valueOf;f.prototype.valueOf=function(){return this.value};
    f.prototype.toJSNumber=f.prototype.valueOf;g.prototype.valueOf=g.prototype.toJSNumber=function(){return parseInt(this.toString(),10)};for(var X=0;1E3>X;X++)c[X]=y(X),0<X&&(c[-X]=y(-X));c.one=c[1];c.zero=c[0];c.minusOne=c[-1];c.max=Wa;c.min=Ca;c.gcd=Xa;c.lcm=function(a,b){a=y(a).abs();b=y(b).abs();return a.divide(Xa(a,b)).multiply(b)};c.isInstance=function(a){return a instanceof e||a instanceof f||a instanceof g};c.randBetween=function(a,b,d){a=y(a);b=y(b);d=d||Math.random;var e=Ca(a,b);a=Wa(a,b).subtract(e).add(1);
    if(a.isSmall)return e.add(Math.floor(d()*a));a=ja(a,1E7).value;b=[];for(var f=!0,g=0;g<a.length;g++){var h=f?a[g]:1E7,k=x(d()*h);b.push(k);k<h&&(f=!1);}return e.add(c.fromArray(b,1E7,!1))};c.fromArray=function(a,b,c){return Ta(a.map(y),y(b||10),c)};return c}();a.hasOwnProperty("exports")&&(a.exports=b);});let Ab=void 0;
    const Z=async(a,b)=>{if(Y.worker)return a=await Y.worker.postMessage({type:r.RUN_WASM_EXPORT,export:a,parameters:b}),C(a).message.response},Bb=async(a,b)=>{if(Y.worker)return a=await Y.worker.postMessage({type:r.GET_WASM_MEMORY_SECTION,start:a,end:b}),a=C(a),new Uint8Array(a.message.response)},Cb=async(a)=>{if(Y.worker)return a=await Y.worker.postMessage({type:r.GET_WASM_CONSTANT,constant:a}),C(a).message.response},Db={};
    function Eb(a){const b=C(a);if(b.message)switch(Db[b.message.type]&&Db[b.message.type].forEach((a)=>a(b.message)),b.message.type){case r.UPDATED:this.fps=b.message.fps;break;case r.BREAKPOINT:(async()=>{await this.pause();this.options.breakpointCallback&&this.options.breakpointCallback();m.runHook({key:"breakpoint"});})();break;case r.CRASHED:(async()=>{await this.pause();console.log("Wasmboy Crashed!");let a=await Z("getProgramCounter");var b=await Cb("GAMEBOY_INTERNAL_MEMORY_LOCATION");b=await Bb(b+
    a,b+a+1);console.log(`Program Counter: 0x${a.toString(16)}`);console.log(`Opcode: 0x${b[0].toString(16)}`);})();}}let Fb=!1;
    class Gb{constructor(){this.canvasElement=this.coreType=this.worker=void 0;this.loadedROM=this.renderId=this.initialized=this.loadedAndStarted=this.ready=this.paused=!1;this.fps=0;this.speed=1;this._resetConfig();"undefined"!==typeof window&&(window.addEventListener("beforeunload",function(){Fb=!0;}),window.document.addEventListener("visibilitychange",()=>{"hidden"!==document.visibilityState||this.options&&this.options.disablePauseOnHidden||setTimeout(()=>{Fb||this.pause();},0);}));}config(a,b){return (async()=>
    {await this.pause();await this.setCanvas(b);!a&&this.options||this._resetConfig();if(a&&(Object.keys(a).forEach((b)=>{void 0!==this.options[b]&&(this.options[b]=a[b]);}),a.gameboySpeed)){let b=Math.floor(60*a.gameboySpeed);0>=b&&(b=1);this.options.gameboyFrameRate=b;}})()}getConfig(){return this.options}setCanvas(a){return a?(async()=>{await this.pause();this.canvasElement=a;await E.initialize(this.canvasElement,this.options.updateGraphicsCallback);})():Promise.resolve()}getCanvas(){return this.canvasElement}addBootROM(a,
    b,c,d){return N.addBootROM(a,b,c,d)}getBootROMs(){return N.getBootROMs()}loadROM(a,b){return ob.bind(this)(a,b)}play(){return (async()=>{if(this.ready){if(!this.loadedAndStarted){this.loadedAndStarted=!0;if(this.options.onLoadedAndStarted)this.options.onLoadedAndStarted();m.runHook({key:"loadedAndStarted"});}if(this.options.onPlay)this.options.onPlay();m.runHook({key:"play"});this.options.headless||(G.resumeAudioContext(),G.resetTimeStretch());await this.worker.postMessage({type:r.RESET_AUDIO_QUEUE});
    this.paused=!1;this.updateId||await this.worker.postMessage({type:r.PLAY});this.renderId||this.options.headless||(this.renderId=T(()=>{yb.call(this);}));}})()}pause(){return (async()=>{this.paused=!0;if(this.ready&&this.options.onPause)this.options.onPause();m.runHook({key:"pause"});xb(this.renderId);this.renderId=!1;this.options.headless||G.cancelAllAudio(!0);this.worker&&await this.worker.postMessage({type:r.PAUSE});await new Promise((a)=>{T(()=>{a();});});})()}reset(a){return (async()=>{this.config(a,
    this.canvasElement);if(this.loadedROM)return this.loadROM(this.loadedROM)})()}getSavedMemory(){return N.getSavedMemory()}saveLoadedCartridge(a){return N.saveLoadedCartridge(a)}deleteSavedCartridge(a){return N.deleteSavedCartridge(a)}saveState(){return (async()=>{await this.pause();return await N.saveState()})()}getSaveStates(){return (async()=>{let a=await N.getCartridgeObject();return a?a.saveStates:[]})()}loadState(a){return (async()=>{await this.pause();await N.loadState(a);})()}deleteState(a){return (async()=>
    {await N.deleteState(a);})()}getFPS(){return this.fps}getCoreType(){return this.coreType}getSpeed(){return this.speed}setSpeed(a){0>=a&&(a=.1);(async()=>{this.worker&&(this.speed=a,G.setSpeed(a),await this.worker.postMessageIgnoreResponse({type:r.SET_SPEED,speed:a}));await new Promise((a)=>{T(()=>{a();});});})();}isGBC(){return (async()=>{const a=await Y.worker.postMessage({type:r.IS_GBC});return C(a).message.response})()}_resetConfig(){this.fpsTimeStamps=[];this.frameSkipCounter=0;this.options={headless:!1,
    disablePauseOnHidden:!1,isAudioEnabled:!0,enableAudioDebugging:!1,gameboyFrameRate:60,frameSkip:0,enableBootROMIfAvailable:!0,isGbcEnabled:!0,isGbcColorizationEnabled:!0,gbcColorizationPalette:null,audioBatchProcessing:!1,graphicsBatchProcessing:!1,timersBatchProcessing:!1,graphicsDisableScanlineRendering:!1,audioAccumulateSamples:!1,tileRendering:!1,tileCaching:!1,maxNumberOfAutoSaveStates:10,updateGraphicsCallback:null,updateAudioCallback:null,saveStateCallback:null,breakpointCallback:null,onReady:null,
    onPlay:null,onPause:null,onLoadedAndStarted:null};}_instantiateWorkers(){return (async()=>{this.worker||(this.worker=await mb(),this.worker.addMessageListener(Eb.bind(this)));})()}}const Y=new Gb;
    var Hb={name:"wasmboy",description:"Gameboy / Gameboy Color Emulator written for Web Assembly using AssemblyScript. Shell/Debugger in Preact",keywords:"web-assembly webassembly gameboy emulator emulation assemblyscript gameboy-color".split(" "),author:"Aaron Turner",version:"0.5.1",license:"GPL-3.0-or-later",homepage:"https://wasmboy.app",repository:{type:"git",url:"git+https://github.com/torch2424/wasmBoy.git"},bugs:{url:"https://github.com/torch2424/wasmBoy/issues"},main:"dist/wasmboy.wasm.cjs.js",
    module:"dist/wasmboy.wasm.esm.js",browser:"dist/wasmboy.wasm.umd.js",iife:"dist/wasmboy.wasm.iife.js",scripts:{prepare:"npx run-s core:build lib:build",start:'npx concurrently --kill-others --names "DEBUGGER,CORE,LIB" -c "bgBlue.bold,bgMagenta.bold,bgGreen.bold" "npm run debugger:watch" "npm run core:watch" "npm run lib:watch:wasm"',"start:ts":'npx concurrently --kill-others --names "DEBUGGER,LIBANDCORETS" -c "bgBlue.bold,bgGreen.bold" "npm run debugger:watch" "npm run lib:watch:ts"',dev:"npm run start",
    watch:"npm run start","dev:ts":"npm run start:ts","watch:ts":"npm run start:ts",build:"npx run-s core:build lib:build:wasm",deploy:"npx run-s lib:deploy demo:deploy",prettier:"npm run prettier:lint:fix","prettier:lint":"npx run-s prettier:lint:message prettier:lint:list","prettier:lint:message":'echo "Listing unlinted files, will show nothing if everything is fine."',"prettier:lint:list":"npx prettier --config .prettierrc --list-different rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
    "prettier:lint:fix":"npx prettier --config .prettierrc --write rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",precommit:"npx pretty-quick --staged","core:watch":'npx watch "npm run core:build" core',"core:build":"npx run-s core:build:asc core:build:dist core:build:done","core:build:asc":"npx asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wat -O3 --validate --sourceMap core/dist/core.untouched.wasm.map --memoryBase 0","core:build:ts":"npx rollup -c --environment TS",
    "core:build:asc:measure":"npm run core:build:asc -- --measure --noEmit","core:build:ts:measure":"npx tsc --project core/tsconfig.json --noEmit --extendedDiagnostics","core:build:dist":"npx run-s core:build:dist:mkdir core:build:dist:cp","core:build:dist:mkdir":"mkdir -p build/assets","core:build:dist:cp":"cp dist/core/*.untouched.* build/assets","core:build:done":'echo "Built Core!"',"lib:build":"npx run-s lib:build:wasm lib:build:ts lib:build:ts:getcoreclosure","lib:watch:wasm":"npx rollup -c -w --environment WASM",
    "lib:build:wasm":"npx rollup -c --environment PROD,WASM","lib:watch:ts":"npx rollup -c -w --environment TS","lib:build:ts":"npx rollup -c --environment PROD,TS","lib:build:ts:esnext":"npx rollup -c --environment PROD,TS,ES_NEXT","lib:build:ts:getcoreclosure":"npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE","lib:build:ts:getcoreclosure:closuredebug":"npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE,CLOSURE_DEBUG","lib:deploy":"npx run-s core:build lib:build:wasm lib:build:ts lib:deploy:np",
    "lib:deploy:np":"npx np",test:"npm run test:accuracy","test:accuracy":"npx run-s build test:accuracy:nobuild","test:accuracy:nobuild":"node --experimental-worker node_modules/mocha/bin/_mocha test/accuracy/accuracy-test.js --exit","test:perf":"npm run test:performance","test:performance":"npx run-s build test:performance:nobuild","test:performance:nobuild":"node --experimental-worker node_modules/mocha/bin/_mocha test/performance/performance-test.js --exit","test:integration":"npx run-s build test:integration:nobuild",
    "test:integration:nobuild":"node --experimental-worker node_modules/mocha/bin/_mocha test/integration/integration-test.js --exit","debugger:dev":"npm run debugger:watch","debugger:watch":"npx rollup -c -w --environment DEBUGGER,SERVE","debugger:build":"npx rollup -c --environment DEBUGGER","debugger:build:skiplib":"npx rollup -c --environment DEBUGGER,SKIP_LIB","benchmark:build":"npx rollup -c --environment PROD,TS,BENCHMARK","benchmark:build:skiplib":"npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
    "benchmark:dev":"npm run benchmark:watch","benchmark:watch":"npx rollup -c -w --environment BENCHMARK,SERVE","amp:build":"npx rollup -c --environment PROD,TS,AMP","amp:build:skiplib":"npx rollup -c --environment PROD,TS,AMP,SKIP_LIB","amp:dev":"npm run amp:watch","amp:watch":"npx rollup -c -w --environment AMP,SERVE","iframe:dev":"npm run iframe:watch","iframe:watch":"npx rollup -c -w --environment IFRAME,SERVE","iframe:serve":"npx serve build/iframe -p 8080","iframe:build":"npx rollup -c --environment IFRAME",
    "iframe:build:skiplib":"npx rollup -c --environment IFRAME,SKIP_LIB","demo:build":"npx run-s core:build lib:build demo:build:apps","demo:build:apps":"npx run-s debugger:build:skiplib benchmark:build:skiplib amp:build:skiplib iframe:build:skiplib","demo:cname":"echo 'wasmboy.app' > build/CNAME","demo:dist":"cp -r dist/ build/dist","demo:gh-pages":"npx gh-pages -d build","demo:deploy":"npx run-s demo:build demo:dist demo:cname demo:gh-pages","wasmerboy:build":"npx asc demo/wasmerboy/index.ts -b demo/wasmerboy/dist/wasmerboy.wasm -O3 --validate --use abort=wasi_abort --runtime stub --memoryBase 8324096",
    "wasmerboy:start":"cd demo/wasmerboy && wapm run wasmerboy --dir=tobutobugirl tobutobugirl/tobutobugirl.gb && cd .."},files:["dist","README.md","LICENSE"],dependencies:{"audiobuffer-to-wav":"git+https://github.com/torch2424/audiobuffer-to-wav.git#es-module-rollup",idb:"^2.1.3",raf:"^3.4.0","responsive-gamepad":"1.1.0"},devDependencies:{"@ampproject/rollup-plugin-closure-compiler":"^0.7.2","@babel/core":"^7.1.2","@babel/plugin-proposal-class-properties":"^7.1.0","@babel/plugin-proposal-export-default-from":"^7.2.0",
    "@babel/plugin-proposal-object-rest-spread":"^7.0.0","@babel/plugin-transform-react-jsx":"^7.0.0","@phosphor/commands":"^1.6.1","@phosphor/default-theme":"^0.1.0","@phosphor/messaging":"^1.2.2","@phosphor/widgets":"^1.6.0","@rollup/plugin-commonjs":"^11.0.2","@rollup/plugin-node-resolve":"^7.1.1","@wasmer/io-devices-lib-assemblyscript":"^0.1.3","as-wasi":"git+https://github.com/jedisct1/as-wasi.git",assemblyscript:"^0.8.1","babel-plugin-filter-imports":"^2.0.3","babel-preset-env":"^1.6.1","big-integer":"^1.6.38",
    "browser-detect":"^0.2.28",bulma:"^0.7.1","chart.js":"^2.7.3","chartjs-plugin-downsample":"^1.0.2",chota:"^0.5.2",concurrently:"^3.5.1","devtools-detect":"^2.2.0","gb-instructions-opcodes":"0.0.4","gh-pages":"^1.1.0","hash-generator":"^0.1.0",husky:"^1.0.0-rc.8","load-script":"^1.0.0","markdown-table":"^1.1.1",microseconds:"^0.1.0",mocha:"^5.0.1","normalize.css":"^8.0.1",np:"^3.1.0","npm-run-all":"^4.1.5","performance-now":"^2.1.0","pngjs-image":"^0.11.7","postcss-import":"^12.0.1",preact:"^8.2.1",
    "preact-compat":"^3.17.0","preact-portal":"^1.1.3","preact-virtual-list":"^0.3.1",prettier:"^1.12.1","pretty-quick":"^1.6.0",pubx:"0.0.3","recursive-readdir-sync":"^1.0.6",rollup:"^0.66.1","rollup-plugin-babel":"^4.0.3","rollup-plugin-bundle-size":"^1.0.2","rollup-plugin-commonjs":"^9.2.0","rollup-plugin-copy-glob":"^0.2.2","rollup-plugin-delete":"^0.1.2","rollup-plugin-hash":"^1.3.0","rollup-plugin-json":"^3.1.0","rollup-plugin-livereload":"^1.0.4","rollup-plugin-node-resolve":"^3.4.0","rollup-plugin-postcss":"^1.6.2",
    "rollup-plugin-replace":"^2.1.0","rollup-plugin-serve":"^0.6.0","rollup-plugin-svelte":"^5.1.1","rollup-plugin-terser":"^5.2.0","rollup-plugin-typescript":"^1.0.0","rollup-plugin-url":"^2.1.0",serve:"^11.3.0","shared-gb":"git+https://github.com/torch2424/shared-gb-js.git","source-map-loader":"^0.2.4","stats-lite":"^2.2.0",svelte:"^3.19.2",terser:"^4.6.6",traverse:"^0.6.6",tslib:"^1.9.3",typescript:"^3.1.3","uglifyjs-webpack-plugin":"^1.2.3","url-loader":"^1.0.1",valoo:"^2.1.0",watch:"^1.0.2","webpack-dev-server":"^3.1.10"}};
    const Ib={config:Y.config.bind(Y),getCoreType:Y.getCoreType.bind(Y),getConfig:Y.getConfig.bind(Y),setCanvas:Y.setCanvas.bind(Y),getCanvas:Y.getCanvas.bind(Y),addBootROM:Y.addBootROM.bind(Y),getBootROMs:Y.getBootROMs.bind(Y),loadROM:Y.loadROM.bind(Y),play:Y.play.bind(Y),pause:Y.pause.bind(Y),reset:Y.reset.bind(Y),addPlugin:m.addPlugin.bind(m),isPlaying:()=>!Y.paused,isPaused:()=>Y.paused,isReady:()=>Y.ready,isLoadedAndStarted:()=>Y.loadedAndStarted,getVersion:()=>Hb.version,getSavedMemory:Y.getSavedMemory.bind(Y),
    saveLoadedCartridge:Y.saveLoadedCartridge.bind(Y),deleteSavedCartridge:Y.deleteSavedCartridge.bind(Y),saveState:Y.saveState.bind(Y),getSaveStates:Y.getSaveStates.bind(Y),loadState:Y.loadState.bind(Y),deleteState:Y.deleteState.bind(Y),getFPS:Y.getFPS.bind(Y),setSpeed:Y.setSpeed.bind(Y),isGBC:Y.isGBC.bind(Y),ResponsiveGamepad:Q.ResponsiveGamepad,enableDefaultJoypad:Q.enableDefaultJoypad.bind(Q),disableDefaultJoypad:Q.disableDefaultJoypad.bind(Q),setJoypadState:Q.setJoypadState.bind(Q),resumeAudioContext:G.resumeAudioContext.bind(G),
    _getAudioChannels:G.getAudioChannels.bind(G),_getCartridgeInfo:N.getCartridgeInfo.bind(N),_runNumberOfFrames:async(a)=>{await Y.pause();const b=()=>{Ab=T(()=>{Ab&&(Y.worker.postMessage({type:r.FORCE_OUTPUT_FRAME}),E.renderFrame(),b());});};b();for(let b=0;b<a;b++)await Z("executeFrame",[]);Ab=void 0;Y.worker.postMessage({type:r.FORCE_OUTPUT_FRAME});E.renderFrame();},_runWasmExport:Z,_getWasmMemorySection:Bb,_getWasmConstant:Cb,_getStepsAsString:async(a)=>{var b=await Z("getStepsPerStepSet");const c=
    await Z("getStepSets"),d=await Z("getSteps");b=zb(b).multiply(c).add(d);return a?b.toString(a):b.toString(10)},_getCyclesAsString:async(a)=>{var b=await Z("getCyclesPerCycleSet");const c=await Z("getCycleSets"),d=await Z("getCycles");b=zb(b).multiply(c).add(d);return a?b.toString(a):b.toString(10)}};var WasmBoy=Ib;//# sourceMappingURL=wasmboy.wasm.esm.js.map

    /* demo/iframe/components/WasmBoy.svelte generated by Svelte v3.19.2 */

    const { console: console_1 } = globals;
    const file$2 = "demo/iframe/components/WasmBoy.svelte";

    // (79:0) {#if $isLoaded === false}
    function create_if_block$1(ctx) {
    	let div;
    	let promise;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		error: 9
    	};

    	handle_promise(promise = /*wasmBoyPromise*/ ctx[3], info);

    	const block = {
    		c: function create() {
    			div = element("div");
    			info.block.c();
    			attr_dev(div, "class", "status svelte-1r43jy9");
    			add_location(div, file$2, 79, 0, 1963);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			info.block.m(div, info.anchor = null);
    			info.mount = () => div;
    			info.anchor = null;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			{
    				const child_ctx = ctx.slice();
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			info.block.d();
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(79:0) {#if $isLoaded === false}",
    		ctx
    	});

    	return block;
    }

    // (88:2) {:catch error}
    function create_catch_block(ctx) {
    	let div;
    	let t0;
    	let h3;
    	let t1_value = /*error*/ ctx[9].message + "";
    	let t1;

    	function select_block_type_1(ctx, dirty) {
    		if (/*$romName*/ ctx[2]) return create_if_block_2;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx, -1);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t0 = space();
    			h3 = element("h3");
    			t1 = text(t1_value);
    			add_location(h3, file$2, 94, 6, 2309);
    			attr_dev(div, "class", "error");
    			add_location(div, file$2, 88, 4, 2166);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, h3);
    			append_dev(h3, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t0);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(88:2) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (92:6) {:else}
    function create_else_block_1(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Error!";
    			add_location(h3, file$2, 92, 8, 2275);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(92:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (90:6) {#if $romName}
    function create_if_block_2(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text("Error loading ");
    			t1 = text(/*$romName*/ ctx[2]);
    			t2 = text(" ...");
    			add_location(h2, file$2, 90, 8, 2215);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			append_dev(h2, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$romName*/ 4) set_data_dev(t1, /*$romName*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(90:6) {#if $romName}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import { onMount }
    function create_then_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(1:0) <script>   import { onMount }",
    		ctx
    	});

    	return block;
    }

    // (81:25)      {#if $romName}
    function create_pending_block(ctx) {
    	let t;
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*$romName*/ ctx[2]) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			t = space();
    			div = element("div");
    			attr_dev(div, "class", "donut");
    			add_location(div, file$2, 86, 4, 2119);
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(t.parentNode, t);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(81:25)      {#if $romName}",
    		ctx
    	});

    	return block;
    }

    // (84:4) {:else}
    function create_else_block(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Loading...";
    			add_location(h2, file$2, 84, 6, 2085);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(84:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (82:4) {#if $romName}
    function create_if_block_1(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text("Loading ");
    			t1 = text(/*$romName*/ ctx[2]);
    			t2 = text(" ...");
    			add_location(h2, file$2, 82, 6, 2035);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			append_dev(h2, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$romName*/ 4) set_data_dev(t1, /*$romName*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(82:4) {#if $romName}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let canvas;
    	let t;
    	let if_block_anchor;
    	let if_block = /*$isLoaded*/ ctx[1] === false && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			canvas = element("canvas");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(canvas, "class", "svelte-1r43jy9");
    			add_location(canvas, file$2, 75, 2, 1918);
    			attr_dev(div, "class", "canvas-container svelte-1r43jy9");
    			attr_dev(div, "style", /*canvasStyle*/ ctx[0]);
    			add_location(div, file$2, 74, 0, 1865);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, canvas);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*canvasStyle*/ 1) {
    				attr_dev(div, "style", /*canvasStyle*/ ctx[0]);
    			}

    			if (/*$isLoaded*/ ctx[1] === false) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $romUrl;
    	let $isStarted;
    	let $isLoaded;
    	let $romName;
    	validate_store(romUrl, "romUrl");
    	component_subscribe($$self, romUrl, $$value => $$invalidate(5, $romUrl = $$value));
    	validate_store(isStarted, "isStarted");
    	component_subscribe($$self, isStarted, $$value => $$invalidate(6, $isStarted = $$value));
    	validate_store(isLoaded, "isLoaded");
    	component_subscribe($$self, isLoaded, $$value => $$invalidate(1, $isLoaded = $$value));
    	validate_store(romName, "romName");
    	component_subscribe($$self, romName, $$value => $$invalidate(2, $romName = $$value));
    	let mountResolve;

    	let mountPromise = new Promise(resolve => {
    			mountResolve = resolve;
    		});

    	onMount(mountResolve);
    	let canvasStyle = "display: none";

    	const loadWasmBoy = async () => {
    		await mountPromise;
    		const wasmBoyCanvas = document.querySelector(".canvas-container > canvas");

    		const EmbedPlugin = {
    			name: "EmbedPlugin",
    			saveState: saveStateObject => {
    				if (wasmBoyCanvas) {
    					saveStateObject.screenshotCanvasDataURL = wasmBoyCanvas.toDataURL();
    				}
    			},
    			play: () => isPlaying.set(true),
    			pause: () => {
    				isPlaying.set(false);
    				setStatus("Paused", -1);
    			}
    		};

    		await WasmBoy.config({
    			isGbcEnabled: true,
    			isGbcColorizationEnabled: true,
    			isAudioEnabled: true,
    			gameboyFrameRate: 60,
    			maxNumberOfAutoSaveStates: 3
    		});

    		await WasmBoy.setCanvas(wasmBoyCanvas);
    		WasmBoy.addPlugin(EmbedPlugin);
    		await WasmBoy.loadROM($romUrl);
    		await WasmBoy.play();
    		$$invalidate(0, canvasStyle = "display: block");
    		isLoaded.set(true);
    		isPlaying.set(true);
    	};

    	const wasmBoyPromise = loadWasmBoy().catch(error => {
    		console.error(error);
    		throw error;
    	});

    	isPlaying.subscribe(async value => {
    		if (!WasmBoy.isPlaying() && value) {
    			await WasmBoy.play();
    		} else if (WasmBoy.isPlaying() && !value) {
    			await WasmBoy.pause();
    		}
    	});

    	saveState.subscribe(() => {
    		if ($isStarted && $isLoaded) {
    			WasmBoy.saveState().then(() => {
    				WasmBoy.play();
    				setStatus("State Saved!");
    			}).catch(() => {
    				setStatus("Error saving the state...");
    			});
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<WasmBoy> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("WasmBoy", $$slots, []);

    	$$self.$capture_state = () => ({
    		onMount,
    		isStarted,
    		isLoaded,
    		isPlaying,
    		romUrl,
    		romName,
    		saveState,
    		setStatus,
    		WasmBoy,
    		mountResolve,
    		mountPromise,
    		canvasStyle,
    		loadWasmBoy,
    		wasmBoyPromise,
    		$romUrl,
    		$isStarted,
    		$isLoaded,
    		$romName
    	});

    	$$self.$inject_state = $$props => {
    		if ("mountResolve" in $$props) mountResolve = $$props.mountResolve;
    		if ("mountPromise" in $$props) mountPromise = $$props.mountPromise;
    		if ("canvasStyle" in $$props) $$invalidate(0, canvasStyle = $$props.canvasStyle);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [canvasStyle, $isLoaded, $romName, wasmBoyPromise];
    }

    class WasmBoy_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "WasmBoy_1",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* demo/iframe/components/LoadState.svelte generated by Svelte v3.19.2 */

    const { console: console_1$1 } = globals;
    const file$3 = "demo/iframe/components/LoadState.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (48:0) {:catch error}
    function create_catch_block$1(ctx) {
    	let p;
    	let t_value = /*error*/ ctx[4].message + "";
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(t_value);
    			set_style(p, "color", "red");
    			add_location(p, file$3, 48, 2, 1203);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block$1.name,
    		type: "catch",
    		source: "(48:0) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (34:0) {:then saveStates}
    function create_then_block$1(ctx) {
    	let ul;
    	let each_value = /*saveStates*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "svelte-17y6lo8");
    			add_location(ul, file$3, 34, 2, 786);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*handleLoadState, wasmBoySaveStates, Date*/ 3) {
    				each_value = /*saveStates*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block$1.name,
    		type: "then",
    		source: "(34:0) {:then saveStates}",
    		ctx
    	});

    	return block;
    }

    // (36:4) {#each saveStates as saveState}
    function create_each_block(ctx) {
    	let li;
    	let button;
    	let img;
    	let img_src_value;
    	let t0;
    	let div;
    	let h2;
    	let t1_value = new Date(/*saveState*/ ctx[5].date).toLocaleString() + "";
    	let t1;
    	let t2;
    	let h4;

    	let t3_value = (/*saveState*/ ctx[5].isAuto
    	? "Auto Save"
    	: "Manual Save") + "";

    	let t3;
    	let t4;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[2](/*saveState*/ ctx[5], ...args);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			button = element("button");
    			img = element("img");
    			t0 = space();
    			div = element("div");
    			h2 = element("h2");
    			t1 = text(t1_value);
    			t2 = space();
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			if (img.src !== (img_src_value = /*saveState*/ ctx[5].screenshotCanvasDataURL)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Save State Screenshot");
    			attr_dev(img, "class", "svelte-17y6lo8");
    			add_location(img, file$3, 38, 8, 902);
    			add_location(h2, file$3, 40, 10, 1002);
    			add_location(h4, file$3, 41, 10, 1067);
    			attr_dev(div, "class", "svelte-17y6lo8");
    			add_location(div, file$3, 39, 8, 986);
    			attr_dev(button, "class", "svelte-17y6lo8");
    			add_location(button, file$3, 37, 6, 842);
    			attr_dev(li, "class", "svelte-17y6lo8");
    			add_location(li, file$3, 36, 4, 831);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, button);
    			append_dev(button, img);
    			append_dev(button, t0);
    			append_dev(button, div);
    			append_dev(div, h2);
    			append_dev(h2, t1);
    			append_dev(div, t2);
    			append_dev(div, h4);
    			append_dev(h4, t3);
    			append_dev(li, t4);
    			dispose = listen_dev(button, "click", click_handler, false, false, false);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(36:4) {#each saveStates as saveState}",
    		ctx
    	});

    	return block;
    }

    // (32:26)    <div class="donut"></div> {:then saveStates}
    function create_pending_block$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "donut svelte-17y6lo8");
    			add_location(div, file$3, 32, 2, 739);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block$1.name,
    		type: "pending",
    		source: "(32:26)    <div class=\\\"donut\\\"></div> {:then saveStates}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let await_block_anchor;
    	let promise;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 3,
    		error: 4
    	};

    	handle_promise(promise = /*wasmBoySaveStates*/ ctx[0], info);

    	const block = {
    		c: function create() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			{
    				const child_ctx = ctx.slice();
    				child_ctx[3] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	const wasmBoySaveStates = WasmBoy.getSaveStates().then(saveStates => {
    		// Sort by date
    		saveStates.sort((a, b) => {
    			if (a.date > b.date) {
    				return -1;
    			}

    			if (a.date < b.date) {
    				return 1;
    			}

    			return 0;
    		});

    		return Promise.resolve(saveStates);
    	}).catch(error => {
    		console.error(error);
    		throw error;
    	});

    	const handleLoadState = async saveState$$1 => {
    		await WasmBoy.loadState(saveState$$1);
    		await WasmBoy.play();
    		hideModal();
    		setStatus("State Loaded!");
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<LoadState> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("LoadState", $$slots, []);
    	const click_handler = (saveState$$1, e) => handleLoadState(saveState$$1);

    	$$self.$capture_state = () => ({
    		WasmBoy,
    		setStatus,
    		hideModal,
    		wasmBoySaveStates,
    		handleLoadState
    	});

    	return [wasmBoySaveStates, handleLoadState, click_handler];
    }

    class LoadState extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LoadState",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    var name = "wasmboy";
    var description = "Gameboy / Gameboy Color Emulator written for Web Assembly using AssemblyScript. Shell/Debugger in Preact";
    var keywords = [
    	"web-assembly",
    	"webassembly",
    	"gameboy",
    	"emulator",
    	"emulation",
    	"assemblyscript",
    	"gameboy-color"
    ];
    var author = "Aaron Turner";
    var version = "0.5.1";
    var license = "GPL-3.0-or-later";
    var homepage = "https://wasmboy.app";
    var repository = {
    	type: "git",
    	url: "git+https://github.com/torch2424/wasmBoy.git"
    };
    var bugs = {
    	url: "https://github.com/torch2424/wasmBoy/issues"
    };
    var main = "dist/wasmboy.wasm.cjs.js";
    var module$1 = "dist/wasmboy.wasm.esm.js";
    var browser = "dist/wasmboy.wasm.umd.js";
    var iife = "dist/wasmboy.wasm.iife.js";
    var scripts = {
    	prepare: "npx run-s core:build lib:build",
    	start: "npx concurrently --kill-others --names \"DEBUGGER,CORE,LIB\" -c \"bgBlue.bold,bgMagenta.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run core:watch\" \"npm run lib:watch:wasm\"",
    	"start:ts": "npx concurrently --kill-others --names \"DEBUGGER,LIBANDCORETS\" -c \"bgBlue.bold,bgGreen.bold\" \"npm run debugger:watch\" \"npm run lib:watch:ts\"",
    	dev: "npm run start",
    	watch: "npm run start",
    	"dev:ts": "npm run start:ts",
    	"watch:ts": "npm run start:ts",
    	build: "npx run-s core:build lib:build:wasm",
    	deploy: "npx run-s lib:deploy demo:deploy",
    	prettier: "npm run prettier:lint:fix",
    	"prettier:lint": "npx run-s prettier:lint:message prettier:lint:list",
    	"prettier:lint:message": "echo \"Listing unlinted files, will show nothing if everything is fine.\"",
    	"prettier:lint:list": "npx prettier --config .prettierrc --list-different rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
    	"prettier:lint:fix": "npx prettier --config .prettierrc --write rollup.*.js preact.config.js demo/**/*.js demo/**/*.css lib/**/*.js core/**/*.ts",
    	precommit: "npx pretty-quick --staged",
    	"core:watch": "npx watch \"npm run core:build\" core",
    	"core:build": "npx run-s core:build:asc core:build:dist core:build:done",
    	"core:build:asc": "npx asc core/index.ts -b dist/core/core.untouched.wasm -t dist/core/core.untouched.wat -O3 --validate --sourceMap core/dist/core.untouched.wasm.map --memoryBase 0",
    	"core:build:ts": "npx rollup -c --environment TS",
    	"core:build:asc:measure": "npm run core:build:asc -- --measure --noEmit",
    	"core:build:ts:measure": "npx tsc --project core/tsconfig.json --noEmit --extendedDiagnostics",
    	"core:build:dist": "npx run-s core:build:dist:mkdir core:build:dist:cp",
    	"core:build:dist:mkdir": "mkdir -p build/assets",
    	"core:build:dist:cp": "cp dist/core/*.untouched.* build/assets",
    	"core:build:done": "echo \"Built Core!\"",
    	"lib:build": "npx run-s lib:build:wasm lib:build:ts lib:build:ts:getcoreclosure",
    	"lib:watch:wasm": "npx rollup -c -w --environment WASM",
    	"lib:build:wasm": "npx rollup -c --environment PROD,WASM",
    	"lib:watch:ts": "npx rollup -c -w --environment TS",
    	"lib:build:ts": "npx rollup -c --environment PROD,TS",
    	"lib:build:ts:esnext": "npx rollup -c --environment PROD,TS,ES_NEXT",
    	"lib:build:ts:getcoreclosure": "npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE",
    	"lib:build:ts:getcoreclosure:closuredebug": "npx rollup -c --environment PROD,TS,GET_CORE_CLOSURE,CLOSURE_DEBUG",
    	"lib:deploy": "npx run-s core:build lib:build:wasm lib:build:ts lib:deploy:np",
    	"lib:deploy:np": "npx np",
    	test: "npm run test:accuracy",
    	"test:accuracy": "npx run-s build test:accuracy:nobuild",
    	"test:accuracy:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/accuracy/accuracy-test.js --exit",
    	"test:perf": "npm run test:performance",
    	"test:performance": "npx run-s build test:performance:nobuild",
    	"test:performance:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/performance/performance-test.js --exit",
    	"test:integration": "npx run-s build test:integration:nobuild",
    	"test:integration:nobuild": "node --experimental-worker node_modules/mocha/bin/_mocha test/integration/integration-test.js --exit",
    	"debugger:dev": "npm run debugger:watch",
    	"debugger:watch": "npx rollup -c -w --environment DEBUGGER,SERVE",
    	"debugger:build": "npx rollup -c --environment DEBUGGER",
    	"debugger:build:skiplib": "npx rollup -c --environment DEBUGGER,SKIP_LIB",
    	"benchmark:build": "npx rollup -c --environment PROD,TS,BENCHMARK",
    	"benchmark:build:skiplib": "npx rollup -c --environment PROD,TS,BENCHMARK,SKIP_LIB",
    	"benchmark:dev": "npm run benchmark:watch",
    	"benchmark:watch": "npx rollup -c -w --environment BENCHMARK,SERVE",
    	"amp:build": "npx rollup -c --environment PROD,TS,AMP",
    	"amp:build:skiplib": "npx rollup -c --environment PROD,TS,AMP,SKIP_LIB",
    	"amp:dev": "npm run amp:watch",
    	"amp:watch": "npx rollup -c -w --environment AMP,SERVE",
    	"iframe:dev": "npm run iframe:watch",
    	"iframe:watch": "npx rollup -c -w --environment IFRAME,SERVE",
    	"iframe:serve": "npx serve build/iframe -p 8080",
    	"iframe:build": "npx rollup -c --environment IFRAME",
    	"iframe:build:skiplib": "npx rollup -c --environment IFRAME,SKIP_LIB",
    	"demo:build": "npx run-s core:build lib:build demo:build:apps",
    	"demo:build:apps": "npx run-s debugger:build:skiplib benchmark:build:skiplib amp:build:skiplib iframe:build:skiplib",
    	"demo:cname": "echo 'wasmboy.app' > build/CNAME",
    	"demo:dist": "cp -r dist/ build/dist",
    	"demo:gh-pages": "npx gh-pages -d build",
    	"demo:deploy": "npx run-s demo:build demo:dist demo:cname demo:gh-pages",
    	"wasmerboy:build": "npx asc demo/wasmerboy/index.ts -b demo/wasmerboy/dist/wasmerboy.wasm -O3 --validate --use abort=wasi_abort --runtime stub --memoryBase 8324096",
    	"wasmerboy:start": "cd demo/wasmerboy && wapm run wasmerboy --dir=tobutobugirl tobutobugirl/tobutobugirl.gb && cd .."
    };
    var files = [
    	"dist",
    	"README.md",
    	"LICENSE"
    ];
    var dependencies = {
    	"audiobuffer-to-wav": "git+https://github.com/torch2424/audiobuffer-to-wav.git#es-module-rollup",
    	idb: "^2.1.3",
    	raf: "^3.4.0",
    	"responsive-gamepad": "1.1.0"
    };
    var devDependencies = {
    	"@ampproject/rollup-plugin-closure-compiler": "^0.7.2",
    	"@babel/core": "^7.1.2",
    	"@babel/plugin-proposal-class-properties": "^7.1.0",
    	"@babel/plugin-proposal-export-default-from": "^7.2.0",
    	"@babel/plugin-proposal-object-rest-spread": "^7.0.0",
    	"@babel/plugin-transform-react-jsx": "^7.0.0",
    	"@phosphor/commands": "^1.6.1",
    	"@phosphor/default-theme": "^0.1.0",
    	"@phosphor/messaging": "^1.2.2",
    	"@phosphor/widgets": "^1.6.0",
    	"@rollup/plugin-commonjs": "^11.0.2",
    	"@rollup/plugin-node-resolve": "^7.1.1",
    	"@wasmer/io-devices-lib-assemblyscript": "^0.1.3",
    	"as-wasi": "git+https://github.com/jedisct1/as-wasi.git",
    	assemblyscript: "^0.8.1",
    	"babel-plugin-filter-imports": "^2.0.3",
    	"babel-preset-env": "^1.6.1",
    	"big-integer": "^1.6.38",
    	"browser-detect": "^0.2.28",
    	bulma: "^0.7.1",
    	"chart.js": "^2.7.3",
    	"chartjs-plugin-downsample": "^1.0.2",
    	chota: "^0.5.2",
    	concurrently: "^3.5.1",
    	"devtools-detect": "^2.2.0",
    	"gb-instructions-opcodes": "0.0.4",
    	"gh-pages": "^1.1.0",
    	"hash-generator": "^0.1.0",
    	husky: "^1.0.0-rc.8",
    	"load-script": "^1.0.0",
    	"markdown-table": "^1.1.1",
    	microseconds: "^0.1.0",
    	mocha: "^5.0.1",
    	"normalize.css": "^8.0.1",
    	np: "^3.1.0",
    	"npm-run-all": "^4.1.5",
    	"performance-now": "^2.1.0",
    	"pngjs-image": "^0.11.7",
    	"postcss-import": "^12.0.1",
    	preact: "^8.2.1",
    	"preact-compat": "^3.17.0",
    	"preact-portal": "^1.1.3",
    	"preact-virtual-list": "^0.3.1",
    	prettier: "^1.12.1",
    	"pretty-quick": "^1.6.0",
    	pubx: "0.0.3",
    	"recursive-readdir-sync": "^1.0.6",
    	rollup: "^0.66.1",
    	"rollup-plugin-babel": "^4.0.3",
    	"rollup-plugin-bundle-size": "^1.0.2",
    	"rollup-plugin-commonjs": "^9.2.0",
    	"rollup-plugin-copy-glob": "^0.2.2",
    	"rollup-plugin-delete": "^0.1.2",
    	"rollup-plugin-hash": "^1.3.0",
    	"rollup-plugin-json": "^3.1.0",
    	"rollup-plugin-livereload": "^1.0.4",
    	"rollup-plugin-node-resolve": "^3.4.0",
    	"rollup-plugin-postcss": "^1.6.2",
    	"rollup-plugin-replace": "^2.1.0",
    	"rollup-plugin-serve": "^0.6.0",
    	"rollup-plugin-svelte": "^5.1.1",
    	"rollup-plugin-terser": "^5.2.0",
    	"rollup-plugin-typescript": "^1.0.0",
    	"rollup-plugin-url": "^2.1.0",
    	serve: "^11.3.0",
    	"shared-gb": "git+https://github.com/torch2424/shared-gb-js.git",
    	"source-map-loader": "^0.2.4",
    	"stats-lite": "^2.2.0",
    	svelte: "^3.19.2",
    	terser: "^4.6.6",
    	traverse: "^0.6.6",
    	tslib: "^1.9.3",
    	typescript: "^3.1.3",
    	"uglifyjs-webpack-plugin": "^1.2.3",
    	"url-loader": "^1.0.1",
    	valoo: "^2.1.0",
    	watch: "^1.0.2",
    	"webpack-dev-server": "^3.1.10"
    };
    var packageJson = {
    	name: name,
    	description: description,
    	keywords: keywords,
    	author: author,
    	version: version,
    	license: license,
    	homepage: homepage,
    	repository: repository,
    	bugs: bugs,
    	main: main,
    	module: module$1,
    	browser: browser,
    	iife: iife,
    	scripts: scripts,
    	files: files,
    	dependencies: dependencies,
    	devDependencies: devDependencies
    };

    /* demo/iframe/components/About.svelte generated by Svelte v3.19.2 */
    const file$4 = "demo/iframe/components/About.svelte";

    // (18:4) {#if $romName}
    function create_if_block_2$1(ctx) {
    	let li;
    	let b;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			li = element("li");
    			b = element("b");
    			b.textContent = "ROM Name:";
    			t1 = space();
    			t2 = text(/*$romName*/ ctx[0]);
    			add_location(b, file$4, 18, 10, 1226);
    			add_location(li, file$4, 18, 6, 1222);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, b);
    			append_dev(li, t1);
    			append_dev(li, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$romName*/ 1) set_data_dev(t2, /*$romName*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(18:4) {#if $romName}",
    		ctx
    	});

    	return block;
    }

    // (21:4) {#if $romUrl}
    function create_if_block_1$1(ctx) {
    	let li;
    	let b;
    	let t1;
    	let a;
    	let t2;

    	const block = {
    		c: function create() {
    			li = element("li");
    			b = element("b");
    			b.textContent = "ROM URL:";
    			t1 = space();
    			a = element("a");
    			t2 = text(/*$romUrl*/ ctx[1]);
    			add_location(b, file$4, 21, 10, 1297);
    			attr_dev(a, "href", /*$romUrl*/ ctx[1]);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "svelte-iqykeu");
    			add_location(a, file$4, 21, 26, 1313);
    			add_location(li, file$4, 21, 6, 1293);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, b);
    			append_dev(li, t1);
    			append_dev(li, a);
    			append_dev(a, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$romUrl*/ 2) set_data_dev(t2, /*$romUrl*/ ctx[1]);

    			if (dirty & /*$romUrl*/ 2) {
    				attr_dev(a, "href", /*$romUrl*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(21:4) {#if $romUrl}",
    		ctx
    	});

    	return block;
    }

    // (24:4) {#if $playPoster}
    function create_if_block$2(ctx) {
    	let li;
    	let b;
    	let t1;
    	let a;
    	let t2;

    	const block = {
    		c: function create() {
    			li = element("li");
    			b = element("b");
    			b.textContent = "Play Poster:";
    			t1 = space();
    			a = element("a");
    			t2 = text(/*$playPoster*/ ctx[2]);
    			add_location(b, file$4, 24, 10, 1408);
    			attr_dev(a, "href", /*$playPoster*/ ctx[2]);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "svelte-iqykeu");
    			add_location(a, file$4, 24, 30, 1428);
    			add_location(li, file$4, 24, 6, 1404);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, b);
    			append_dev(li, t1);
    			append_dev(li, a);
    			append_dev(a, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$playPoster*/ 4) set_data_dev(t2, /*$playPoster*/ ctx[2]);

    			if (dirty & /*$playPoster*/ 4) {
    				attr_dev(a, "href", /*$playPoster*/ ctx[2]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(24:4) {#if $playPoster}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let h10;
    	let t1;
    	let p0;
    	let t2;
    	let a0;
    	let t4;
    	let a1;
    	let t6;
    	let a2;
    	let t8;
    	let a3;
    	let t10;
    	let a4;
    	let t12;
    	let t13;
    	let div0;
    	let t16;
    	let h11;
    	let t18;
    	let ul0;
    	let li0;
    	let a5;
    	let t20;
    	let li1;
    	let a6;
    	let t22;
    	let h12;
    	let t24;
    	let ul1;
    	let t25;
    	let t26;
    	let t27;
    	let h13;
    	let t29;
    	let h20;
    	let t31;
    	let p1;
    	let t32;
    	let a7;
    	let t34;
    	let t35;
    	let h21;
    	let t37;
    	let p2;
    	let t39;
    	let h22;
    	let t41;
    	let p3;
    	let t42;
    	let a8;
    	let t44;
    	let if_block0 = /*$romName*/ ctx[0] && create_if_block_2$1(ctx);
    	let if_block1 = /*$romUrl*/ ctx[1] && create_if_block_1$1(ctx);
    	let if_block2 = /*$playPoster*/ ctx[2] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h10 = element("h1");
    			h10.textContent = "WasmBoy Embed Player";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("This is a dynamic GameBoy / GameBoy color ROM player powered by WasmBoy. WasmBoy is a Game Boy / Game Boy Color emulation library, 🎮written for WebAssembly using ");
    			a0 = element("a");
    			a0.textContent = "AssemblyScript";
    			t4 = text(". 🚀 This embed is built with ");
    			a1 = element("a");
    			a1.textContent = "Svelte";
    			t6 = text(", and input is handled by ");
    			a2 = element("a");
    			a2.textContent = "Responsive Gamepad";
    			t8 = text(". WasmBoy is written by ");
    			a3 = element("a");
    			a3.textContent = "Aaron Turner (torch2424)";
    			t10 = text(", and Licensed under ");
    			a4 = element("a");
    			a4.textContent = "GPL 3.0";
    			t12 = text(".");
    			t13 = space();
    			div0 = element("div");
    			div0.textContent = `WasmBoy Version: ${packageJson.version}`;
    			t16 = space();
    			h11 = element("h1");
    			h11.textContent = "WasmBoy Links";
    			t18 = space();
    			ul0 = element("ul");
    			li0 = element("li");
    			a5 = element("a");
    			a5.textContent = "Github Repo";
    			t20 = space();
    			li1 = element("li");
    			a6 = element("a");
    			a6.textContent = "NPM Package";
    			t22 = space();
    			h12 = element("h1");
    			h12.textContent = "Embed Configuration";
    			t24 = space();
    			ul1 = element("ul");
    			if (if_block0) if_block0.c();
    			t25 = space();
    			if (if_block1) if_block1.c();
    			t26 = space();
    			if (if_block2) if_block2.c();
    			t27 = space();
    			h13 = element("h1");
    			h13.textContent = "Help";
    			t29 = space();
    			h20 = element("h2");
    			h20.textContent = "Controls";
    			t31 = space();
    			p1 = element("p");
    			t32 = text("This player supports Keyboard and Gamepad input per the default ");
    			a7 = element("a");
    			a7.textContent = "Responsive Gamepad";
    			t34 = text(" configuration. For keyboard controls: Directional (Dpad) controls are handled by the arrows keys, or WASD on your keyboard. The A button is controlled by the \"Z\" key. The B button is controlled by the \"X\" key. Start is handled by the \"Enter\" key. Select is handled by the \"Shift\" key.");
    			t35 = space();
    			h21 = element("h2");
    			h21.textContent = "Saves States / Loading States";
    			t37 = space();
    			p2 = element("p");
    			p2.textContent = "Save states can be made by clicking the save icon in the control bar at the bottom of the page. Save states will also be made whenever you navigate away from the running iframe, or when the page is refreshed. Save states can be loaded by clicking the load icon in the control bar, and choosing the appropiate save state represented by the screenshot, and time at which the save states was made. Save states are stored locally in your browser in the IndexedDB API. Meaning they are not backed up to a server, and can be accidentally deleted when clearing your browser cache.";
    			t39 = space();
    			h22 = element("h2");
    			h22.textContent = "Reporting Bugs / Making Suggestions";
    			t41 = space();
    			p3 = element("p");
    			t42 = text("Please feel free to file any bugs, suggestions, issues, etc.. At the ");
    			a8 = element("a");
    			a8.textContent = "WasmBoy Github repo";
    			t44 = text(".");
    			add_location(h10, file$4, 7, 2, 154);
    			attr_dev(a0, "href", "https://github.com/AssemblyScript/assemblyscript");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "class", "svelte-iqykeu");
    			add_location(a0, file$4, 8, 168, 352);
    			attr_dev(a1, "href", "https://svelte.dev/");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "class", "svelte-iqykeu");
    			add_location(a1, file$4, 8, 291, 475);
    			attr_dev(a2, "href", "https://github.com/torch2424/responsive-gamepad");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "class", "svelte-iqykeu");
    			add_location(a2, file$4, 8, 373, 557);
    			attr_dev(a3, "href", "https://github.com/torch2424");
    			attr_dev(a3, "target", "_blank");
    			attr_dev(a3, "class", "svelte-iqykeu");
    			add_location(a3, file$4, 8, 493, 677);
    			attr_dev(a4, "href", "https://github.com/torch2424/wasmboy/blob/master/LICENSE");
    			attr_dev(a4, "target", "_blank");
    			attr_dev(a4, "class", "svelte-iqykeu");
    			add_location(a4, file$4, 8, 597, 781);
    			add_location(p0, file$4, 8, 2, 186);
    			add_location(div0, file$4, 9, 2, 883);
    			add_location(h11, file$4, 10, 2, 935);
    			attr_dev(a5, "href", "https://github.com/torch2424/wasmboy");
    			attr_dev(a5, "target", "_blank");
    			attr_dev(a5, "class", "svelte-iqykeu");
    			add_location(a5, file$4, 12, 8, 973);
    			add_location(li0, file$4, 12, 4, 969);
    			attr_dev(a6, "href", "https://www.npmjs.com/package/wasmboy");
    			attr_dev(a6, "target", "_blank");
    			attr_dev(a6, "class", "svelte-iqykeu");
    			add_location(a6, file$4, 13, 8, 1066);
    			add_location(li1, file$4, 13, 4, 1062);
    			add_location(ul0, file$4, 11, 2, 960);
    			add_location(h12, file$4, 15, 2, 1161);
    			add_location(ul1, file$4, 16, 2, 1192);
    			add_location(h13, file$4, 27, 2, 1509);
    			add_location(h20, file$4, 28, 2, 1525);
    			attr_dev(a7, "href", "https://github.com/torch2424/responsive-gamepad");
    			attr_dev(a7, "target", "_blank");
    			attr_dev(a7, "class", "svelte-iqykeu");
    			add_location(a7, file$4, 29, 69, 1612);
    			add_location(p1, file$4, 29, 2, 1545);
    			add_location(h21, file$4, 30, 2, 2000);
    			add_location(p2, file$4, 31, 2, 2041);
    			add_location(h22, file$4, 32, 2, 2624);
    			attr_dev(a8, "href", "https://github.com/torch2424/wasmboy");
    			attr_dev(a8, "target", "_blank");
    			attr_dev(a8, "class", "svelte-iqykeu");
    			add_location(a8, file$4, 33, 74, 2743);
    			add_location(p3, file$4, 33, 2, 2671);
    			attr_dev(div1, "class", "about svelte-iqykeu");
    			add_location(div1, file$4, 5, 0, 131);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h10);
    			append_dev(div1, t1);
    			append_dev(div1, p0);
    			append_dev(p0, t2);
    			append_dev(p0, a0);
    			append_dev(p0, t4);
    			append_dev(p0, a1);
    			append_dev(p0, t6);
    			append_dev(p0, a2);
    			append_dev(p0, t8);
    			append_dev(p0, a3);
    			append_dev(p0, t10);
    			append_dev(p0, a4);
    			append_dev(p0, t12);
    			append_dev(div1, t13);
    			append_dev(div1, div0);
    			append_dev(div1, t16);
    			append_dev(div1, h11);
    			append_dev(div1, t18);
    			append_dev(div1, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a5);
    			append_dev(ul0, t20);
    			append_dev(ul0, li1);
    			append_dev(li1, a6);
    			append_dev(div1, t22);
    			append_dev(div1, h12);
    			append_dev(div1, t24);
    			append_dev(div1, ul1);
    			if (if_block0) if_block0.m(ul1, null);
    			append_dev(ul1, t25);
    			if (if_block1) if_block1.m(ul1, null);
    			append_dev(ul1, t26);
    			if (if_block2) if_block2.m(ul1, null);
    			append_dev(div1, t27);
    			append_dev(div1, h13);
    			append_dev(div1, t29);
    			append_dev(div1, h20);
    			append_dev(div1, t31);
    			append_dev(div1, p1);
    			append_dev(p1, t32);
    			append_dev(p1, a7);
    			append_dev(p1, t34);
    			append_dev(div1, t35);
    			append_dev(div1, h21);
    			append_dev(div1, t37);
    			append_dev(div1, p2);
    			append_dev(div1, t39);
    			append_dev(div1, h22);
    			append_dev(div1, t41);
    			append_dev(div1, p3);
    			append_dev(p3, t42);
    			append_dev(p3, a8);
    			append_dev(p3, t44);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$romName*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$1(ctx);
    					if_block0.c();
    					if_block0.m(ul1, t25);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*$romUrl*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(ul1, t26);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*$playPoster*/ ctx[2]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$2(ctx);
    					if_block2.c();
    					if_block2.m(ul1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $romName;
    	let $romUrl;
    	let $playPoster;
    	validate_store(romName, "romName");
    	component_subscribe($$self, romName, $$value => $$invalidate(0, $romName = $$value));
    	validate_store(romUrl, "romUrl");
    	component_subscribe($$self, romUrl, $$value => $$invalidate(1, $romUrl = $$value));
    	validate_store(playPoster, "playPoster");
    	component_subscribe($$self, playPoster, $$value => $$invalidate(2, $playPoster = $$value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("About", $$slots, []);

    	$$self.$capture_state = () => ({
    		playPoster,
    		romName,
    		romUrl,
    		packageJson,
    		$romName,
    		$romUrl,
    		$playPoster
    	});

    	return [$romName, $romUrl, $playPoster];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* demo/iframe/components/icons/CloseIcon.svelte generated by Svelte v3.19.2 */

    const file$5 = "demo/iframe/components/icons/CloseIcon.svelte";

    function create_fragment$5(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z");
    			attr_dev(path0, "fill", "#fff");
    			add_location(path0, file$5, 4, 2, 167);
    			attr_dev(path1, "d", "M0 0h24v24H0z");
    			attr_dev(path1, "fill", "none");
    			add_location(path1, file$5, 5, 2, 295);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "class", "svelte-1cmb9l6");
    			add_location(svg, file$5, 3, 0, 81);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CloseIcon> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("CloseIcon", $$slots, []);
    	return [];
    }

    class CloseIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CloseIcon",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* demo/iframe/components/Modal.svelte generated by Svelte v3.19.2 */
    const file$6 = "demo/iframe/components/Modal.svelte";

    // (12:0) {#if $modalStore > 0}
    function create_if_block$3(ctx) {
    	let dialog;
    	let div0;
    	let t0;
    	let button;
    	let t1;
    	let div1;
    	let current_block_type_index;
    	let if_block1;
    	let current;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*$modalStore*/ ctx[0] === 1) return create_if_block_3;
    		if (/*$modalStore*/ ctx[0] === 2) return create_if_block_4;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	const closeicon = new CloseIcon({ $$inline: true });
    	const if_block_creators = [create_if_block_1$2, create_if_block_2$2];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*$modalStore*/ ctx[0] === 1) return 0;
    		if (/*$modalStore*/ ctx[0] === 2) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type_1(ctx, -1))) {
    		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			dialog = element("dialog");
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			button = element("button");
    			create_component(closeicon.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			if (if_block1) if_block1.c();
    			attr_dev(button, "class", "icon-button");
    			add_location(button, file$6, 21, 6, 457);
    			attr_dev(div0, "class", "modal-header svelte-1315onv");
    			add_location(div0, file$6, 14, 2, 295);
    			attr_dev(div1, "class", "modal-content svelte-1315onv");
    			add_location(div1, file$6, 26, 4, 563);
    			attr_dev(dialog, "class", "svelte-1315onv");
    			add_location(dialog, file$6, 12, 2, 283);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, dialog, anchor);
    			append_dev(dialog, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div0, t0);
    			append_dev(div0, button);
    			mount_component(closeicon, button, null);
    			append_dev(dialog, t1);
    			append_dev(dialog, div1);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div1, null);
    			}

    			current = true;
    			dispose = listen_dev(button, "click", /*handleClose*/ ctx[1], false, false, false);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx, dirty))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, t0);
    				}
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx, dirty);

    			if (current_block_type_index !== previous_block_index) {
    				if (if_block1) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block1 = if_blocks[current_block_type_index];

    					if (!if_block1) {
    						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block1.c();
    					}

    					transition_in(if_block1, 1);
    					if_block1.m(div1, null);
    				} else {
    					if_block1 = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(closeicon.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(closeicon.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(dialog);

    			if (if_block0) {
    				if_block0.d();
    			}

    			destroy_component(closeicon);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(12:0) {#if $modalStore > 0}",
    		ctx
    	});

    	return block;
    }

    // (18:34) 
    function create_if_block_4(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "About";
    			attr_dev(h2, "class", "svelte-1315onv");
    			add_location(h2, file$6, 18, 8, 423);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(18:34) ",
    		ctx
    	});

    	return block;
    }

    // (16:6) {#if $modalStore === 1}
    function create_if_block_3(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Load State";
    			attr_dev(h2, "class", "svelte-1315onv");
    			add_location(h2, file$6, 16, 8, 360);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(16:6) {#if $modalStore === 1}",
    		ctx
    	});

    	return block;
    }

    // (30:34) 
    function create_if_block_2$2(ctx) {
    	let current;
    	const about = new About({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(about.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(about, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(about.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(about.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(about, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(30:34) ",
    		ctx
    	});

    	return block;
    }

    // (28:6) {#if $modalStore === 1}
    function create_if_block_1$2(ctx) {
    	let current;
    	const loadstate = new LoadState({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(loadstate.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(loadstate, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(loadstate.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(loadstate.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(loadstate, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(28:6) {#if $modalStore === 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$modalStore*/ ctx[0] > 0 && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$modalStore*/ ctx[0] > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $modalStore;
    	validate_store(modalStore, "modalStore");
    	component_subscribe($$self, modalStore, $$value => $$invalidate(0, $modalStore = $$value));

    	const handleClose = () => {
    		hideModal();
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Modal", $$slots, []);

    	$$self.$capture_state = () => ({
    		modalStore,
    		hideModal,
    		LoadState,
    		About,
    		CloseIcon,
    		handleClose,
    		$modalStore
    	});

    	return [$modalStore, handleClose];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* demo/iframe/components/icons/PauseIcon.svelte generated by Svelte v3.19.2 */

    const file$7 = "demo/iframe/components/icons/PauseIcon.svelte";

    function create_fragment$7(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M0 0h24v24H0z");
    			attr_dev(path0, "fill", "none");
    			add_location(path0, file$7, 4, 2, 167);
    			attr_dev(path1, "d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z");
    			attr_dev(path1, "fill", "#fff");
    			add_location(path1, file$7, 5, 2, 207);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "class", "svelte-1cmb9l6");
    			add_location(svg, file$7, 3, 0, 81);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PauseIcon> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("PauseIcon", $$slots, []);
    	return [];
    }

    class PauseIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PauseIcon",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* demo/iframe/components/icons/SaveIcon.svelte generated by Svelte v3.19.2 */

    const file$8 = "demo/iframe/components/icons/SaveIcon.svelte";

    function create_fragment$8(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M0 0h24v24H0z");
    			attr_dev(path0, "fill", "none");
    			add_location(path0, file$8, 4, 2, 167);
    			attr_dev(path1, "d", "M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z");
    			attr_dev(path1, "fill", "#fff");
    			add_location(path1, file$8, 5, 2, 207);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "class", "svelte-1cmb9l6");
    			add_location(svg, file$8, 3, 0, 81);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SaveIcon> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("SaveIcon", $$slots, []);
    	return [];
    }

    class SaveIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SaveIcon",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* demo/iframe/components/icons/LoadIcon.svelte generated by Svelte v3.19.2 */

    const file$9 = "demo/iframe/components/icons/LoadIcon.svelte";

    function create_fragment$9(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z");
    			attr_dev(path0, "fill", "#fff");
    			add_location(path0, file$9, 4, 2, 167);
    			attr_dev(path1, "d", "M0 0h24v24H0z");
    			attr_dev(path1, "fill", "none");
    			add_location(path1, file$9, 5, 2, 285);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "class", "svelte-1cmb9l6");
    			add_location(svg, file$9, 3, 0, 81);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LoadIcon> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("LoadIcon", $$slots, []);
    	return [];
    }

    class LoadIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LoadIcon",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* demo/iframe/components/icons/AboutIcon.svelte generated by Svelte v3.19.2 */

    const file$a = "demo/iframe/components/icons/AboutIcon.svelte";

    function create_fragment$a(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M0 0h24v24H0z");
    			attr_dev(path0, "fill", "none");
    			add_location(path0, file$a, 4, 2, 167);
    			attr_dev(path1, "d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z");
    			attr_dev(path1, "fill", "#fff");
    			add_location(path1, file$a, 5, 2, 207);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "class", "svelte-1cmb9l6");
    			add_location(svg, file$a, 3, 0, 81);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<AboutIcon> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("AboutIcon", $$slots, []);
    	return [];
    }

    class AboutIcon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AboutIcon",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* demo/iframe/components/ControlsBar.svelte generated by Svelte v3.19.2 */
    const file$b = "demo/iframe/components/ControlsBar.svelte";

    // (56:2) {#if displayStatus}
    function create_if_block_1$3(ctx) {
    	let div;
    	let t_value = /*$status*/ ctx[2].message + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "status svelte-5kbxka");
    			add_location(div, file$b, 56, 4, 1275);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$status*/ 4 && t_value !== (t_value = /*$status*/ ctx[2].message + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(56:2) {#if displayStatus}",
    		ctx
    	});

    	return block;
    }

    // (65:8) {:else}
    function create_else_block$1(ctx) {
    	let current;
    	const playicon = new PlayIcon({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(playicon.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(playicon, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(playicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(playicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(playicon, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(65:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (63:8) {#if $isPlaying}
    function create_if_block$4(ctx) {
    	let current;
    	const pauseicon = new PauseIcon({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(pauseicon.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(pauseicon, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(pauseicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(pauseicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(pauseicon, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(63:8) {#if $isPlaying}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let footer;
    	let t0;
    	let ul;
    	let li0;
    	let button0;
    	let current_block_type_index;
    	let if_block1;
    	let t1;
    	let li1;
    	let button1;
    	let t2;
    	let li2;
    	let button2;
    	let t3;
    	let li3;
    	let button3;
    	let current;
    	let dispose;
    	let if_block0 = /*displayStatus*/ ctx[0] && create_if_block_1$3(ctx);
    	const if_block_creators = [create_if_block$4, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$isPlaying*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx, -1);
    	if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	const saveicon = new SaveIcon({ $$inline: true });
    	const loadicon = new LoadIcon({ $$inline: true });
    	const abouticon = new AboutIcon({ $$inline: true });

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			ul = element("ul");
    			li0 = element("li");
    			button0 = element("button");
    			if_block1.c();
    			t1 = space();
    			li1 = element("li");
    			button1 = element("button");
    			create_component(saveicon.$$.fragment);
    			t2 = space();
    			li2 = element("li");
    			button2 = element("button");
    			create_component(loadicon.$$.fragment);
    			t3 = space();
    			li3 = element("li");
    			button3 = element("button");
    			create_component(abouticon.$$.fragment);
    			attr_dev(button0, "class", "icon-button");
    			add_location(button0, file$b, 61, 6, 1375);
    			add_location(li0, file$b, 60, 4, 1364);
    			attr_dev(button1, "class", "icon-button");
    			add_location(button1, file$b, 71, 6, 1575);
    			add_location(li1, file$b, 70, 4, 1564);
    			attr_dev(button2, "class", "icon-button");
    			add_location(button2, file$b, 77, 6, 1689);
    			add_location(li2, file$b, 76, 4, 1678);
    			attr_dev(button3, "class", "icon-button");
    			add_location(button3, file$b, 83, 6, 1803);
    			add_location(li3, file$b, 82, 4, 1792);
    			attr_dev(ul, "class", "controls-buttons svelte-5kbxka");
    			add_location(ul, file$b, 59, 2, 1330);
    			attr_dev(footer, "class", "controls-bar svelte-5kbxka");
    			add_location(footer, file$b, 54, 0, 1219);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			if (if_block0) if_block0.m(footer, null);
    			append_dev(footer, t0);
    			append_dev(footer, ul);
    			append_dev(ul, li0);
    			append_dev(li0, button0);
    			if_blocks[current_block_type_index].m(button0, null);
    			append_dev(ul, t1);
    			append_dev(ul, li1);
    			append_dev(li1, button1);
    			mount_component(saveicon, button1, null);
    			append_dev(ul, t2);
    			append_dev(ul, li2);
    			append_dev(li2, button2);
    			mount_component(loadicon, button2, null);
    			append_dev(ul, t3);
    			append_dev(ul, li3);
    			append_dev(li3, button3);
    			mount_component(abouticon, button3, null);
    			current = true;

    			dispose = [
    				listen_dev(button0, "click", /*handlePlayPause*/ ctx[3], false, false, false),
    				listen_dev(button1, "click", /*handleSave*/ ctx[4], false, false, false),
    				listen_dev(button2, "click", /*handleLoad*/ ctx[5], false, false, false),
    				listen_dev(button3, "click", /*handleAbout*/ ctx[6], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*displayStatus*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$3(ctx);
    					if_block0.c();
    					if_block0.m(footer, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block1 = if_blocks[current_block_type_index];

    				if (!if_block1) {
    					if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block1.c();
    				}

    				transition_in(if_block1, 1);
    				if_block1.m(button0, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block1);
    			transition_in(saveicon.$$.fragment, local);
    			transition_in(loadicon.$$.fragment, local);
    			transition_in(abouticon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block1);
    			transition_out(saveicon.$$.fragment, local);
    			transition_out(loadicon.$$.fragment, local);
    			transition_out(abouticon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    			if (if_block0) if_block0.d();
    			if_blocks[current_block_type_index].d();
    			destroy_component(saveicon);
    			destroy_component(loadicon);
    			destroy_component(abouticon);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let $isPlaying;
    	let $status;
    	validate_store(isPlaying, "isPlaying");
    	component_subscribe($$self, isPlaying, $$value => $$invalidate(1, $isPlaying = $$value));
    	validate_store(status, "status");
    	component_subscribe($$self, status, $$value => $$invalidate(2, $status = $$value));
    	let displayStatus = false;
    	let statusTimeout;

    	// Subscribe to status changes, and show the status message
    	// on changes
    	status.subscribe(value => {
    		if (statusTimeout) {
    			clearTimeout(statusTimeout);
    		}

    		$$invalidate(0, displayStatus = true);

    		if (value.timeout < 0) {
    			return false;
    		}

    		statusTimeout = setTimeout(
    			() => {
    				$$invalidate(0, displayStatus = false);
    				statusTimeout = undefined;
    			},
    			value.timeout
    		);
    	});

    	const handlePlayPause = () => {
    		if ($isPlaying) {
    			isPlaying.set(false);
    			setStatus("Paused", -1);
    		} else {
    			isPlaying.set(true);
    			setStatus("Playing!");
    		}
    	};

    	const handleSave = () => {
    		triggerSaveState();
    	};

    	const handleLoad = () => {
    		showLoadState();
    	};

    	const handleAbout = () => {
    		showAbout();
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ControlsBar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ControlsBar", $$slots, []);

    	$$self.$capture_state = () => ({
    		isPlaying,
    		setStatus,
    		status,
    		triggerSaveState,
    		showLoadState,
    		showAbout,
    		PlayIcon,
    		PauseIcon,
    		SaveIcon,
    		LoadIcon,
    		AboutIcon,
    		displayStatus,
    		statusTimeout,
    		handlePlayPause,
    		handleSave,
    		handleLoad,
    		handleAbout,
    		$isPlaying,
    		$status
    	});

    	$$self.$inject_state = $$props => {
    		if ("displayStatus" in $$props) $$invalidate(0, displayStatus = $$props.displayStatus);
    		if ("statusTimeout" in $$props) statusTimeout = $$props.statusTimeout;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		displayStatus,
    		$isPlaying,
    		$status,
    		handlePlayPause,
    		handleSave,
    		handleLoad,
    		handleAbout
    	];
    }

    class ControlsBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ControlsBar",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    var loadScript = function load (src, opts, cb) {
      var head = document.head || document.getElementsByTagName('head')[0];
      var script = document.createElement('script');

      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }

      opts = opts || {};
      cb = cb || function() {};

      script.type = opts.type || 'text/javascript';
      script.charset = opts.charset || 'utf8';
      script.async = 'async' in opts ? !!opts.async : true;
      script.src = src;

      if (opts.attrs) {
        setAttributes(script, opts.attrs);
      }

      if (opts.text) {
        script.text = '' + opts.text;
      }

      var onend = 'onload' in script ? stdOnEnd : ieOnEnd;
      onend(script, cb);

      // some good legacy browsers (firefox) fail the 'in' detection above
      // so as a fallback we always set onload
      // old IE will ignore this and new IE will set onload
      if (!script.onload) {
        stdOnEnd(script, cb);
      }

      head.appendChild(script);
    };

    function setAttributes(script, attrs) {
      for (var attr in attrs) {
        script.setAttribute(attr, attrs[attr]);
      }
    }

    function stdOnEnd (script, cb) {
      script.onload = function () {
        this.onerror = this.onload = null;
        cb(null, script);
      };
      script.onerror = function () {
        // this.onload = null here is necessary
        // because even IE9 works not like others
        this.onerror = this.onload = null;
        cb(new Error('Failed to load ' + this.src), script);
      };
    }

    function ieOnEnd (script, cb) {
      script.onreadystatechange = function () {
        if (this.readyState != 'complete' && this.readyState != 'loaded') return
        this.onreadystatechange = null;
        cb(null, script); // there is no way to catch loading errors in IE8
      };
    }

    /* demo/iframe/App.svelte generated by Svelte v3.19.2 */

    const { console: console_1$2 } = globals;
    const file$c = "demo/iframe/App.svelte";

    // (31:2) {:else}
    function create_else_block$2(ctx) {
    	let t;
    	let if_block_anchor;
    	let current;
    	const wasmboy = new WasmBoy_1({ $$inline: true });
    	let if_block = /*$isLoaded*/ ctx[1] && create_if_block_1$4(ctx);

    	const block = {
    		c: function create() {
    			create_component(wasmboy.$$.fragment);
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			mount_component(wasmboy, target, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*$isLoaded*/ ctx[1]) {
    				if (!if_block) {
    					if_block = create_if_block_1$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				} else {
    					transition_in(if_block, 1);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(wasmboy.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(wasmboy.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(wasmboy, detaching);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(31:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (29:2) {#if $isStarted === false}
    function create_if_block$5(ctx) {
    	let current;
    	const playposter = new PlayPoster({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(playposter.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(playposter, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(playposter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(playposter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(playposter, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(29:2) {#if $isStarted === false}",
    		ctx
    	});

    	return block;
    }

    // (33:4) {#if $isLoaded}
    function create_if_block_1$4(ctx) {
    	let t;
    	let current;
    	const modal = new Modal({ $$inline: true });
    	const controlsbar = new ControlsBar({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(modal.$$.fragment);
    			t = space();
    			create_component(controlsbar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(modal, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(controlsbar, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal.$$.fragment, local);
    			transition_in(controlsbar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal.$$.fragment, local);
    			transition_out(controlsbar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(modal, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(controlsbar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(33:4) {#if $isLoaded}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$5, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$isStarted*/ ctx[0] === false) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx, -1);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "app svelte-16eszze");
    			add_location(main, file$c, 27, 0, 772);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let $isStarted;
    	let $isLoaded;
    	validate_store(isStarted, "isStarted");
    	component_subscribe($$self, isStarted, $$value => $$invalidate(0, $isStarted = $$value));
    	validate_store(isLoaded, "isLoaded");
    	component_subscribe($$self, isLoaded, $$value => $$invalidate(1, $isLoaded = $$value));

    	if (typeof window !== "undefined") {
    		loadScript("https://www.googletagmanager.com/gtag/js?id=UA-125276735-3", (err, script) => {
    			if (err) {
    				console.error(err);
    				return;
    			}

    			window.dataLayer = window.dataLayer || [];

    			function gtag() {
    				window.dataLayer.push(arguments);
    			}

    			gtag("js", new Date());
    			gtag("config", "UA-125276735-3");
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		PlayPoster,
    		WasmBoy: WasmBoy_1,
    		Modal,
    		ControlsBar,
    		isStarted,
    		isLoaded,
    		loadScript,
    		$isStarted,
    		$isLoaded
    	});

    	return [$isStarted, $isLoaded];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
