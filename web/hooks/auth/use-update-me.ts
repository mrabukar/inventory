"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";
import { updateMe, type UpdateMeInput } from "@/service/auth/update-me";
import { useAppStore } from "@/store/app";
import { SESSION_QUERY_KEY } from "./session";

export function useUpdateMe() {
  const queryClient = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: UpdateMeInput) => updateMe(input),
    onSuccess: async (response) => {
      const user = mapApiUserToAppUser(response.user);
      setUser(user);
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
