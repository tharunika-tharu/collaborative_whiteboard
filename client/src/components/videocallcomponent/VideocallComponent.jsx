import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { useAuth0 } from "@auth0/auth0-react";
import { useSocket } from "../context";
import "./Videocall.css";

function Videocall() {
  const { user } = useAuth0();
  console.log(user);
  const Id = useSocket();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  // const [remoteStreams, setRemoteStreams] = useState([]);
  const socket = useRef(Id.socket);
  const device = useRef(null);
  const rtpCapabilities = useRef(null);
  const producerTransport = useRef(null);
  let consumerTransports = [];
  const audioProducer = useRef(null);
  const videoProducer = useRef(null);
  const isProducer = useRef(false);

  const startButton = useRef(null);
  const hangupButton = useRef(null);
  const muteAudButton = useRef(null);

  const [audiostate, setAudio] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isObserver, setIsObserver] = useState(true);

  const [localStream, setLocalStream] = useState(null);

  useEffect(() => {
    socket.current.on("new-producer", ({ producerId }) => {
      getRtpCapabilities({ audioTrack: null, videoTrack: null, producerId });
    });

    socket.current.on("producer-closed", ({ remoteProducerId }) => {
      handleProducerClosed(remoteProducerId);
    });
    getProducers();
    return () => {
      socket.current.disconnect();
    };
  }, []);
  useEffect(() => {
    if (Id.host) callRequest();
  }, [Id.host]);
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // video: true,
        audio: { echoCancellation: true },
        video: {
          width: 200,
          height: 100,
        },
      });
      setLocalStream(stream);
      // Check if localVideoRef already has a stream to prevent reassigning
      if (localVideoRef.current.srcObject) return;

      // Assign the full stream to the video element
      localVideoRef.current.srcObject = stream;

      // Optionally, assign the stream to a separate audio element if needed
      localAudioRef.current.srcObject = stream;

      // Extract tracks for further usage in RTP capabilities
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      getRtpCapabilities({ audioTrack, videoTrack, producerId: null });
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
  };

  const getRtpCapabilities = ({ audioTrack, videoTrack, producerId }) => {
    console.log("entered ", "getRtpCapabilities");

    socket.current.emit(
      "getRtpCapabilities",
      { roomName: Id.roomId },
      async (data) => {
        rtpCapabilities.current = data.rtpCapabilities;
        await createDevice(audioTrack, videoTrack, producerId);
      }
    );
  };

  const createDevice = async (audioTrack, videoTrack, producerId) => {
    console.log("entered ", "createDevice");
    try {
      device.current = new mediasoupClient.Device();
      await device.current.load({
        routerRtpCapabilities: rtpCapabilities.current,
      });
      if (!producerId) createSendTransport({ audioTrack, videoTrack });
      else signalNewConsumerTransport(producerId);
    } catch (error) {
      console.error("Error creating device", error);
      if (error.name === "UnsupportedError") {
        console.warn("browser not supported");
      }
    }
  };

  const createSendTransport = ({ audioTrack, videoTrack }) => {
    console.log("entered ", "createSendTransport");
    socket.current.emit(
      "createWebRtcTransport",
      { sender: true },
      ({ params }) => {
        if (params.error) {
          console.error("Error creating WebRTC Transport:", params.error);
          return;
        }
        console.log("entered ", "createSendTransport1");
        producerTransport.current = device.current.createSendTransport(params);
        console.log("Finished ", "createSendTransport1");
        producerTransport.current.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              await socket.current.emit("transport-connect", {
                dtlsParameters,
              });
              callback();
              console.log("Finished ", "callback");
            } catch (error) {
              errback(error);
              console.log("Finished ", "errback");
            }
          }
        );

        producerTransport.current.on(
          "produce",
          async ({ kind, rtpParameters }, callback, errback) => {
            try {
              console.log("entered ", "transport-produce");
              await socket.current.emit(
                "transport-produce",
                { kind, rtpParameters },
                ({ id, producersExist }) => {
                  callback({ id });
                  if (producersExist) getProducers();
                }
              );
              console.log("Finished ", "transport-produce");
            } catch (error) {
              errback(error);
            }
          }
        );

        connectSendTransport(audioTrack, videoTrack);
      }
    );
  };

  const connectSendTransport = async (audioTrack, videoTrack) => {
    console.log("entered ", "connectSendTransport");
    audioProducer.current = await producerTransport.current.produce({
      track: audioTrack,
    });
    console.log("complete");
    videoProducer.current = await producerTransport.current.produce({
      track: videoTrack,
    });
  };

  const signalNewConsumerTransport = async (remoteProducerId) => {
    console.log("createWebRtcTransport");
    socket.current.emit(
      "createWebRtcTransport",
      { sender: false },
      ({ params }) => {
        try {
          const consumerTransport = device.current.createRecvTransport(params);

          consumerTransport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                await socket.current.emit("transport-recv-connect", {
                  dtlsParameters,
                  serverConsumerTransportId: params.id,
                });
                callback();
              } catch (error) {
                errback(error);
              }
            }
          );
          connectRecvTransport(consumerTransport, remoteProducerId, params.id);
        } catch (e) {
          console.log(e);
        }
      }
    );
  };

  const connectRecvTransport = async (
    consumerTransport,
    remoteProducerId,
    serverConsumerTransportId
  ) => {
    await socket.current.emit(
      "consume",
      {
        rtpCapabilities: device.current.rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
      },
      async ({ params }) => {
        console.log(params);

        // Consume the track (could be audio or video)
        const consumer = await consumerTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        // Create a new media stream for the received track
        const newStream = new MediaStream([consumer.track]);
        // console.log(params.userSocket);
        // console.log(Id.users);
        // const userSocketToName = Id.users.find(
        //   (user) => user.socketId === params.userSocket[0]
        // )?.name;

        // Determine if the stream is video or audio
        if (params.kind === "video") {
          if (isObserver) {
            if (!remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.srcObject = newStream; // First remote video (Host)
              consumerTransports = [
                ...consumerTransports,
                {
                  consumerTransport,
                  serverConsumerTransportId: params.id,
                  producerId: remoteProducerId,
                  consumer,
                  videoRef: remoteVideoRef,
                },
              ];
              // if (userSocketToName)
              //   document.getElementById(
              //     "remote-video"
              //   ).innerText = `${userSocketToName} :`;
              // else
              //   document.getElementById("remote-video").innerText =
              //     "Remote Video :";
            } else {
              localVideoRef.current.srcObject = newStream; // Second remote video (Person in call)
              consumerTransports = [
                ...consumerTransports,
                {
                  consumerTransport,
                  serverConsumerTransportId: params.id,
                  producerId: remoteProducerId,
                  consumer,
                  videoRef: localVideoRef,
                },
              ];
              // if (userSocketToName)
              //   document.getElementById(
              //     "local-video"
              //   ).innerText = `${userSocketToName} :`;
              // else
              //   document.getElementById("local-video").innerText =
              //     "Local Video :";
            }
          } else if (!isObserver || isHost) {
            remoteVideoRef.current.srcObject = newStream; // For non-host participants
            consumerTransports = [
              ...consumerTransports,
              {
                consumerTransport,
                serverConsumerTransportId: params.id,
                producerId: remoteProducerId,
                consumer,
                videoRef: remoteVideoRef,
              },
            ];
            // if (userSocketToName)
            //   document.getElementById(
            //     "remote-video"
            //   ).innerText = `${userSocketToName} :`;
            // else
            //   document.getElementById("remote-video").innerText =
            //     "Remote Video :";
          }
        } else if (params.kind === "audio") {
          if (isObserver) {
            if (!remoteAudioRef.current.srcObject) {
              remoteAudioRef.current.srcObject = newStream; // First remote audio (Host)
              consumerTransports = [
                ...consumerTransports,
                {
                  consumerTransport,
                  serverConsumerTransportId: params.id,
                  producerId: remoteProducerId,
                  consumer,
                  audioRef: remoteAudioRef,
                },
              ];
            } else {
              localAudioRef.current.srcObject = newStream; // Second remote audio (Person in call)
              consumerTransports = [
                ...consumerTransports,
                {
                  consumerTransport,
                  serverConsumerTransportId: params.id,
                  producerId: remoteProducerId,
                  consumer,
                  audioRef: localAudioRef,
                },
              ];
            }
          } else if (!isObserver || isHost) {
            remoteAudioRef.current.srcObject = newStream; // For non-host participants
            consumerTransports = [
              ...consumerTransports,
              {
                consumerTransport,
                serverConsumerTransportId: params.id,
                producerId: remoteProducerId,
                consumer,
                audioRef: remoteAudioRef,
              },
            ];
          }
        }

        socket.current.emit("consumer-resume", {
          serverConsumerId: params.serverConsumerId,
        });
      }
    );
  };

  // const getProducers = () => {
  //   socket.current.emit("getProducers", (producerIds) => {
  //     producerIds.forEach((producerId)=>signalNewConsumerTransport(producerId));
  //   });
  // };

  const getProducers = () => {
    socket.current.emit("getProducers", (producerIds) => {
      producerIds.forEach((producerId) =>
        getRtpCapabilities({ audioTrack: null, videoTrack: null, producerId })
      );
    });
  };

  // getRtpCapabilities({ audioTrack: null, videoTrack: null, producerId });

  const handleProducerClosed = (remoteProducerId) => {
    const producerToClose = consumerTransports.find(
      (transportData) => transportData.producerId === remoteProducerId
    );

    if (producerToClose) {
      // Close the consumer transport and the consumer itself
      producerToClose.consumerTransport?.close();
      producerToClose.consumer?.close();

      // Check if it's video or audio before setting srcObject to null
      if (producerToClose.videoRef?.current) {
        producerToClose.videoRef.current.srcObject = null;
      }
      if (producerToClose.audioRef?.current) {
        producerToClose.audioRef.current.srcObject = null;
      }

      // Remove the transport from the list
      consumerTransports = consumerTransports.filter(
        (transportData) => transportData.producerId !== remoteProducerId
      );

      // Optional: You may want to update the state/UI here to reflect the closed producer
    } else {
      console.error(`Producer with ID ${remoteProducerId} not found.`);
    }
  };

  const callRequest = async () => {
    socket.current.emit("getProducers", (producerIds) => {
      if (producerIds.length == 2 || (producerIds.length < 2 && Id.host)) {
        // Check if current user is the host
        if (Id.host) {
          setIsHost(true);
          setIsObserver(false);
        } else {
          setIsObserver(false);
        }
        setAudio(true);
        getLocalStream();
      }
    });
  };

  const quitCall = async () => {
    try {
      // Stop and disable local audio and video tracks
      console.log(localStream);
      if (!localStream) return;
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop(); // Stop the track to prevent sending the media
        });
      }
      // If there is a producer transport, close it
      localVideoRef.current.srcObject = null;
      localAudioRef.current.srcObject = null;
      setIsObserver(true);
      setLocalStream(null);

      if (audioProducer.current) {
        await audioProducer.current.close(); // Close audio producer
        audioProducer.current = null; // Clear audio producer reference
      }

      if (videoProducer.current) {
        await videoProducer.current.close(); // Close video producer
        videoProducer.current = null; // Clear video producer reference
      }

      // Close producer transport
      if (producerTransport.current) {
        await producerTransport.current.close(); // Close producer transport
        producerTransport.current = null; // Clear producer transport reference
      }
    } catch (e) {
      console.log(e);
    }
  };

  function muteAudio() {
    // Ensure localAudioRef and srcObject are valid
    if (!localAudioRef.current || !localAudioRef.current.srcObject) {
      console.error("Audio stream not available.");
      return;
    }
    if (!localStream) {
      setAudio(false);
      return;
    }
    const audioTrack = localStream
      .getTracks()
      .find((track) => track.kind === "audio");

    if (audioTrack) {
      if (audiostate) {
        audioTrack.enabled = false;
        setAudio(false); // Mute audio
      } else {
        audioTrack.enabled = true;
        setAudio(true); // Unmute audio
      }
    } else {
      console.error("Audio track not found.");
    }
  }
  return (
    <>
      <main className="videocall-container">
        <div className="video bg-main">
          {/* Remote Video */}
          <h4 id="remote-video">{`Remote Video :`}</h4>
          <video
            ref={remoteVideoRef}
            className="video-item"
            autoPlay
            playsInline
          ></video>
          {/* Local Video for host and person in call */}
          <h4 id="local-video">
            {!isObserver ? `Local Video :` : `Remote Video :`}
          </h4>
          <video
            ref={localVideoRef}
            className="video-item"
            autoPlay
            playsInline
          ></video>

          {/* Local Audio for host and person in call */}
          <audio ref={localAudioRef} autoPlay playsInline></audio>

          {/* Remote Audio */}
          <audio ref={remoteAudioRef} autoPlay playsInline></audio>
        </div>

        <div className="btn">
          <button
            className="btn-item btn-start"
            ref={startButton}
            onClick={callRequest}
          >
            <i className="fa-solid fa-video"></i>
          </button>

          <button
            className="btn-item btn-end"
            ref={hangupButton}
            onClick={quitCall}
          >
            <i className="fa-solid fa-video-slash"></i>
          </button>

          <button
            className="btn-item btn-start"
            ref={muteAudButton}
            onClick={muteAudio}
          >
            {audiostate ? (
              <i className="fa-solid fa-microphone"></i>
            ) : (
              <i className="fa-solid fa-microphone-slash"></i>
            )}
          </button>
        </div>
      </main>
    </>
  );
}

export default Videocall;
