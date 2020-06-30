import json
from channels.generic.websocket import WebsocketConsumer

class LogConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
    
    def disconnect(self, close_code):
        self.send(text_data=json.dumps({'disconnect': True}))
    
    def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        self.send(text_data=json.dumps({'message': 'what do you want?'}))
        print(message)