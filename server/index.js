require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");
const mediasoup = require("mediasoup");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "http://localhost:3000" },
});

// Application state variables
let worker;
let rooms = {}; // { roomName1: { Router, rooms: [ sicketId1, ... ] }, ...}
let peers = {}; // { socketId1: { roomName1, socket, transports = [id1, id2,] }, producers = [id1, id2,] }, consumers = [id1, id2,], peerDetails }, ...}
let transports = []; // [ { socketId1, roomName1, transport, consumer }, ... ]
let producers = []; // [ { socketId1, roomName1, producer, }, ... ]
let consumers = []; // [ { socketId1, roomName1, consumer, }, ... ]
const roomHosts = {};
const activeCalls = {};
const roomUsers = {};
const permission = {};

// Mediasoup codecs
const mediaCodecs = [
  { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: { "x-google-start-bitrate": 1000 },
  },
];

io.on("connection", (socket) => {
  console.log("Connected");
  // Use middleware to check permission before creating a shape
  worker = createWorker();
  socket.use((packet, next) => {
    const eventName = packet[0]; // Get event name from packet

    // Only check permission for specific events
    const eventsRequiringPermission = [
      "shapeCreated",
      "shapeUpdated",
      "textUpdated",
      "shapeTransformed",
      "shapeDragged",
      "undo",
      "redo",
      "shapesChange",
      "canvasZoomed",
      "canvasDragged",
      "onPointerDown",
      "onPointerMove",
      "onPointerUp",
      "onClick",
      "clearShapes",
      "handleDoubleClick",
      "handleTextChange",
      "handleTextBlur",
    ];

    // If the event requires permission, check it
    if (eventsRequiringPermission.includes(eventName)) {
      const hasPermission = permission[socket.id]; // Check if the user has permission

      if (!hasPermission) {
        console.log(
          `User ${socket.id} tried to execute ${eventName} without permission`
        );
        return next(new Error("Permission denied"));
      }
    }

    next();
  });
  // User joins a room
  socket.on("joinRoom", (user) => {
    handleJoinRoom(socket, user);
  });

  // Handling host's join request approval
  socket.on("handleJoinRequest", ({ roomId, socketId, accept, user }) => {
    handleJoinRequest(socket, roomId, socketId, accept, user);
  });

  // Disconnecting a user by the host
  socket.on("disconnectUser", (roomId, socketId) => {
    handleDisconnectUser(socket, roomId, socketId);
  });

  // Disconnect event
  socket.on("disconnect", () => {
    handleDisconnect(socket);
  });

  // Get RTP capabilities
  socket.on("getRtpCapabilities", async ({ roomName }, callback) => {
    await handleGetRtpCapabilities(socket, roomName, callback);
  });

  // Create WebRTC transport
  socket.on("createWebRtcTransport", async ({ sender }, callback) => {
    await handleCreateWebRtcTransport(socket, sender, callback);
  });

  // Consumers
  socket.on("getProducers", (callback) => {
    handleGetProducers(socket, callback);
  });

  // Producer connection and production
  socket.on("transport-connect", ({ dtlsParameters }) => {
    handleTransportConnect(socket, dtlsParameters);
  });

  socket.on(
    "transport-produce",
    async ({ kind, rtpParameters, appData }, callback) => {
      await handleTransportProduce(
        socket,
        kind,
        rtpParameters,
        appData,
        callback
      );
    }
  );

  socket.on(
    "transport-recv-connect",
    async ({ dtlsParameters, serverConsumerTransportId }) => {
      await handleTransportRecvConnect(
        socket,
        dtlsParameters,
        serverConsumerTransportId
      );
    }
  );

  socket.on(
    "consume",
    async (
      { rtpCapabilities, remoteProducerId, serverConsumerTransportId },
      callback
    ) => {
      await handleConsume(
        socket,
        rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
        callback
      );
    }
  );

  socket.on("consumer-resume", async ({ serverConsumerId }) => {
    await handleConsumerResume(socket, serverConsumerId);
  });

  socket.on("grantPermission", handleGrantPermission);

  socket.on("revokePermission", handleRevokePermission);

  socket.on("shapeCreated", ({ shape }, roomId) => {
    handleShapeCreated(socket, shape, roomId);
  });

  socket.on("shapeUpdated", ({ shapes }, roomId) => {
    handleShapeUpdated(socket, shapes, roomId);
  });

  socket.on("selectionBoxUpdate", ({ selectionBox }, roomId) => {
    handleSelectionBoxUpdate(socket, selectionBox, roomId);
  });

  socket.on("selectionComplete", ({ selectedShapes }, roomId) => {
    handleSelectionComplete(socket, selectedShapes, roomId);
  });

  socket.on("textUpdated", ({ shapeId, text }, roomId) => {
    handleTextUpdated(socket, shapeId, text, roomId);
  });

  socket.on("shapeTransformed", ({ updatedShape }, roomId) => {
    handleShapeTransformed(socket, updatedShape, roomId);
  });

  socket.on("shapeDragged", ({ updatedShape }, roomId) => {
    handleShapeDragged(socket, updatedShape, roomId);
  });

  socket.on("undo", (data, roomId) => {
    handleundo(socket, data, roomId);
  });

  socket.on("redo", (data, roomId) => {
    handleredo(socket, data, roomId);
  });

  socket.on("shapesChange", (data, roomId) => {
    handleshapesChange(socket, data, roomId);
  });

  socket.on("canvasZoomed", ({ scale, position }, roomId) => {
    handleCanvasZoomed(socket, scale, position, roomId);
  });

  socket.on("canvasDragged", ({ position }, roomId) => {
    handleCanvasDragged(socket, position, roomId);
  });

  socket.on("onPointerDown", (message, roomId) => {
    handlePointerDown(socket, message, roomId);
  });

  socket.on("onPointerMove", (message, roomId) => {
    handlePointerMove(socket, message, roomId);
  });

  socket.on("onPointerUp", (message, roomId) => {
    handlePointerUp(socket, message, roomId);
  });

  socket.on("onClick", (message, roomId) => {
    handleClick(socket, message, roomId);
  });
  socket.on("clearShapes", (roomId) => {
    handleClearShapes(socket, roomId);
  });

  socket.on("handleDoubleClick", (message, roomId) => {
    handleDoubleClick(socket, message, roomId);
  });

  socket.on("handleTextChange", (message, roomId) => {
    handleTextChange(socket, message, roomId);
  });

  socket.on("handleTextBlur", (message, roomId) => {
    handleTextBlur(socket, message, roomId);
  });

  socket.on("handleSendMessage", (message, roomId) => {
    handleSendMessage(socket, message, roomId);
  });

  socket.on("pointerPosition", (message, roomId) => {
    handlePointerPositionUpdate(socket, message, roomId);
  });
});

