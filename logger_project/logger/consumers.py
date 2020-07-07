import json
import base64
from datetime import datetime
from channels.generic.websocket import WebsocketConsumer

CLIENT_VERSION = '0.2'

class LogConsumer(WebsocketConsumer):
    
    def connect(self):
        self.__applicationID = None
        self.__flightID = None
        self.__authenticated = False


        self.__connect_time = datetime.now()
        self.accept()
    
    def disconnect(self, close_code):
        self.send(text_data=json.dumps({'disconnect': True}))
    
    def __processHandshake(self, handshake):
        """
        Processes the handshake
        """
    
    def __version_check(self, json_obj):
        """
        Called when a bad client version is communicating with the server.
        Closes the connection once the failure message has been sent.
        """
        if 'loggerVersion' in json_obj.keys():
            if json_obj['loggerVersion'] != CLIENT_VERSION:
                self.send(text_data=json.dumps({
                    'state': 'error',
                    'errorCode': 1,
                    'errorMessage': f'Expected version {CLIENT_VERSION}'
                }))

                self.close()
                return False
        
        return True
    
    def __authenticate(self, json_obj):
        """
        Authenticate!
        Here, you would check that the application and flight ID are correct and valid.
        And probably decrypt the auth string, too.
        """
        auth_obj = json.loads(base64.b64decode(json_obj['authString']))
        self.__applicationID = auth_obj['appID']
        self.__flightID = auth_obj['flightID']
        self.__authenticated = True

        self.send(text_data=json.dumps({
            'state': 'handshakeApproved',
        }))

        # self.send(text_data=json.dumps({
        #     'state': 'handshakeRejected',
        #     'errorMessage': 'Failed for some reason',
        # }))
    
    def receive(self, text_data):
        json_obj = json.loads(text_data)
        
        if self.__version_check(json_obj):
            if json_obj['messageType'] == 'authenticate':
                if self.__authenticated:
                    self.send(text_data=json.dumps({
                        'state': 'error',
                        'errorCode': 2,
                        'errorMessage': f'Already authenticated; ignoring request'
                    }))

                    return
                
                self.__authenticate(json_obj)
            
            elif json_obj['messageType'] == 'data' and self.__authenticated:
                data = json_obj['payload']['data']

                for entry in data:
                    print(entry)

        # data = json_obj['payload']['data']

        # for entry in data:
        #     print(entry)
        
        # self.send(text_data='hello world')
        # #self.close()