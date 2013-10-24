(function(angular) {
    'use strict';

    angular.module('ngGesture')

        /**
         * @ngdoc service
         * @name ngGesture.service:$gestureHold
         *
         * @description
         * An alias for $gesture that ensures hold detection functionality is available.
         *    Adds bindings for `hold` to $gesture
         */
        .factory('$gestureHold', ['$window', '$timeout', '$gesture', function($window, $timeout, $gesture) {
            $gesture.register({
                name: 'hold',
                index: 10,
                defaults: {
                    holdMaxPointers     : 1,
                    holdDuration        : 751,        // 750ms, or less, is a tap
                    holdMoveTolerance   : 10,         // Doesn't overlap with drags move tolerance and is equal to click
                    holdAcceptRightClick: true,        // Allow users with mice to right click instead of holding
                    touchActiveClass    : 'ng-click-active'
                },
                setup: function(el, inst) {
                    // Use the setup function to prevent context menus
                    if (inst.options.holdAcceptRightClick) {
                        el.on('contextmenu', function(event) {
                            event = event.originalEvent || event;
                            // mouse events use which, pointer events use button
                            if (event.button === 2) {
                                event.preventDefault(); // Prevent the context menu
                            }
                        });
                    }
                },
                handler: function(ev, inst) {
                    var self = this;

                    switch (ev.eventType) {
                    case $gesture.utils.EVENT_START:
                        if (inst.options.holdAcceptRightClick === true && ev.srcEvent.button === 2) {
                            inst.current.name = self.name;        // Trigger on right click
                            inst.trigger(self.name, ev);
                        } else if (ev.touches.length <= inst.options.holdMaxPointers) {
                            self.valid = $timeout(function() {
                                inst.current.name = self.name;        // Set the event and trigger if
                                inst.trigger(self.name, ev);            // we have been holding long
                                self.valid = false;                             // enough
                            }, inst.options.holdDuration, true);
                        }
                        break;
                    case $gesture.utils.EVENT_MOVE:
                        if (self.valid && (ev.distance > inst.options.holdMoveTolerance || ev.touches.length <= inst.options.holdMaxPointers)) {
                            $timeout.cancel(self.valid);
                            self.valid = false;                     // Invalidate if we exceed tolerances
                        }
                        break;
                    case $gesture.utils.EVENT_END:
                        if (self.valid) {
                            $timeout.cancel(self.valid);    // If the event ends before the hold is
                            self.valid = false;                     // triggered then we cancel
                        }
                        break;
                    }
                }
            });

            return $gesture;
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngHold
         *
         * @description
         * Specify custom behavior when element is held for a period of time or right clicked.
         * A hold is an extended touch without much motion.
         *
         * @element ANY
         * @param {expression} ngHold {@link guide/expression Expression} to evaluate upon
         * extended touch. (Event object is available as `$event`, Angular Element as '$element')
         *
         * @example
                <doc:example>
                    <doc:source>
                        <button ng-hold="held = held + 1" ng-init="held=0">
                            Hold or right click to increment
                        </button>
                        Was Held: {{ held }}
                    </doc:source>
                </doc:example>
         */
        .directive('ngHold', ['$parse', '$gestureHold', function($parse, $gesture) {
            var emptyHandler = function () {
                return false;
            };

            return function(scope, element, attr) {
                var holdHandler = $parse(attr.ngHold);

                element[0].onclick = emptyHandler;

                $gesture.gestureOn(element, 'hold', $gesture.extractSettings(scope, attr)).on('hold', function(eventdata) {
                    scope.$apply(function() {
                        holdHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }]);
}(this.angular));