//Utility functions
const createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  });
  console.log(`worker pid ${worker.pid}`);

  worker.on("died", (error) => {
    console.error("mediasoup worker has died");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
};

const removeItems = (items, socketId, type) => {
  items.forEach((item) => {
    if (item.socketId === socketId) {
      item[type].close();
    }
  });
  items = items.filter((item) => item.socketId !== socketId);

  return items;
};

const createRoom = async (roomName, socketId) => {
  let router1;
  let peers = [];
  if (rooms[roomName]) {
    router1 = rooms[roomName].router;
    peers = rooms[roomName].peers || [];
  } else {
    router1 = await worker.createRouter({ mediaCodecs });
  }

  console.log(`Router ID: ${router1.id}`, peers.length);

  rooms[roomName] = {
    router: router1,
    peers: [...peers, socketId],
  };

  return router1;
};

const addTransport = (socket, transport, roomName, sender) => {
  transports = [
    ...transports,
    { socketId: socket.id, transport, roomName, sender },
  ];

  peers[socket.id] = {
    ...peers[socket.id],
    transports: [...peers[socket.id].transports, transport.id],
  };
};

const addProducer = (socket, producer, roomName) => {
  producers = [...producers, { socketId: socket.id, producer, roomName }];

  peers[socket.id] = {
    ...peers[socket.id],
    producers: [...peers[socket.id].producers, producer.id],
  };
};

const addConsumer = (socket, consumer, roomName) => {
  // add the consumer to the consumers list
  consumers = [...consumers, { socketId: socket.id, consumer, roomName }];

  // add the consumer id to the peers list
  peers[socket.id] = {
    ...peers[socket.id],
    consumers: [...peers[socket.id].consumers, consumer.id],
  };
};

const informConsumers = (socket, roomName, socketId, id) => {
  console.log(`just joined, id ${id} ${roomName}, ${socketId}`);
  socket.to(roomName).emit("new-producer", { producerId: id });
};

const getTransport = (socketId) => {
  const [producerTransport] = transports.filter(
    (transport) => transport.socketId === socketId && transport.sender
  );
  return producerTransport.transport;
};

const createWebRtcTransport = async (router) => {
  return new Promise(async (resolve, reject) => {
    try {
      // https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
      // const webRtcTransport_options = {
      //   listenIps: [
      //     {
      //       ip: "0.0.0.0", // replace with relevant IP address
      //       announcedIp: "127.0.0.1",
      //     },
      //   ],
      //   enableUdp: true,
      //   enableTcp: true,
      //   preferUdp: true,
      // };

      const webRtcTransport_options = {
        listenIps: [
          {
            ip: "0.0.0.0", // This is for all available network interfaces
            announcedIp: "127.0.0.1", // Replace this with your public IP if your application is public-facing
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        rtcMinPort: 10000,
        rtcMaxPort: 59999,
        // Add this port range to prevent exhaustion of UDP ports
        // portRange: {
        //   min: 40000, // Start of the port range
        //   max: 49999  // End of the port range (adjust as needed)
        // }
      };

      // https://mediasoup.org/documentation/v3/mediasoup/api/#router-createWebRtcTransport
      let transport = await router
        .createWebRtcTransport(webRtcTransport_options)
        .catch((e) => console.log(e));
      console.log(`Transport created on ports: ${transport?.tuple?.localPort}`);
      console.log(`transport id: ${transport?.id}`);

      transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") {
          transport.close();
          transports = transports.filter(
            (transportData) => transportData.transport.id !== transport.id
          );
          console.log("transport closed...............");
        }
      });

      transport.on("close", () => {
        console.log("transport closed");
      });

      resolve(transport);
    } catch (error) {
      reject(error);
    }
  });
};

