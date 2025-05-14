import React, { useEffect } from "react";
import RoomManager from "./components/RoomManager";
import ClassRoom from "./components/ClassRoom";
import { useAuth0 } from "@auth0/auth0-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Loading from "./components/Loading.js";
import "./App.css";

function App() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isLoading) {
    return <Loading />;
  }
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route index element={<RoomManager />} />
          <Route path="classroom/:id" element={<ClassRoom />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
