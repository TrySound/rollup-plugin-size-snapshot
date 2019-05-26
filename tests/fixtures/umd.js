var root;

if (typeof self !== "undefined") {
  root = self;
} else if (typeof window !== "undefined") {
  root = window;
} else if (typeof global$1 !== "undefined") {
  root = global$1;
} else if (typeof module !== "undefined") {
  root = module;
} else {
  root = Function("return this")();
}

export default "";