function handleJoinRoom(socket, user) {
  let roomName = user.roomId;
  peers[socket.id] = {
    socket,
    roomName, // Name for the Router this Peer joined
    transports: [],
    producers: [],
    consumers: [],
    peerDetails: {
      name: "",
      isAdmin: false,
    },
  };
  if (user.roomId) socket.roomId = user.roomId;
  if (user.user && !roomHosts[user.roomId]) {
    roomHosts[user.roomId] = socket.id;
    user.user["socketId"] = socket.id;
    roomUsers[user.roomId] = [user.user];
    permission[socket.id] = true;
    socket.join(user.roomId);
    console.log(`${socket.id} joined room as host: ${user.roomId}`);
    socket.emit("host", roomUsers[user.roomId]);
  } else {
    io.to(roomHosts[user.roomId]).emit("joinRequest", {
      roomId: user.roomId,
      socketId: socket.id,
      user: user.user,
    });
  }
}

function handleJoinRequest(socket, roomId, socketId, accept, user) {
  if (accept) {
    user["socketId"] = socketId;
    roomUsers[roomId].push(user);
    io.sockets.sockets.get(socketId).join(roomId);
    permission[socketId] = false;
    io.to(socketId).emit("joinAccepted", roomUsers[roomId]);
    io.to(roomId).emit("newUser", {
      roomUsers: roomUsers[roomId],
      newUser: user,
    });
    console.log(`User ${socketId} joined room: ${roomId}`);
  } else {
    io.to(socketId).emit("joinDenied", roomId);
    console.log(`User ${socketId} was denied access to room: ${roomId}`);
  }
}

function handleDisconnectUser(socket, roomId, socketId) {
  if (roomHosts[roomId] === socket.id) {
    delete permission[socketId];

    roomUsers[roomId] = roomUsers[roomId].filter(
      (user) => user.socketId !== socketId
    );

    if (!peers[socketId]) return;
    const { roomName } = peers[socketId];
    delete peers[socketId];

    rooms[roomName] = {
      router: rooms[roomName]?.router,
      peers: rooms[roomName]?.peers?.filter(
        (socketid) => socketid !== socketId
      ),
    };

    if (socketId === roomHosts[roomId]) {
      delete roomHosts[roomId];
    }

    io.to(socketId).emit("disconnectedByHost");
    io.sockets.sockets.get(socketId).leave(roomId);

    io.to(roomId).emit("userDisconnected", {
      socketId,
      roomUsers: roomUsers[roomId],
    });

    console.log(`User ${socketId} was disconnected from room: ${roomId}`);
  }
}
function handleDisconnect(socket) {
  // cleanup
  for (const roomId in roomHosts) {
    if (roomHosts[roomId] === socket.id) {
      delete roomHosts[roomId];
      delete activeCalls[roomId];
      io.in(roomId).emit("roomDestroyed");
      io.socketsLeave(roomId);
      console.log(`Host disconnected, room destroyed: ${roomId}`);
      break;
    }
  }
  console.log("peer disconnected");
  consumers = removeItems(consumers, socket.id, "consumer");
  producers = removeItems(producers, socket.id, "producer");
  transports = removeItems(transports, socket.id, "transport");

  if (!peers[socket.id]) return;
  const { roomName } = peers[socket.id];
  delete peers[socket.id];

  // remove socket from room
  rooms[roomName] = {
    router: rooms[roomName]?.router,
    peers: rooms[roomName]?.peers?.filter((socketId) => socketId !== socket.id),
  };
  console.log(`Disconnected user ${socket.id}`);
}

