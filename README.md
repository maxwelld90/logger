# logger
Exploratory implementation for an event logger.

Basic how to get things working:

1. Create your Python environment. All required packages are in `requirements.txt`. Python 3.7/3.8 should be fine.
2. Launch the server by going to `logger_project` and running `python manage.py runserver`.
3. Navigate to `http://127.0.0.1:8000/client/`.
4. Open up the developer tools to see what is going on!
5. You should see a bunch of logger events.
6. Scroll over the boxes (just to check) a couple of times, and watch the browser events appearing.
7. Check the server console. Every 10 events, the client library sends a chunk of data to the server.
8. Resize the browser. Switch to different tabs. Close the browser window. These events should be logged.

I need to continue working on grouping together elements (buttons/input fields, for search boxes, for example) and perhaps remove duplicated events (i.e. as you resize, an event is fired for each pixel change!). So far, so good.