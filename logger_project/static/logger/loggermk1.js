/*
    Basic Logging Library
    
    Author: David Maxwell
    Date: 2020-06-30
*/


const logger = {
    properties: {
        socket: null,
        startTimestamp: null,
        
        sendQueue: {
            queue: [],
            maxQueueSize: 10,
        }
    },

    methods: {
        logEvent: function(event) {
            // We need some special logic for hover events so we don't log erroneous events.
            if (event['type'] == 'mouseover' || event['type'] == 'mouseout') {
                if (!logger.methods.isParent(this, event.relatedTarget) && event.target == this) {
                    logger.methods.sendToLogger(event);
                }

                return;
            }

            logger.methods.sendToLogger(event);
        },

        isParent: function(refNode, otherNode) {
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
        },

        sendToLogger: function(event) {
            event['eventTimestamp'] = new Date().getTime();
            const logObject = logger.methods.getLogObject(event);

            logger.properties.sendQueue.queue.push(logObject);
            console.log(logObject);
            
            if (logger.properties.sendQueue.queue.length == logger.properties.sendQueue.maxQueueSize) {
                logger.methods.sendQueue();
            }
        },

        sendQueue: function() {
            const sendQueue = logger.properties.sendQueue.queue;
            logger.properties.sendQueue.queue = [];

            const stringRepresentation = JSON.stringify(sendQueue);
            logger.properties.socket.send(stringRepresentation);
        },

        getLogObject: function(event) {
            if (logger.eventLogObjectMethods[event['type']] == undefined) {
                return logger.eventLogObjectMethods.base(event);
            }

            return logger.eventLogObjectMethods[event['type']](event);
        },

        cleanup: function(event) {
            logger.methods.sendQueue();
            logger.properties.socket.cleanup();
        },
    },

    eventLogObjectMethods: {
        base: function(event) {
            const baseData = {
                type: event['type'],
                elementName: event.target.getAttribute('data-loggable-name'),
                time: {
                    delta: event['eventTimestamp'] - logger.properties.startTimestamp,
                    absolute: event['eventTimestamp'],
                },
            }

            return baseData;
        },

        keydown: function(event) {
            const base = logger.eventLogObjectMethods.base(event);
            const keypressObject = {
                'key': event['key'],
                'keyCode': event['keyCode'],
                'repeat': event['repeat'],
                'values': {
                    'beforeKeypress': event['target'].value,
                    'afterKeypress': event['target'].value,
                    'altKey': event['altKey'],
                    'shiftKey': event['shiftKey'],
                },
            };

            return {...base, ...keypressObject};
        },

    },

    init: {
        start: function() {
            let loggableElements = document.querySelectorAll('*[data-loggable]');
            logger.properties.startTimestamp = new Date().getTime();
            
            logger.properties.socket = new WebSocket("ws://127.0.0.1:8000/ws/log/"); // Temporary.
            
            for (const element of loggableElements) {
                let elementLogEvents = element.getAttribute('data-loggable').split(',');
                
                for (const event of elementLogEvents) {
                    element.addEventListener(event, logger.methods.logEvent);
                }
            }

            logger.properties.sendQueue.queue.push({'START': 'event'});

            // Bind other events (e.g. page unload, resize, unfocus, etc.)
            window.addEventListener('beforeunload', function(event) {
                logger.properties.sendQueue.queue.push({'EVENT': 'CLOSE!!'});
                logger.methods.cleanup();
            });

            window.addEventListener('visibilitychange', function(event) {
                console.log('change to' + document.visibilityState);

                if (document.visibilityState == 'hidden') {
                    logger.properties.sendQueue.queue.push({'CHANGE OF STATE': 'TAB HIDDEN!!'});
                }
                else {
                    logger.properties.sendQueue.queue.push({'CHANGE OF STATE': 'TAB VISIBLE!!'});
                }
            });

            window.addEventListener('blur', function(event) {
                console.log('Lose focus of the window');
            });

            window.addEventListener('focus', function(event) {
                console.log('Gain focus of the window');
            })

            window.addEventListener('resize', function(event) {
                console.log('Changed to ' + window.innerWidth + 'x' + window.innerHeight);
            });

            logger.properties.sendQueue.queue.push({'originWidth': window.innerWidth, 'originHeight': window.innerHeight});
            
            document.body.style.pointerEvents = 'all';
            // Window resize? Dimensions at start? Where is cursor at the beginning?
        }
    }

}

document.addEventListener("DOMContentLoaded", () => {
    const socket = new WebSocket('ws://127.0.0.1:8000/ws/log/');

    socket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        console.log(data);
    }

    let button = document.querySelector('#testbutton');

    button.addEventListener('click', (e) => {
        socket.send(JSON.stringify({'message': 'hi'}));
    })
});