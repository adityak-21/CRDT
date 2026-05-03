import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { App } from "./App";

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  if (!roomId) {
    navigate("/");
    return null;
  }

  return <App roomId={roomId} />;
}