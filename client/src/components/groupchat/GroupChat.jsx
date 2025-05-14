import React, { useEffect, useState } from "react";
import "./GroupChat.css";
import { useSocket } from "../context";
import { useAuth0 } from "@auth0/auth0-react";

function GroupChat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const Id = useSocket();
  const { user } = useAuth0();

  const getUserColor = (username) => {
    const colors = [
      "#1abc9c",
      "#3498db",
      "#9b59b6",
      "#e74c3c",
      "#f39c12",
      "#2ecc71",
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      const temp = [
        ...messages,
        { text: inputMessage, sender: user.name, picture: user.picture },
      ];
      setMessages(temp);
      setInputMessage("");
      Id.socket.emit("handleSendMessage", { temp }, Id.roomId);
      console.log(temp);
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    Id.socket.on("handleSendMessage", ({ temp: newMessages }) => {
      console.log(newMessages);
      setInputMessage("");
      setMessages(newMessages);
    });
  }, []);

  return (
    <div className="group-chat-container">
      <div className="chat-header">
        <h3>Group Chat</h3>
      </div>
      <div className="chat-messages">
        {messages &&
          messages.map((message, index) => (
            <div
              key={index}
              className="chat-message"
              style={{
                alignSelf:
                  message.sender === user.name ? "flex-end" : "flex-start",
                backgroundColor:
                  message.sender === user.name ? "#1abc9c" : "#34495e",
              }}
            >
              <div className="message-content">
                <img
                  src={
                    message.sender === user.name
                      ? user.picture
                      : message.picture
                  }
                  alt="User DP"
                  className="user-dp"
                />
                <div>
                  <strong
                    style={{
                      color:
                        message.sender === user.name
                          ? "White"
                          : getUserColor(message.sender),
                    }}
                  >
                    {message.sender === user.name ? "You" : message.sender}:
                  </strong>
                  <br />
                  {message.text}
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
        <button className="chat-send-button" onClick={handleSendMessage}>
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
}

export default GroupChat;
