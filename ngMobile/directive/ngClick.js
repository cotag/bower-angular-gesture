(function(angular) {
  'use strict';

  angular.module('ngMobile')

    // Replaces the default ngClick with mobiles version
    .config(['$provide', function($provide) {
      $provide.decorator('ngClickDirective', ['$delegate', function($delegate) {
        // drop the default ngClick directive
        $delegate.shift();
        return $delegate;
      }]);
    }])



    /**
     * @ngdoc service
     * @name ngMobile.service:$mobileClick
     *
     * @description
     * An alias for $mobile that ensures click/tap detection functionality is available.
     *  Adds bindings for `tap` and `doubletap` to $mobile
     */
    .factory('$mobileClick', ['$window', '$timeout', '$mobile', function($window, $timeout, $mobile) {
      $mobile.register({
        name: 'tap',
        index: 100,
        defaults: {
          tapMaxPointers    : 1,
          tapMaxDuration    : 750,    // Shorter than 750ms is a tap, longer is a taphold or drag.
          tapMoveTolerance  : 10,     // 10px doesn't overlap with drags move tolerance
          tapAlways          : true,   // tap on double tap (w3c way for click)
          preventGhostClicks: true,   // ignore virtual click events if click already handled
          doubletapTolerance : 20,     // allow for a bit of human error
          doubletapInterval  : 400,
          touchActiveClass  : 'ng-click-active'
        },
        setup: function(el, inst) {
          var self = this;

          // Use the setup function to check for IE8 or below
          // As IE doesn't have a mouse down event for double taps
          if (!$window.document.addEventListener) {
            el.bind('dblclick', function(ev) {
              if (inst.options.tapAlways) {
                inst.trigger('tap', ev);
              }
              inst.trigger('doubletap', ev);
            });
          }

          // click fall-back (primarily for programmatic clicks and testing)
          // Also allows for browser defaults where a gesture hasn't prevented the click
          //  e.g. a hold will cancel a click event however if hold isn't applied to the element
          //       and we are on a desktop browser then this will trigger a click event
          self.allow_click = true;
          el.bind('click', function(ev) {
            if (self.allow_click === true) {
              inst.trigger('tap', ev);
            } else {
              $timeout.cancel(self.allow_click); // Ensures only one click is approved
              self.allow_click = true;
            }

            return false;
          });
        },
        handler: function(ev, inst) {
          var self = this, prev;

          switch (ev.eventType) {
          case $mobile.utils.EVENT_START:
            this.valid = true;
            break;
          case $mobile.utils.EVENT_MOVE:
            if (ev.distance > inst.options.tapMoveTolerance) {
              this.valid = false;
            }
            break;
          case $mobile.utils.EVENT_END:
            // previous gesture, for the double tap since these are two different gesture detections
            prev = inst.previous;

            // when the touch time is higher then the max touch time
            // or when the moving distance is too much
            if (!this.valid || ev.deltaTime > inst.options.tapMaxDuration || ev.distance > inst.options.tapMoveTolerance) {
              if (inst.current.name !== '') {
                // Prevent click if another gesture is occurring
                // Otherwise run with browser default behavior
                this.allow_click = $timeout(function() {
                  self.allow_click = true;
                }, 0, false);
              }
              return;
            }

            inst.current.name = this.name;
            ev.preventDefault();

            // check if double tap
            if (prev && prev.name === this.name && !this.did_doubletap &&
                (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletapInterval &&
                $mobile.utils.getDistance(prev.lastEvent.center, ev.center) < inst.options.doubletapTolerance) {

              if (inst.options.tapAlways) {
                inst.trigger(inst.current.name, ev);
              }
              inst.trigger('doubletap', ev);
              this.did_doubletap = true;
            } else {
              // do a single tap
              this.did_doubletap = false;
              inst.trigger(inst.current.name, ev);
            }

            if (ev.srcEvent.type === 'touchend' && inst.options.preventGhostClicks) {
              $mobile.utils.preventGhostClick(ev.touches[0].clientX, ev.touches[0].clientY);
            }

            // Prevent click handler trigger as we have already handled this event.
            // We prevent clicks occuring after the up/end event has been handled
            //  and clear the condition before the next tick through the reactor
            //  or after a click has been prevented (which ever comes first)
            this.allow_click = $timeout(function() {
              self.allow_click = true;
            }, 0, false);

            break;
          }
        }
      });

      return $mobile;
    }])


    /**
     * @ngdoc directive
     * @name ngMobile.directive:ngClick
     *
     * @description
     * A more powerful replacement for the default ngClick designed to be used on touchscreen
     * devices. Most mobile browsers wait about 300ms after a tap-and-release before sending
     * the click event. This version handles them immediately, and then prevents the
     * following click event from propagating.
     *
     * This directive can fall back to using an ordinary click event, and so works on desktop
     * browsers as well as mobile.
     *
     * This directive also sets a CSS class, defaulting to `ng-click-active`, while the 
     * element is being held down (by a mouse click or touch) so you can restyle the depressed
     * element if you wish.
     *
     * @element ANY
     * @param {expression} ngClick {@link guide/expression Expression} to evaluate
     * upon tap. (Event object is available as `$event`, Angular Element as '$element')
     *
     * @example
        <doc:example>
          <doc:source>
            <button ng-click="clicks = clicks + 1" ng-init="clicks=0">
              Click to Increment
            </button>
            clicks: {{ clicks }}
          </doc:source>
        </doc:example>
     */
    .directive('ngClick', ['$parse', '$mobileClick', function($parse, $mobile) {
      return function(scope, element, attr) {
        var clickHandler = $parse(attr.ngClick);

        // Hack for iOS Safari's benefit. It goes searching for onclick handlers and is liable to click
        // something else nearby.
        element[0].onclick = function() {};

        $mobile.gestureOn(element, 'tap', $mobile.extractSettings(scope, attr)).bind('tap', function(eventdata) {
          scope.$apply(function() {
            clickHandler(scope, {$event: eventdata, $element: element});
          });
        });
      };
    }])



     /**
     * @ngdoc directive
     * @name ngMobile.directive:ngDblClick
     *
     * @description
     * Specify custom behavior when element is tapped twice on a touchscreen device.
     * A double tap is two taps with only a brief pause without much motion.
     *
     * @element ANY
     * @param {expression} ngClick {@link guide/expression Expression} to evaluate
     * upon double tap. (Event object is available as `$event`, Angular Element as '$element')
     *
     * @example
        <doc:example>
          <doc:source>
            <button ng-dbl-click="dbl = dbl + 1" ng-init="dbl=0">
              Double Click to Increment
            </button>
            Double Clicks: {{ dbl }}
          </doc:source>
        </doc:example>
     */
    .directive('ngDblClick', ['$parse', '$mobileClick', function($parse, $mobile) {
      return function(scope, element, attr) {
        var clickHandler = $parse(attr.ngDblClick);

        // Hack for iOS Safari's benefit. It goes searching for onclick handlers and is liable to click
        // something else nearby.
        element[0].onclick = function() {};

        $mobile.gestureOn(element, 'tap', $mobile.extractSettings(scope, attr)).bind('doubletap', function(eventdata) {
          scope.$apply(function() {
            clickHandler(scope, {$event: eventdata, $element: element});
          });
        });
      };
    }]);
}(this.angular));
