/*
    Logger Prototype
    Mark II (Using proper JS modules and plugin patterns)

    Author: David Maxwell
    Date: 2020-07-07
    Version: 0.2
*/

/* The main Logger singleton object, created on page load. The "core". */
(function(root) {
    'use strict';

    function Logger(root) {
        var _public = {};

        var bindElementEventListeners = function() {
            /* Bind listeners to all elements we want to track, for the respective event(s) we want to capture */
            for (let loggableElement of root.document.querySelectorAll('*[data-logger-capture]')) {
                let elementLogEvents = loggableElement.dataset.loggerCapture.split(',');

                for (let eventType of elementLogEvents) {
                    loggableElement.addEventListener(eventType, root.Logger.EventLoggingHandlers.eventCallback);
                }
            }
        };

        var bindDocumentEventListeners = function() {
            /* Bind listeners for the document-level events (i.e. page unload, resizing, etc.) */
            let documentEvents = root.document.body.dataset.loggerDocumentevents;
            
            if (documentEvents) {
                let documentLogEvents = documentEvents.split(',');

                for (let eventType of documentLogEvents) {
                    let applyTo = root.document; // Default

                    if (root.Logger.EventLoggingHandlers.documentLevelEventMappings[eventType]) {
                        applyTo = root.Logger.EventLoggingHandlers.documentLevelEventMappings[eventType];
                    }

                    applyTo.addEventListener(eventType, root.Logger.EventLoggingHandlers.eventCallback);
                }
            }

            /* Add special events, such as when the page is unloaded */
            root.addEventListener('beforeunload', root.Logger.cleanup);
        };
        
        _public.version = '0.2';

        _public.Helpers = (function() {
            var _helpers = {}

            _helpers.extend = function(objA, objB) {
                for (var key in objB) {
                    if (objB.hasOwnProperty(key)) {
                        objA[key] = objB[key];
                    }
                }

                return objA;
            };

            _helpers.isParent = function(refNode, otherNode) {
                if (otherNode == null) {
                    return false;
                }

                var parent = otherNode.parentNode;

                do {
                    if (refNode == parent) {
                        return true;
                    }
                    else {
                        parent = parent.parentNode;
                    }
                } while (parent);

                return false;
            };

            return _helpers;
        })();

        _public.console = function(messageStr) {
            if (root.Logger.Config.getProperty('verbose')) {
                var timeDelta = new Date().getTime() - root.Logger.Config.getInitTimestamp();
                console.log(`LOGGER > ${timeDelta}: ${messageStr}`);
            }
        };

        _public.init = function(options) {
            if (!root.Logger.Config.init(options)) {
                return false;
            }

            bindElementEventListeners();
            bindDocumentEventListeners();

            root.Logger.console('Listening for loggable events');
            return true;
        };

        _public.cleanup = function(event) {
            root.Logger.console('Logger cleanup (shutdown) requested');

            if (event) {
                root.Logger.EventLoggingHandlers.eventCallback(event);
            }
            root.Logger.Dispatcher.cleanup();
            root.Logger.console('Logger cleanup (shutdown) complete');
        };

        return _public;
    }

    if (typeof(root.Logger) === 'undefined') {
        window.Logger = Logger(root);
    }
})(window);

/* The Config plugin, containing all the settings and configuration details for the instance. */
(function(root) {
    'use strict';

    if (typeof(root.Logger) === 'undefined') {
        return;
    }

    Logger.Config = (function() {
        var _public = {};
        var _initTimestamp = new Date().getTime();
        var _properties = {
            endpoint: null,
            verbose: false,
            sendQueueMaxSize: 10,
            authString: null,
        };

        var isSupported = function() {
            return !!root.document.querySelectorAll && !root.addEventListener;
        };

        _public.previousViewportResolution = {
            innerWidth: window.screen.innerWidth,
            innerHeight: window.screen.innerHeight,
        };

        _public.init = function(options) {
            _properties = root.Logger.Helpers.extend(_properties, options);

            root.Logger.console('Instantiating module');

            if (!isSupported) {
                return;
            }

            root.Logger.Dispatcher.init();
            root.Logger.Dispatcher.connect();

            root.Logger.EventLoggingHandlers.eventCallback({'type': 'loggerstart'});
            return true;
        };

        _public.getProperty = function(name) {
            return _properties[name];
        };

        _public.getInitTimestamp = function() {
            return _initTimestamp;
        };

        return _public;
    })();
})(window);

