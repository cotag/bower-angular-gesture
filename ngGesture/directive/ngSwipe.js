(function(angular) {
    'use strict';

    angular.module('ngGesture')


        /**
         * @ngdoc service
         * @name ngGesture.service:$gestureSwipe
         *
         * @description
         * An alias for $gesture that ensures swipe detection functionality is available.
         *    Adds bindings for `swipe`, `swipeleft`, `swiperight`, `swipeup` and
         *    `swipedown` to $gesture
         */
        .factory('$gestureSwipe', ['$gesture', function($gesture) {
            $gesture.register({
                name: 'swipe',
                index: 40,
                defaults: {
                    swipeMaxPointers     : 1,
                    swipeMinVelocity     : 0.7,
                    // The maximum vertical or horizontal delta for a swipe should be less than 75px.
                    swipeMaxOrthogonality: 75,
                    // Vertical distance should not be more than a fraction of the horizontal distance
                    //    and vice versa.
                    swipeXyRatio         : 0.3,
                    // At least a 30px motion is necessary for a swipe.
                    swipeMinDistance     : 30,
                    // The total distance in any direction before we make the call on swipe vs scroll.
                    swipeMoveBuffer      : 10
                },
                handler: function(ev, inst) {
                    var totalX, totalY;

                    switch (ev.eventType) {
                    case $gesture.utils.EVENT_START:
                        if (ev.srcEvent.button !== 0) {
                            inst.stopDetect();
                            break;
                        }
                        this.valid = true;
                        break;
                    case $gesture.utils.EVENT_MOVE:
                        if (!this.valid) {
                            return;
                        }

                        totalX = Math.abs(ev.deltaX);
                        totalY = Math.abs(ev.deltaY);

                        // Android will send a touchcancel if it thinks we're starting to scroll.
                        // So when the total distance (+ or - or both) exceeds 10px in either direction,
                        // we either:
                        // - send preventDefault() and treat this as a swipe.
                        // - or let the browser handle it as a scroll.

                        // Check we haven't exceeded our maximum orthogonality
                        //    Do this before the buffer check as it prevents default
                        //    and we don't want to prevent scrolling for no reason
                        if (totalX > totalY) {
                            if (totalY > inst.options.swipeMaxOrthogonality) {
                                this.valid = false;
                                return;
                            }
                        } else {
                            if (totalX > inst.options.swipeMaxOrthogonality) {
                                this.valid = false;
                                return;
                            }
                        }

                        // Don't prevent default until we clear the buffer
                        if (totalX < inst.options.swipeMoveBuffer && totalY < inst.options.swipeMoveBuffer) {
                            return;
                        }

                        if (inst.handlers[this.name] || inst.handlers[this.name + ev.direction]) {
                            // If a handler exists for this direction of swipe then prevent default
                            ev.preventDefault();
                        } else {
                            // The swipe is invalid
                            this.valid = false;
                            return;
                        }
                        break;
                    case $gesture.utils.EVENT_END:
                        if (!this.valid) { return; }
                        this.valid = false;

                        totalX = Math.abs(ev.deltaX);
                        totalY = Math.abs(ev.deltaY);

                        // Check the swipe meets the requirements
                        if (totalX > totalY) {
                            if (!(totalY <= inst.options.swipeMaxOrthogonality && totalX > inst.options.swipeMinDistance && totalY / totalX < inst.options.swipeXyRatio && ev.velocityX >= inst.options.swipeMinVelocity)) {
                                return;
                            }
                        } else {
                            if (!(totalX <= inst.options.swipeMaxOrthogonality && totalY > (inst.options.swipeMinDistance / 2) && totalX / totalY < inst.options.swipeXyRatio && ev.velocityY >= inst.options.swipeMinVelocity)) {
                                return;
                            }
                        }

                        // trigger swipe events
                        if (inst.handlers[this.name] || inst.handlers[this.name + ev.direction]) {
                            ev.stopPropagation();
                            inst.trigger(this.name, ev);
                            inst.trigger(this.name + ev.direction, ev);
                        }
                        break;
                    }
                }
            });

            return $gesture;
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngSwipe
         *
         * @description
         * Specify custom behavior when an element is swiped on a touchscreen device.
         * A swipe is a quick slide of the finger across the screen, either up, down, left or right.
         * Though ngSwipe is designed for touch-based devices, it will work with a mouse click and drag too.
         *
         * @element ANY
         * @param {expression} ngSwipe {@link guide/expression Expression} to evaluate
         * upon swipe. (Event object is available as `$event`)
         *
         * @example
            <doc:example>
                <doc:source>
                <div ng-swipe="showAction = $event.direction">
                    Swipe me: {{showAction}}
                </div>
                </doc:source>
            </doc:example>
         */
        .directive('ngSwipe', ['$parse', '$gestureSwipe', function($parse, $gesture) {
            return function(scope, element, attr) {
                var swipeHandler = $parse(attr.ngSwipe);

                $gesture.gestureOn(element, 'swipe', $gesture.extractSettings(scope, attr)).on('swipe', function(eventdata) {
                    scope.$apply(function() {
                        swipeHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngSwipeRight
         *
         * @description
         * Specify custom behavior when an element is swiped to the right on a touchscreen device.
         * A rightward swipe is a quick, left-to-right slide of the finger.
         * Though ngSwipeRight is designed for touch-based devices, it will work with a mouse click and drag too.
         *
         * @element ANY
         * @param {expression} ngSwipeRight {@link guide/expression Expression} to evaluate
         * upon right swipe. (Event object is available as `$event`)
         *
         * @example
            <doc:example>
                <doc:source>
                <div ng-show="!showActions" ng-swipe-left="showActions = true">
                    Some list content, like an email in the inbox
                </div>
                <div ng-show="showActions" ng-swipe-right="showActions = false">
                    <button ng-click="reply()">Reply</button>
                    <button ng-click="delete()">Delete</button>
                </div>
                </doc:source>
            </doc:example>
         */
        .directive('ngSwipeRight', ['$parse', '$gestureSwipe', function($parse, $gesture) {
            return function(scope, element, attr) {
                var swipeHandler = $parse(attr.ngSwipeRight);

                $gesture.gestureOn(element, 'swipe', $gesture.extractSettings(scope, attr)).on('swiperight', function(eventdata) {
                    scope.$apply(function() {
                        swipeHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngSwipeLeft
         *
         * @description
         * Specify custom behavior when an element is swiped to the left on a touchscreen device.
         * A leftward swipe is a quick, right-to-left slide of the finger.
         * Though ngSwipeLeft is designed for touch-based devices, it will work with a mouse click and drag too.
         *
         * @element ANY
         * @param {expression} ngSwipeLeft {@link guide/expression Expression} to evaluate
         * upon left swipe. (Event object is available as `$event`)
         *
         * @example
            <doc:example>
                <doc:source>
                <div ng-show="!showActions" ng-swipe-left="showActions = true">
                    Some list content, like an email in the inbox
                </div>
                <div ng-show="showActions" ng-swipe-right="showActions = false">
                    <button ng-click="reply()">Reply</button>
                    <button ng-click="delete()">Delete</button>
                </div>
                </doc:source>
            </doc:example>
         */
        .directive('ngSwipeLeft', ['$parse', '$gestureSwipe', function($parse, $gesture) {
            return function(scope, element, attr) {
                var swipeHandler = $parse(attr.ngSwipeLeft);

                $gesture.gestureOn(element, 'swipe', $gesture.extractSettings(scope, attr)).on('swipeleft', function(eventdata) {
                    scope.$apply(function() {
                        swipeHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngSwipeUp
         *
         * @description
         * Specify custom behavior when an element is swiped up on a touchscreen device.
         * An upward swipe is a quick, bottom-to-top slide of the finger.
         * Though ngSwipeUp is designed for touch-based devices, it will work with a mouse click and drag too.
         *
         * @element ANY
         * @param {expression} ngSwipeUp {@link guide/expression Expression} to evaluate
         * upon upward swipe. (Event object is available as `$event`)
         *
         * @example
            <doc:example>
                <doc:source>
                <div ng-show="!showActions" ng-swipe-down="showActions = true">
                    Swipe down to see notifications
                </div>
                <div style="height:150px" ng-show="showActions" ng-swipe-up="showActions = false">
                    Swipe up to hide this notification
                </div>
                </doc:source>
            </doc:example>
         */
        .directive('ngSwipeUp', ['$parse', '$gestureSwipe', function($parse, $gesture) {
            return function(scope, element, attr) {
                var swipeHandler = $parse(attr.ngSwipeUp);

                $gesture.gestureOn(element, 'swipe', $gesture.extractSettings(scope, attr)).on('swipeup', function(eventdata) {
                    scope.$apply(function() {
                        swipeHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }])


        /**
         * @ngdoc directive
         * @name ngGesture.directive:ngSwipeDown
         *
         * @description
         * Specify custom behavior when an element is swiped down on a touchscreen device.
         * A downward swipe is a quick, top-to-bottom slide of the finger.
         * Though ngSwipeDown is designed for touch-based devices, it will work with a mouse click and drag too.
         *
         * @element ANY
         * @param {expression} ngSwipeDown {@link guide/expression Expression} to evaluate
         * upon downward swipe. (Event object is available as `$event`)
         *
         * @example
            <doc:example>
                <doc:source>
                <div ng-show="!showActions" ng-swipe-down="showActions = true">
                    Swipe down to see notifications
                </div>
                <div style="height:150px" ng-show="showActions" ng-swipe-up="showActions = false">
                    Swipe up to hide this notification
                </div>
                </doc:source>
            </doc:example>
         */
        .directive('ngSwipeDown', ['$parse', '$gestureSwipe', function($parse, $gesture) {
            return function(scope, element, attr) {
                var swipeHandler = $parse(attr.ngSwipeDown);

                $gesture.gestureOn(element, 'swipe', $gesture.extractSettings(scope, attr)).on('swipedown', function(eventdata) {
                    scope.$apply(function() {
                        swipeHandler(scope, {$event: eventdata, $element: element});
                    });
                });
            };
        }]);
}(this.angular));
