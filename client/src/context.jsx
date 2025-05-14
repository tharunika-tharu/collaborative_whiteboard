import { createContext, useContext, useState } from "react";
import { io } from "socket.io-client";
export const SocketContext = createContext(null);

export const useSocket = () => {
  const roomId = useContext(SocketContext);
  return roomId;
};
const socket = io("http://localhost:5000", { transports: ["websocket"] });
export const SocketProvider = (props) => {
  const [roomId, setRoomId] = useState(null);
  const [users, setUsers] = useState([]);
  const [host, setHost] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [call, setCall] = useState(0);
  const [quit, setQuit] = useState(null);
  return (
    <SocketContext.Provider
      value={{
        roomId,
        setRoomId,
        users,
        setUsers,
        currentUser,
        setCurrentUser,
        host,
        setHost,
        call,
        quit,
        setCall,
        setQuit,
        socket,
      }}
    >
      {props.children}
    </SocketContext.Provider>
  );
};