/* The dispatcher, the submodule responsible for handling the connection with the server, and handling the queue of events to log. */
(function(root) {
    'use strict';

    if (typeof(root.Logger) === 'undefined') {
        return;
    }

    Logger.Dispatcher = (function() {
        var _public = {};
        var _socket = null;
        var _sendQueue = [];
        var _connectionFailure = false;

        var serverStates = {
            error: function(dataResponse) {
                console.log('error with server');
            },

            handshakeApproved: function(dataResponse) {
                root.Logger.console('Authentication handshake approved; session can continue');
                root.Logger.EventLoggingHandlers.eventCallback({'type': 'basicinfo'});
            },

            handshakeRejected: function(dataResponse) {
                let errorMessage = dataResponse['errorMessage'];
                root.Logger.console(`Handshake rejected: ${errorMessage}`);
                root.Logger.cleanup();
                _connectionFailure = true;
            },

            serverStopping: function(dataResponse) {
                console.log('server stopping');
                _connectionFailure = true;
            },
        };

        var socketEvents = {
            onopen: function(event) {
                root.Logger.console('Connection to endpoint established');
                sendHandshake();
            },

            onclose: function(event) {
                root.Logger.console('Connection to endpoint lost; cannot send more data');
                _connectionFailure = true;
            },

            onerror: function(event) {
                root.Logger.console('Connection error');
            },

            onmessage: function(event) {
                root.Logger.console('Message received from server');
                let dataResponse = JSON.parse(event['data']);
                let state = dataResponse['state'];
    
                if (serverStates[state]) {
                    serverStates[state](dataResponse);
                    return;
                }
    
                root.Logger.console('Unknown message received from server; ignoring');
            },
        };

        var flushQueue = function() {
            let oldSendQueue = _sendQueue;
            _sendQueue = [];

            sendSerialisedObject(oldSendQueue);
            root.Logger.console(`Queue flushed; size was ${oldSendQueue.length}, now ${_sendQueue.length}`);
        };

        var sendHandshake = function() {
            root.Logger.console('Authenticating with endpoint');

            let toSend = {
                'loggerVersion': root.Logger.version,
                'messageType': 'authenticate',
                'authString': root.Logger.Config.getProperty('authString'),
            }

            _socket.send(JSON.stringify(toSend));
        };

        var sendSerialisedObject = function(payload) {
            root.Logger.console('Preparing to send payload');

            let toSend = {
                'loggerVersion': root.Logger.version,
                'messageType': 'data',
                'payload': {
                    'length': payload.length,
                    'data': payload,
                },
            };

            _socket.send(JSON.stringify(toSend));
        };

        _public.init = function() {};

        _public.connect = function() {
            const url = root.Logger.Config.getProperty('endpoint');
            root.Logger.console('Establishing connection');

            _socket = new WebSocket(`ws://${url}`);
            _socket.onopen = socketEvents.onopen;
            _socket.onclose = socketEvents.onclose;
            _socket.onerror = socketEvents.onerror;
            _socket.onmessage = socketEvents.onmessage;
        };

        _public.cleanup = function() {
            flushQueue();
            _socket.close();
        };

        _public.send = function(event) {
            if (_connectionFailure) {
                if (_sendQueue.length > 0) {
                    _sendQueue = [];
                }

                return;
            }

            const maxQueueSize = root.Logger.Config.getProperty('sendQueueMaxSize');
            let stringified = JSON.stringify(event);

            if (maxQueueSize < 1) {
                sendSerialisedObject([stringified]);
                return;
            }
            
            root.Logger.console(`Event logged: ${stringified}`);
            _sendQueue.push(stringified);

            if (_sendQueue.length == maxQueueSize) {
                flushQueue();
            }
        };

        return _public;
    })();
})(window);

