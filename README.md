# react-saga

Some extends of react-saga
Provides a local use of saga based state management

## Install

```
npm install immer react react-dom redux-saga use-immer @ideveloper.eu.org/react-saga --save
```

## Usage

### ContextCreator

```jsx
import ContextCreator from "@ideveloper.eu.org/react-saga";
import { delay } from "redux-saga/effects";

const model = {
  state: {
    partOne: {
      count: 0,
      loading: false,
    },
    partTwo: {
      count: 0,
      loading: false,
    },
  },
  effects: {
    one: {
      *increase(payload, { set }) {
        yield set((state) => {
          state.partOne.count++;
        });
      },
      *asyncIncrease(payload, { set, put }) {
        yield set((state) => void (state.partOne.loading = true));
        yield delay(1000);
        yield put({ type: "increase" });
        yield set((state) => void (state.partOne.loading = false));
      },

      *decrease(payload, { set }) {
        yield set((state) => {
          state.partOne.count--;
        });
      },
      *asyncDecrease(payload, { set, put }) {
        yield set((state) => void (state.partOne.loading = true));
        yield delay(1000);
        yield put({ type: "decrease" });
        yield set((state) => void (state.partOne.loading = false));
      },
    },
    two: {
      *increase(payload, { set }) {
        yield set((state) => {
          state.partTwo.count++;
        });
      },
      *asyncIncrease(payload, { set, put }) {
        yield set((state) => void (state.partTwo.loading = true));
        yield delay(1000);
        yield put({ type: "increase" });
        yield set((state) => void (state.partTwo.loading = false));
      },

      *decrease(payload, { set }) {
        yield set((state) => {
          state.partTwo.count--;
        });
      },
      *asyncDecrease(payload, { set, put }) {
        yield set((state) => void (state.partTwo.loading = true));
        yield delay(1000);
        yield put({ type: "decrease" });
        yield set((state) => void (state.partTwo.loading = false));
      },
    },

    *increaseBoth(payload, { put }) {
      yield put({ type: "one/increase" });
      yield put({ type: "two/increase" });
    },
  },
};

export const { connect, useContextDispatch, useContextState } =
  ContextCreator(model);

function Example1() {
  const dispatch = useContextDispatch();
  const increaseBoth = () => dispatch({ type: "increaseBoth" });

  const increase = () => dispatch({ type: "one/increase" });
  const decrease = () => dispatch({ type: "one/decrease" });
  const asyncIncrease = () => dispatch({ type: "one/asyncIncrease" });
  const asyncDecrease = () => dispatch({ type: "one/asyncDecrease" });

  const increase2 = () => dispatch({ type: "two/increase" });
  const decrease2 = () => dispatch({ type: "two/decrease" });
  const asyncIncrease2 = () => dispatch({ type: "two/asyncIncrease" });
  const asyncDecrease2 = () => dispatch({ type: "two/asyncDecrease" });

  const one = useContextState((state) => state.partOne);
  const two = useContextState((state) => state.partTwo);

  return (
    <div>
      <div>
        <button onClick={increaseBoth}>both increase</button>
      </div>
      <br />
      <div style={{ display: "flex", gap: "8px" }}>
        <div>
          <h4>part one: {one.count}</h4>
          <div>
            <button onClick={increase}>increase partOne</button>
            <button disabled={one.loading} onClick={asyncIncrease}>
              asyncIncrease partOne
            </button>
            <button onClick={decrease}>decrease partOne</button>
            <button disabled={one.loading} onClick={asyncDecrease}>
              asyncDecrease partOne
            </button>
          </div>
        </div>
        <div>
          <h4>part two: {two.count}</h4>
          <div>
            <button onClick={increase2}>increase partTwo</button>
            <button disabled={two.loading} onClick={asyncIncrease2}>
              asyncIncrease partTwo
            </button>
            <button onClick={decrease2}>decrease partTwo</button>
            <button disabled={two.loading} onClick={asyncDecrease2}>
              asyncDecrease partTwo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default connect(Example1);
```

### useSagaReducer

```jsx
import { useSagaReducer } from "@ideveloper.eu.org/react-saga";
import { eventChannel, END } from "redux-saga";

const model = {
  state: {
    count: 0,
    isAsync: false,
    seconds: 5,
  },
  reducer: {
    increase(state) {
      state.count += 1;
    },
  },
  effects: {
    *asyncIncrease(payload, { set, call, take, cancelled, select, race }) {
      yield set((state) => void (state.isAsync = true));
      const defaultSeconds = yield select((state) => state.seconds);
      const chan = yield call(model.helper.countdown, defaultSeconds);
      yield race({
        finish: call(function* startTime() {
          try {
            while (true) {
              const seconds = yield take(chan);
              yield set((state) => void (state.seconds = seconds));
            }
          } finally {
            if (yield cancelled()) {
              chan.close();
              console.log("countdown cancelled");
              yield set((state) => {
                state.isAsync = false;
                state.seconds = defaultSeconds;
              });
            } else {
              yield set((state) => {
                state.isAsync = false;
                state.seconds = defaultSeconds;
                state.count += 1;
              });
            }
          }
        }),
        cancel: take("cancelAsyncIncrease"),
      });
    },
  },
  helper: {
    countdown(secs) {
      return eventChannel((emitter) => {
        const iv = setInterval(() => {
          secs -= 1;
          if (secs > 0) {
            emitter(secs);
          } else {
            // this causes the channel to close
            emitter(END);
          }
        }, 1000);
        // The subscriber must return an unsubscribe function
        return () => {
          clearInterval(iv);
        };
      });
    },
  },
};

export default function Example2() {
  const [{ count, isAsync, seconds }, dispatch] = useSagaReducer(model);

  return (
    <div>
      <p style={{ margin: "10px 0" }}>Current Counter: {count}</p>
      <div>
        <button onClick={() => dispatch({ type: "increase" })}>
          Sync Increase
        </button>
        <button
          onClick={() =>
            isAsync
              ? dispatch({
                  type: "cancelAsyncIncrease",
                })
              : dispatch({
                  type: "asyncIncrease",
                })
          }
        >
          {`${
            isAsync ? `Async Increasing ... (${seconds})` : "Async Increase"
          }`}
        </button>
      </div>
    </div>
  );
}
```
