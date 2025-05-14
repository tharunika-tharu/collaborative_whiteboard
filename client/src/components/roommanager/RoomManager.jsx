import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../context";
import "./RoomManager.css";
import ConfirmationModal from "./ConfirmationModal";

function RoomManager() {
  const { user } = useAuth0();
  const navigate = useNavigate();
  const Id = useSocket();
  const [roomId, setRoomId] = useState("");
  const [isRoomCreated, setIsRoomCreated] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Id.socket.on("joinAccepted", (roomUsers) => {
      if (Id.currentUser) {
        const temp = { ...roomUsers[0] };
        Id.setCurrentUser(temp);
      }
      Id.setUsers(roomUsers);
      Id.setRoomId(roomId);
      setCurrentRoomId(roomId);
      navigate(`/classroom/${roomId}`);
    });

    Id.socket.on("joinDenied", ({ roomId }) => {
      setMessage("Denied!");
      setIsModalOpen(true);
    });

    return () => {
      Id.socket.off("joinAccepted");
      Id.socket.off("joinDenied");
    };
  }, [Id, navigate, roomId]);

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    Id.socket.emit("joinRoom", { roomId: newRoomId, user: user });
    Id.socket.on("host", (roomUsers) => {
      Id.setHost(true);
      Id.setUsers(roomUsers);
      Id.setRoomId(newRoomId);
      setCurrentRoomId(newRoomId);
      setIsRoomCreated(true);
    });
  };

  const handleJoinRoom = () => {
    if (roomId) {
      setMessage("Sent!");
      setIsModalOpen(true);
      Id.socket.emit("joinRoom", { roomId: roomId, user: user });
    }
  };

  const copyToClipboard = () => {
    const link = `${currentRoomId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {})
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <div className="room-manager-container">
      <div className="room-manager">
        <h2>Room Manager</h2>

        {isRoomCreated ? (
          <div>
            <p>Room created! Share this link with others:</p>
            <div className="input-container">
              <i
                className="fas fa-copy copy-icon"
                onClick={copyToClipboard}
              ></i>
              <input
                type="text"
                value={`Room Id: ${currentRoomId}`}
                readOnly
                onClick={(e) => e.target.select()}
              />
            </div>
            <Link to={`classroom/${currentRoomId}`}>
              <button>Enter the Room</button>
            </Link>
          </div>
        ) : (
          <>
            <div className="input-container">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
              <button onClick={handleJoinRoom}>Join Room</button>
            </div>

            <hr />

            <button onClick={handleCreateRoom}>Create Room</button>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => setIsModalOpen(false)}
        isAlert={true}
        requestType={`${message}`}
        requestMessage={
          message === "Sent!"
            ? `Request sent to the host!`
            : `Join denied by the host on the roomId: ${roomId}`
        }
      />
    </div>
  );
}

export default RoomManager;