async function handleGetRtpCapabilities(socket, roomName, callback) {
  // create Router if it does not exist
  // const router1 = rooms[roomName] && rooms[roomName].get('data').router || await createRoom(roomName, socket.id)
  const router1 = await createRoom(roomName, socket.id);

  // get Router RTP Capabilities
  const rtpCapabilities = router1.rtpCapabilities;

  // call callback from the client and send back the rtpCapabilities
  callback({ rtpCapabilities });
}

// Handler for creating WebRTC transport
async function handleCreateWebRtcTransport(socket, sender, callback) {
  // get Room Name from Peer's properties
  if (!peers[socket.id]) throw new Error("This promise was rejected");
  const roomName = peers[socket.id].roomName;

  // get Router (Room) object this peer is in based on RoomName
  const router = rooms[roomName].router;

  createWebRtcTransport(router).then(
    (transport) => {
      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });

      // add transport to Peer's properties
      addTransport(socket, transport, roomName, sender);
    },
    (error) => {
      console.log(error);
    }
  );
}
function handleGetProducers(socket, callback) {
  //return all producer transports
  let producerList = [];
  if (!peers[socket.id]) {
    callback(producerList);
    return;
  }
  const { roomName } = peers[socket.id];

  producers.forEach((producerData) => {
    if (
      producerData.socketId !== socket.id &&
      producerData.roomName === roomName
    ) {
      producerList = [...producerList, producerData.producer.id];
    }
  });

  // return the producer list back to the client
  callback(producerList);
}
function handleTransportConnect(socket, dtlsParameters) {
  console.log("DTLS PARAMS... ", { dtlsParameters });

  getTransport(socket.id).connect({ dtlsParameters });
}

// Handler for transport production
async function handleTransportProduce(
  socket,
  kind,
  rtpParameters,
  appData,
  callback
) {
  // call produce based on the prameters from the client
  const producer = await getTransport(socket.id).produce({
    kind,
    rtpParameters,
  });

  // add producer to the producers array
  const { roomName } = peers[socket.id];

  addProducer(socket, producer, roomName);

  informConsumers(socket, roomName, socket.id, producer.id);

  console.log("Producer ID: ", producer.id, producer.kind);

  producer.on("transportclose", () => {
    console.log("transport for this producer closed ");
    producer.close();
    producers = producers.filter(
      (producerData) => producerData.producer.id !== producer.id
    );
    transports = transports.filter(
      (transportData) =>
        transportData.transport.id !== getTransport(socket.id).id
    );
  });

  // Send back to the client the Producer's id
  callback({
    id: producer.id,
    producersExist: producers.length > 1 ? true : false,
  });
}

// Handler for receiving transport connection
async function handleTransportRecvConnect(
  socket,
  dtlsParameters,
  serverConsumerTransportId
) {
  console.log(`DTLS PARAMS: ${dtlsParameters}`);
  const consumerTransport = transports.find(
    (transportData) =>
      !transportData.sender &&
      transportData.transport.id == serverConsumerTransportId
  ).transport;
  await consumerTransport.connect({ dtlsParameters });
}

// Handler for consuming media
async function handleConsume(
  socket,
  rtpCapabilities,
  remoteProducerId,
  serverConsumerTransportId,
  callback
) {
  try {
    const { roomName } = peers[socket.id];
    const router = rooms[roomName].router;
    let consumerTransport = transports.find(
      (transportData) =>
        !transportData.sender &&
        transportData.transport.id == serverConsumerTransportId
    ).transport;

    // check if the router can consume the specified producer
    if (
      router.canConsume({
        producerId: remoteProducerId,
        rtpCapabilities,
      })
    ) {
      // transport can now consume and return a consumer
      const consumer = await consumerTransport.consume({
        producerId: remoteProducerId,
        rtpCapabilities,
        paused: true,
      });

      consumer.on("transportclose", () => {
        console.log("transport close from consumer");
      });

      consumer.on("producerclose", () => {
        console.log("producer of consumer closed");
        socket.emit("producer-closed", { remoteProducerId });

        consumerTransport.close([]);
        transports = transports.filter(
          (transportData) => transportData.transport.id !== consumerTransport.id
        );
        consumer.close();
        consumers = consumers.filter(
          (consumerData) => consumerData.consumer.id !== consumer.id
        );
      });

      addConsumer(socket, consumer, roomName);

      // from the consumer extract the following params
      // to send back to the Client
      // userSocket = producers
      // .filter((producer) => producer.producer.id === remoteProducerId)
      // .map((producer) => producer.socketId);

      const params = {
        id: consumer.id,
        producerId: remoteProducerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        serverConsumerId: consumer.id,
        // userSocket: userSocket,
      };

      // send the parameters to the client
      callback({ params });
    }
  } catch (error) {
    console.log(error.message);
    callback({
      params: {
        error: error,
      },
    });
  }
}

