"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type PropsWithChildren,
} from "react";
import type { IncomeProfile, PlaygroundBill, BillEvent } from "~/types";

interface PlaygroundState {
  bills: PlaygroundBill[];
  incomeProfile: IncomeProfile | null;
  isInitialized: boolean;
}

type PlaygroundAction =
  | { type: "INIT_FRESH"; incomeProfile: IncomeProfile }
  | { type: "INIT_CLONE"; incomeProfile: IncomeProfile; bills: BillEvent[] }
  | { type: "ADD_BILL"; bill: PlaygroundBill }
  | { type: "UPDATE_BILL"; id: string; data: Omit<PlaygroundBill, "id"> }
  | { type: "DELETE_BILL"; id: string }
  | { type: "RESET" };

const initialState: PlaygroundState = {
  bills: [],
  incomeProfile: null,
  isInitialized: false,
};

function playgroundReducer(
  state: PlaygroundState,
  action: PlaygroundAction,
): PlaygroundState {
  switch (action.type) {
    case "INIT_FRESH":
      return {
        bills: [],
        incomeProfile: action.incomeProfile,
        isInitialized: true,
      };
    case "INIT_CLONE":
      return {
        bills: action.bills.map((bill): PlaygroundBill => {
          // Cast via `any` because BillEvent._id is typed as string but the
          // MongoDB driver returns ObjectId at runtime, making typed
          // destructuring impractical without a richer BillEvent definition.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { _id: _discardId, userId: _discardUserId, ...rest } = bill as any;
          return {
            ...rest,
            id: crypto.randomUUID(),
          };
        }),
        incomeProfile: action.incomeProfile,
        isInitialized: true,
      };
    case "ADD_BILL":
      return {
        ...state,
        bills: [...state.bills, action.bill],
      };
    case "UPDATE_BILL":
      return {
        ...state,
        bills: state.bills.map((bill) =>
          bill.id === action.id ? { ...action.data, id: action.id } : bill,
        ),
      };
    case "DELETE_BILL":
      return {
        ...state,
        bills: state.bills.filter((bill) => bill.id !== action.id),
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const PlaygroundContext = createContext<PlaygroundState | null>(null);
const PlaygroundDispatchContext =
  createContext<Dispatch<PlaygroundAction> | null>(null);

export function PlaygroundProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(playgroundReducer, initialState);

  return (
    <PlaygroundContext.Provider value={state}>
      <PlaygroundDispatchContext.Provider value={dispatch}>
        {children}
      </PlaygroundDispatchContext.Provider>
    </PlaygroundContext.Provider>
  );
}

export function usePlayground() {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error("usePlayground must be used within PlaygroundProvider");
  }
  return context;
}

export function usePlaygroundDispatch() {
  const context = useContext(PlaygroundDispatchContext);
  if (!context) {
    throw new Error(
      "usePlaygroundDispatch must be used within PlaygroundProvider",
    );
  }
  return context;
}
