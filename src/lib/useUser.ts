import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api";
import { IUser } from "../types";

export default function useUser() {
  const { isLoading, data, isError } = useQuery<IUser>({
    queryKey: [`me`],
    queryFn: getMe,
    retry: false
  });

  return {
    userLoading: isLoading,
    user: data,
    isLoggedIn: !isError && !!data // 에러가 없고 data가 있을 때만 로그인 상태로 처리
  };
}