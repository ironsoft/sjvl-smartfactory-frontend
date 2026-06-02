import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUser from "../lib/useUser";

interface IProps {
  children: React.ReactNode;
}

export default function WorkerProtectedPage({ children }: IProps) {
  const { user, userLoading, isLoggedIn } = useUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (!userLoading) {
      if (!isLoggedIn) {
        navigate("/");
      } else if (user?.role !== "worker") {
        navigate("/home");
      }
    }
  }, [userLoading, isLoggedIn, user, navigate]);
  return <>{children}</>;
}
