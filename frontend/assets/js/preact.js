// Vendor bootstrap: expose a clean Preact + htm + hooks surface as ES exports.
// The UMD builds are loaded as classic scripts in index.html and attach to
// window.preact / window.preactHooks / window.htm.
const { h, render, Fragment } = window.preact;
const hooks = window.preactHooks;
const html = window.htm.bind(h);

export { h, render, Fragment, html };
export const {
  useState, useEffect, useMemo, useRef, useCallback, useReducer, useLayoutEffect,
} = hooks;