// Handler for resuming consumer
async function handleConsumerResume(socket, serverConsumerId) {
  console.log("consumer resume");
  const { consumer } = consumers.find(
    (consumerData) => consumerData.consumer.id === serverConsumerId
  );
  await consumer.resume();
}

// Handler for granting permission
function handleGrantPermission(message) {
  permission[message.socketId] = true;
}

// Handler for revoking permission
function handleRevokePermission(message) {
  permission[message.socketId] = false;
}

// Handler for broadcasting new shape creation
function handleShapeCreated(socket, shape, roomId) {
  socket.to(roomId).emit("shapeCreated", { shape });
}

// Handler for broadcasting shape updates (move, resize)
function handleShapeUpdated(socket, shapes, roomId) {
  socket.to(roomId).emit("shapeUpdated", { shapes });
}

// Handler for broadcasting selection box updates
function handleSelectionBoxUpdate(socket, selectionBox, roomId) {
  socket.to(roomId).emit("selectionBoxUpdate", { selectionBox });
}

// Handler for broadcasting group selection completion
function handleSelectionComplete(socket, selectedShapes, roomId) {
  socket.to(roomId).emit("selectionComplete", { selectedShapes });
}

// Handler for broadcasting text updates
function handleTextUpdated(socket, shapeId, text, roomId) {
  socket.to(roomId).emit("textUpdated", { shapeId, text });
}

// Handler for broadcasting shape transformations
function handleShapeTransformed(socket, updatedShape, roomId) {
  socket.to(roomId).emit("shapeTransformed", { updatedShape });
}

// Handler for broadcasting shape drag events
function handleShapeDragged(socket, updatedShape, roomId) {
  socket.to(roomId).emit("shapeDragged", { updatedShape });
}

// Handler for broadcasting shape change events
function handleshapesChange(socket, data, roomId) {
  socket.to(roomId).emit("shapesChange", data);
}

// Handler for canvas undo
function handleundo(socket, data, roomId) {
  socket.to(roomId).emit("undo", data);
}

// Handler for canvas redo
function handleredo(socket, data, roomId) {
  socket.to(roomId).emit("redo", data);
}

// Handler for canvas zoom
function handleCanvasZoomed(socket, scale, position, roomId) {
  socket.to(roomId).emit("updateCanvasZoom", { scale, position });
}

// Handler for canvas drag
function handleCanvasDragged(socket, position, roomId) {
  socket.to(roomId).emit("updateCanvasDrag", { position });
}

// Handler for pointer events
function handlePointerDown(socket, message, roomId) {
  socket.to(roomId).emit("onPointerDown", message);
}

function handlePointerMove(socket, message, roomId) {
  socket.to(roomId).emit("onPointerMove", message);
}

function handlePointerUp(socket, message, roomId) {
  socket.to(roomId).emit("onPointerUp", message);
}

function handleClick(socket, message, roomId) {
  socket.to(roomId).emit("onClick", message);
}

// Handler for clearing shapes
function handleClearShapes(socket, roomId) {
  socket.to(roomId).emit("clearShapes");
}

// Handler for double click
function handleDoubleClick(socket, message, roomId) {
  socket.to(roomId).emit("handleDoubleClick", message);
}

// Handler for text changes and blurs
function handleTextChange(socket, message, roomId) {
  socket.to(roomId).emit("handleTextChange", message);
}

function handleTextBlur(socket, message, roomId) {
  socket.to(roomId).emit("handleTextBlur", message);
}

// Handler for sending messages in chat
function handleSendMessage(socket, message, roomId) {
  socket.to(roomId).emit("handleSendMessage", message);
}

function handlePointerPositionUpdate(socket, message, roomId) {
  console.log("I have executed", message);
  socket.to(roomId).emit("pointerPositionUpdate", { message });
}

function error(err, req, res, next) {
  if (!test) console.error(err.stack);

  res.status(500);
  res.send("Internal Server Error");
}
app.use(error);
server.listen(5000, () => {
  console.log("listening on Port 5000");
});
