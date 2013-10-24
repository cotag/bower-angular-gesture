(function (angular) {
    'use strict';

    angular.module('ngGesture', [])

        .factory('$ngUtils', ['$window', '$timeout', function ($window, $timeout) {

            return {
                // directions
                DIRECTION_UP: 1,
                DIRECTION_DOWN: 2,
                DIRECTION_LEFT: 3,
                DIRECTION_RIGHT: 4,

                DIRECTION_NAME: {
                    1: 'up',
                    2: 'down',
                    3: 'left',
                    4: 'right'
                },

                // simplified event types
                EVENT_START: 1,
                EVENT_MOVE: 2,
                EVENT_END: 3,


                /**
                * find if a node is in the given parent
                * used for event delegation tricks
                * @param     {HTMLElement}     node
                * @param     {HTMLElement}     parent
                * @returns {boolean}         has_parent
                */
                hasParent: function (node, parent) {
                    while (node) {
                        if (node === parent) {
                            return true;
                        }
                        node = node.parentNode;
                    }
                    return false;
                },


                /**
                * get the center of all the pointers
                * @param     {Array}     pointers
                * @returns {Object}    center
                */
                getCenter: function (pointers) {
                    var valuesX = [], valuesY = [], t, len;

                    for (t = 0, len = pointers.length; t < len; t += 1) {
                        valuesX.push(pointers[t].pageX);
                        valuesY.push(pointers[t].pageY);
                    }

                    return {
                        pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
                        pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
                    };
                },


                /**
                * calculate the velocity between two points
                * @param     {Number}    delta_time
                * @param     {Number}    delta_x
                * @param     {Number}    delta_y
                * @returns {Object}    velocity
                */
                getVelocity: function (delta_time, delta_x, delta_y) {
                    return {
                        x: Math.abs(delta_x / delta_time) || 0,
                        y: Math.abs(delta_y / delta_time) || 0
                    };
                },


                /**
                * calculate the angle between two coordinates
                * @param     {Touch}     touch1
                * @param     {Touch}     touch2
                * @returns {Number}    angle
                */
                getAngle: function (touch1, touch2) {
                    var y = touch2.pageY - touch1.pageY,
                        x = touch2.pageX - touch1.pageX;

                    return Math.atan2(y, x) * 180 / Math.PI;
                },


                /**
                * angle to direction define
                * @param     {Touch}     touch1
                * @param     {Touch}     touch2
                * @returns {String}    direction constant, like this.DIRECTION_LEFT
                */
                getDirection: function (touch1, touch2) {
                    var x = Math.abs(touch1.pageX - touch2.pageX),
                        y = Math.abs(touch1.pageY - touch2.pageY);

                    if (x >= y) {
                        return touch1.pageX - touch2.pageX > 0 ? this.DIRECTION_LEFT : this.DIRECTION_RIGHT;
                    }
                    // else
                    return touch1.pageY - touch2.pageY > 0 ? this.DIRECTION_UP : this.DIRECTION_DOWN;
                },


                /**
                * calculate the distance between two pointers
                * @param     {Touch}     touch1
                * @param     {Touch}     touch2
                * @returns {Number}    distance
                */
                getDistance: function (touch1, touch2) {
                    var x = touch2.pageX - touch1.pageX,
                        y = touch2.pageY - touch1.pageY;
                    return Math.sqrt((x * x) + (y * y));
                },


                /**
                * calculate the scale factor between two touchLists (fingers)
                * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
                * @param     {Array}     start
                * @param     {Array}     end
                * @returns {Number}    scale
                */
                getScale: function (start, end) {
                    // need two fingers...
                    if (start.length >= 2 && end.length >= 2) {
                        return this.getDistance(end[0], end[1]) / this.getDistance(start[0], start[1]);
                    }
                    // else
                    return 1;
                },


                /**
                * calculate the rotation degrees between two touchLists (fingers)
                * @param     {Array}     start
                * @param     {Array}     end
                * @returns {Number}    rotation
                */
                getRotation: function (start, end) {
                    // need two fingers
                    if (start.length >= 2 && end.length >= 2) {
                        return this.getAngle(end[1], end[0]) - this.getAngle(start[1], start[0]);
                    }
                    // else
                    return 0;
                },


                /**
                * boolean if the direction is vertical
                * @param    {String}    direction
                * @returns    {Boolean}     is_vertical
                */
                isVertical: function (direction) {
                    return (direction === this.DIRECTION_UP || direction === this.DIRECTION_DOWN);
                },

                /**
                * stop browser default behavior with css props
                * @param   {HtmlElement}   element
                * @param   {Object}    css_props
                */
                stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
                    var prop,
                        vendors = ['webkit', 'khtml', 'moz', 'ms', 'o', ''],
                        i,
                        p;

                    if (!css_props || !element.style) {
                        return;
                    }

                    // with css properties for modern browsers
                    for (i = 0; i < vendors.length; i += 1) {
                        for (p in css_props) {
                            if (css_props.hasOwnProperty(p)) {
                                prop = p;

                                // vender prefix at the property
                                if (vendors[i]) {
                                    prop = vendors[i] + prop.substring(0, 1).toUpperCase() + prop.substring(1);
                                }

                                // set the style
                                element.style[prop] = css_props[p];
                            }
                        }
                    }

                    // also the disable onselectstart
                    if (css_props.userSelect === 'none') {
                        element.onselectstart = function() {
                            return false;
                        };

                        // NOTE:: Only seems to have any effect on IE8 with jquery
                        // Behaves normally for all other browsers, jquery or not.
                        element.ondragstart = function() {
                            return false;
                        };
                    }
                }
            };
        }])

        .provider('$gesture', function() {

            var defaults = {
                    setBrowserBehaviors: true
                },
                defaultBrowserBehavior = {
                    // this also triggers onselectstart=false for IE
                    userSelect: 'none',
                    touchCallout: 'none',
                    contentZooming: 'none',
                    userDrag: 'none',
                    tapHighlightColor: 'rgba(0,0,0,0)'
                },
                EVENT_START = 'pointerdown',
                EVENT_MOVE = 'pointermove',
                EVENT_END = 'pointerup',
                EVENT_CANCEL = 'pointercancel lostpointercapture';


            this.setGestureDefaults = function(settings) {
                angular.extend(defaults, settings);
            };

            this.setDefaultBrowserBehavior = function(settings) {
                angular.extend(defaultBrowserBehavior, settings);
            };


            this.$get = ['$window', '$document', '$timeout', '$ngUtils', function ($window, $document, $timeout, $utils) {
                var gestureTypes = {},      // Gestures registered with $mobile

                    instanceId = 0,         // id of last instance (for use in associative arrays)
                    pointerAllocation = {}, // PointerId => Instances (capture mapping)
                    eventPointers = {},     // Instance => Pointers (similar to touches list on iOS)

                    // Track the current event so we don't steal the capture
                    // As there may be multiple elements checking for gestures
                    currentEvent,


                    detect = function(event, eventType, instance) {
                        var i,
                            touches = [],
                            pointerEnding;

                        // Get the touches related to this element
                        angular.forEach(eventPointers[instance], function(value) {
                            this.push(value);
                        }, touches);

                        // Make this a move event if there are still fingers on the screen
                        if (eventType === $utils.EVENT_END) {
                            pointerEnding = event.pointerId;

                            if ((instance.pointersCount - 1) > 0) {
                                eventType = $utils.EVENT_MOVE;
                            }
                        }

                        instance.detect({
                            center      : $utils.getCenter(touches),
                            timeStamp   : Date.now(),
                            target      : event.target,
                            touches     : touches,
                            eventType   : eventType,
                            srcEvent    : event,

                            /**
                             * prevent the browser default actions
                             * mostly used to disable scrolling of the browser
                             */
                            preventDefault: function() {
                                if (this.srcEvent.preventManipulation) {
                                    this.srcEvent.preventManipulation();
                                }

                                if (this.srcEvent.preventDefault) {
                                    this.srcEvent.preventDefault();
                                }
                            },

                            /**
                             * stop bubbling the event up to its parents
                             */
                            stopPropagation: function() {
                                this.srcEvent.propagation_stop_sig = true;

                                if (this.srcEvent.stopPropagation) {
                                    this.srcEvent.stopPropagation();
                                }
                            },

                            /**
                             * immediately stop gesture detection
                             * might be useful after a swipe was detected
                             * @return {*}
                             */
                            stopDetect: function() {
                                return instance.stopDetect();
                            }
                        });


                        // on the end we reset everything
                        if (eventType === $utils.EVENT_END) {
                            instance.stopDetect();
                        } else if (pointerEnding !== undefined) {
                            // We remove the pointer no longer on the screen
                            delete pointerAllocation[event.pointerId];                // This is ok
                            delete eventPointers[instance][event.pointerId];
                            instance.pointersCount = instance.pointersCount - 1;
                        }
                    },


                    tryDetect = function (event, eventType, instances) {
                        var i;

                        if (instances.length > 0) {
                            for (i = 0; i < instances.length; i += 1) {
                                if (!event.propagation_stop_sig) {
                                    detect(event, eventType, instances[i]);
                                } else {
                                    // de-allocate pointers to the remaining instances
                                    instances[i].stopDetect();
                                }
                            }
                        }
                    },

                    moveEvent = function (event) {
                        event = event.originalEvent || event; // in case of jQuery

                        var element = angular.element(this),
                            i,
                            instance,
                            instances = [];

                        if (pointerAllocation[event.pointerId]) {
                            // clone the instances array
                            instances.push.apply(instances, pointerAllocation[event.pointerId]);

                            for (i = 0; i < instances.length; i += 1) {
                                instance = instances[i];

                                // Update pointer
                                eventPointers[instance][event.pointerId] = event;
                            }
                        }

                        tryDetect(event, $utils.EVENT_MOVE, instances);
                    },

                    endEvent = function (event) {
                        event = event.originalEvent || event; // in case of jQuery

                        var element = angular.element(this),
                            i,
                            instance,
                            instances = [];

                        if (pointerAllocation[event.pointerId]) {
                            // clone the instances array
                            instances.push.apply(instances, pointerAllocation[event.pointerId]);

                            for (i = 0; i < instances.length; i += 1) {
                                instance = instances[i];

                                // Update pointer
                                eventPointers[instance][event.pointerId] = event;
                            }
                        }
                        
                        // We can ignore events from this pointer now
                        element.off(EVENT_MOVE, moveEvent);
                        element.off('pointerup', endEvent);
                        element.off('pointercancel', cancelEvent);
                        element.off('lostpointercapture', cancelEvent);
                        element[0].releasePointerCapture(event.pointerId);

                        tryDetect(event, $utils.EVENT_END, instances);
                    },

                    cancelEvent = function (event) {
                        event = event.originalEvent || event; // in case of jQuery

                        var element = angular.element(this),
                            i,
                            instance,
                            instances = [];

                        if (pointerAllocation[event.pointerId]) {
                            // clone the instances array
                            instances.push.apply(instances, pointerAllocation[event.pointerId]);

                            for (i = 0; i < instances.length; i += 1) {
                                instance = instances[i];

                                // Update pointer
                                if (eventPointers[instance].length > 1) {
                                    delete eventPointers[instance][event.pointerId];
                                } else {
                                    instance.stopDetect();
                                }
                            }

                            delete pointerAllocation[event.pointerId];
                        }
                        
                        // We can ignore events from this pointer now
                        element.off(EVENT_MOVE, moveEvent);
                        element.off('pointerup', endEvent);
                        element.off('pointercancel', cancelEvent);
                        element.off('lostpointercapture', cancelEvent);
                        // Avoids a possible error in the polyfill
                        // A click event that cancels a captured pointer generates a
                        // start event that never has an end.
                        element.off(EVENT_START, startEvent);
                        $timeout(function () {
                            element.on(EVENT_START, startEvent);
                        }, 0, false);
                    },

                    startEvent = function (event) {
                        event = event.originalEvent || event; // in case of jQuery

                        // Return if we have already handled this event in a child
                        if (event === currentEvent) {
                            return;
                        }
                        currentEvent = event;

                        // Doesn't seem to work in polyfill
                        //if (event.isPrimary === true) {
                        //    event.preventDefault();
                        //}

                        var element = angular.element(this),
                            i,
                            instance,
                            instances = [],
                            captureProcessed = false;


                        // run up the tree looking for mobile elements
                        i = element;
                        do {
                            instance = i.data('__$gesture.config__');
                            if (instance) {
                                instances.push(instance);
                            }
                            i = i.parent();
                        } while (i[0]);


                        // Check if any of the elements are interested in capturing this pointer
                        pointerAllocation[event.pointerId] = [];
                        for (i = 0; i < instances.length; i += 1) {
                            instance = instances[i];

                            // Check if the element can capture another pointer and assign the pointer to that element
                            if (instance.pointersCount < instance.pointersMax) {
                                if (instance.options.touchActiveClass) {
                                    element.addClass(instance.options.touchActiveClass);
                                }

                                pointerAllocation[event.pointerId].push(instance);

                                if (instance.pointersCount === 0) {
                                    eventPointers[instance] = {};
                                }
                                eventPointers[instance][event.pointerId] = event;
                                instance.pointersCount = instance.pointersCount + 1;

                                if (captureProcessed === false) {
                                    captureProcessed = true;

                                    // Capture the pointer (this is the DOM element)
                                    if (this.setPointerCapture !== undefined) {
                                        this.setPointerCapture(event.pointerId);
                                    }

                                    // Listen for further events on this element
                                    element.on(EVENT_MOVE, moveEvent);
                                    element.on(EVENT_END, endEvent);
                                    element.on(EVENT_CANCEL, cancelEvent);
                                }
                            }
                        }

                        tryDetect(event, $utils.EVENT_START, instances);
                    };

                return {
                    /**
                     * Shortcut to $mobileUtils
                     */
                    utils: $utils,

                    /**
                     * Valid setting names are evaluates against the current scope and set for this element
                     */
                    extractSettings: function(scope, attributes) {
                        var p, result = {};
                        for (p in attributes) {
                            if ((defaults.hasOwnProperty(p) || defaultBrowserBehavior.hasOwnProperty(p)) && attributes.hasOwnProperty(p)) {
                                result[p] = scope.$eval(attributes[p]);
                            }
                        }
                        return result;
                    },

                    /**
                     * Gesture registration with default setting allocation
                     */
                    register: function(options) {
                        defaults = angular.extend(options.defaults || {}, defaults);    // We don't want to override any user defined defaults

                        delete options.defaults;

                        gestureTypes[options.name] = options;
                    },

                    /**
                     * Associates a gesure instance to the current object
                     */
                    gestureOn: function(element, gestures, options) {
                        var i,
                            gesture,
                            sortFunc = function(a, b) {
                                if (a.index < b.index) {
                                    return -1;
                                }
                                if (a.index > b.index) {
                                    return 1;
                                }
                                return 0;
                            },
                            instance = element.data('__$gesture.config__') || {
                                id: undefined,
                                handlers: {},     // Event callbacks
                                registered: {}, // Gesture state data store
                                gestures: [],     // Gestures applied to this element

                                /**
                                 * Provide a handler for an event
                                 * I would have liked to use angulars.on and triggered real events
                                 * to simlify creating complex widgets via delegation or for stats etc
                                 * however I couldn't do this and support IE8 at the same time so I
                                 * used a similar interface to JQLite for when IE8 support is dropped
                                 */
                                on: function(event, handler) {
                                    instance.handlers[event] = instance.handlers[event] || [];
                                    instance.handlers[event].push(handler);
                                    return instance;
                                },

                                /**
                                 * Remove a handler for an event
                                 */
                                off: function(event, handler) {
                                    if (handler === undefined) {
                                        delete instance.handlers[event];
                                    } else {
                                        angular.arrayRemove(instance.handlers[event], handler);
                                    }
                                    return instance;
                                },

                                toString: function() {
                                    return instance.id;
                                },


                                /**
                                 * extend eventData for gestures
                                 * @param     {Object}     ev
                                 * @returns {Object}     ev
                                 */
                                extendEventData: function(ev) {
                                    var i, len,
                                        startEv = instance.current.startEvent,
                                        delta_time = ev.timeStamp - startEv.timeStamp,
                                        delta_x = ev.center.pageX - startEv.center.pageX,
                                        delta_y = ev.center.pageY - startEv.center.pageY,
                                        velocity = $utils.getVelocity(delta_time, delta_x, delta_y);

                                    // if the touches change, add the new touches over the startEvent touches
                                    // this because touchevents don't have all the touches on touchstart, or the
                                    // user must place his fingers at the EXACT same time on the screen, which is not realistic
                                    if (startEv && ev.touches.length !== startEv.touches.length) {
                                        // extend 1 level deep to get the touchlist with the touch objects
                                        startEv.touches = [];
                                        i = 0;
                                        for (len = ev.touches.length; i < len; i += 1) {
                                            startEv.touches.push(ev.touches[i]);
                                        }
                                    }

                                    angular.extend(ev, {
                                        deltaTime     : delta_time,

                                        deltaX        : delta_x,
                                        deltaY        : delta_y,

                                        velocityX     : velocity.x,
                                        velocityY     : velocity.y,

                                        distance    : $utils.getDistance(startEv.center, ev.center),
                                        angle         : $utils.getAngle(startEv.center, ev.center),
                                        direction     : $utils.DIRECTION_NAME[$utils.getDirection(startEv.center, ev.center)],

                                        scale         : $utils.getScale(startEv.touches, ev.touches),
                                        rotation    : $utils.getRotation(startEv.touches, ev.touches),

                                        startEvent    : startEv
                                    });

                                    return ev;
                                },


                                /**
                                 * gesture detection
                                 * @param     {Object}    eventData
                                 * @param     {Object}    eventData
                                 */
                                detect: function(eventData) {
                                    if (!instance.current) {
                                        instance.stopped = false;

                                        instance.current = {
                                            inst        : instance,     // reference to instance we're working for
                                            startEvent    : angular.extend({}, eventData), // start eventData for distances, timing etc
                                            lastEvent     : false,    // last eventData
                                            name        : ''                    // current gesture we're in/detected, can be 'tap', 'hold' etc
                                        };
                                    } else if (instance.stopped) {
                                        instance.stopDetect();    // just in case
                                        return;
                                    }

                                    // extend event data with calculations about scale, distance etc
                                    eventData = instance.extendEventData(eventData);

                                    var g = 0,
                                        len,
                                        gesture;

                                    // call gesture handlers
                                    for (len = instance.gestures.length; g < len; g += 1) {
                                        gesture = instance.gestures[g];

                                        // only when the instance options have enabled this gesture
                                        if (!instance.stopped) {
                                            // if a handler returns false, we stop with the detection
                                            if (gesture.handler.call(instance.registered[gesture.name], eventData, instance) === false) {
                                                instance.stopDetect();
                                                break;
                                            }
                                        }
                                    }

                                    // store as previous event event
                                    if (instance.current) {
                                        instance.current.lastEvent = eventData;
                                    }

                                    return eventData;
                                },


                                /**
                                 * clear the gesture vars
                                 * this is called on endDetect, but can also be used when a final gesture has been detected
                                 * to stop other gestures from being fired
                                 */
                                stopDetect: function() {
                                    var pointers = eventPointers[instance],
                                        allocations,
                                        pointerId,
                                        i;

                                    if (instance.options.touchActiveClass) {
                                        element.removeClass(instance.options.touchActiveClass);
                                    }

                                    if (pointers) {
                                        delete eventPointers[instance];
                                        for (pointerId in pointers) {
                                            // Splice out the instance in question if multiple elements are executing on it
                                            if (pointerAllocation.hasOwnProperty(pointerId) && pointerAllocation[pointerId].length > 1) {
                                                allocations = pointerAllocation[pointerId];

                                                for (i = 0; i < allocations.length; i += 1) {
                                                    if (allocations[i] === instance) {
                                                        allocations.splice(i, 1);
                                                    }
                                                }
                                            } else {
                                                delete pointerAllocation[pointerId];
                                            }
                                        }
                                    }

                                    // stopped!
                                    instance.stopped = true;
                                    instance.pointersCount = 0;

                                    // clone current data to the store as the previous gesture
                                    // used for the double tap gesture, since this is an other gesture detect session
                                    if (instance.current) {
                                        instance.previous = angular.extend({}, instance.current);

                                        // reset the current
                                        instance.current = null;
                                    }
                                },


                                /**
                                 * trigger gesture event
                                 * @param     {String}        gesture
                                 * @param     {Object}        eventData
                                 */
                                trigger: function(gesture, eventData) {
                                    if (instance.handlers[gesture]) {
                                        var i, handlers = instance.handlers[gesture];

                                        for (i = 0; i < handlers.length; i += 1) {
                                            handlers[i].call(element, eventData);
                                        }
                                    }
                                    return instance;
                                },

                                previous: undefined, // The previous gesture on this element
                                current: undefined,    // Are we currently gesturing

                                pointersCount: 0,        // Number of active pointers
                                pointersMax: 1,            // The max pointers this element could use to perform a gesture

                                options: undefined,     // The gesture configuration associated with this element
                                browserBehaviors: {}
                            };

                        if (!instance.id) {
                            instance.options = angular.extend(
                                angular.copy(defaults),    // Clone the defaults
                                options || {}                        // Merge in any overriding changes
                            );

                            instanceId = instanceId + 1;
                            instance.id = instanceId.toString();

                            element.data('__$gesture.config__', instance);

                            // add some css to the element to prevent the browser from doing its native behavior
                            if (instance.options.setBrowserBehaviors) {
                                for (i in defaultBrowserBehavior) {
                                    if (defaultBrowserBehavior.hasOwnProperty(i)) {
                                        instance.browserBehaviors[i] = instance.options[i] || defaultBrowserBehavior[i];
                                    }
                                }
                                $utils.stopDefaultBrowserBehavior(element[0], instance.browserBehaviors);
                                if (element.attr('touch-action') === undefined) {
                                    element.attr('touch-action', instance.options.touchAction || 'none');
                                }
                            } else {
                                if (element.attr('touch-action') === undefined) {
                                    element.attr('touch-action', 'none');
                                }
                            }

                            // The events are no longer required for the current element
                            element.scope().$on('$destroy', function() {
                                instance.stopDetect();
                            });

                            // start detection on interaction
                            element.on(EVENT_START, startEvent);
                        } else if (options) {
                            // This is not the first call to gestureOn
                            angular.extend(instance.options, options);
                        }

                        // Apply the gesture configuration for the selected gestures
                        if (gestures) {
                            gestures = gestures.split(' ');
                            for (i = 0; i < gestures.length; i += 1) {
                                gesture = gestureTypes[gestures[i]];

                                // instance.events checks if the gesture has been previously registered
                                if (!instance.registered[gesture.name]) {
                                    // This is a sandbox that the gestures can use for persisted state
                                    instance.registered[gesture.name] = {name: gesture.name};

                                    // set its index
                                    gesture.index = gesture.index || 1000;

                                    // add gesture to the list
                                    instance.gestures.push(gesture);

                                    // sort the list by index
                                    instance.gestures.sort(sortFunc);
                                }

                                // Provide a function for any additional configuration
                                if (gesture.setup) {
                                    gesture.setup.call(instance.registered[gesture.name], element, instance);
                                }

                                if ((instance.options[gesture.name + '_max_pointers'] || 1) > instance.pointersMax) {
                                    instance.pointersMax = instance.options[gesture.name + '_max_pointers'] || 1;
                                }
                            }
                        }

                        return instance;
                    }
                };
            }];
        });

}(this.angular));
