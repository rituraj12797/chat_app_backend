# chat_app_backend
this is based on socket.io and node clusters for scaling the system to utilize all the cores

## following are some functionalities and their system architecture diagram 
  ![alt text](chat_app/src/assets/images/architeture_emit_broadcast.png)

  the cluster adapter is used to connecte mode js worker process in a clusters to transmit Every packet that is sent to multiple clients (e.g. io.to("room1").emit() or socket.broadcast.emit()) is also sent to other workers via the IPC channel.

  The worker processes spawned can communicate with the parent via IPC (Inter Process Communication) channel which allows messages to be passed back and forth between the parent and child. 