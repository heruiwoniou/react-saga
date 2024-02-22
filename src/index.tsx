import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  SET_SYMBOL,
  META_SYMBOL,
  EMPTY_OBJECT,
  uniqueId,
  flattenEntries,
  identity,
} from "./utils";
import * as sagaEffects from "redux-saga/effects";
import { AnyAction, runSaga, stdChannel } from "redux-saga";
import { ImmerReducer, useImmerReducer } from "use-immer";
import { Draft } from "immer";

export type OriginalEffects = typeof sagaEffects;

export type CombineEffects = OriginalEffects & {
  set: <T>(set: T) => Generator<any, void, unknown>;
};

const combineEffects: CombineEffects = {
  *set(set) {
    yield sagaEffects.put({ type: SET_SYMBOL, _: set });
  },
  ...sagaEffects,
};

export type ReducerMap<S, A extends AnyAction> = {
  [key: string]: ImmerReducer<S, A>;
};

export type EffectsGeneratorFunction<A, EffectsMethods> = (
  action: A,
  combineEffectsMethods: EffectsMethods
) => Generator;

export type EffectGeneratorFunction<
  A,
  EffectsMethods extends CombineEffects
> = EffectsGeneratorFunction<A, EffectsMethods>;

export type EffectMap<
  A extends AnyAction,
  EffectsMethods extends CombineEffects = CombineEffects
> = {
  [key: string]:
  | EffectMap<A, EffectsMethods>
  | EffectGeneratorFunction<A, EffectsMethods>;
};

export type EffectsStructure<A, EffectsMethods extends CombineEffects> = {
  scope: string[];
  key: string;
  generator: EffectGeneratorFunction<A, EffectsMethods>;
};

export type Model<S, R, E> = {
  reducer: R;
  state: S;
  effects: E;
  [key: string]: any;
};

export function useSagaReducer<
  S extends Record<string, any>,
  R extends ReducerMap<S, A>,
  E extends EffectMap<A>,
  A extends AnyAction
>(props: Model<S, R, E>) {
  useReducer;
  const {
    reducer: initialReducer,
    state: initialState,
    effects = EMPTY_OBJECT,
  } = props;
  const defaultReducer = {
    [SET_SYMBOL](
      state: Draft<S>,
      { _: set }: { _: (draft: Draft<S>) => void | Draft<S> }
    ) {
      return (set(state) || state) as Draft<S>;
    },
  };

  const [state, reducerDispatch] = useImmerReducer<S, A>(function (
    draft,
    action
  ) {
    ({ ...defaultReducer, ...initialReducer })[action.type]?.(draft, action) ||
      draft;
  },
    initialState);
  const sagaEnv = useRef(state);
  sagaEnv.current = state;
  const channel = useMemo(() => stdChannel(), []);
  const dispatchActions = useRef<
    Record<string, { resolve: Function; reject: Function }>
  >({});
  const dispatch = useCallback((action: A) => {
    return new Promise((resolve, reject) => {
      const withMetaPayload = { ...action, [META_SYMBOL]: { id: uniqueId() } };
      dispatchActions.current[withMetaPayload[META_SYMBOL].id] = {
        resolve: (result: any) => {
          resolve(result);
          delete dispatchActions.current[withMetaPayload[META_SYMBOL].id];
        },
        reject: (e: any) => {
          reject(e);
          delete dispatchActions.current[withMetaPayload[META_SYMBOL].id];
        },
      };
      setTimeout(() => channel.put(withMetaPayload), 0);
      reducerDispatch(action);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const getState = useCallback(() => sagaEnv.current, []);
  useEffect(() => {
    const task = runSaga({ channel, dispatch, getState }, function* () {
      const entities = flattenEntries(effects);
      for (let i = 0; i < entities.length; i++) {
        const { scope, key, generator } = entities[i];
        yield sagaEffects.takeEvery(
          [...scope, key].join("/"),
          function* run(fullAction) {
            const { [META_SYMBOL]: meta, ...action } = fullAction as AnyAction;
            try {
              combineEffects.put;
              const result = yield generator(action, {
                ...combineEffects,
                put: function* (action: A) {
                  const { type, ...payload } = action;
                  yield sagaEffects.put({
                    type:
                      type.indexOf("/") > -1
                        ? type
                        : [...scope, type].join("/"),
                    ...payload,
                  });
                },
              } as any);
              dispatchActions.current[meta?.id]?.resolve?.(result);
            } catch (e) {
              dispatchActions.current[meta?.id]?.reject?.(e);
            }
          }
        );
      }
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [state, dispatch];
}

export default function ContextCreator<
  S extends Record<string, any>,
  R extends ReducerMap<S, A>,
  E extends EffectMap<A>,
  A extends AnyAction
>(model: Model<S, R, E>) {
  const ModuleContext = createContext<ReturnType<typeof useSagaReducer> | null>(null);

  const useContextState = (fn = identity) => {
    const context = useContext(ModuleContext);
    if (context) {
      const [state] = context;
      return fn(state);
    }
    throw new Error("not in correct context")
  };

  const useContextDispatch = () => {
    const context = useContext(ModuleContext);
    if (context) {
      const [, dispatch] = context;
      return dispatch;
    }
    throw new Error("not in correct context")
  };

  const ContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const state = useSagaReducer<S, R, E, A>(model);
    return (
      <ModuleContext.Provider value={state}>{children}</ModuleContext.Provider>
    );
  };

  const connect = (Component: React.ComponentType<any>) => () =>
  (
    <ContextProvider>
      <Component />
    </ContextProvider>
  );

  return {
    connect,
    useContextState,
    useContextDispatch,
    ContextProvider,
  };
}
