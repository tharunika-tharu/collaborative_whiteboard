import React, { useEffect, useState } from "react";
import Whiteboard from "./Whiteboard";
import Videocall from "./VideocallComponent";
import GroupChat from "./GroupChat";
import { useSocket } from "../context";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "./ConfirmationModal";

const ClassRoom = () => {
  const Id = useSocket();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [pendingJoinRequest, setPendingJoinRequest] = useState(null);

  const handleUserConfirmation = (confirmed) => {
    if (pendingJoinRequest) {
      const { roomId, socketId, user } = pendingJoinRequest;

      user["socketId"] = socketId;
      if (confirmed) Id.setCurrentUser(user);
      Id.socket.emit("handleJoinRequest", {
        roomId,
        socketId,
        accept: confirmed,
        user,
      });

      setPendingJoinRequest(null);
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    if (!Id.roomId) {
      navigate("/");
      window.location.reload();
    }

    const handleJoinRequest = ({ roomId, socketId, user }) => {
      if (Id.host) {
        setPendingJoinRequest({ roomId, socketId, user });
        setIsModalOpen(true);
      }
    };

    const handleNewUser = ({ socketId, roomUsers }) => {
      Id.setUsers(roomUsers);
    };

    const handleUserDisconnected = ({ socketID, roomUsers }) => {
      Id.setUsers(roomUsers);
    };

    const handleDisconnectedByHost = () => {
      navigate("/");
      window.location.reload();
    };

    Id.socket.on("joinRequest", handleJoinRequest);
    Id.socket.on("newUser", handleNewUser);
    Id.socket.on("userDisconnected", handleUserDisconnected);
    Id.socket.on("disconnectedByHost", handleDisconnectedByHost);

    return () => {
      Id.socket.off("joinRequest", handleJoinRequest);
      Id.socket.off("newUser", handleNewUser);
      Id.socket.off("userDisconnected", handleUserDisconnected);
    };
  }, [Id, navigate]);

  return (
    <div className="main-app-container">
      <div className="app-container">
        <div className="whiteboard-container">
          <Whiteboard users={Id.users} isAdmin={Id.host} />
        </div>
        <div className="main-right-container">
          <div className="right-container">
            <Videocall />
            <GroupChat />
          </div>
        </div>
      </div>

      {Id.host && pendingJoinRequest && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleUserConfirmation}
          isAlert={false}
          requestType={"Join Request"}
          requestMessage={`Do you allow ${pendingJoinRequest?.user?.name} to join?`}
        />
      )}
      {!Id.host && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={() => setIsModalOpen(false)}
          isAlert={true}
          requestType={"Accepted!"}
          requestMessage={`Request accepted by the host on the room ID: ${Id.roomId}.`}
        />
      )}
    </div>
  );
};

export default ClassRoom;
