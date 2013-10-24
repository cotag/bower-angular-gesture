(function(angular) {
    'use strict';

    angular.module('ngGesture')

        /**
         * @ngdoc service
         * @name ngGesture.service:$gestureTouch
         *
         * @description
         * An alias for $gesture that ensures element level touch/release detection functionality is available.
         * Synonymous with start, down, up and end events across the various input types
         *    Adds bindings for `touch` and `release` to $gesture
         */
        .factory('$gestureTouch', ['$gesture', function($gesture) {
            $gesture.register({
                name: 'touch',
                index: -Infinity,
                defaults: {
                    touchPreventDefault: false,
                    touchActiveClass: 'ng-click-active'
                },
                handler: function(ev, inst) {
                    if (ev.srcEvent.button !== 0) {
                        inst.stopDetect();
                        return;
                    }

                    if (inst.options.touchPreventDefault) {
                        ev.preventDefault();
                    }

                    if (ev.eventType === $gesture.utils.EVENT_START) {
                        inst.trigger(this.name, ev);
                    }
                }
            });

            $gesture.register({
                name: 'release',
                index: Infinity,
                handler: function(ev, inst) {
                    if (ev.eventType === $gesture.utils.EVENT_END) {
                        inst.trigger(this.name, ev);
                    }
                }
            });

            $gesture.register({
                name: 'move',
                index: -9007199254740992, // The largest negative number possible
                handler: function(ev, inst) {
                    if (ev.eventType === $gesture.utils.EVENT_MOVE) {
                        inst.trigger(this.name, ev);
                    }
                }
            });

            return $gesture;
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngTouch
         *
         * @description
         * Specify custom behavior when element is 'touched' by an input device.
         * Synonymous with touch start, pointer down, pointer up and touch end events
         *
         * This directive also sets a CSS class, defaulting to `ng-click-active`, while the 
         * element is being held down (by a mouse click or touch) so you can restyle the depressed
         * element if you wish.
         *
         * @element ANY
         * @param {expression} ngTouch {@link guide/expression Expression} to evaluate
         * upon touch. (Event object is available as `$event`, Angular Element as '$element')
         *
         * @example
                <doc:example>
                    <doc:source>
                        <button ng-touch="touched = touched + 1" ng-init="touched=0">
                            Touch to Increment
                        </button>
                        Touched: {{ touched }}
                    </doc:source>
                </doc:example>
         */
        .directive('ngTouch', ['$parse', '$gestureTouch', function($parse, $gesture) {
            return function(scope, element, attr) {
                var touchHandler = $parse(attr.ngTouch);

                $gesture.gestureOn(element, 'touch', $gesture.extractSettings(scope, attr)).on('touch', function(eventdata) {
                    scope.$apply(function() {
                        touchHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngMove
         *
         * @description
         * Specify custom behavior when a pointer is moved after an element has been touched.
         * A move is synonymous with touch move, pointer move and mouse move events.
         *
         * @element ANY
         * @param {expression} ngMove {@link guide/expression Expression} to evaluate
         * upon pointer move. (Event object is available as `$event`, Angular Element as '$element')
         *
         * @example
                <doc:example>
                    <doc:source>
                        <button ng-move="moved = $event.distance" ng-init="moved=0">
                            Touch this text then move your mouse pointer
                        </button>
                        Moved {{ moved }}px from initial touch point
                    </doc:source>
                </doc:example>
         */
        .directive('ngMove', ['$parse', '$gestureTouch', function($parse, $gesture) {
            return function(scope, element, attr) {
                var moveHandler = $parse(attr.ngMove);

                $gesture.gestureOn(element, 'move', $gesture.extractSettings(scope, attr)).on('move', function(eventdata) {
                    scope.$apply(function() {
                        moveHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngRelease
         *
         * @description
         * Specify custom behavior when element is released after being touched.
         * A release is synonymous with touch end, pointer up and mouse up events.
         *
         * @element ANY
         * @param {expression} ngRelease {@link guide/expression Expression} to evaluate
         * upon release. (Event object is available as `$event`, Angular Element as '$element')
         *
         * @example
                <doc:example>
                    <doc:source>
                        <button ng-release="release = release + 1" ng-init="release=0">
                            Touch then release to increment
                        </button>
                        Released: {{ release }} times
                    </doc:source>
                </doc:example>
         */
        .directive('ngRelease', ['$parse', '$gestureTouch', function($parse, $gesture) {
            return function(scope, element, attr) {
                var releaseHandler = $parse(attr.ngRelease);

                $gesture.gestureOn(element, 'release', $gesture.extractSettings(scope, attr)).on('release', function(eventdata) {
                    scope.$apply(function() {
                        releaseHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }]);
}(this.angular));