/* Event logging handlers. What do you want to log for the different events that take place? */
(function(root) {
    'use strict';

    if (typeof(root.Logger) === 'undefined') {
        return;
    }

    Logger.EventLoggingHandlers = (function() {
        var _public = {};

        var logEvent = function(event, toSend) {
            let eventType = event['type'];
            var toSend = root.Logger.EventLoggingHandlers.base(event);

            if (root.Logger.EventLoggingHandlers.hasOwnProperty(eventType)) {
                let specificObject = root.Logger.EventLoggingHandlers[eventType](event);
                toSend = root.Logger.Helpers.extend(toSend, specificObject);
            }
            
            root.Logger.Dispatcher.send(toSend);
        }

        _public.eventCallback = function(event, preventBubbling=true) {
            /* Prevent events bubbling over */
            if (preventBubbling) {
                if (!root.Logger.Helpers.isParent(this, event.relatedTarget) && event.target == this) {
                    logEvent(event);
                }

                return;
            }

            logEvent(event);
        };

        _public.documentLevelEventMappings = {
            resize: root.document,
            blur: root.document,
            focus: root.document,
            visibilitychange: root.document,
            resize: root,
        };

        _public.base = function(event) {
            var returnObject = {};
            let eventTimestamp = new Date().getTime();

            returnObject['type'] = event['type'];
            returnObject['time'] = {
                'delta': eventTimestamp - root.Logger.Config.getInitTimestamp(),
                'absolute': eventTimestamp,
            };

            return returnObject;
        }

        _public.loggerstart = function(event) {
            return {
                startingURL: window.location.href,
            };
        };

        _public.basicinfo = function(event) {
            let returnObject = {
                browserDetails: {
                    vendor: navigator.vendor,
                    build: navigator.productSub,
                    agentString: navigator.agentString,
                    browserLanguage: {
                        current: navigator.language,
                        available: navigator.languages,
                    },
                },
                display: {
                    width: screen.width,
                    height: screen.height,
                    depth: screen.colorDepth,
                    availWidth: screen.availWidth,
                    availHeight: screen.availHeight,
                },
                initialViewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
            };

            let appSpecific = root.Logger.Config.getProperty('appSpecific');

            if (appSpecific) {
                returnObject.appSpecific = appSpecific;
            }
            else {
                returnObject.appSpecific = {};
            }

            return returnObject;
        };

        _public.beforeunload = function(event) {
            return {
                type: 'leavepage',
            };
        };

        _public.mouseover = function(event) {
            return {'mouseover': 'event'};
        };

        _public.resize = function(event) {
            let newWidth = window.innerWidth;
            let newHeight = window.innerHeight;

            let oldWidth = root.Logger.Config.previousViewportResolution.innerWidth;
            let oldHeight = root.Logger.Config.previousViewportResolution.innerHeight;

            root.Logger.Config.previousViewportResolution.innerWidth = newWidth;
            root.Logger.Config.previousViewportResolution.innerHeight = newHeight;
            
            return {
                viewportAdjustment: {
                    newWidth: newWidth,
                    newHeight: newHeight,
                    oldWidth: oldWidth,
                    oldHeight: oldHeight,
                }
            };
        }

        return _public;
    })();
})(window);

/* Additional plugin for EventLoggingHandlers - template code for adding your own handler functions. */
(function(root) {
    'use strict';

    if (typeof(root.Logger) === 'undefined') {
        return;
    }

    root.Logger.EventLoggingHandlers.mouseout = function(event) {
        return {'mouseout': 'event'};
    };

    root.Logger.EventLoggingHandlers.click = function(event) {
        return {'specific': 'click'};
    };

})(window);