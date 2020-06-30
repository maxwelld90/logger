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