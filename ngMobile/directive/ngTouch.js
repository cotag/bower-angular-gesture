'use strict';

angular.module('ngMobile')

/**
 * @ngdoc service
 * @name ngMobile.service:$mobileTouch
 *
 * @description
 * An alias for $mobile that ensures element level touch/release detection functionality is available.
 * Synonymous with start, down, up and end events across the various input types
 *  Adds bindings for `touch` and `release` to $mobile
 */
.factory('$mobileTouch', ['$window', '$timeout', '$mobile', function($window, $timeout, $mobile) {
  $mobile.register({
    name: 'touch',
    index: -Infinity,
    defaults: {
      touch_prevent_default: false,
      touch_active_class: 'ng-click-active'
    },
    handler: function(ev, inst) {
      if (inst.options.touch_prevent_default) {
        ev.preventDefault();
      }

      if (ev.eventType == $mobile.utils.EVENT_START) {
        inst.trigger(this.name, ev);
      }
    }
  });

  $mobile.register({
    name: 'release',
    index: Infinity,
    handler: function(ev, inst) {
      if (ev.eventType == $mobile.utils.EVENT_END) {
        inst.trigger(this.name, ev);
      }
    }
  });

  return $mobile;
}])


/**
 * @ngdoc directive
 * @name ngMobile.directive:ngTouch
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
.directive('ngTouch', ['$parse', '$mobileTouch', function($parse, $mobile) {
  return function(scope, element, attr) {
    var touchHandler = $parse(attr['ngTouch']);

    $mobile.gestureOn(element, 'touch').bind('touch', function(eventdata) {
      scope.$apply(function() {
        touchHandler(scope, {$event: eventdata, $element: element});
      });
    });
  };
}])


 /**
 * @ngdoc directive
 * @name ngMobile.directive:ngRelease
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
.directive('ngRelease', ['$parse', '$mobileTouch', function($parse, $mobile) {
  return function(scope, element, attr) {
    var releaseHandler = $parse(attr['ngRelease']);

    $mobile.gestureOn(element, 'release').bind('release', function(eventdata) {
      scope.$apply(function() {
        releaseHandler(scope, {$event:eventdata, $element: element});
      });
    });
  };
}]);

