import json
from datetime import datetime
from channels.generic.websocket import WebsocketConsumer

class LogConsumer(WebsocketConsumer):
    
    def connect(self):
        self.__connect_time = datetime.now()
        self.accept()
    
    def disconnect(self, close_code):
        self.send(text_data=json.dumps({'disconnect': True}))
    
    def receive(self, text_data):
        recieved_chunk = json.loads(text_data)
        
        for event in recieved_chunk:
            print(event)