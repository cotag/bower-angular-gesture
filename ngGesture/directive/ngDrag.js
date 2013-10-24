(function(angular) {
    'use strict';

    angular.module('ngGesture')
        .factory('$gestureDrag', ['$gesture', function($gesture) {
            $gesture.register({
                name: 'drag',
                index: 50,
                defaults: {
                    dragMaxPointers : 1,
                    dragMinDistance : 10,
                    dragAdjustStart : true,
                    // prevent default browser behavior when dragging occurs
                    // when you are using the drag gesture, it is a good practice to set this true
                    dragBlock       : true
                },
                handler: function dragGesture(ev, inst) {
                    // current gesture isnt drag, but dragged is true
                    // this means an other gesture is busy. now call dragend
                    if (inst.current.name !== this.name && this.triggered) {
                        inst.trigger(this.name + 'end', ev);
                        this.triggered = false;
                        return;
                    }

                    // max touches
                    if (ev.touches.length > inst.options.dragMaxPointers) {
                        return;
                    }

                    switch (ev.eventType) {
                    case $gesture.utils.EVENT_START:
                        if (ev.srcEvent.button !== 0) {
                            inst.stopDetect();
                            break;
                        }
                        this.triggered = false;
                        break;

                    case $gesture.utils.EVENT_MOVE:
                        // when the distance we moved is too small we skip this gesture
                        // or we can be already in dragging
                        if (ev.distance < inst.options.dragMinDistance && inst.current.name !== this.name) {
                            return;
                        }

                        // we are dragging!
                        if (inst.current.name !== this.name) {
                            inst.current.name = this.name;

                            // Adjust the start position based on the min drag distance
                            if (inst.options.dragAdjustStart) {
                                // When a drag is triggered, set the event center to dragMinDistance pixels from the original event center.
                                // Without this correction, the dragged distance would jumpstart at dragMinDistance pixels instead of at 0.
                                // It might be useful to save the original start point somewhere
                                var factor = Math.abs(inst.options.dragMinDistance / ev.distance);
                                inst.current.startEvent.center.pageX += ev.deltaX * factor;
                                inst.current.startEvent.center.pageY += ev.deltaY * factor;

                                // recalculate event data using new start point
                                inst.extendEventData(ev);
                            }
                        }

                        // first time, trigger dragstart event
                        if (!this.triggered) {
                            inst.trigger(this.name + 'begin', ev);
                            this.triggered = true;
                        }

                        // trigger normal event
                        inst.trigger(this.name, ev);

                        // block the browser events
                        if (inst.options.dragBlock) {
                            ev.preventDefault();
                        }
                        break;

                    case $gesture.utils.EVENT_END:
                        // trigger dragend
                        if (this.triggered) {
                            inst.trigger(this.name + 'stop', ev);
                        }

                        this.triggered = false;
                        break;
                    }
                }
            });

            return $gesture;
        }])

        .directive('ngDrag', ['$parse', '$gestureDrag', function($parse, $gesture) {
            return {
                restrict: 'A',        // Attribute
                link: function(scope, element, attrs) {
                    var x0,         // X 0ffset of drag start
                        y0,            // Y 0ffset of drag start
                        x,            // Current X offset during drag
                        y,            // Current Y offset during drag
                        props,        // Stores the change in position
                        start,        // Is this the first move
                        performDrag = attrs.dragMoveElement === 'true',
                        moveY = attrs.dragYAxis !== 'false',
                        moveX = attrs.dragXAxis !== 'false',
                        dragStart,
                        onDrag,
                        dragEnd;

                    if (attrs.dragBegin) {
                        dragStart = $parse(attrs.dragBegin);
                    }

                    if (attrs.ngDrag) {
                        onDrag = $parse(attrs.ngDrag);
                    }

                    if (attrs.dragStop) {
                        dragEnd = $parse(attrs.dragStop);
                    }

                    $gesture.gestureOn(element, 'drag', $gesture.extractSettings(scope, attrs)).on('dragbegin', function(event) {
                        x0 = event.center.pageX - element[0].offsetLeft;
                        y0 = event.center.pageY - element[0].offsetTop;

                        start = true;
                    }).on('drag', function(event) {
                        props = {};

                        x = event.center.pageX - x0;
                        y = event.center.pageY - y0;

                        if (start === true && dragStart) {
                            start = false;
                            scope.$apply(function() {
                                dragStart(scope, {$event: event, $element: element});
                            });
                        }

                        if (performDrag) {
                            if (moveX) {
                                props.left = x;
                                element.css('left', x + 'px');
                            }
                            if (moveY) {
                                props.top = y;
                                element.css('top', y + 'px');
                            }
                        } else {
                            if (moveX) { props.left = x; }
                            if (moveY) { props.top = y; }
                        }

                        if (onDrag) {
                            scope.$apply(function() {
                                onDrag(scope, {$event: event, $element: element, $position: props});
                            });
                        }
                    }).on('dragstop', function(event) {
                        if (dragEnd) {
                            scope.$apply(function() {
                                dragEnd(scope, {$event: event, $element: element, $position: props});
                            });
                        }
                    });
                }
            };
        }]);
}(this.angular));
