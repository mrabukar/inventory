"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSaleLocation,
  listSaleLocations,
} from "@/service/sale-locations/sale-locations";

export function useSaleLocations(enabled = true) {
  return useQuery({
    queryKey: ["sale-locations"],
    queryFn: () => listSaleLocations(false),
    enabled,
  });
}

export function useCreateSaleLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSaleLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale-locations"] });
    },
  });
}
