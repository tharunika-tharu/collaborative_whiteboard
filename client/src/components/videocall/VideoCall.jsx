import React from "react";
import { useRef, useEffect, useState } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { useSocket } from "../context";
import "./Videocall.css";

const configuration = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun1.l.google.com:3478",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc;
let localStream;
let startButton;
let hangupButton;
let muteAudButton;
let remoteVideo;
let localVideo;

async function handleAnswer(answer) {
  if (!pc) {
    console.error("no peerconnection");
    return;
  }
  try {
    await pc.setRemoteDescription(answer);
  } catch (e) {
    console.log(e);
  }
}

async function handleCandidate(candidate) {
  try {
    if (!pc) {
      console.error("no peerconnection");
      return;
    }
    if (!candidate) {
      await pc.addIceCandidate(null);
    } else {
      await pc.addIceCandidate(candidate);
    }
  } catch (e) {
    console.log(e);
  }
}
async function hangup() {
  if (pc) {
    pc.close();
    pc = null;
  }
  try {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    startButton.current.disabled = false;
    hangupButton.current.disabled = true;
    muteAudButton.current.disabled = true;
  } catch (e) {
    console.log(e);
  }
}

function Videocall() {
  startButton = useRef(null);
  hangupButton = useRef(null);
  muteAudButton = useRef(null);
  localVideo = useRef(null);
  remoteVideo = useRef(null);
  const Id = useSocket();
  const { user } = useAuth0();

  // Socket event handlers
  useEffect(() => {
    const handleSocketEvents = (e) => {
      if (!localStream) {
        console.log("not ready yet");
        return;
      }
      switch (e.type) {
        case "offer":
          handleOffer(e);
          break;
        case "answer":
          handleAnswer(e);
          break;
        case "candidate":
          handleCandidate(e);
          break;
        case "ready":
          // A second tab joined. This tab will initiate a call unless in a call already.
          if (pc) {
            console.log("already in call, ignoring");
            return;
          }
          makeCall();
          break;
        case "bye":
          if (pc) {
            hangup();
          }
          break;
        default:
          console.log("unhandled", e);
          break;
      }
    };
    const handleIncomingCall = (from) => {
      const isAccepted = true;
      if (isAccepted) {
        console.log("incomming called one times");
        Id.socket.emit("answerCall", {
          roomId: Id.roomId,
          fromSocketId: from,
          accept: true,
        });
        startB();
      } else {
        Id.socket.emit("answerCall", {
          roomId: Id.roomId,
          fromSocketId: from,
          accept: false,
        });
      }
    };
    const handleCallFailed = (message) => {
      alert(`${message}`);
    };

    Id.socket.on("callFailed", handleCallFailed);
    Id.socket.on("message", handleSocketEvents);
    Id.socket.on("incomingCall", handleIncomingCall);

    return () => {
      Id.socket.off("message", handleSocketEvents); // Cleanup socket event
      Id.socket.off("callFailed", handleCallFailed);
      Id.socket.off("incomingCall", handleIncomingCall);
    };
  }, [Id.socket]);

  async function makeCall() {
    try {
      pc = new RTCPeerConnection(configuration);
      pc.onicecandidate = (e) => {
        const message = {
          type: "candidate",
          candidate: null,
        };
        if (e.candidate) {
          message.candidate = e.candidate.candidate;
          message.sdpMid = e.candidate.sdpMid;
          message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        Id.socket.emit("message", message);
      };
      pc.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));
      const offer = await pc.createOffer();
      Id.socket.emit("message", { type: "offer", sdp: offer.sdp });
      await pc.setLocalDescription(offer);
    } catch (e) {
      console.log(e);
    }
  }

  async function handleOffer(offer) {
    if (pc) {
      console.error("existing peerconnection");
      return;
    }
    try {
      pc = new RTCPeerConnection(configuration);
      pc.onicecandidate = (e) => {
        const message = {
          type: "candidate",
          candidate: null,
        };
        if (e.candidate) {
          message.candidate = e.candidate.candidate;
          message.sdpMid = e.candidate.sdpMid;
          message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        Id.socket.emit("message", message);
      };
      pc.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      Id.socket.emit("message", { type: "answer", sdp: answer.sdp });
      await pc.setLocalDescription(answer);
    } catch (e) {
      console.log(e);
    }
  }

  const call = async () => {
    await startB();

    Id.socket.emit("callUser", {
      roomId: Id.roomId,
      targetSocketId: Id.currentUser.socketId,
    });
  };
  useEffect(() => {
    if (Id.call === 1) {
      call();
    }
  }, [Id.call]);

  useEffect(() => {
    const handleCallAccepted = (message) => {
      alert(`Call accepted from socket id : ${message.to}`);
    };
    const handleCallRejected = () => {
      alert(`Call rejected`);
    };

    const handleCallEnded = () => {
      try {
        hangB();
      } catch (e) {
        console.log(e);
      }
      Id.setCall(0);
    };
    Id.socket.on("callEnded", handleCallEnded);
    Id.socket.on("callRejected", handleCallRejected);
    Id.socket.on("callAccepted", handleCallAccepted);

    return () => {
      Id.socket.off("callEnded", handleCallEnded);
      Id.socket.off("callRejected", handleCallRejected);
      Id.socket.off("callAccepted", handleCallAccepted);
    };
  }, []);

  useEffect(() => {
    hangupButton.current.disabled = true;
    muteAudButton.current.disabled = true;
  }, []);
  const [audiostate, setAudio] = useState(true);

  const callRequest = async () => {
    if (Id.users.length > 1) {
      await startB();

      Id.socket.emit("callUser", {
        roomId: Id.roomId,
        targetSocketId: Id.currentUser.socketId,
      });
    }
  };

  const quitCall = async () => {
    try {
      hangB();
    } catch (e) {
      console.log(e);
    }

    Id.socket.emit("quitCall", Id.roomId);
  };

  const startB = async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true },
      });
      localVideo.current.srcObject = localStream;
    } catch (err) {
      console.log(err);
    }

    startButton.current.disabled = true;
    hangupButton.current.disabled = false;
    muteAudButton.current.disabled = false;

    Id.socket.emit("message", { type: "ready" });
  };

  const hangB = async () => {
    hangup();
    localVideo.current.srcObject = null;
    remoteVideo.current.srcObject = null;
    Id.socket.emit("message", { type: "bye" });
  };

  function muteAudio() {
    const audioTrack = localStream
      .getTracks()
      .find((track) => track.kind === "audio");

    if (audioTrack) {
      if (audiostate) {
        audioTrack.enabled = false;
        setAudio(false);
      } else {
        audioTrack.enabled = true;
        setAudio(true);
      }
    }
  }

  return (
    <>
      <main className="videocall-container">
        <div className="video bg-main">
          <video
            ref={localVideo}
            className="video-item"
            autoPlay
            playsInline
            src=" "
          ></video>
          <video
            ref={remoteVideo}
            className="video-item"
            autoPlay
            playsInline
            src=" "
          ></video>
        </div>

        <div className="btn">
          <button
            className="btn-item btn-start"
            ref={startButton}
            onClick={callRequest}
          >
            <i class="fa-solid fa-video"></i>
          </button>
          <button
            className="btn-item btn-end"
            ref={hangupButton}
            onClick={quitCall}
          >
            <i class="fa-solid fa-video-slash"></i>
          </button>
          <button
            className="btn-item btn-start"
            ref={muteAudButton}
            onClick={muteAudio}
          >
            {audiostate ? (
              <i class="fa-solid fa-microphone"></i>
            ) : (
              <i class="fa-solid fa-microphone-slash"></i>
            )}
          </button>
        </div>
      </main>
    </>
  );
}

export default Videocall;
