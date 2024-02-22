## react-saga extends

Provides a local use of saga based state management

### useSagaReduder

```jsx
import { useSagaReducer } from '@ideveloper.eu.org/react-saga';
import { eventChannel, END } from 'redux-saga';

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

export default function Counter() {
  const [{ count, isAsync, seconds }, dispatch] = useSagaReducer(model);

  return (
    <>
      <h2>useSagaReducer</h2>
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
    </>
  );
}
```
