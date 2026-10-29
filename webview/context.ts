import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ClientMessage } from "../src/shared/protocol";
import type { Translate } from "./i18n";
import type { Action, State } from "./store";

export interface AppContextValue {
  state: State;
  dispatch: (action: Action) => void;
  t: Translate;
  post: (message: ClientMessage) => void;
  view: "sidebar" | "panel";
}

export const AppContext = createContext<AppContextValue>(null as unknown as AppContextValue);

export function useApp(): AppContextValue {
  return useContext(AppContext);
}
