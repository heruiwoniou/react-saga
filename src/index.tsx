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
import { Draft, produce } from "immer";

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
) => Generator<any, any>;

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

function useImmerBySettingsReducer<S, A, I>(
  reducer: ImmerReducer<S, A>,
  initializerArg: S & I,
  initializer?: (arg: S & I) => S,
  disabledImmer?: boolean
) {
  const cachedReducer = useMemo(
    () => (disabledImmer ? reducer as any : produce(reducer)),
    [reducer, disabledImmer],
  );
  return useReducer(cachedReducer, initializerArg as any, initializer as any);
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
    disabledImmer = false,
  } = props;
  const defaultReducer = {
    [SET_SYMBOL](
      state: Draft<S>,
      { _: set }: { _: (draft: Draft<S>) => void | Draft<S> }
    ) {
      return (set(state) || state) as Draft<S>;
    },
  };

  const [state, reducerDispatch] = useImmerBySettingsReducer<S, A, any>(
    function (draft: any, action: any) {
      return { ...defaultReducer, ...initialReducer }[action.type]?.(draft, action) || draft;
    } as any,
    initialState,
    undefined,
    disabledImmer,
  );

  const sagaEnv = useRef(state);
  sagaEnv.current = state;
  const channel = useMemo(() => stdChannel(), []);
  const entities = useMemo(() => flattenEntries(effects), [effects]);
  const allActionTypes = useMemo(() => entities.map(({ key, scope }) => [...scope, key].join('/')), [entities]);
  const dispatchActions = useRef<
    Record<string, { resolve: Function; reject: Function } | any>
  >({});
  dispatchActions.current.allActionTypes = allActionTypes;
  dispatchActions.current.put = (message: any) => channel.put(message);
  dispatchActions.current.reducerDispatch = reducerDispatch;
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
      setTimeout(() => dispatchActions.current.put(withMetaPayload), 0);
      dispatchActions.current.reducerDispatch(action);
      if (!dispatchActions.current.allActionTypes.includes(action.type)) {
        dispatchActions.current[withMetaPayload[META_SYMBOL].id].resolve();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const getState = useCallback(() => sagaEnv.current, []);
  useEffect(() => {
    const task = runSaga({ channel, dispatch, getState }, function* () {
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
  }, [entities]);

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

  const connect = (Component: React.ComponentType<any>) => (props: any) =>
  (
    <ContextProvider>
      <Component {...props} />
    </ContextProvider>
  );

  return {
    connect,
    useContextState,
    useContextDispatch,
    ContextProvider,
  };
}
