import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// A dialog's open record kept in the URL (?view=<id>), so a notification or a shared link can open it
export const useSearchParamState = (name: string): [string | null, (value: string | null) => void] => {
  const [params, setParams] = useSearchParams();
  const value = params.get(name);
  const set = useCallback(
    (next: string | null) =>
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          if (next) updated.set(name, next);
          else updated.delete(name);
          return updated;
        },
        { replace: true },
      ),
    [name, setParams],
  );
  return [value, set];
};
