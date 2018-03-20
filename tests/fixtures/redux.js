var ActionTypes = {
  INIT: "@@redux/INIT"
};

export function createStore(reducer, preloadedState, enhancer) {
  if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== "undefined") {
    if (typeof enhancer !== "function") {
      throw new Error("Expected the enhancer to be a function.");
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== "function") {
    throw new Error("Expected the reducer to be a function.");
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  function getState() {
    return currentState;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error("Expected listener to be a function.");
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(
        "Actions must be plain objects. " +
          "Use custom middleware for async actions."
      );
    }

    if (typeof action.type === "undefined") {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          "Have you misspelled a constant?"
      );
    }

    if (isDispatching) {
      throw new Error("Reducers may not dispatch actions.");
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = (currentListeners = nextListeners);
    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      listener();
    }

    return action;
  }

  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== "function") {
      throw new Error("Expected the nextReducer to be a function.");
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  };
}

function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type;
  var actionName =
    (actionType && '"' + actionType.toString() + '"') || "an action";

  return (
    "Given action " +
    actionName +
    ', reducer "' +
    key +
    '" returned undefined. ' +
    "To ignore an action, you must explicitly return the previous state. " +
    "If you want this reducer to hold no value, you can return null instead of undefined."
  );
}

function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  var reducerKeys = Object.keys(reducers);
  var argumentName =
    action && action.type === ActionTypes.INIT
      ? "preloadedState argument passed to createStore"
      : "previous state received by the reducer";

  if (reducerKeys.length === 0) {
    return (
      "Store does not have a valid reducer. Make sure the argument passed " +
      "to combineReducers is an object whose values are reducers."
    );
  }

  if (!isPlainObject(inputState)) {
    return (
      "The " +
      argumentName +
      ' has unexpected type of "' +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      '". Expected argument to be an object with the following ' +
      ('keys: "' + reducerKeys.join('", "') + '"')
    );
  }

  var unexpectedKeys = Object.keys(inputState).filter(function(key) {
    return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
  });

  unexpectedKeys.forEach(function(key) {
    unexpectedKeyCache[key] = true;
  });

  if (unexpectedKeys.length > 0) {
    return (
      "Unexpected " +
      (unexpectedKeys.length > 1 ? "keys" : "key") +
      " " +
      ('"' +
        unexpectedKeys.join('", "') +
        '" found in ' +
        argumentName +
        ". ") +
      "Expected to find one of the known reducer keys instead: " +
      ('"' + reducerKeys.join('", "') + '". Unexpected keys will be ignored.')
    );
  }
}

function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(function(key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, { type: ActionTypes.INIT });

    if (typeof initialState === "undefined") {
      throw new Error(
        'Reducer "' +
          key +
          '" returned undefined during initialization. ' +
          "If the state passed to the reducer is undefined, you must " +
          "explicitly return the initial state. The initial state may " +
          "not be undefined. If you don't want to set a value for this reducer, " +
          "you can use null instead of undefined."
      );
    }

    var type =
      "@@redux/PROBE_UNKNOWN_ACTION_" +
      Math.random()
        .toString(36)
        .substring(7)
        .split("")
        .join(".");
    if (typeof reducer(undefined, { type: type }) === "undefined") {
      throw new Error(
        'Reducer "' +
          key +
          '" returned undefined when probed with a random type. ' +
          ("Don't try to handle " +
            ActionTypes.INIT +
            ' or other actions in "redux/*" ') +
          "namespace. They are considered private. Instead, you must return the " +
          "current state for any unknown actions, unless it is undefined, " +
          "in which case you must return the initial state, regardless of the " +
          "action type. The initial state may not be undefined, but can be null."
      );
    }
  });
}

export function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    {
      if (typeof reducers[key] === "undefined") {
        warning('No reducer provided for key "' + key + '"');
      }
    }

    if (typeof reducers[key] === "function") {
      finalReducers[key] = reducers[key];
    }
  }
  var finalReducerKeys = Object.keys(finalReducers);

  var unexpectedKeyCache = void 0;
  {
    unexpectedKeyCache = {};
  }

  var shapeAssertionError = void 0;
  try {
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }

  return function combination() {
    var state =
      arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var action = arguments[1];

    if (shapeAssertionError) {
      throw shapeAssertionError;
    }

    {
      var warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      );
      if (warningMessage) {
        warning(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};
    for (var _i = 0; _i < finalReducerKeys.length; _i++) {
      var _key = finalReducerKeys[_i];
      var reducer = finalReducers[_key];
      var previousStateForKey = state[_key];
      var nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === "undefined") {
        var errorMessage = getUndefinedStateErrorMessage(_key, action);
        throw new Error(errorMessage);
      }
      nextState[_key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}

function bindActionCreator(actionCreator, dispatch) {
  return function() {
    return dispatch(actionCreator.apply(undefined, arguments));
  };
}

export function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === "function") {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== "object" || actionCreators === null) {
    throw new Error(
      "bindActionCreators expected an object or a function, instead received " +
        (actionCreators === null ? "null" : typeof actionCreators) +
        ". " +
        'Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?'
    );
  }

  var keys = Object.keys(actionCreators);
  var boundActionCreators = {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var actionCreator = actionCreators[key];
    if (typeof actionCreator === "function") {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}

export function compose() {
  for (
    var _len = arguments.length, funcs = Array(_len), _key = 0;
    _key < _len;
    _key++
  ) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function(arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(function(a, b) {
    return function() {
      return a(b.apply(undefined, arguments));
    };
  });
}

export function applyMiddleware() {
  for (
    var _len = arguments.length, middlewares = Array(_len), _key = 0;
    _key < _len;
    _key++
  ) {
    middlewares[_key] = arguments[_key];
  }

  return function(createStore) {
    return function(reducer, preloadedState, enhancer) {
      var store = createStore(reducer, preloadedState, enhancer);
      var _dispatch = store.dispatch;
      var chain = [];

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch(action) {
          return _dispatch(action);
        }
      };
      chain = middlewares.map(function(middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = compose.apply(undefined, chain)(store.dispatch);

      return Object.assign({}, store, {
        dispatch: _dispatch
      });
    };
  };
}
