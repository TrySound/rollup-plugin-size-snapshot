// @flow

export const isExternal = (id: string) =>
  !id.startsWith(".") && !id.startsWith("/");
