
(function(angular) {
  'use strict';

  /**
   * @ngdoc overview
   * @name ngMobile
   * @description
   */

  /*
   * Provides a basis for gesture detection where multiple gestures can be
   * applied to an element without clashing and multiple gestures can
   * be active at the same time on different elements.
   *
   * Based on jQuery Mobile touch event handling (jquerymobile.com)
   *   Microsoft PointerDraw http://ie.microsoft.com/testdrive/ieblog/2011/oct/PointerDraw.js.source.html
   *   with substantial portions of code from Hammer.JS http://eightmedia.github.io/hammer.js/
   */

  /* Hammer.JS License:
  Copyright (C) 2013 by Jorik Tangelder (Eight Media)

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
  */


  // define ngMobile module and register $mobile service
  angular.module('ngMobile', [])



    /**
     * @ngdoc object
     * @name ngMobile.$mobileUtils
     * @requires $window
     *
     * @description
     *   Holds helper functions and constants useful for detecting mobile events
     */
    .factory('$mobileUtils', ['$window', '$timeout', function($window, $timeout) {
      var CLICKBUSTER_THRESHOLD = 25,  // 25 pixels in any dimension is the limit for busting clicks.
        PREVENT_DURATION = 2500,     // 2.5 seconds maximum from preventGhostClick call to click
        lastPreventedTime,
        regionCount,
        touchCoordinatesMD,     // Touch coordinates for mouse down
        touchCoordinatesC,      // Touch coordinates for click


        // TAP EVENTS AND GHOST CLICKS
        //
        // Why tap events?
        // Mobile browsers detect a tap, then wait a moment (usually ~300ms) to see if you're
        // double-tapping, and then fire a click event.
        //
        // This delay sucks and makes mobile apps feel unresponsive.
        // So we detect touchstart, touchmove, touchcancel and touchend ourselves and determine when
        // the user has tapped on something.
        //
        // What happens when the browser then generates a click event?
        // The browser, of course, also detects the tap and fires a click after a delay. This results in
        // tapping/clicking twice. So we do "clickbusting" to prevent it.
        //
        // How does it work?
        // We attach global touchstart and click handlers, that run during the capture (early) phase.
        // So the sequence for a tap is:
        // - global touchstart: Sets an "allowable region" at the point touched.
        // - element's touchstart: Starts a touch
        // (- touchmove or touchcancel ends the touch, no click follows)
        // - element's touchend: Determines if the tap is valid (didn't move too far away, didn't hold
        //   too long) and fires the user's tap handler. The touchend also calls preventGhostClick().
        // - preventGhostClick() removes the allowable region the global touchstart created.
        // - The browser generates a click event.
        // - The global click handler catches the click, and checks whether it was in an allowable region.
        //     - If preventGhostClick was called, the region will have been removed, the click is busted.
        //     - If the region is still there, the click proceeds normally. Therefore clicks on links and
        //       other elements without ngTap on them work normally.
        //
        // This is an ugly, terrible hack!
        // Yeah, tell me about it. The alternatives are using the slow click events, or making our users
        // deal with the ghost clicks, so I consider this the least of evils. Fortunately Angular
        // encapsulates this ugly logic away from the user.
        //
        // Why not just put click handlers on the element?
        // We do that too, just to be sure. The problem is that the tap event might have caused the DOM
        // to change, so that the click fires in the same position but something else is there now. So
        // the handlers are global and care only about coordinates and not elements.


        // Checks if the coordinates are close enough to be within the region.
        hit = function(x1, y1, x2, y2) {
          return Math.abs(x1 - x2) < CLICKBUSTER_THRESHOLD && Math.abs(y1 - y2) < CLICKBUSTER_THRESHOLD;
        },

        // Checks a list of allowable regions against a click location.
        // Returns true if the click should be allowed.
        // Splices out the allowable region from the list after it has been used.
        checkAllowableRegions = function(touchCoordinates, x, y) {
          var i;
          for (i = 0; i < touchCoordinates.length; i += 1) {
            if (hit(touchCoordinates[i][0], touchCoordinates[i][1], x, y)) {
              touchCoordinates.splice(i, i + 1);
              return true; // allowable region
            }
          }
          return false; // No allowable region; bust it.
        },

        // Global click handler that prevents the click if it's in a bustable zone and preventGhostClick
        // was called recently.
        onClick = function(event) {
          if (Date.now() - lastPreventedTime > PREVENT_DURATION) {
            return; // Too old.
          }

          var touches = event.touches && event.touches.length ? event.touches : [event],
            x = touches[0].clientX,
            y = touches[0].clientY;
          // Work around desktop Webkit quirk where clicking a label will fire two clicks (on the label
          // and on the input element). Depending on the exact browser, this second click we don't want
          // to bust has either (0,0) or negative coordinates.
          if (x < 1 && y < 1) {
            return; // offscreen
          }

          // Look for an allowable region containing this click.
          // If we find one, that means it was created by touchstart and not removed by
          // preventGhostClick, so we don't bust it.
          if (checkAllowableRegions(event.type === 'mousedown' ? touchCoordinatesMD : touchCoordinatesC, x, y)) {
            return;
          }

          // If we didn't find an allowable region, bust the click.
          event.stopPropagation();
          event.preventDefault();
        },

        // Global touchstart handler that creates an allowable region for a click event.
        // This allowable region can be removed by preventGhostClick if we want to bust it.
        onTouchStart = function(event) {
          var touches = event.touches && event.touches.length ? event.touches : [event],
            x = touches[0].clientX,
            y = touches[0].clientY,
            identifier = touches[0].identifier;

          touchCoordinatesMD.push([x, y, identifier]);
          touchCoordinatesC.push([x, y, identifier]);

          if (regionCount === 0) {
            $window.document.addEventListener('mousedown', onClick, true);
          }
          regionCount += 1;

          $timeout(function() {
            // Remove the allowable region.
            var i;

            regionCount -= 1;
            if (regionCount === 0) {
              // Limits user to either touch events or mice on non-pointer event browsers
              // whilst allowing the user to switch input device at any time.
              // There is no delay moving from a mouse to touch, however there is a
              // PREVENT_DURATION (2.5 second) delay moving from touch to a mouse
              $window.document.removeEventListener('mousedown', onClick, true);
            }

            for (i = 0; i < touchCoordinatesMD.length; i += 1) {
              if (touchCoordinatesMD[i][2] === identifier) {
                touchCoordinatesMD.splice(i, i + 1);
                break;
              }
            }
            for (i = 0; i < touchCoordinatesC.length; i += 1) {
              if (touchCoordinatesC[i][2] === identifier) {
                touchCoordinatesC.splice(i, i + 1);
                break;
              }
            }
          }, PREVENT_DURATION, false);
        };


      return {
        /**
        * On the first call, attaches some event handlers. Then whenever it gets called, it creates a
        * zone around the touchstart where clicks will get busted.
        * @param   {HTMLElement}   node
        * @param   {HTMLElement}   parent
        * @returns {boolean}     has_parent
        */
        preventGhostClick: function(x, y) {
          if (!touchCoordinatesC) {
            touchCoordinatesC = [];
            touchCoordinatesMD = [];
            regionCount = 1;
            $window.document.addEventListener('touchstart', onTouchStart, true);

            // Since mouse down binds the pointer to an element and iOS emulates
            // these events we block them temporarily 
            $window.document.addEventListener('mousedown', onClick, true);
            $timeout(function() {
              regionCount -= 1;
              if (regionCount === 0) {
                $window.document.removeEventListener('mousedown', onClick, true);
              }
            }, PREVENT_DURATION, false);

            $window.document.addEventListener('click', onClick, true);
          }
          lastPreventedTime = Date.now();

          checkAllowableRegions(touchCoordinatesMD, x, y);
          checkAllowableRegions(touchCoordinatesC, x, y);
        },


        // direction defines
        DIRECTION_DOWN: 'down',
        DIRECTION_LEFT: 'left',
        DIRECTION_UP: 'up',
        DIRECTION_RIGHT: 'right',

        // touch event defines
        EVENT_START: 'start',
        EVENT_MOVE: 'move',
        EVENT_END: 'end',

        HAS_POINTEREVENTS: $window.navigator.pointerEnabled || $window.navigator.msPointerEnabled,
        HAS_TOUCHEVENTS: ($window.ontouchend === undefined),

        // eventtypes per touchevent (start, move, end)
        // are filled by this.event.determineEventTypes on setup
        EVENT_TYPES: {},


        /**
        * find if a node is in the given parent
        * used for event delegation tricks
        * @param   {HTMLElement}   node
        * @param   {HTMLElement}   parent
        * @returns {boolean}     has_parent
        */
        hasParent: function(node, parent) {
          while (node) {
            if (node === parent) {
              return true;
            }
            node = node.parentNode;
          }
          return false;
        },


        /**
        * get the center of all the touches
        * @param   {Array}   touches
        * @returns {Object}  center
        */
        getCenter: function getCenter(touches) {
          var valuesX = [], valuesY = [], t, len;

          for (t = 0, len = touches.length; t < len; t += 1) {
            valuesX.push(touches[t].pageX);
            valuesY.push(touches[t].pageY);
          }

          return {
            pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
            pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
          };
        },


        /**
        * calculate the velocity between two points
        * @param   {Number}  delta_time
        * @param   {Number}  delta_x
        * @param   {Number}  delta_y
        * @returns {Object}  velocity
        */
        getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
          return {
            x: Math.abs(delta_x / delta_time) || 0,
            y: Math.abs(delta_y / delta_time) || 0
          };
        },


        /**
        * calculate the angle between two coordinates
        * @param   {Touch}   touch1
        * @param   {Touch}   touch2
        * @returns {Number}  angle
        */
        getAngle: function getAngle(touch1, touch2) {
          var y = touch2.pageY - touch1.pageY,
            x = touch2.pageX - touch1.pageX;

          return Math.atan2(y, x) * 180 / Math.PI;
        },


        /**
        * angle to direction define
        * @param   {Touch}   touch1
        * @param   {Touch}   touch2
        * @returns {String}  direction constant, like this.DIRECTION_LEFT
        */
        getDirection: function getDirection(touch1, touch2) {
          var x = Math.abs(touch1.pageX - touch2.pageX),
            y = Math.abs(touch1.pageY - touch2.pageY);

          if (x >= y) {
            return touch1.pageX - touch2.pageX > 0 ? this.DIRECTION_LEFT : this.DIRECTION_RIGHT;
          }
          // else
          return touch1.pageY - touch2.pageY > 0 ? this.DIRECTION_UP : this.DIRECTION_DOWN;
        },


        /**
        * calculate the distance between two touches
        * @param   {Touch}   touch1
        * @param   {Touch}   touch2
        * @returns {Number}  distance
        */
        getDistance: function getDistance(touch1, touch2) {
          var x = touch2.pageX - touch1.pageX,
            y = touch2.pageY - touch1.pageY;
          return Math.sqrt((x * x) + (y * y));
        },


        /**
        * calculate the scale factor between two touchLists (fingers)
        * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
        * @param   {Array}   start
        * @param   {Array}   end
        * @returns {Number}  scale
        */
        getScale: function getScale(start, end) {
          // need two fingers...
          if (start.length >= 2 && end.length >= 2) {
            return this.getDistance(end[0], end[1]) / this.getDistance(start[0], start[1]);
          }
          // else
          return 1;
        },


        /**
        * calculate the rotation degrees between two touchLists (fingers)
        * @param   {Array}   start
        * @param   {Array}   end
        * @returns {Number}  rotation
        */
        getRotation: function getRotation(start, end) {
          // need two fingers
          if (start.length >= 2 && end.length >= 2) {
            return this.getAngle(end[1], end[0]) - this.getAngle(start[1], start[0]);
          }
          // else
          return 0;
        },


        /**
        * boolean if the direction is vertical
        * @param  {String}  direction
        * @returns  {Boolean}   is_vertical
        */
        isVertical: function isVertical(direction) {
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



    /**
     * @ngdoc object
     * @name ngMobile.$mobile
     * @requires $window $document
     *
     * @description
     *   Provides an interface for configuring default gesture settings and
     *   registering for gesture detection within directives. This is achieved
     *   by normalizing browser mouse, touch and pointer events for gesture
     *   detection.
     *   Effectively mimicking touch events with element level isolation.
     */
    .provider('$mobile', function() {

      var defaults = {
        setBrowserBehaviors: true
      },
        defaultBrowserBehavior = {
          // this also triggers onselectstart=false for IE
          userSelect: 'none',
          // this makes the element blocking in IE10 >, you could experiment with the value
          // see for more options this issue; https://github.com/EightMedia/this.js/issues/241
          touchAction: 'none',
          touchCallout: 'none',
          contentZooming: 'none',
          userDrag: 'none',
          tapHighlightColor: 'rgba(0,0,0,0)'
        };

      this.setGestureDefaults = function(settings) {
        angular.extend(defaults, settings);
      };

      this.setDefaultBrowserBehavior = function(settings) {
        angular.extend(defaultBrowserBehavior, settings);
      };


      this.$get = ['$window', '$document', '$timeout', '$mobileUtils', function($window, $document, $timeout, $mobileUtils) {
        var gestureTypes = {}, // Gestures registered with $mobile
          instanceId = 0,      // id of last instance (for use in associative arrays)

          pointerAllocation = {},  // PointerId => Instances (capture mapping)
          eventPointers = {},      // Instance => Pointers (similar to touches list on iOS)

          // Track the current event so we don't steal the capture
          currentEvent,


          /*
           * Delayed pointer release
           */
          releasePointer = function(element, pointerId) {
            $timeout(function() {
              element.releasePointerCapture(pointerId);
            }, 0, false);
          },


          detect = function(event, eventType, instance, pointersEnding) {
            var i,
              touches;

            pointersEnding = pointersEnding || [];  // may be undefined
            touches = [];

            // Get the touches related to this element
            angular.forEach(eventPointers[instance], function(value) {
              this.push(value);
            }, touches);

            // Make this a move event if there are still fingers on the screen
            if (eventType === $mobileUtils.EVENT_END && (pointersEnding.length - instance.pointersCount) > 0) {
              eventType = $mobileUtils.EVENT_MOVE;
            }

            instance.detect({
              center    : $mobileUtils.getCenter(touches),
              timeStamp   : Date.now(),
              target    : event.target,
              touches   : touches,
              eventType   : eventType,
              srcEvent  : event,

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
                } else {
                  this.srcEvent.returnValue = false;  // IE8
                }
              },

              /**
               * stop bubbling the event up to its parents
               */
              stopPropagation: function() {
                this.srcEvent.propagation_stop_sig = true;

                if (this.srcEvent.stopPropagation) {
                  this.srcEvent.stopPropagation();
                } else {
                  this.srcEvent.cancelBubble = true;  // IE8
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
            if (eventType === $mobileUtils.EVENT_END) {
              instance.stopDetect();
            } else {
              // We remove the pointers that are no longer on the screen
              for (i = 0; i < pointersEnding.length; i += 1) {
                delete pointerAllocation[pointersEnding[i]];        // This is ok
                delete eventPointers[instance][pointersEnding[i]];
                instance.pointersCount = instance.pointersCount - 1;
              }
            }
          },


          /**
           * touch event normalisation
           * @param   {HTMLElement}   element
           * @param   {String}    eventType
           */
          onTouch = function(element, eventType) {
            element.bind($mobileUtils.EVENT_TYPES[eventType], function(event) {
              event = event.originalEvent || event; // in case of jQuery

              // Return if we have already handled this event or the event is a right click
              // NOTE:: event.button is for IE8
              if (event === currentEvent || ((event.type.match(/mouse/i) && (event.which || event.button) !== 1) || (event.type.match(/pointerdown/i) && event.button !== 0))) {
                return;
              }
              currentEvent = event;

              // Normalise pointers, mice and touches with pointer lists
              // Effectively emulates touch events with element level isolation
              var pointerList = (event.changedTouches && event.changedTouches.length) ? event.changedTouches : ((event.touches && event.touches.length) ? event.touches : [event]),
                i,
                p,
                pointerObj,
                instance,
                instances = [],
                captureProcessed,
                pointersEnding = {};

              if (eventType === $mobileUtils.EVENT_START) {


                // protect against failing to get an up or end on non-pointer based browsers
                //
                // as we can capture pointer events on elements being monitored for angulars $destroy event
                // we will never lose track of pointers. However touchends will not fire if the capturing
                // element is removed and 
                if (!$mobileUtils.HAS_POINTEREVENTS) {
                  if (event.touches) {  // touches we loop through making sure they exist

                    instance = {};
                    for (i = 0; i < event.touches.length; i += 1) {
                      instance[event.touches[i].identifier] = true;
                    }
                    for (i = 0; i < event.changedTouches.length; i += 1) {
                      instance[event.changedTouches[i].identifier] = true;
                    }

                    angular.forEach(pointerAllocation, function(value, key) {
                      if (!instance.hasOwnProperty(key)) {
                        instances.push(key);
                      }
                    });

                    for (p = 0; p < instances.length; p += 1) {
                      instance = pointerAllocation[instances[p]];
                      for (i = 0; i < instance.length; i += 1) {
                        instance[i].stopDetect();
                      }
                    }

                    // reset instances
                    instances = [];
                    instance = undefined;
                  } else if (pointerAllocation[1]) {             // this is a mouse
                    instance = pointerAllocation[1];
                    for (i = 0; i < instance.length; i += 1) {
                      instance[i].stopDetect();
                    }
                  }
                }


                // run up the tree looking for mobile elements
                i = element;
                do {
                  instance = i.data('__$mobile.config__');
                  if (instance) {
                    instances.push(instance);
                  }
                  i = i.parent();
                } while (i[0]);


                // loop through the pointers
                for (p = 0; p < pointerList.length; p += 1) {
                  captureProcessed = false;
                  pointerObj = pointerList[p];
                  pointerObj.identifier = (pointerObj.identifier !== undefined) ? pointerObj.identifier : (pointerObj.pointerId !== undefined) ? pointerObj.pointerId : 1;

                  // reset the current id
                  pointerAllocation[pointerObj.identifier] = [];

                  for (i = 0; i < instances.length; i += 1) {
                    instance = instances[i];

                    // Check if the element can capture another pointer and assign the pointer to that element
                    if (instance.pointersCount < instance.pointersMax) {
                      // TODO:: check for stealing element here
                      // if it exists and a parent element has not indicated prevent stealing
                      // then it should become the sole target of this event (or shared amongst other stealing elements)


                      if (instance.options.touchActiveClass) {
                        element.addClass(instance.options.touchActiveClass);
                      }

                      pointerAllocation[pointerObj.identifier].push(instance);
                      if (instance.pointersCount === 0) {
                        eventPointers[instance] = {};
                      }
                      eventPointers[instance][pointerObj.identifier] = pointerObj;
                      instance.pointersCount = instance.pointersCount + 1;

                      // Capture pointer events on the first element accepting the pointer
                      if (!captureProcessed && $mobileUtils.HAS_POINTEREVENTS) {
                        if (!element[0].setPointerCapture) {
                          element[0].setPointerCapture = element[0].msSetPointerCapture;
                          element[0].releasePointerCapture = element[0].msReleasePointerCapture;
                        }
                        element[0].setPointerCapture(pointerObj.identifier);
                        captureProcessed = true;
                      }
                    }
                  }

                  // Check for IE8 to add pageX and pageY (same as below) -----------------------------v
                  if (!$window.document.addEventListener) {
                    pointerObj.pageX = pointerObj.clientX + $window.document.body.scrollLeft;
                    pointerObj.pageY = pointerObj.clientY + $window.document.body.scrollTop;
                  }
                }
              } else {
                // loop through the pointers
                for (p = 0; p < pointerList.length; p += 1) {
                  captureProcessed = false;
                  pointerObj = pointerList[p];
                  pointerObj.identifier = (pointerObj.identifier !== undefined) ? pointerObj.identifier : (pointerObj.pointerId !== undefined) ? pointerObj.pointerId : 1;

                  if (pointerAllocation[pointerObj.identifier]) {
                    // NOTE:: we could attach pointers to elements if a user has missed the target element for the initial touch?
                    //  Might make this a configuration option in the future: gobble_pointers?
                    instances.push.apply(instances, pointerAllocation[pointerObj.identifier]);

                    // Check for IE8 to add pageX and pageY (same as above) ----------------------------^
                    if (!$window.document.addEventListener) {
                      pointerObj.pageX = pointerObj.clientX + $window.document.body.scrollLeft;
                      pointerObj.pageY = pointerObj.clientY + $window.document.body.scrollTop;
                    }

                    for (i = 0; i < instances.length; i += 1) {
                      instance = instances[i];

                      // Update pointer
                      eventPointers[instance][pointerObj.identifier] = pointerObj;

                      // Keep track of pointers that are leaving the screen
                      if (eventType === $mobileUtils.EVENT_END) {
                        if (pointersEnding[instance]) {
                          pointersEnding[instance].push(pointerObj.identifier);
                        } else {
                          pointersEnding[instance] = [pointerObj.identifier];
                        }

                        // Release captured pointers
                        if (!captureProcessed && $mobileUtils.HAS_POINTEREVENTS) {
                          releasePointer(element[0], pointerObj.identifier);
                          captureProcessed = true;
                        }
                      }
                    }
                  }
                }
              }

              // Detect gestures
              if (instances.length > 0) {
                for (i = 0; i < instances.length; i += 1) {
                  if (!event.propagation_stop_sig) {
                    detect(event, eventType, instances[i], pointersEnding[instances[i]]);
                  } else {
                    // de-allocate pointers to the remaining instances
                    instances[i].stopDetect();
                  }
                }
              }
            });
          };

        // determine the eventtype we want to set
        if ($mobileUtils.HAS_POINTEREVENTS) {
          // pointerEvents
          $mobileUtils.EVENT_TYPES[$mobileUtils.EVENT_START]  = 'pointerdown MSPointerDown';
          $mobileUtils.EVENT_TYPES[$mobileUtils.EVENT_MOVE]   = 'pointermove MSPointerMove';
          $mobileUtils.EVENT_TYPES[$mobileUtils.EVENT_END]  = 'pointerup pointercancel lostpointercapture MSPointerUp MSPointerCancel MSLostPointerCapture';
        } else {
          // for non pointer events browsers
          $mobileUtils.EVENT_TYPES[$mobileUtils.EVENT_START]  = 'touchstart mousedown';
          $mobileUtils.EVENT_TYPES[$mobileUtils.EVENT_MOVE]   = 'touchmove mousemove';
          $mobileUtils.EVENT_TYPES[$mobileUtils.EVENT_END]  = 'touchend touchcancel mouseup';

          // Add touch events on the document (effectively emulating capture)
          onTouch($document, $mobileUtils.EVENT_MOVE);
          onTouch($document, $mobileUtils.EVENT_END);

          // Fix IE8
          if (!Date.now) {
            Date.now = function() {
              return new Date().valueOf();
            };
          }
        }

        return {
          /**
           * Shortcut to $mobileUtils
           */
          utils: $mobileUtils,

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
            defaults = angular.extend(options.defaults || {}, defaults);  // We don't want to override any user defined defaults

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
              instance = element.data('__$mobile.config__') || {
                id: undefined,
                handlers: {},   // Event callbacks
                registered: {}, // Gesture state data store
                gestures: [],   // Gestures applied to this element

                /**
                 * Provide a handler for an event
                 * I would have liked to use angulars.bind and triggered real events
                 * to simlify creating complex widgets via delegation or for stats etc
                 * however I couldn't do this and support IE8 at the same time so I
                 * used a similar interface to JQLite for when IE8 support is dropped
                 */
                bind: function(event, handler) {
                  instance.handlers[event] = instance.handlers[event] || [];
                  instance.handlers[event].push(handler);
                  return instance;
                },

                /**
                 * Remove a handler for an event
                 */
                unbind: function(event, handler) {
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
                 * @param   {Object}   ev
                 * @returns {Object}   ev
                 */
                extendEventData: function(ev) {
                  var i, len,
                    startEv = instance.current.startEvent,
                    delta_time = ev.timeStamp - startEv.timeStamp,
                    delta_x = ev.center.pageX - startEv.center.pageX,
                    delta_y = ev.center.pageY - startEv.center.pageY,
                    velocity = $mobileUtils.getVelocity(delta_time, delta_x, delta_y);

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
                    deltaTime   : delta_time,

                    deltaX    : delta_x,
                    deltaY    : delta_y,

                    velocityX   : velocity.x,
                    velocityY   : velocity.y,

                    distance  : $mobileUtils.getDistance(startEv.center, ev.center),
                    angle     : $mobileUtils.getAngle(startEv.center, ev.center),
                    direction   : $mobileUtils.getDirection(startEv.center, ev.center),

                    scale     : $mobileUtils.getScale(startEv.touches, ev.touches),
                    rotation  : $mobileUtils.getRotation(startEv.touches, ev.touches),

                    startEvent  : startEv
                  });

                  return ev;
                },


                /**
                 * gesture detection
                 * @param   {Object}  eventData
                 * @param   {Object}  eventData
                 */
                detect: function(eventData) {
                  if (!instance.current) {
                    instance.stopped = false;

                    instance.current = {
                      inst    : instance,   // reference to instance we're working for
                      startEvent  : angular.extend({}, eventData), // start eventData for distances, timing etc
                      lastEvent   : false,  // last eventData
                      name    : ''          // current gesture we're in/detected, can be 'tap', 'hold' etc
                    };
                  } else if (instance.stopped) {
                    instance.stopDetect();  // just in case
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
                 * @param   {String}    gesture
                 * @param   {Object}    eventData
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
                current: undefined,  // Are we currently gesturing

                pointersCount: 0,    // Number of active pointers
                pointersMax: 1,      // The max pointers this element could use to perform a gesture

                options: undefined,   // The gesture configuration associated with this element
                browserBehaviors: {}
              };

            if (!instance.id) {
              instance.options = angular.extend(
                angular.copy(defaults),  // Clone the defaults
                options || {}            // Merge in any overriding changes
              );

              instanceId = instanceId + 1;
              instance.id = instanceId.toString();

              element.data('__$mobile.config__', instance);

              // add some css to the element to prevent the browser from doing its native behavior
              if (instance.options.setBrowserBehaviors) {
                for (i in defaultBrowserBehavior) {
                  if (defaultBrowserBehavior.hasOwnProperty(i)) {
                    instance.browserBehaviors[i] = instance.options[i] || defaultBrowserBehavior[i];
                  }
                }
                $mobileUtils.stopDefaultBrowserBehavior(element[0], instance.browserBehaviors);
              }

              // The events are no longer required for the current element
              element.scope().$on('$destroy', function() {
                instance.stopDetect();
              });

              // start detection on touchstart
              if ($mobileUtils.HAS_POINTEREVENTS) {
                onTouch(element, $mobileUtils.EVENT_START);
                onTouch(element, $mobileUtils.EVENT_MOVE);
                onTouch(element, $mobileUtils.EVENT_END);
              } else {
                onTouch(element, $mobileUtils.EVENT_START);
              }
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
