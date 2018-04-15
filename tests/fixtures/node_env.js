export const a = () => {
  console.log("a");
};

if (process.env.NODE_ENV !== "production") {
  a();
}
